import type { Metadata } from "next";
import "./globals.css";
import { ModeProvider } from "@/components/providers/ModeProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { RealtimeProvider } from "@/components/providers/RealtimeProvider";
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
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen font-sans">
        <QueryProvider>
          <ModeProvider>
            <RealtimeProvider>
              <AppShell>{children}</AppShell>
            </RealtimeProvider>
          </ModeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

