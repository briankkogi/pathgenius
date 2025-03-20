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
import { collection } from "firebase/firestore"

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
          if (userDoc.exists() && userDoc.data().initialLearningGoal) {
            // User has already completed onboarding, redirect to dashboard
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
        // Before creating a session, check if the backend is healthy
        try {
          const response = await fetch('http://localhost:8000/api/health');
          if (!response.ok) {
            throw new Error("Assessment service is currently unavailable");
          }
        } catch (backendError) {
          // Show a warning but proceed anyway
          toast.warning("Assessment service may be unavailable. Your experience might be limited.");
          console.warn("Backend health check failed:", backendError);
          // Continue with the rest of the process
        }
        
        if (isAddCourse) {
          // Create a new assessment session document in Firestore
          const assessmentSessionRef = doc(collection(db, "assessmentSessions"));
          await setDoc(assessmentSessionRef, {
            userId: user.uid,
            learningGoal,
            professionLevel,
            isAddCourse: true,
            createdAt: new Date().toISOString(),
            status: "pending"
          });
          
          toast.success("Course preferences saved! Let's complete a quick assessment.");
          router.push(`/assessment?sessionId=${assessmentSessionRef.id}`);
        } else {
          // Handle initial onboarding - save to user profile
          // Instead of setting a general professionLevel, we'll create a topics map
          // that stores the professionLevel for each topic
          await setDoc(doc(db, "users", user.uid), {
            // Add the initial learning goal
            initialLearningGoal: learningGoal,
            // Store topic-specific profession levels
            topics: {
              [learningGoal]: {
                professionLevel,
                addedAt: new Date().toISOString()
              }
            },
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          
          // Create assessment session for initial onboarding
          const assessmentSessionRef = doc(collection(db, "assessmentSessions"));
          await setDoc(assessmentSessionRef, {
            userId: user.uid,
            learningGoal,
            professionLevel,
            isAddCourse: false,
            createdAt: new Date().toISOString(),
            status: "pending"
          });
          
          router.push(`/assessment?sessionId=${assessmentSessionRef.id}`);
        }
      } catch (error) {
        console.error("Error saving data:", error);
        toast.error(isAddCourse ? "Failed to add course" : "Failed to save preferences");
      } finally {
        setIsSubmitting(false);
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
              <ProfessionLevelInput 
                learningGoal={learningGoal}
                professionLevel={professionLevel} 
                setProfessionLevel={setProfessionLevel} 
              />
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

interface ProfessionLevelInputProps {
  learningGoal: string;
  professionLevel: string;
  setProfessionLevel: (value: string) => void;
}

function ProfessionLevelInput({ learningGoal, professionLevel, setProfessionLevel }: ProfessionLevelInputProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Label>What's your experience level with {learningGoal}?</Label>
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

interface LearningGoalInputProps {
  learningGoal: string;
  setLearningGoal: (value: string) => void;
}

function LearningGoalInput({ learningGoal, setLearningGoal }: LearningGoalInputProps) {
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

interface OnboardingFormProps {
  step: number;
  learningGoal: string;
  setLearningGoal: (value: string) => void;
  professionLevel: string;
  setProfessionLevel: (value: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

function OnboardingForm({ 
  step, 
  learningGoal, 
  setLearningGoal, 
  professionLevel, 
  setProfessionLevel, 
  handleSubmit 
}: OnboardingFormProps) {
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
              <ProfessionLevelInput 
                learningGoal={learningGoal}
                professionLevel={professionLevel} 
                setProfessionLevel={setProfessionLevel} 
              />
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

