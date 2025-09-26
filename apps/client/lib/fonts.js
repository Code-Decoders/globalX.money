import { Nunito, PT_Serif, JetBrains_Mono } from "next/font/google";

export const fontSans = Nunito({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
  weight: ["400", "700"],
});
export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
  weight: ["400", "700"],
});

export const fontSerif = PT_Serif({
  subsets: ["latin"],
  variable: "--font-geist-serif",
  display: "swap",
  weight: ["400", "700"],
});
