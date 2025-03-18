"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Menu, ChevronLeft, ChevronRight, LogOut, Home, BookOpen, BarChart, Settings } from "lucide-react"
import { useFirebase } from "@/contexts/FirebaseContext"
import { signOut } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { doc, getDoc } from "firebase/firestore"
import { useEffect } from "react"

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

const DashboardSidebar = ({ isCollapsed, toggleSidebar }: DashboardSidebarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const pathname = usePathname()
  const { user } = useFirebase()
  const router = useRouter()

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            setUserData(userDoc.data())
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      }
    }
    fetchUserData()
  }, [user])

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast.success("Logged out successfully")
      router.push("/sign-in")
    } catch (error) {
      console.error("Error logging out:", error)
      toast.error("Failed to log out")
    }
  }

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase() || 'U'
  }

  const sidebarVariants = {
    expanded: { width: 240 },
    collapsed: { width: 80 },
  }

  return (
    <>
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon" className="ml-2">
            <Menu size={24} />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] sm:w-[300px]">
          <MobileMenu setIsMobileMenuOpen={setIsMobileMenuOpen} userData={userData} />
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
                  <AvatarImage src={user?.photoURL || ""} alt={userData?.name || user?.displayName || "User"} />
                  <AvatarFallback>{getInitials(userData?.name || user?.displayName || "User")}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="font-semibold">{userData?.name || user?.displayName || "User"}</p>
                  <p className="text-sm text-muted-foreground">{userData?.email || user?.email}</p>
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
        <Button variant="ghost" className="justify-start gap-2" onClick={handleLogout}>
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

function MobileMenu({ setIsMobileMenuOpen, userData }) {
  const pathname = usePathname()
  const { user } = useFirebase()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      toast.success("Logged out successfully")
      router.push("/sign-in")
      setIsMobileMenuOpen(false)
    } catch (error) {
      console.error("Error logging out:", error)
      toast.error("Failed to log out")
    }
  }

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase() || 'U'
  }

  return (
    <nav className="flex flex-col gap-4 mt-4">
      <div className="flex items-center gap-2 mb-8">
        <Avatar>
          <AvatarImage src={user?.photoURL || ""} alt={userData?.name || user?.displayName || "User"} />
          <AvatarFallback>{getInitials(userData?.name || user?.displayName || "User")}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{userData?.name || user?.displayName || "User"}</p>
          <p className="text-sm text-muted-foreground">{userData?.email || user?.email}</p>
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
      <Button variant="ghost" className="justify-start gap-2 mt-auto" onClick={handleLogout}>
        <LogOut size={20} />
        Logout
      </Button>
    </nav>
  )
}

export default DashboardSidebar

