"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from "wagmi";
import { formatUnits } from "viem";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FundCard } from "@/components/fund-card";
import { RecipientStageCard } from "@/components/recipient-stage-card";
import { FlowSteps } from "@/components/flow-steps";
import { SEPOLIA_CHAIN_ID, CENTRAL_WALLET_ADDRESS, PYUSD_DECIMALS, PYUSD_TOKEN_ADDRESS } from "@/lib/constants";

const quoteDefaults = {
  sendAmount: "1000.00",
  receiveAmount: "82140.57",
  fee: "$5.00",
  rate: "$1 = ₹82.56",
  eta: "~45 seconds",
};

const STAGES = {
  QUOTE: "quote",
  FUND: "fund",
  RECIPIENT: "recipient",
};

const centralWalletAbi = [
  {
    name: "getUserDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

export default function QuotePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const switchAttemptedRef = useRef(false);

  const [stage, setStage] = useState(STAGES.QUOTE);
  const [sendAmount, setSendAmount] = useState(quoteDefaults.sendAmount);

  const isWrongChain = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  const {
    data: userDepositRaw,
    refetch: refetchDeposit,
  } = useReadContract({
    address: CENTRAL_WALLET_ADDRESS,
    abi: centralWalletAbi,
    functionName: "getUserDeposit",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address && !isWrongChain) },
  });

  const { data: walletBalanceRaw } = useBalance({
    address,
    token: PYUSD_TOKEN_ADDRESS,
    chainId: SEPOLIA_CHAIN_ID,
    watch: true,
    query: { enabled: Boolean(address && !isWrongChain) },
  });

  const userDeposit = useMemo(() => {
    try {
      return userDepositRaw ? Number(formatUnits(userDepositRaw, PYUSD_DECIMALS)) : 0;
    } catch {
      return 0;
    }
  }, [userDepositRaw]);

  const walletBalance = useMemo(() => {
    try {
      return walletBalanceRaw ? Number(formatUnits(walletBalanceRaw.value, PYUSD_DECIMALS)) : 0;
    } catch {
      return 0;
    }
  }, [walletBalanceRaw]);

  const sendAmountNumber = useMemo(() => {
    const value = Number(sendAmount);
    return Number.isFinite(value) ? value : 0;
  }, [sendAmount]);

  useEffect(() => {
    if (!isConnected) {
      switchAttemptedRef.current = false;
      setStage(STAGES.QUOTE);
      return;
    }

    if (isWrongChain && !switchAttemptedRef.current) {
      switchAttemptedRef.current = true;
      switchChainAsync?.({ chainId: SEPOLIA_CHAIN_ID }).catch((error) => {
        console.error("Automatic chain switch failed", error);
        switchAttemptedRef.current = false;
      });
    } else if (!isWrongChain) {
      switchAttemptedRef.current = false;
    }
  }, [isConnected, isWrongChain, switchChainAsync]);

  const handleMax = useCallback(() => {
    if (!isConnected || isWrongChain) return;
    setSendAmount(walletBalance.toFixed(2));
  }, [isConnected, isWrongChain, walletBalance]);

  const handleQuoteContinue = useCallback(
    async (options = { ensureChain: false }) => {
      if (!isConnected) return;

      if (isWrongChain) {
        try {
          await switchChainAsync?.({ chainId: SEPOLIA_CHAIN_ID });
        } catch (error) {
          console.error("Failed to switch network", error);
        }
        return;
      }

      if (userDeposit >= sendAmountNumber && sendAmountNumber > 0) {
        setStage(STAGES.RECIPIENT);
        void refetchDeposit();
      } else {
        setStage(STAGES.FUND);
      }
    },
    [isConnected, isWrongChain, refetchDeposit, sendAmountNumber, switchChainAsync, userDeposit]
  );

  const handleFundSuccess = useCallback(() => {
    void refetchDeposit();
    setStage(STAGES.RECIPIENT);
  }, [refetchDeposit]);

  const handleRecipientBack = useCallback(() => {
    if (userDeposit >= sendAmountNumber) {
      setStage(STAGES.QUOTE);
    } else {
      setStage(STAGES.FUND);
    }
  }, [sendAmountNumber, userDeposit]);

  return (
    <section className="flex w-full justify-end lg:flex-1">
      {stage === STAGES.QUOTE ? (
        <QuoteStageCard
          sendAmount={sendAmount}
          onSendAmountChange={setSendAmount}
          onMax={handleMax}
          walletBalance={walletBalance}
          userDeposit={userDeposit}
          isConnected={isConnected}
          isWrongChain={isWrongChain}
          onContinue={handleQuoteContinue}
          disconnect={disconnect}
        />
      ) : stage === STAGES.FUND ? (
        <FundCard
          showSteps
          initialAmount={sendAmount}
          onBack={() => setStage(STAGES.QUOTE)}
          onSuccess={handleFundSuccess}
        />
      ) : (
        <RecipientStageCard
          showSteps
          onBack={handleRecipientBack}
          onRecipientSelected={(recipient) => {
            console.log("Recipient selected", recipient);
          }}
        />
      )}
    </section>
  );
}

