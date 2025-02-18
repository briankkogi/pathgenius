"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Link as ScrollLink } from "react-scroll"

export default function Hero() {
  const ctaRef = useRef(null)

  return (
    <section className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center">
      <div className="text-center px-4 sm:px-6 lg:px-8">
        <div className="bg-background/80 backdrop-blur-md p-8 rounded-lg shadow-lg max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-foreground">
            Your AI-Powered Learning Journey Starts Here
          </h1>
          <p className="text-lg sm:text-xl mb-8 text-muted-foreground">
            Discover personalized learning paths curated from the best educational resources across the web, tailored to
            your goals and preferences.
          </p>
          <Button size="lg" asChild>
            <ScrollLink to="cta" smooth={true} duration={500} offset={-100}>
              Start Learning for Free
            </ScrollLink>
          </Button>
        </div>
      </div>
    </section>
  )
}

