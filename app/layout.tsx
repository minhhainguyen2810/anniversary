import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anniversary — The days worth celebrating",
  description: "A private shared calendar for anniversaries and every 100-day milestone.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
