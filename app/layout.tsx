import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { GlobalContextProvider } from "@/components/global-context";
import { Navbar } from "@/components/navbar";
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
            <div className="min-h-screen flex flex-col pt-24">
              <Navbar />
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