function QuoteStageCard({
  sendAmount,
  onSendAmountChange,
  onMax,
  walletBalance,
  userDeposit,
  isConnected,
  isWrongChain,
  onContinue,
  disconnect,
}) {
  return (
    <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
      <CardContent className="space-y-6 px-6 pb-2">
        <FlowSteps current={1} />

        <div className="space-y-2">
          <Label htmlFor="send-amount" className="text-xs font-semibold uppercase text-muted-foreground">
            You send
          </Label>
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-muted px-4 py-3">
            <Input
              id="send-amount"
              type="number"
              value={sendAmount}
              min="0"
              onChange={(event) => onSendAmountChange(event.target.value)}
              className="border-0 bg-transparent px-0 text-xl/ar font-semibold text-card-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full px-3 text-xs"
              onClick={onMax}
              disabled={!isConnected || isWrongChain || walletBalance === 0}
            >
              Max
            </Button>
            <div className="flex flex-col items-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-secondary/50 px-3 py-1 text-[11px] font-semibold text-secondary-foreground">
              <span>PYUSD</span>
            </div>
          </div>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {isConnected ? (
              isWrongChain ? (
                <p>Switch to Sepolia to view balances.</p>
              ) : (
                <>
                  <p>
                    Available balance: <span className="font-semibold text-card-foreground">{walletBalance.toFixed(2)} PYUSD</span>
                  </p>
                  <p>
                    Deposited with us: <span className="font-semibold text-card-foreground">{userDeposit.toFixed(2)} PYUSD</span>
                  </p>
                </>
              )
            ) : (
              <p>Connect your wallet to view balances.</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="receive-amount" className="text-xs font-semibold uppercase text-muted-foreground">
            They receive
          </Label>
          <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border bg-background px-4 py-3">
            <div className="flex flex-1 items-center gap-2">
              <span className="text-lg font-semibold text-muted-foreground">₹</span>
              <Input
                id="receive-amount"
                type="number"
                min="0"
                defaultValue={quoteDefaults.receiveAmount}
                className="border-0 bg-transparent px-0 text-xl font-semibold text-card-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
            </div>
            <div className="ml-auto flex flex-col items-end gap-1 rounded-[var(--radius-lg)] bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              <span>INR</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span className="font-medium text-card-foreground">{quoteDefaults.rate}</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {quoteDefaults.eta}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Transfer fee</span>
            <span className="font-semibold text-card-foreground">{quoteDefaults.fee}</span>
          </div>
          <ul className="space-y-1 pt-1 text-[10px]">
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Compliance checks run in real time
            </li>
            <li className="flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-secondary-foreground/40" />
              Rate holds for 30 minutes
            </li>
          </ul>
          {isWrongChain ? (
            <p className="rounded-full bg-destructive/10 px-3 py-1 text-center text-[11px] font-semibold text-destructive">
              Switch to Sepolia to continue
            </p>
          ) : null}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 px-6 pb-6">
        <ConnectButton.Custom>
          {({ account, chain, openConnectModal: open, mounted }) => {
            const connected = mounted && account;
            const chainLabel = chain?.id === SEPOLIA_CHAIN_ID ? "Sepolia" : "Wrong network";

            return (
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full rounded-full"
                  onClick={() => {
                    if (!account) {
                      open?.();
                      return;
                    }
                    void onContinue();
                  }}
                >
                  {!account
                    ? "Connect wallet to continue"
                    : isWrongChain
                    ? "Switching to Sepolia…"
                    : "Continue"}
                </Button>

                {connected ? (
                  <div className="flex items-center justify-between rounded-[var(--radius-lg)] border bg-muted px-4 py-2 text-xs text-muted-foreground">
                    <div className="flex flex-col">
                      <span className="font-semibold text-card-foreground">{account.displayName}</span>
                      <span>{chainLabel}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => disconnect()}>
                      <LogOut className="h-4 w-4" />
                      <span className="sr-only">Disconnect wallet</span>
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          }}
        </ConnectButton.Custom>
        <p className="text-center text-[11px] text-muted-foreground">Regulated transfers by PY Remit Labs LLC.</p>
      </CardFooter>
    </Card>
  );
}
