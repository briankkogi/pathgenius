"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Brain } from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

export default function SignUp() {
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
        <h2 className="text-2xl font-semibold mb-6 text-center">Create Your Account</h2>
        <form className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@example.com" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" required className="mt-1" />
          </div>
          <Button type="submit" className="w-full">
            Sign Up
          </Button>
        </form>
        <p className="mt-4 text-center text-sm">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

