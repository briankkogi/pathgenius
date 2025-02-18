"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Home, BookOpen, BarChart, Settings, Menu, ChevronLeft, ChevronRight, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

const menuItems = [
  { icon: Home, label: "Overview", href: "/dashboard" },
  { icon: BookOpen, label: "My Courses", href: "/dashboard/courses" },
  { icon: BarChart, label: "Progress", href: "/dashboard/progress" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

interface DashboardSidebarProps {
  isCollapsed: boolean
  toggleSidebar: () => void
}

export function DashboardSidebar({ isCollapsed, toggleSidebar }: DashboardSidebarProps) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        toggleSidebar()
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [toggleSidebar])

  const sidebarVariants = {
    expanded: { width: 240 },
    collapsed: { width: 80 },
  }

  return (
    <>
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden fixed top-4 left-4 z-50">
            <Menu />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] sm:w-[300px]">
          <MobileMenu setIsMobileMenuOpen={setIsMobileMenuOpen} />
        </SheetContent>
      </Sheet>

      <motion.div
        className="hidden md:flex flex-col gap-4 p-4 border-r h-screen bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        initial={isCollapsed ? "collapsed" : "expanded"}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center justify-between mb-4">
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <Avatar>
                  <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="font-semibold">John Doe</p>
                  <p className="text-xs text-muted-foreground">john@example.com</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="shrink-0">
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </Button>
        </div>
        <Separator className="my-2" />
        <nav className="flex flex-col gap-2 flex-grow">
          {menuItems.map((item) => (
            <NavItem key={item.href} item={item} isActive={pathname === item.href} isCollapsed={isCollapsed} />
          ))}
        </nav>
        <Separator className="my-2" />
        <Button variant="ghost" className="justify-start gap-2">
          <LogOut size={20} />
          <AnimatePresence>
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    </>
  )
}

function NavItem({ item, isActive, isCollapsed }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={item.href}>
            <motion.div
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <item.icon size={20} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.div>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function MobileMenu({ setIsMobileMenuOpen }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-4 mt-4">
      <div className="flex items-center gap-2 mb-8">
        <Avatar>
          <AvatarImage src="/placeholder-avatar.jpg" alt="User" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">John Doe</p>
          <p className="text-sm text-muted-foreground">john@example.com</p>
        </div>
      </div>
      <Separator className="my-2" />
      {menuItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
            pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <item.icon size={20} />
          {item.label}
        </Link>
      ))}
      <Separator className="my-2" />
      <Button variant="ghost" className="justify-start gap-2 mt-auto">
        <LogOut size={20} />
        Logout
      </Button>
    </nav>
  )
}

