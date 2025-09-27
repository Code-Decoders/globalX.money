"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChainId, useAccount, useDisconnect, useSwitchChain, useReadContract, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { SEPOLIA_CHAIN_ID, CENTRAL_WALLET_ADDRESS, PYUSD_DECIMALS, PYUSD_TOKEN_ADDRESS } from "@/lib/constants";

const quote = {
  sendAmount: "1000.00",
  receiveAmount: "82140.57",
  fee: "$5.00",
  rate: "$1 = ₹82.56",
  eta: "~45 seconds",
};

export default function QuotePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const switchAttemptedRef = useRef(false);

  const isWrongChain = isConnected && chainId !== SEPOLIA_CHAIN_ID;

  // Central wallet ABI (views only)
  const centralWalletAbi = [
    {
      name: "getUserDeposit",
      type: "function",
      stateMutability: "view",
      inputs: [{ name: "user", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ];

  const userDepositRes = useReadContract({
    address: CENTRAL_WALLET_ADDRESS,
    abi: centralWalletAbi,
    functionName: "getUserDeposit",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address && !isWrongChain) },
  });
  const walletBalanceRes = useBalance({
    address,
    token: PYUSD_TOKEN_ADDRESS,
    chainId: SEPOLIA_CHAIN_ID,
    watch: true,
    query: { enabled: Boolean(address && !isWrongChain) },
  });

  const userDeposit = (() => {
    try {
      return userDepositRes.data ? Number(formatUnits(userDepositRes.data, PYUSD_DECIMALS)) : 0;
    } catch {
      return 0;
    }
  })();
  const walletBalance = (() => {
    try {
      return walletBalanceRes.data ? Number(formatUnits(walletBalanceRes.data.value, PYUSD_DECIMALS)) : 0;
    } catch {
      return 0;
    }
  })();

  const [sendAmount, setSendAmount] = useState(quote.sendAmount);

  const handleMax = useCallback(() => {
    if (!isConnected || isWrongChain) return;
    setSendAmount(walletBalance.toFixed(2));
  }, [isConnected, isWrongChain, walletBalance]);

  useEffect(() => {
    if (!isConnected) {
      switchAttemptedRef.current = false;
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

  const handleContinue = useCallback(async () => {
    if (!isConnected) {
      return;
    }

    if (isWrongChain) {
      try {
        await switchChainAsync?.({ chainId: SEPOLIA_CHAIN_ID });
      } catch (error) {
        console.error("Failed to switch network", error);
      }
      return;
    }

    router.push("/app/funds");
  }, [isConnected, isWrongChain, switchChainAsync, router]);

  return (
    <section className="flex w-full justify-end lg:flex-1">
      <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
        <CardContent className="space-y-6 px-6 pb-2">

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
                onChange={(event) => setSendAmount(event.target.value)}
                className="border-0 bg-transparent px-0 text-xl font-semibold text-card-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-full px-3 text-xs"
                onClick={handleMax}
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
                      Available balance: <span className="font-semibold text-card-foreground">${walletBalance.toFixed(2)}</span>
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
                  defaultValue={quote.receiveAmount}
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
              <span className="font-medium text-card-foreground">{quote.rate}</span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {quote.eta}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Transfer fee</span>
              <span className="font-semibold text-card-foreground">{quote.fee}</span>
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
                      void handleContinue();
                    }}
                  >
                    {!account
                      ? "Connect wallet to continue"
                      : isWrongChain
                      ? "Switching to Sepolia…"
                      : "Continue to recipient"}
                  </Button>

                  {connected ? (
                    <div className="flex items-center justify-between rounded-[var(--radius-lg)] border bg-muted px-4 py-2 text-xs text-muted-foreground">
                      <div className="flex flex-col">
                        <span className="font-semibold text-card-foreground">{account.displayName}</span>
                        <span>{chainLabel}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => disconnect()}
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="sr-only">Disconnect wallet</span>
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            }}
          </ConnectButton.Custom>
          <p className="text-center text-[11px] text-muted-foreground">
            Regulated transfers by PY Remit Labs LLC.
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
