"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatUnits, parseUnits } from "viem";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FlowSteps } from "@/components/flow-steps";
import {
  CENTRAL_WALLET_ADDRESS,
  PYUSD_DECIMALS,
  PYUSD_TOKEN_ADDRESS,
  SEPOLIA_CHAIN_ID,
} from "@/lib/constants";

const erc20Abi = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

const centralWalletAbi = [
  {
    name: "depositPYUSD",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
];

export default function FundsPage() {
  const router = useRouter();
  const { isConnected, address, chainId } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { writeContractAsync } = useWriteContract();
  const [pyusdAmount, setPyusdAmount] = useState("100");
  const [feedback, setFeedback] = useState("");
  const [approvalHash, setApprovalHash] = useState();
  const [depositHash, setDepositHash] = useState();
  const [approving, setApproving] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [autoDeposited, setAutoDeposited] = useState(false);

  const { data: pyusdBalance } = useBalance({
    address,
    token: PYUSD_TOKEN_ADDRESS,
    chainId: SEPOLIA_CHAIN_ID,
    watch: true,
    enabled: Boolean(address),
  });

  const walletBalance = useMemo(() => {
    if (!pyusdBalance) return 0;
    return Number(formatUnits(pyusdBalance.value, PYUSD_DECIMALS));
  }, [pyusdBalance]);

  const { data: allowance = 0n, refetch: refetchAllowance } = useReadContract({
    address: PYUSD_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CENTRAL_WALLET_ADDRESS] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: {
      enabled: Boolean(address),
    },
  });

  const approvalReceipt = useWaitForTransactionReceipt({ hash: approvalHash, chainId: SEPOLIA_CHAIN_ID });
  const depositReceipt = useWaitForTransactionReceipt({ hash: depositHash, chainId: SEPOLIA_CHAIN_ID });

  const tokenAddressMasked = useMemo(
    () => `${PYUSD_TOKEN_ADDRESS.slice(0, 6)}••••${PYUSD_TOKEN_ADDRESS.slice(-4)}`,
    []
  );

  const treasuryAddressMasked = useMemo(
    () => `${CENTRAL_WALLET_ADDRESS.slice(0, 6)}••••${CENTRAL_WALLET_ADDRESS.slice(-4)}`,
    []
  );

  const amountBigInt = useMemo(() => {
    if (!pyusdAmount) return 0n;
    try {
      return parseUnits(pyusdAmount, PYUSD_DECIMALS);
    } catch (error) {
      return 0n;
    }
  }, [pyusdAmount]);

  const needsApproval = allowance < amountBigInt;
  const isApprovalPending = Boolean(approvalHash) && approvalReceipt.status === "pending";
  const isDepositPending = Boolean(depositHash) && depositReceipt.status === "pending";

  const [approvalError, setApprovalError] = useState("");
  const [depositError, setDepositError] = useState("");

  const requireConnection = useCallback(() => {
    if (!isConnected) {
      openConnectModal?.();
      return true;
    }
    if (chainId !== SEPOLIA_CHAIN_ID) {
      setFeedback("Switch to Sepolia before funding.");
      setTimeout(() => setFeedback(""), 2500);
      return true;
    }
    return false;
  }, [chainId, isConnected, openConnectModal]);

  const applyPercent = useCallback(
    (percent) => {
      if (!walletBalance) return;
      const value = (walletBalance * percent).toFixed(2);
      setPyusdAmount(value);
    },
    [walletBalance]
  );

  const handleCopy = useCallback(async (value, message) => {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(message);
      setTimeout(() => setFeedback(""), 2000);
    } catch (error) {
      setFeedback("Copy failed. Please copy manually.");
      setTimeout(() => setFeedback(""), 2500);
    }
  }, []);

  const handleApprove = useCallback(async () => {
    if (requireConnection()) return;
    if (amountBigInt === 0n) {
      setFeedback("Enter an amount first.");
      setTimeout(() => setFeedback(""), 2000);
      return;
    }
    try {
      setApproving(true);
      setApprovalError("");
      const hash = await writeContractAsync({
        address: PYUSD_TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [CENTRAL_WALLET_ADDRESS, amountBigInt],
        chainId: SEPOLIA_CHAIN_ID,
      });
      setApprovalHash(hash);
      setFeedback("Approval submitted…");
      setTimeout(() => setFeedback(""), 2000);
    } catch (error) {
      console.error(error);
      const msg = error?.shortMessage || error?.message || "Approval failed";
      setFeedback(msg);
      setApprovalError(msg);
      setTimeout(() => setFeedback(""), 2500);
    } finally {
      setApproving(false);
    }
  }, [amountBigInt, requireConnection, writeContractAsync]);

  const handleDeposit = useCallback(async () => {
    if (requireConnection()) return;
    if (amountBigInt === 0n) {
      setFeedback("Enter an amount first.");
      setTimeout(() => setFeedback(""), 2000);
      return;
    }
    if (needsApproval) {
      setFeedback("Approve the settlement token before depositing.");
      setTimeout(() => setFeedback(""), 2500);
      return;
    }
    try {
      setDepositing(true);
      setDepositError("");
      const hash = await writeContractAsync({
        address: CENTRAL_WALLET_ADDRESS,
        abi: centralWalletAbi,
        functionName: "depositPYUSD",
        args: [amountBigInt],
        chainId: SEPOLIA_CHAIN_ID,
      });
      setDepositHash(hash);
      setFeedback("Deposit submitted…");
      setTimeout(() => setFeedback(""), 2000);
    } catch (error) {
      console.error(error);
      const msg = error?.shortMessage || error?.message || "Deposit failed";
      setFeedback(msg);
      setDepositError(msg);
      setTimeout(() => setFeedback(""), 2500);
    } finally {
      setDepositing(false);
    }
  }, [amountBigInt, needsApproval, requireConnection, writeContractAsync]);

  useEffect(() => {
    if (approvalReceipt.status === "success") {
      setFeedback("Approval confirmed.");
      (async () => {
        await refetchAllowance();
        setTimeout(() => setFeedback(""), 500);
        if (!autoDeposited) {
          setAutoDeposited(true);
          await handleDeposit();
        }
      })();
    } else if (approvalReceipt.status === "error") {
      setFeedback("Approval failed. Try again.");
      setApprovalError("Approval transaction reverted or not found on Sepolia.");
      setTimeout(() => setFeedback(""), 2000);
    }
  }, [approvalReceipt.status, refetchAllowance, autoDeposited, handleDeposit]);

  useEffect(() => {
    if (depositReceipt.status === "success") {
      setFeedback("Funds deposited.");
      setTimeout(() => setFeedback(""), 2000);
      router.push("/app/recipient");
    } else if (depositReceipt.status === "error") {
      setFeedback("Deposit failed. Try again.");
      setDepositError("Deposit transaction reverted or not found on Sepolia.");
      setTimeout(() => setFeedback(""), 2000);
    }
  }, [depositReceipt.status, router]);

  const pendingMessage = useMemo(() => {
    if (isApprovalPending && approvalHash) {
      return `Processing on Sepolia… Tx: ${approvalHash.slice(0, 10)}…`;
    }
    if (isDepositPending && depositHash) {
      return `Processing on Sepolia… Tx: ${depositHash.slice(0, 10)}…`;
    }
    return "";
  }, [isApprovalPending, isDepositPending, approvalHash, depositHash]);

  const anomalyMessage = useMemo(() => {
    // If a watcher reports pending but we do not have a tx hash, explain why.
    const approvalAnomaly = approvalReceipt.status === "pending" && !approvalHash;
    const depositAnomaly = depositReceipt.status === "pending" && !depositHash;
    if (approvalAnomaly) return "Approval watcher pending without a transaction — click the button to start approval.";
    if (depositAnomaly) return "Deposit watcher pending without a transaction — click the button to start deposit.";
    return "";
  }, [approvalReceipt.status, depositReceipt.status, approvalHash, depositHash]);

  const handleApproveAndDeposit = useCallback(async () => {
    if (requireConnection()) return;
    if (amountBigInt === 0n) {
      setFeedback("Enter an amount first.");
      setTimeout(() => setFeedback(""), 2000);
      return;
    }
    setAutoDeposited(false);
    if (needsApproval) {
      await handleApprove();
    } else {
      await handleDeposit();
    }
  }, [requireConnection, amountBigInt, needsApproval, handleApprove, handleDeposit]);

  return (
    <section className="flex w-full justify-end lg:flex-1">
      <Card className="w-full shadow-lg sm|max-w-md md:max-w-md">
        <CardContent className="space-y-6 px-6 pb-2">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full border">
              <Link href="/app">←</Link>
            </Button>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">Fund account</h1>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Settlement token (Sepolia)
            </Label>
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border bg-muted px-4 py-3">
              <div className="flex flex-1 flex-col">
                <span className="font-mono text-sm text-card-foreground">{tokenAddressMasked}</span>
                <span className="text-[11px] text-muted-foreground">Tap copy to add the settlement token (PYUSD) to your wallet.</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleCopy(PYUSD_TOKEN_ADDRESS, "Token address copied") }>
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fund-amount" className="text-xs font-semibold uppercase text-muted-foreground">
              Amount to send (settlement token)
            </Label>
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-muted px-4 py-3">
              <Input
                id="fund-amount"
                type="number"
                min="0"
                step="0.01"
                value={pyusdAmount}
                onChange={(event) => setPyusdAmount(event.target.value)}
                className="border-0 bg-transparent px-0 text-xl font-semibold text-card-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {[0.25, 0.5, 0.75, 1].map((pct) => (
                <Button
                  key={pct}
                  variant="outline"
                  size="sm"
                  className="rounded-full border-border/60"
                  onClick={() => applyPercent(pct)}
                >
                  {pct === 1 ? "Max" : `${pct * 100}%`}
                </Button>
              ))}
            </div>
            {isConnected ? (
              <p className="text-xs font-semibold text-primary">
                Settlement balance: {walletBalance.toFixed(2)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground">
            <p className="font-semibold text-card-foreground">Funding checklist</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Switch wallet to Sepolia.</li>
              <li>Add the settlement token (PYUSD) if hidden ({tokenAddressMasked}).</li>
              <li>Keep a little ETH for gas fees.</li>
            </ol>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 px-6 pb-6">
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={handleApproveAndDeposit}
            disabled={
              !isConnected ||
              amountBigInt === 0n ||
              approving ||
              depositing ||
              isApprovalPending ||
              isDepositPending
            }
          >
            {approving || depositing || isApprovalPending || isDepositPending
              ? "Depositing…"
              : "Deposit"}
          </Button>
          {pendingMessage ? (
            <p className="text-center text-[11px] text-muted-foreground">{pendingMessage}</p>
          ) : null}
          {anomalyMessage ? (
            <p className="text-center text-[11px] text-destructive">{anomalyMessage}</p>
          ) : null}
          {approvalError ? (
            <p className="text-center text-[11px] text-destructive">{approvalError}</p>
          ) : null}
          {depositError ? (
            <p className="text-center text-[11px] text-destructive">{depositError}</p>
          ) : null}
          {feedback ? (
            <p className="text-center text-[11px] text-muted-foreground">{feedback}</p>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
