"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Brain } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"
import { useRouter } from "next/navigation"
import { signInWithEmailAndPassword } from "firebase/auth"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"

export default function SignIn() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      router.push("/dashboard")
      toast.success("Signed in successfully!")
    } catch (error: any) {
      console.error("Error signing in:", error)
      if (error.code === "auth/invalid-credential") {
        toast.error("Invalid email or password")
      } else {
        toast.error("Failed to sign in. Please try again.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-grow flex items-center justify-center relative py-20">
      <motion.div
        className="bg-background/80 backdrop-blur-md p-8 rounded-lg shadow-lg w-full max-w-md z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-center mb-6">
          <Brain className="h-10 w-10 text-primary mr-2" />
          <h1 className="text-3xl font-bold text-primary">PathGenius</h1>
        </div>
        <h2 className="text-2xl font-semibold mb-6 text-center">Welcome Back</h2>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
              className="mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              required
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Don't have an account?{" "}
          <Link href="/sign-up" className="text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

