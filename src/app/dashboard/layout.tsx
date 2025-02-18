"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { DashboardSidebar } from "../components/DashboardSidebar"
import { motion, AnimatePresence } from "framer-motion"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev)
  }

  if (!isMounted) {
    return null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar isCollapsed={isSidebarCollapsed} toggleSidebar={toggleSidebar} />
      <AnimatePresence mode="wait">
        <motion.main
          key={isSidebarCollapsed ? "collapsed" : "expanded"}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-y-auto py-6 px-4 md:px-6 lg:px-8"
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </motion.main>
      </AnimatePresence>
    </div>
  )
}

