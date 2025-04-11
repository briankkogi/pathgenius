"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DarkModeToggle } from "./DarkModeToggle"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"

export default function Header() {
  const pathname = usePathname()
  const [isSignedIn, setIsSignedIn] = useState(false)

  useEffect(() => {
    // Check if the user is signed in
    setIsSignedIn(pathname.startsWith("/dashboard") || pathname.startsWith("/course") || pathname === "/onboarding")
  }, [pathname])

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (section) {
      section.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <header className="bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-50 py-4">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link
          href={pathname.startsWith("/dashboard") || pathname.startsWith("/course") ? "/dashboard" : "/"}
          className="text-2xl font-bold text-primary"
        >
          PathGenius
        </Link>
        <nav className="hidden md:flex space-x-6">
          {pathname === "/" && (
            <>
              <button
                onClick={() => scrollToSection("features")}
                className="text-foreground hover:text-primary transition-colors"
              >
                Features
              </button>
              <button
                onClick={() => scrollToSection("how-it-works")}
                className="text-foreground hover:text-primary transition-colors"
              >
                How It Works
              </button>
            </>
          )}
        </nav>
        <div className="flex items-center space-x-4">
          <DarkModeToggle />
          {isSignedIn ? (
            <Button asChild variant="outline">
              <Link href="/">Sign Out</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

