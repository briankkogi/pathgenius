"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, BookOpen } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { funQuotes } from "@/lib/constants"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, collection, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface LoadingCurationProps {
  learningGoal: string;
  assessmentId?: string | null;
}

export default function LoadingCuration({ learningGoal, assessmentId }: LoadingCurationProps) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [courseId, setCourseId] = useState<string | null>(null)
  const router = useRouter()
  const { user } = useFirebase()

  const handleQuoteChange = useCallback(() => {
    setQuoteIndex((prevIndex) => (prevIndex + 1) % funQuotes.length)
  }, [])

  useEffect(() => {
    const quoteInterval = setInterval(handleQuoteChange, 5000)
    
    // Don't automatically end loading - wait for course generation
    
    return () => {
      clearInterval(quoteInterval)
    }
  }, [handleQuoteChange])

  useEffect(() => {
    const generateCourse = async () => {
      if (!user) return
      
      try {
        // Call our new FastAPI endpoint to generate a course
        const response = await fetch('http://localhost:8000/api/curate-course', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            learningGoal,
            professionLevel: "beginner", // Default to beginner if not available
            userId: user.uid,
            assessmentId
          })
        })
        
        if (!response.ok) {
          throw new Error("Failed to generate course")
        }
        
        const data = await response.json()
        
        // Save course to Firebase
        const courseRef = doc(collection(db, "courses"))
        await setDoc(courseRef, {
          userId: user.uid,
          courseId: data.courseId,
          title: data.title,
          modules: data.modules,
          learningGoal,
          createdAt: new Date().toISOString(),
          progress: 0
        })
        
        // Set courseId for redirection
        setCourseId(courseRef.id)
        
        // End loading after course is generated and saved
        setIsLoading(false)
      } catch (error) {
        console.error("Error generating course:", error)
        // End loading even if there's an error
        setIsLoading(false)
      }
    }
    
    if (user) {
      generateCourse()
    }
  }, [user, learningGoal, assessmentId])

  const handleStartLearning = () => {
    // Use the Firebase document ID of the course
    const url = courseId 
      ? `/course/${courseId}?goal=${encodeURIComponent(learningGoal)}&assessment=${assessmentId || ''}`
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

