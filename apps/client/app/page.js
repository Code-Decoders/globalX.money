import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const steps = [
  {
    title: "1. Get a quote",
    href: "/app",
    description: "Lock in live FX and fees before you send.",
  },
  {
    title: "2. Add funds",
    href: "/app/funds",
    description: "Top up PYUSD on Sepolia using the treasury contract.",
  },
  {
    title: "3. Send remittance",
    href: "/app",
    description: "Finalize recipient details and launch the transfer.",
  },
];

export default function HomeLanding() {
  return (
    <section className="flex w-full justify-end lg:flex-1">
      <Card className="w-full shadow-lg sm:max-w-md md:max-w-md">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">PY Remit</p>
          <CardTitle className="text-2xl">Move PYUSD globally in three steps</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Follow the flow to quote, fund, and send money to India with complete transparency.
          </p>
          <Separator className="bg-border" />
          <div className="space-y-3">
            {steps.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="block rounded-[var(--radius-lg)] border bg-muted px-4 py-3 text-left transition hover:bg-muted/80"
              >
                <p className="text-sm font-semibold text-card-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-6">
          <Button asChild size="lg" className="w-full rounded-full">
            <Link href="/app">Start a quote</Link>
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Need Sepolia PYUSD? Add funds in step two before sending.
          </p>
        </CardFooter>
      </Card>
    </section>
  );
}
