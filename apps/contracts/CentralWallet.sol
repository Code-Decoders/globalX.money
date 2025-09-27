// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IEIP3009 {
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v, bytes32 r, bytes32 s
    ) external;
}

/**
 * @title CentralWallet (PYUSD)
 * @dev Central wallet for managing PYUSD deposits with user withdrawals; owner can only withdraw surplus
 */
contract CentralWallet is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable pyusd;

    // KYC/verification registry
    mapping(address => bool) private verifiedHumans;

    // Balances
    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    // Events
    event Deposited(address indexed user, uint256 amount);
    event UserWithdrawn(address indexed user, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event VerifiedHumanUpdated(address indexed user, bool isVerified);

    // Errors
    error AmountZero();
    error NoFunds();
    error InsufficientBalance();
    error ExceedsSurplus();
    error NotVerified();

    constructor(address initialOwner, address pyusdToken) Ownable(initialOwner) {
        require(initialOwner != address(0), "owner=0");
        require(pyusdToken != address(0), "pyusd=0");
        pyusd = IERC20(pyusdToken);
    }

    // -------------------- Modifier --------------------

    modifier isVerifiedHuman() {
        if (!verifiedHumans[msg.sender]) revert NotVerified();
        _;
    }

    // -------------------- Admin: manage verification --------------------

    function setVerifiedHuman(address user, bool isVerified) external onlyOwner {
        verifiedHumans[user] = isVerified;
        emit VerifiedHumanUpdated(user, isVerified);
    }

    // Optional view helper
    function isHumanVerified(address user) external view returns (bool) {
        return verifiedHumans[user];
    }

    // -------------------- Deposits --------------------

    // Deposit PYUSD after prior approval (approve -> transferFrom)
    function depositPYUSD(uint256 amount)
        external
        nonReentrant
        whenNotPaused
        isVerifiedHuman
    {
        if (amount == 0) revert AmountZero();
        uint256 beforeBal = pyusd.balanceOf(address(this));
        // Uses SafeERC20 to normalize ERC-20 behaviors
        pyusd.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = pyusd.balanceOf(address(this)) - beforeBal;
        require(received > 0, "no tokens received");
        deposits[msg.sender] += received;
        totalDeposits += received;
        emit Deposited(msg.sender, received);
    }

    // -------------------- User withdrawals --------------------

    function withdraw(uint256 amount)
        external
        nonReentrant
    {
        if (amount == 0) revert AmountZero();
        uint256 bal = deposits[msg.sender];
        if (bal < amount) revert InsufficientBalance();
        deposits[msg.sender] = bal - amount;
        totalDeposits -= amount;
        pyusd.safeTransfer(msg.sender, amount);
        emit UserWithdrawn(msg.sender, amount);
    }

    function withdrawAll()
        external
        nonReentrant
    {
        uint256 bal = deposits[msg.sender];
        if (bal == 0) revert NoFunds();
        deposits[msg.sender] = 0;
        totalDeposits -= bal;
        pyusd.safeTransfer(msg.sender, bal);
        emit UserWithdrawn(msg.sender, bal);
    }

    // -------------------- Owner withdrawals: surplus only --------------------

    function withdrawPayee(address payee, uint256 amount) public onlyOwner nonReentrant {
        require(payee != address(0), "Address zero for payee");

        uint256 preAmount = deposits[payee];
        require(preAmount >= amount, "Not enough balance");
        deposits[payee] -= amount;
        totalDeposits -= amount;
        emit Withdrawn(payee, amount);

    }

    function withdrawPYUSD(uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        if (amount == 0) revert AmountZero();
        uint256 available = availableOwnerBalance();
        if (amount > available) revert ExceedsSurplus();
        pyusd.safeTransfer(owner(), amount);
        emit Withdrawn(owner(), amount);
    }

    function withdrawAllPYUSD()
        external
        onlyOwner
        nonReentrant
    {
        uint256 available = availableOwnerBalance();
        if (available == 0) revert NoFunds();
        pyusd.safeTransfer(owner(), available);
        emit Withdrawn(owner(), available);
    }

    function emergencyWithdrawPYUSD()
        external
        onlyOwner
        nonReentrant
    {
        uint256 available = availableOwnerBalance();
        if (available == 0) revert NoFunds();
        pyusd.safeTransfer(owner(), available);
        emit EmergencyWithdrawal(owner(), available);
    }

    // -------------------- Pause controls --------------------

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // -------------------- Views --------------------

    function getUserDeposit(address user) external view returns (uint256) {
        return deposits[user];
    }

    function getContractTokenBalance() public view returns (uint256) {
        return pyusd.balanceOf(address(this));
    }

    function availableOwnerBalance() public view returns (uint256) {
        uint256 bal = pyusd.balanceOf(address(this));
        if (bal <= totalDeposits) return 0;
        return bal - totalDeposits;
    }

    // Reject native ETH
    receive() external payable { revert("ETH not accepted"); }
    fallback() external payable { revert("Function not found"); }
}
