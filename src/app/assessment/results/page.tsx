"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"

export default function AssessmentResults() {
  const [sessionData, setSessionData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useFirebase()
  
  const sessionId = searchParams.get('id')

  useEffect(() => {
    const fetchSession = async () => {
      if (!user || !sessionId) {
        toast.error("Missing session information")
        router.push("/dashboard")
        return
      }
      
      try {
        const sessionDoc = await getDoc(doc(db, "assessmentSessions", sessionId))
        if (sessionDoc.exists()) {
          setSessionData(sessionDoc.data())
        } else {
          toast.error("Assessment session not found")
          router.push("/dashboard")
        }
      } catch (error) {
        console.error("Error fetching session:", error)
        toast.error("Failed to load assessment results")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchSession()
  }, [user, sessionId, router])

  const handleStartLearning = () => {
    if (!sessionData || !sessionId) {
      toast.error("Missing session data")
      return
    }
    
    // Use the new loading-curation page
    router.push(`/loading-curation?goal=${encodeURIComponent(sessionData.learningGoal)}&assessment=${sessionId}`)
  }

  // Render JSX here with the handleStartLearning function
  return (
    <div>
      {/* Your results UI */}
      <Button 
        onClick={handleStartLearning}
        size="lg"
        className="mt-8"
      >
        Start Learning
      </Button>
    </div>
  )
} 