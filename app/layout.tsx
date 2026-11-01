import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ArborPulse — Read the rhythm of a tree",
  description: "Turn a short video into measurable tree motion and an inspection evidence brief. Built for the Meta Global AI Developer Hackathon.",
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" }, manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ArborPulse", statusBarStyle: "default" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
