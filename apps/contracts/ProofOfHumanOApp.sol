// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { SelfVerificationRoot } from "@selfxyz/contracts/contracts/abstract/SelfVerificationRoot.sol";
import { ISelfVerificationRoot } from "@selfxyz/contracts/contracts/interfaces/ISelfVerificationRoot.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { SelfStructs } from "@selfxyz/contracts/contracts/libraries/SelfStructs.sol";
import { SelfUtils } from "@selfxyz/contracts/contracts/libraries/SelfUtils.sol";
import { IIdentityVerificationHubV2 } from "@selfxyz/contracts/contracts/interfaces/IIdentityVerificationHubV2.sol";


/**
 * @title ProofOfHumanOApp
 * @notice Self Protocol verification contract
 * @dev Extends SelfVerificationRoot for human verification
 */
contract ProofOfHumanOApp is SelfVerificationRoot, Ownable {
    // Storage for verification tracking

    mapping(uint256 => bool) public usedNullifier;
    mapping(address => bool) public verifiedHumans;
    mapping(address => VerificationData) public verificationData;
    bytes32 public verificationConfigId;
    SelfStructs.VerificationConfigV2 public verificationConfig;


    // Verification data structure
    struct VerificationData {
        address userAddress;
        bytes32 verificationConfigId;
        uint256 timestamp;
        string gender;
        string nationality;
        uint256 minimumAge;
    }

    event VerificationCompleted(
        address indexed userAddress,
        bytes32 indexed verificationConfigId,
        VerificationData data
    );

    /**
     * @notice Constructor for the ProofOfHumanOApp contract
     * @param _identityVerificationHubV2Address The address of the Identity Verification Hub V2
     * @param _scope The scope for verification
     * @param _verificationConfig The verification configuration ID
     * @param _owner The owner address for Self Protocol configuration
     */
    constructor(
        address _identityVerificationHubV2Address,
        string memory _scope,
        SelfUtils.UnformattedVerificationConfigV2 memory _verificationConfig,
        address _owner
    )
        SelfVerificationRoot(_identityVerificationHubV2Address, _scope)
        Ownable(_owner)
    {
        verificationConfig = SelfUtils.formatVerificationConfigV2(_verificationConfig);
        verificationConfigId =
            IIdentityVerificationHubV2(_identityVerificationHubV2Address).setVerificationConfigV2(verificationConfig);
    }

    /**
     * @notice Implementation of customVerificationHook
     * @dev Called after successful verification, stores data locally
     * @param _output The verification output from the hub
     * @param _userData The user data (expected to be the user address)
     */
    function customVerificationHook(
        ISelfVerificationRoot.GenericDiscloseOutputV2 memory _output,
        bytes memory _userData
    )
        internal
        override
    {
        address userAddress = address(uint160(_output.userIdentifier));

        // Store verification data locally
        usedNullifier[_output.nullifier] = true;
        verifiedHumans[userAddress] = true;

        // Store verification data
        VerificationData memory userData = VerificationData({
            userAddress: userAddress,
            verificationConfigId: verificationConfigId,
            timestamp: block.timestamp,
            gender: _output.gender,
            nationality: _output.nationality,
            minimumAge: _output.olderThan
        });

        verificationData[userAddress] = userData;

        emit VerificationCompleted(userAddress, verificationConfigId, userData);
    }

    /**
     * @notice Update verification config ID
     * @param configId New verification config ID
     */
    function setConfigId(bytes32 configId) external onlyOwner {
        verificationConfigId = configId;
    }

    /**
     * @notice Get verification config ID
     */
    function getConfigId(bytes32, bytes32, bytes memory) public view override returns (bytes32) {
        return verificationConfigId;
    }
}
