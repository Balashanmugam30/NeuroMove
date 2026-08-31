import type { Metadata } from "next";
import "./globals.css";
import { ModeProvider } from "@/components/providers/ModeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "NeuroMove — Real-Time BCI Mobility Platform",
  description:
    "Research-grade real-time motor-imagery EEG mobility command station and safety platform.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        <QueryProvider>
          <ModeProvider>
            <AppShell>{children}</AppShell>
          </ModeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
