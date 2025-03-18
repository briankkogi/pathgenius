import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "./components/ThemeProvider"
import Header from "./components/Header"
import Footer from "./components/Footer"
import { ClientLayout } from "./components/ClientLayout"
import { FirebaseProvider } from "@/contexts/FirebaseContext"
import { Toaster } from "sonner"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PathGenius - AI-Powered Personalized Learning Paths",
  description:
    "Discover tailored learning experiences with PathGenius. Our AI curates the best educational resources to create personalized learning paths just for you.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <FirebaseProvider>
            <div className="flex flex-col min-h-screen">
              <Header />
              <ClientLayout>{children}</ClientLayout>
              <Footer />
            </div>
            <Toaster />
          </FirebaseProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

