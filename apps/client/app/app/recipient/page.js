"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FlowSteps } from "@/components/flow-steps";

export default function RecipientListPage() {
  const { address, isConnected } = useAccount();
  const [recipients, setRecipients] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isConnected || !address) {
      setRecipients([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      setStatus("loading");
      try {
        const response = await fetch(`/api/recipients?walletAddress=${address}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to fetch recipients");
        }
        const data = await response.json();
        setRecipients(data.recipients ?? []);
        setStatus("success");
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error(err);
        setError("Unable to load recipients");
        setStatus("error");
      }
    };

    load();
    return () => controller.abort();
  }, [address, isConnected]);

  return (
    <section className="flex w-full justify-end lg:flex-1">
      <Card className="w-full max-h-[700px] overflow-auto shadow-lg sm:max-w-md md:max-w-md">
        <CardContent className="space-y-6 px-6 pb-2">

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Recipients</p>
              <h1 className="text-lg font-semibold">Saved payees</h1>
            </div>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/app/recipient/add">Add</Link>
            </Button>
          </div>

          <Separator className="bg-border" />

          {!isConnected ? (
            <p className="text-sm text-muted-foreground">
              Connect your wallet to view recipients linked to this address.
            </p>
          ) : status === "loading" ? (
            <p className="text-sm text-muted-foreground">Loading recipients…</p>
          ) : status === "error" ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : recipients.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recipients saved yet. Add one to reuse bank details quickly.
            </p>
          ) : (
            <ul className="space-y-3">
              {recipients.map((recipient) => (
                <li
                  key={recipient.id}
                  className="rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-xs text-muted-foreground"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-card-foreground">
                      {recipient.type === "INDIVIDUAL"
                        ? [recipient.firstName, recipient.lastName].filter(Boolean).join(" ") || "Individual"
                        : recipient.businessName || "Business"}
                    </span>
                    <span className="text-[11px] uppercase text-primary">
                      {recipient.accountType}
                    </span>
                  </div>
                  <div className="mt-1 grid gap-1 text-[11px]">
                    <span>{recipient.bankName}</span>
                    <span>Account: {recipient.accountNumber}</span>
                    <span>IFSC: {recipient.ifsc}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Button asChild size="lg" className="w-full rounded-full" disabled={!isConnected}>
            <Link href="/app/recipient/add">Add new recipient</Link>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Recipients are stored by wallet address. Switch wallets to view others.
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
