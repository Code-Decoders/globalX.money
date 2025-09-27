"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useParams } from "next/navigation";

function formatAmount(value, currency = "USD") {
  const numeric = Number.parseFloat(String(value ?? 0));
  if (!Number.isFinite(numeric)) {
    return "—";
  }
  return `${currency === "USD" ? "$" : ""}${numeric.toFixed(2)}${currency === "USD" ? "" : ` ${currency}`}`;
}

export default function ClaimTransactionPage() {
  const { id } = useParams();

  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState("");

  const fetchTransaction = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/transactions/${id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load transaction");
      }
      setTransaction(data.transaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchTransaction();
  }, [fetchTransaction]);

  const isPending = transaction?.status === "PENDING";
  const isOnHold = transaction?.status === "ON_HOLD";

  const isExpired = useMemo(() => {
    if (!transaction?.claimExpiresAt) return false;
    const expires = new Date(transaction.claimExpiresAt);
    return !Number.isNaN(expires.getTime()) && expires.getTime() < Date.now();
  }, [transaction?.claimExpiresAt]);

  const claimDisabled = useMemo(() => {
    if (!isPending) return true;
    if (claiming) return true;
    if (isExpired) return true;
    return false;
  }, [claiming, isExpired, isPending]);

  const holdDisabled = useMemo(() => {
    if (!isPending) return true;
    if (claiming) return true;
    if (isExpired) return true;
    return false;
  }, [claiming, isExpired, isPending]);

  const handleAction = useCallback(
    async (action) => {
      setFeedback("");
      setFeedbackType("");
      setError("");
      setClaiming(true);
      try {
        const response = await fetch(`/api/transactions/${id}/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Failed to update transaction");
        }

        setTransaction(data.transaction ?? null);
        if (data?.message) {
          setFeedback(data.message);
          setFeedbackType("success");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to update transaction");
      } finally {
        setClaiming(false);
      }
    },
    [id],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading transaction…</p>
      </div>
    );
  }

  if (error && !transaction) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = transaction?.claimExpiresAt ? new Date(transaction.claimExpiresAt) : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Claim remittance</p>
            <h1 className="text-lg font-semibold">Review transfer details</h1>
          </div>

          <div className="rounded-[var(--radius-lg)] border border-primary/20 bg-primary/5 p-4">
            <p className="text-[11px] font-semibold uppercase text-primary">Keep your balance growing</p>
            <h2 className="text-base font-semibold text-primary">Earn a 4% Annual Reward Rate while you hold</h2>
            <p className="text-xs text-muted-foreground">
              Funds on hold continue to earn rewards daily, and you can withdraw them whenever you are ready.
            </p>
          </div>

          <Separator className="bg-border" />

          <div className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-card-foreground">Transfer</h2>
              <div className="rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs">
                <div className="flex items-center justify-between">
                  <span>Sender wallet</span>
                  <span className="font-semibold text-card-foreground">{transaction?.senderWallet ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Amount</span>
                  <span className="font-semibold text-card-foreground">
                    {formatAmount(transaction?.fromAmount, transaction?.currencyFrom)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Purpose</span>
                  <span className="font-semibold text-card-foreground">{transaction?.purpose ?? "—"}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
              <p className="text-sm font-semibold text-card-foreground">{transaction?.status}</p>
              {expiresAt ? (
                <p className="text-xs text-muted-foreground">
                  Claim before: {expiresAt.toLocaleString()}
                </p>
              ) : null}
            </div>

            {feedback ? (
              <p
                className={`rounded-full px-3 py-1 text-center text-[11px] font-semibold ${feedbackType === "success" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {feedback}
              </p>
            ) : null}

            {error ? (
              <p className="rounded-full bg-destructive/10 px-3 py-1 text-center text-[11px] font-semibold text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <div className="flex flex-col gap-2 sm:flex-row-reverse justify-between w-full">
            <Button
              onClick={() => handleAction("hold")}
              disabled={holdDisabled}
              className="w-full rounded-full sm:w-auto"
            >
              {claiming ? "Processing…" : "Keep earning 4% rewards"}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction("claim")}
              disabled={claimDisabled}
              className="w-full rounded-full sm:w-auto"
            >
              {claiming
                ? "Processing…"
                : isExpired
                  ? "Request expired"
                  : isPending
                    ? "Withdraw funds"
                    : isOnHold
                      ? "On hold"
                      : "Already claimed"}
            </Button>
          </div>
          {transaction?.quoteId ? (
            <p className="text-center text-[11px] text-muted-foreground">Quote: {transaction.quoteId}</p>
          ) : null}
          {isPending ? (
            <div className="space-y-1 text-center">
              <p className="text-[11px] font-semibold text-primary">Keep it parked, keep it growing.</p>
              <p className="text-[11px] text-muted-foreground">
                Holding your balance keeps rewards compounding at a 4% Annual Reward Rate until withdrawal.
              </p>
            </div>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}
