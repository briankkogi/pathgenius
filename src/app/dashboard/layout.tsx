"use client"

import type React from "react"

import { useState } from "react"
import { DashboardSidebar } from "../components/DashboardSidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />
      <main
        className={`flex-1 overflow-y-auto py-6 pl-2 transition-all duration-300 ${
          isSidebarCollapsed ? "md:ml-[80px]" : "md:ml-[240px]"
        }`}
      >
        <div className="mx-auto max-w-full mr-4">{children}</div>
      </main>
    </div>
  )
}

