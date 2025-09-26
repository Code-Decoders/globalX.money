import { ModeToggle } from "@/components/mode-toggle";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

export default function Template({ children }) {
    const currentYear = new Date().getFullYear();

    const valueProps = [
        {
            title: "0 hidden fees",
            description: "Every quote shows your service fee before you send.",
        },
        {
            title: "Guaranteed delivery",
            description: "95% of transfers arrive within seconds in India.",
        },
    ];

    const statusPills = [
        {
            label: "Real-time compliance screening",
            dotClass: "bg-primary",
        },
        {
            label: "Wallet-to-bank in one flow",
            dotClass: "bg-secondary",
        },
    ];
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground">
            <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8">
                <div className="text-lg font-semibold tracking-tight">PY Remit</div>
                <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
                    <a className="transition-colors hover:text-foreground" href="#">
                        Product
                    </a>
                    <a className="transition-colors hover:text-foreground" href="#">
                        Exchange rates
                    </a>
                    <a className="transition-colors hover:text-foreground" href="#">
                        Help
                    </a>
                </nav>
                <ModeToggle />
            </header>

            <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-6 pb-16 lg:flex-row lg:items-center">
                <section className="max-w-xl space-y-6 flex-1">
                    <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                        Send money to India in seconds with transparent pricing.
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Top up your wallet with PYUSD and deliver local INR directly to bank accounts. Lock in live rates, see fees upfront, and move value globally without the friction.
                    </p>
                    <div className="grid gap-4 text-sm sm:grid-cols-2">
                        {valueProps.map((value) => (
                            <Card key={value.title}>
                                <CardContent className="space-y-2 px-5 py-4">
                                    <CardTitle className="text-base">{value.title}</CardTitle>
                                    <CardDescription className="text-xs">
                                        {value.description}
                                    </CardDescription>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        {statusPills.map((pill) => (
                            <span key={pill.label} className="flex items-center gap-2">
                                <span className={`inline-flex h-2 w-2 rounded-full ${pill.dotClass}`} />
                                {pill.label}
                            </span>
                        ))}
                    </div>
                </section>
                {children}
            </main>

            <footer className="mx-auto w-full max-w-6xl px-6 pb-10 text-xs text-muted-foreground">
                <p>
                    © {currentYear} PY Remit Labs LLC · Licensed money transmitter · Transfers powered by PYUSD.
                </p>
            </footer>
        </div>
    );
}
