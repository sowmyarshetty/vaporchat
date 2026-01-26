import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sowmya Vapor Chat",
  description:
    "Ephemeral virtual chat rooms. Create, share, and converse—no history stored.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
