"use client"

import dynamic from "next/dynamic"
import type React from "react"

const PageTransition = dynamic(() => import("./PageTransition"), { ssr: false })

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}

