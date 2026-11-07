import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrowthX MCP — add SF events to your agent",
  description:
    "Events discovery for SF founders and builders, delivered as a public MCP server for Claude, Cursor, and ChatGPT.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
