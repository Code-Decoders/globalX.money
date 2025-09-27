import { fontMono, fontSans } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata = {
  title: "GlobalX.money",
  description: "GlobalX.money delivers compliant, instant cross-border remittances with total transparency.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn("bg-background text-foreground font-sans antialiased", fontSans.variable, fontMono.variable)}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
