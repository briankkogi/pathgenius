"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, BookOpen } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { funQuotes } from "@/lib/constants"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, collection, setDoc, getDoc, query, where, getDocs } from "firebase/firestore"
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
  const isRequestInProgress = useRef(false)

  const handleQuoteChange = useCallback(() => {
    setQuoteIndex((prevIndex) => (prevIndex + 1) % funQuotes.length)
  }, [])

  const checkExistingCourse = async (userId: string, goal: string) => {
    try {
      const coursesRef = collection(db, "courses");
      const q = query(
        coursesRef, 
        where("userId", "==", userId),
        where("learningGoal", "==", goal)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].id;
      }
      
      return null;
    } catch (error) {
      console.error("Error checking for existing course:", error);
      return null;
    }
  };

  useEffect(() => {
    const quoteInterval = setInterval(handleQuoteChange, 5000)
    
    // Don't automatically end loading - wait for course generation
    
    return () => {
      clearInterval(quoteInterval)
    }
  }, [handleQuoteChange])

  useEffect(() => {
    const generateCourse = async () => {
      if (!user || isRequestInProgress.current) return
      
      try {
        // Set flag to prevent concurrent requests
        isRequestInProgress.current = true
        
        // First check if a course already exists
        const existingCourseId = await checkExistingCourse(user.uid, learningGoal)
        
        if (existingCourseId) {
          console.log("Found existing course, redirecting to:", existingCourseId)
          setCourseId(existingCourseId)
          setIsLoading(false)
          return
        }
        
        console.log("Generating new course for:", learningGoal)
        
        // Get recommended modules from assessment if available
        let recommendedModules: any[] = []
        
        if (assessmentId) {
          try {
            const assessmentDoc = await getDoc(doc(db, "assessments", assessmentId))
            if (assessmentDoc.exists()) {
              const assessmentData = assessmentDoc.data()
              console.log("Found assessment data:", assessmentData);
              
              // Log the recommended modules specifically
              if (assessmentData.recommendedModules && assessmentData.recommendedModules.length > 0) {
                console.log(`Found ${assessmentData.recommendedModules.length} recommended modules:`, 
                  assessmentData.recommendedModules);
                recommendedModules = assessmentData.recommendedModules;
              } else {
                console.warn("Assessment exists but has no recommended modules");
              }
            } else {
              console.warn(`Assessment with ID ${assessmentId} not found`);
            }
          } catch (error) {
            console.error("Error fetching assessment data:", error)
          }
        }
        
        // Generate a unique request ID to log and track this specific request
        const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        
        // Make the API request with recommended modules
        const response = await fetch('http://localhost:8000/api/curate-course', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
          },
          body: JSON.stringify({
            learningGoal,
            professionLevel: "beginner",
            userId: user.uid,
            assessmentId,
            formatForFirebase: true,
            requestId,
            recommendedModules // Include the recommended modules
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
      } finally {
        isRequestInProgress.current = false
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

