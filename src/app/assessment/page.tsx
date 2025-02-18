"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

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
  const router = useRouter()

  useEffect(() => {
    const storedLearningGoal = localStorage.getItem("learningGoal")
    if (storedLearningGoal) {
      setLearningGoal(storedLearningGoal)
    }
  }, [])

  const handleAnswer = (questionId: number, answerId: string) => {
    setAnswers({ ...answers, [questionId]: answerId })
  }

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1)
    } else {
      // Redirect to the loading curation page
      router.push(`/loading-curation?goal=${encodeURIComponent(learningGoal)}`)
    }
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
          <Button onClick={handleNext} className="w-full">
            {currentQuestion < questions.length - 1 ? "Next" : "Finish"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

