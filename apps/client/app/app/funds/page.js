"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useBalance } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FlowSteps } from "@/components/flow-steps";

const CONTRACT_ADDRESS = "0xCaC524BcA292aaade2DF8A05cC58F0a65B1B3bB9";

export default function FundsPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [pyusdAmount, setPyusdAmount] = useState("100");
  const [feedback, setFeedback] = useState("");

  const { data: pyusdBalance } = useBalance({
    address,
    token: CONTRACT_ADDRESS,
    chainId: 11155111,
    watch: true,
    enabled: Boolean(address),
  });

  const maxAmount = useMemo(() => {
    if (!pyusdBalance) return 0;
    const numeric = Number(pyusdBalance.formatted ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }, [pyusdBalance]);

  const formattedAddress = useMemo(
    () => `${CONTRACT_ADDRESS.slice(0, 6)}••••${CONTRACT_ADDRESS.slice(-4)}`,
    []
  );

  const handleCopyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setFeedback("Contract address copied");
      setTimeout(() => setFeedback(""), 2000);
    } catch (error) {
      setFeedback("Copy failed. Please copy manually.");
      setTimeout(() => setFeedback(""), 2500);
    }
  }, []);

  const handleAddFunds = useCallback(() => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    setFeedback("Smart contract funding coming soon.");
    setTimeout(() => setFeedback(""), 1500);
    router.push("/app/recipient");
  }, [isConnected, openConnectModal, router]);

  const applyPercent = useCallback(
    (percent) => {
      if (!maxAmount) return;
      const value = (maxAmount * percent).toFixed(2);
      setPyusdAmount(value);
    },
    [maxAmount]
  );

  return (
    <section className="flex w-full justify-end lg:flex-1">
      <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
        <CardContent className="space-y-6 px-6 pb-2">

          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full border">
              <Link href="/app">←</Link>
            </Button>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Flow</p>
              <h1 className="text-lg font-semibold">Fund account</h1>
            </div>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Sepolia PYUSD contract
            </Label>
            <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border bg-muted px-4 py-3">
              <div className="flex flex-1 flex-col">
                <span className="font-mono text-sm text-card-foreground">{formattedAddress}</span>
                <span className="text-[11px] text-muted-foreground">Tap copy to use in your wallet</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyAddress}>
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fund-amount" className="text-xs font-semibold uppercase text-muted-foreground">
              Amount to send (PYUSD)
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
                Wallet balance: {maxAmount.toFixed(2)} PYUSD
              </p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground">
            <p className="font-semibold text-card-foreground">Funding checklist</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Switch wallet to Sepolia.</li>
              <li>Add PYUSD token if hidden ({formattedAddress}).</li>
              <li>Keep a little ETH for gas fees.</li>
            </ol>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-4 px-6 pb-6">
          <ConnectButton.Custom>
            {({ account, openConnectModal: open }) => (
              <Button
                size="lg"
                className="w-full rounded-full"
                onClick={() => {
                  if (!account) {
                    open?.();
                    return;
                  }
                  handleAddFunds();
                }}
              >
                {account ? "Prepare funding" : "Connect wallet"}
              </Button>
            )}
          </ConnectButton.Custom>
          {feedback ? (
            <p className="text-center text-[11px] text-muted-foreground">{feedback}</p>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
