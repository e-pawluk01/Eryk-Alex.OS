import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalContextProvider } from "@/components/global-context";
import { ContextSwitcher } from "@/components/context-switcher";
import { AuthGuard } from "@/components/auth-guard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Task OS",
  description: "Task and productivity app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <AuthGuard>
          <GlobalContextProvider>
            <div className="min-h-screen flex flex-col">
              <header className="flex items-center justify-between p-4 sticky top-0 bg-background/80 backdrop-blur-md z-50 border-b border-border/50">
                <nav className="flex items-center gap-6 px-4">
                  <a href="/" className="text-sm font-medium tracking-widest uppercase hover:text-primary transition-colors">Home</a>
                  <a href="/tasks" className="text-sm font-medium tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors">Tasks</a>
                </nav>
                <ContextSwitcher />
              </header>
              <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
                {children}
              </main>
            </div>
          </GlobalContextProvider>
        </AuthGuard>
      </body>
    </html>
  );
}
