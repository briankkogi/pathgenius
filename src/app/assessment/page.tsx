"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, getDoc, setDoc, collection, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface Question {
  id: number;
  question: string;
}

export default function Assessment() {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [learningGoal, setLearningGoal] = useState("")
  const [professionLevel, setProfessionLevel] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [questions, setQuestions] = useState<Question[]>([])
  const [sessionId, setSessionId] = useState("")
  const [apiSessionId, setApiSessionId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isAddCourse, setIsAddCourse] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useFirebase()

  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const response = await fetch('http://localhost:8000/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        return true;
      }
      return false;
    } catch (error) {
      console.error("Backend health check failed:", error);
      return false;
    }
  };

  useEffect(() => {
    // Redirect if not authenticated
    if (!loading && !user) {
      toast.error("Please sign in to continue")
      router.push("/sign-in")
      return
    }

    const fetchSessionData = async () => {
      if (!user) return;
      
      // Get the session ID from the URL
      const firestoreSessionId = searchParams.get('sessionId');
      
      if (!firestoreSessionId) {
        setError("No assessment session found. Please return to the dashboard and try again.");
        setIsLoading(false);
        return;
      }
      
      try {
        // Check if the backend is available first
        const isBackendHealthy = await checkBackendHealth();
        if (!isBackendHealthy) {
          throw new Error("Assessment service is not available. Please try again later.");
        }
        
        // Fetch the session data from Firestore
        const sessionDoc = await getDoc(doc(db, "assessmentSessions", firestoreSessionId));
        
        if (!sessionDoc.exists()) {
          setError("Assessment session not found.");
          setIsLoading(false);
          return;
        }
        
        const sessionData = sessionDoc.data();
        
        // Security check - ensure this session belongs to the current user
        if (sessionData.userId !== user.uid) {
          setError("You don't have permission to access this assessment.");
          setIsLoading(false);
          return;
        }
        
        // Set the data from Firestore
        setLearningGoal(sessionData.learningGoal);
        setProfessionLevel(sessionData.professionLevel);
        setIsAddCourse(sessionData.isAddCourse);
        setSessionId(firestoreSessionId);
        
        // Now fetch questions from the FastAPI backend
        const response = await fetch('http://localhost:8000/api/generate-assessment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            learningGoal: sessionData.learningGoal,
            professionLevel: sessionData.professionLevel,
            userId: user.uid
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || "Failed to generate assessment");
        }
        
        const data = await response.json();
        setQuestions(data.questions);
        setApiSessionId(data.sessionId);
        
        // Update the Firestore session with the API session ID
        await updateDoc(doc(db, "assessmentSessions", firestoreSessionId), {
          apiSessionId: data.sessionId
        });
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error setting up assessment:", err);
        setError("Failed to generate assessment questions. Please try again.");
        setIsLoading(false);
        toast.error("Failed to generate assessment questions");
      }
    };
    
    if (!loading) {
      fetchSessionData();
    }
  }, [user, loading, router, searchParams]);

  const handleAnswerChange = (questionId: number, answer: string) => {
    setAnswers({ ...answers, [questionId]: answer });
    
    // Save answer to Firestore in real-time
    if (user && sessionId) {
      updateDoc(doc(db, "assessmentSessions", sessionId), {
        [`answers.${questionId}`]: answer,
        lastUpdated: new Date().toISOString()
      }).catch(error => {
        console.error("Error saving answer:", error);
      });
    }
  };

  const handleNext = async () => {
    // Validate if there's some text in the answer (not just whitespace)
    if (!answers[questions[currentQuestion].id]?.trim()) {
      toast.warning("Please enter an answer before continuing");
      return;
    }
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Submit the entire assessment
      setIsSubmitting(true);
      try {
        if (!user) throw new Error("User not authenticated");
        
        // Update session status in Firestore
        await updateDoc(doc(db, "assessmentSessions", sessionId), {
          status: "submitted",
          submittedAt: new Date().toISOString()
        });
        
        // Evaluate the assessment using our API
        const evalResponse = await fetch('http://localhost:8000/api/evaluate-assessment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: apiSessionId,
            answers
          })
        });
        
        if (!evalResponse.ok) {
          const errorData = await evalResponse.json();
          throw new Error(errorData.detail || "Failed to evaluate assessment");
        }
        
        const evalData = await evalResponse.json();
        
        // Create a new assessment document in the user's assessments collection
        const assessmentRef = doc(collection(db, `users/${user.uid}/assessments`));
        
        await setDoc(assessmentRef, {
          learningGoal,
          professionLevel,
          answers,
          score: evalData.score,
          feedback: evalData.feedback,
          nextSteps: evalData.nextSteps,
          completedAt: new Date().toISOString(),
          userId: user.uid,
          sessionId: sessionId,
          status: "completed",
        });

        // Update user's profile with latest assessment
        await setDoc(doc(db, "users", user.uid), {
          lastAssessment: {
            id: assessmentRef.id,
            completedAt: new Date().toISOString(),
            learningGoal,
            professionLevel,
            score: evalData.score
          }
        }, { merge: true });

        // If this is a new course, create it based on the assessment
        if (isAddCourse) {
          await setDoc(doc(db, "users", user.uid, "courses", new Date().getTime().toString()), {
            learningGoal,
            professionLevel,
            progress: 0,
            startedAt: new Date().toISOString(),
            assessmentId: assessmentRef.id,
            score: evalData.score
          });
        }
        
        // Update the assessment session with the results
        await updateDoc(doc(db, "assessmentSessions", sessionId), {
          status: "completed",
          score: evalData.score,
          feedback: evalData.feedback,
          nextSteps: evalData.nextSteps,
          assessmentId: assessmentRef.id
        });

        router.push(`/loading-curation?goal=${encodeURIComponent(learningGoal)}`);
      } catch (error) {
        console.error("Error saving assessment:", error);
        toast.error("Failed to save assessment results");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleSkip = () => {
    // Skip this question by setting an empty answer
    handleAnswerChange(questions[currentQuestion].id, "Skipped");
    
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // If it's the last question, proceed to submission
      handleNext();
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[600px]">
          <CardHeader>
            <CardTitle>Preparing your assessment...</CardTitle>
            <CardDescription>
              We're creating questions tailored to your learning goal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[600px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-[600px]">
          <CardHeader>
            <CardTitle>No questions available</CardTitle>
            <CardDescription>
              Please try again or contact support
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[600px] max-w-[90vw]">
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
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold mb-2">{question.question}</h2>
              <p className="text-sm text-muted-foreground mb-4">Please write your answer in the box below. If you're not sure, you can skip this question.</p>
            </div>
            
            <div>
              <Label htmlFor={`question-${question.id}`} className="sr-only">
                Your answer
              </Label>
              <Textarea 
                id={`question-${question.id}`}
                placeholder="Write your answer here..."
                value={answers[question.id] || ""}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleAnswerChange(question.id, e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          </motion.div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={handleSkip}
            disabled={isSubmitting}
          >
            Skip Question
          </Button>
          
          <Button 
            onClick={handleNext} 
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Saving..."
              : currentQuestion < questions.length - 1
              ? "Next Question"
              : "Finish Assessment"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

