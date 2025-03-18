"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, setDoc, collection } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"

const questions = [
  {
    id: 1,
    question: "What is your experience with HTML?",
    options: [
      { id: "a", text: "I've never used it" },
      { id: "b", text: "I know the basics" },
      { id: "c", text: "I'm comfortable with most concepts" },
      { id: "d", text: "I'm an expert" },
    ],
  },
  {
    id: 2,
    question: "How familiar are you with JavaScript?",
    options: [
      { id: "a", text: "I've never used it" },
      { id: "b", text: "I know the basics" },
      { id: "c", text: "I'm comfortable with most concepts" },
      { id: "d", text: "I'm an expert" },
    ],
  },
  // Add more questions as needed
]

export default function Assessment() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState({})
  const [learningGoal, setLearningGoal] = useState("")
  const [professionLevel, setProfessionLevel] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()
  const { user, loading } = useFirebase()

  useEffect(() => {
    // Redirect if not authenticated
    if (!loading && !user) {
      toast.error("Please sign in to continue")
      router.push("/sign-in")
      return
    }

    const storedLearningGoal = localStorage.getItem("learningGoal")
    const storedProfessionLevel = localStorage.getItem("professionLevel")
    if (storedLearningGoal) setLearningGoal(storedLearningGoal)
    if (storedProfessionLevel) setProfessionLevel(storedProfessionLevel)
  }, [user, loading, router])

  const handleAnswer = (questionId: number, answerId: string) => {
    setAnswers({ ...answers, [questionId]: answerId })
  }

  const handleNext = async () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      setIsSubmitting(true)
      try {
        if (!user) throw new Error("User not authenticated")

        // Create a new assessment document in the user's assessments collection
        const assessmentRef = doc(collection(db, `users/${user.uid}/assessments`))
        
        await setDoc(assessmentRef, {
          learningGoal,
          professionLevel,
          answers,
          completedAt: new Date().toISOString(),
          userId: user.uid,
          status: "completed",
        })

        // Update user's profile with latest assessment
        await setDoc(doc(db, "users", user.uid), {
          lastAssessment: {
            id: assessmentRef.id,
            completedAt: new Date().toISOString(),
            learningGoal,
            professionLevel,
          }
        }, { merge: true })

        router.push(`/loading-curation?goal=${encodeURIComponent(learningGoal)}`)
      } catch (error) {
        console.error("Error saving assessment:", error)
        toast.error("Failed to save assessment results")
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[450px]">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const question = questions[currentQuestion]

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>Skill Assessment</CardTitle>
          <CardDescription>
            Question {currentQuestion + 1} of {questions.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <motion.div
            key={question.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-lg font-semibold mb-4">{question.question}</h2>
            <RadioGroup
              value={answers[question.id] || ""}
              onValueChange={(value) => handleAnswer(question.id, value)}
              className="space-y-2"
            >
              {question.options.map((option) => (
                <div key={option.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.id} id={`q${question.id}-${option.id}`} />
                  <Label htmlFor={`q${question.id}-${option.id}`}>{option.text}</Label>
                </div>
              ))}
            </RadioGroup>
          </motion.div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleNext} className="w-full" disabled={isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : currentQuestion < questions.length - 1
              ? "Next"
              : "Finish"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

