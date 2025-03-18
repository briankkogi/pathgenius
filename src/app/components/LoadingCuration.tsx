"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, BookOpen } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { funQuotes } from "@/lib/constants"

interface LoadingCurationProps {
  learningGoal: string;
  assessmentId?: string | null;
}

export default function LoadingCuration({ learningGoal, assessmentId }: LoadingCurationProps) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const handleQuoteChange = useCallback(() => {
    setQuoteIndex((prevIndex) => (prevIndex + 1) % funQuotes.length)
  }, [])

  useEffect(() => {
    const quoteInterval = setInterval(handleQuoteChange, 5000)
    const loadingTimeout = setTimeout(() => setIsLoading(false), 15000)

    return () => {
      clearInterval(quoteInterval)
      clearTimeout(loadingTimeout)
    }
  }, [handleQuoteChange])

  const handleStartLearning = () => {
    // Include the assessment ID in the URL if available
    const url = assessmentId 
      ? `/course/1?goal=${encodeURIComponent(learningGoal)}&assessment=${assessmentId}`
      : `/course/1?goal=${encodeURIComponent(learningGoal)}`
    
    router.push(url)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <LoadingContent quoteIndex={quoteIndex} />
        ) : (
          <CompletedContent learningGoal={learningGoal} onStartLearning={handleStartLearning} />
        )}
      </AnimatePresence>
    </div>
  )
}

function LoadingContent({ quoteIndex }: { quoteIndex: number }) {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <Loader2 className="h-16 w-16 animate-spin mx-auto mb-8" />
      <h1 className="text-3xl font-bold mb-4">Curating Your Personalized Learning Experience</h1>
      <motion.p
        key={quoteIndex}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="text-xl text-muted-foreground"
      >
        {funQuotes[quoteIndex]}
      </motion.p>
    </motion.div>
  )
}

function CompletedContent({ learningGoal, onStartLearning }: { learningGoal: string, onStartLearning: () => void }) {
  return (
    <motion.div
      key="complete"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <BookOpen className="h-16 w-16 mx-auto mb-8 text-primary" />
      <h1 className="text-3xl font-bold mb-4">Your {learningGoal} Learning Path is Ready!</h1>
      <p className="text-xl text-muted-foreground mb-8">
        We've crafted a personalized journey just for you. Ready to dive in?
      </p>
      <Button size="lg" onClick={onStartLearning}>
        Start Learning
      </Button>
    </motion.div>
  )
}

