"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { professionLevels } from "@/lib/constants"

export default function Onboarding() {
  const [step, setStep] = useState(1)
  const [learningGoal, setLearningGoal] = useState("")
  const [professionLevel, setProfessionLevel] = useState("")
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 1 && learningGoal) {
      setStep(2)
    } else if (step === 2 && professionLevel) {
      localStorage.setItem("learningGoal", learningGoal)
      localStorage.setItem("professionLevel", professionLevel)
      router.push("/assessment")
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <OnboardingForm
        step={step}
        learningGoal={learningGoal}
        setLearningGoal={setLearningGoal}
        professionLevel={professionLevel}
        setProfessionLevel={setProfessionLevel}
        handleSubmit={handleSubmit}
      />
    </div>
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

