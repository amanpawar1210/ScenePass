import type { Metadata } from "next";
import "./globals.css";
import "./enhancements.css";
import "./product.css";
import "./redesign.css";

export const metadata: Metadata = {
  title: "ScenePass — Live entertainment, together",
  description: "Discover live events, choose seats together, split payments and carry every ticket in one place.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
