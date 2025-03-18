"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { professionLevels } from "@/lib/constants"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, setDoc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [learningGoal, setLearningGoal] = useState("")
  const [professionLevel, setProfessionLevel] = useState("")
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { user, loading } = useFirebase()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode')
  const isAddCourse = mode === 'add-course'

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Please sign in to continue")
      router.push("/sign-in")
      return
    }

    const loadData = async () => {
      try {
        if (user && !isAddCourse) {
          // Check if user already has preferences
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists() && userDoc.data().learningGoal && userDoc.data().professionLevel) {
            router.push("/dashboard")
            return
          }
        }
        setIsLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err : new Error("An error occurred"))
        setIsLoading(false)
      }
    }
    loadData()
  }, [user, loading, router, isAddCourse])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1 && learningGoal) {
      setStep(2)
    } else if (step === 2 && professionLevel && user) {
      setIsSubmitting(true)
      try {
        if (isAddCourse) {
          // Handle adding a new course
          await setDoc(doc(db, "users", user.uid, "courses", new Date().getTime().toString()), {
            learningGoal,
            professionLevel,
            progress: 0,
            startedAt: new Date().toISOString(),
          })
          toast.success("Course added successfully!")
          router.push("/dashboard")
        } else {
          // Handle initial onboarding
          await setDoc(doc(db, "users", user.uid), {
            learningGoal,
            professionLevel,
            updatedAt: new Date().toISOString(),
          }, { merge: true })
          router.push("/assessment")
        }
      } catch (error) {
        console.error("Error saving data:", error)
        toast.error(isAddCourse ? "Failed to add course" : "Failed to save preferences")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Skeleton className="w-[350px] h-[400px]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <motion.div
      className="flex items-center justify-center min-h-screen bg-background"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{isAddCourse ? "Add New Course" : "Welcome to PathGenius"}</CardTitle>
          <CardDescription>
            {isAddCourse ? "Let's add a new course to your journey" : "Let's personalize your learning journey"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {step === 1 ? (
              <LearningGoalInput learningGoal={learningGoal} setLearningGoal={setLearningGoal} />
            ) : (
              <ProfessionLevelInput professionLevel={professionLevel} setProfessionLevel={setProfessionLevel} />
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" onClick={handleSubmit} className="w-full">
            {step === 1 ? "Next" : "Start Learning"}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

function OnboardingForm({ step, learningGoal, setLearningGoal, professionLevel, setProfessionLevel, handleSubmit }) {
  return (
    <motion.div
      key="onboarding"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>Welcome to PathGenius</CardTitle>
          <CardDescription>Let's personalize your learning journey</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            {step === 1 ? (
              <LearningGoalInput learningGoal={learningGoal} setLearningGoal={setLearningGoal} />
            ) : (
              <ProfessionLevelInput professionLevel={professionLevel} setProfessionLevel={setProfessionLevel} />
            )}
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button type="submit" onClick={handleSubmit} className="w-full">
            {step === 1 ? "Next" : "Start Learning"}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

function LearningGoalInput({ learningGoal, setLearningGoal }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Label htmlFor="learning-goal">What do you want to learn?</Label>
      <Input
        id="learning-goal"
        value={learningGoal}
        onChange={(e) => setLearningGoal(e.target.value)}
        placeholder="e.g., Web Development, Data Science"
        className="mt-2"
      />
    </motion.div>
  )
}

function ProfessionLevelInput({ professionLevel, setProfessionLevel }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Label>Choose your profession level:</Label>
      <RadioGroup value={professionLevel} onValueChange={setProfessionLevel} className="mt-2 space-y-2">
        {professionLevels.map((level) => (
          <div key={level.id} className="flex items-center space-x-2">
            <RadioGroupItem value={level.id} id={level.id} />
            <Label htmlFor={level.id}>{level.label}</Label>
          </div>
        ))}
      </RadioGroup>
    </motion.div>
  )
}

