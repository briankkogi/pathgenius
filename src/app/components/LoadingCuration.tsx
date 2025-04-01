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

interface TopicItem {
  title?: string;
  content?: string;
  [key: string]: any; // For any other properties that might exist
}

type TopicType = string | TopicItem;

interface ModuleData {
  id: number;
  title: string;
  description?: string;
  progress?: number;
  topics: TopicData[];
}

interface TopicData {
  id: string;
  title: string;
  content?: string;
}

export default function LoadingCuration({ learningGoal, assessmentId }: LoadingCurationProps) {
  const [quoteIndex, setQuoteIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [courseDocId, setCourseDocId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const router = useRouter()
  const { user } = useFirebase()
  const isRequestInProgress = useRef(false)
  const generationAttempted = useRef(false);

  const handleQuoteChange = useCallback(() => {
    setQuoteIndex((prevIndex) => (prevIndex + 1) % funQuotes.length)
  }, [])

  const checkExistingCourse = async (userId: string, goal: string): Promise<string | null> => {
    try {
      setStatusMessage("Checking for existing courses...");
      const coursesRef = collection(db, "courses");
      const q = query(
        coursesRef,
        where("userId", "==", userId),
        where("learningGoal", "==", goal)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setStatusMessage("Found existing course.");
        console.log("Firestore Check: Found existing course ID:", querySnapshot.docs[0].id)
        return querySnapshot.docs[0].id;
      }
      setStatusMessage("No existing course found.");
      console.log("Firestore Check: No existing course found.")
      return null;
    } catch (error) {
      console.error("Error checking for existing course:", error);
      setStatusMessage("Error checking courses.");
      return null;
    }
  };

  useEffect(() => {
    const quoteInterval = setInterval(handleQuoteChange, 5000)
    return () => clearInterval(quoteInterval)
  }, [handleQuoteChange])

  useEffect(() => {
    const generateCourse = async () => {
      if (!user || generationAttempted.current) {
        console.log(`generateCourse skipped: user=${!!user}, attempted=${generationAttempted.current}`)
        return
      }
      
      if (courseDocId) {
        console.log("generateCourse skipped: courseDocId already set.")
        setIsLoading(false);
        return;
      }

      generationAttempted.current = true;
      console.log("generateCourse: Attempting generation...")
      
      try {
        if (isRequestInProgress.current) {
          console.log("generateCourse: Request already in progress, skipping.")
          return; 
        }
        isRequestInProgress.current = true;

        const existingDocId = await checkExistingCourse(user.uid, learningGoal);
        if (existingDocId) {
          console.log("generateCourse: Existing course found in Firestore, setting ID:", existingDocId)
          setCourseDocId(existingDocId);
          setIsLoading(false);
          isRequestInProgress.current = false;
          return;
        }

        console.log("generateCourse: No existing course, calling backend API...");
        setStatusMessage("Generating new learning path...");

        let recommendedModules: any[] = []
        if (assessmentId) {
          try {
            const assessmentDoc = await getDoc(doc(db, "assessments", assessmentId))
            if (assessmentDoc.exists()) {
              const assessmentData = assessmentDoc.data()
              console.log("Found assessment data:", assessmentData);
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

        const response = await fetch('http://localhost:8000/api/curate-course', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            learningGoal,
            professionLevel: "beginner",
            userId: user.uid,
            assessmentId,
            recommendedModules
          })
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error("API Error Response:", errorData)
          throw new Error(`Failed to generate course: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("generateCourse: Received data from backend:", data);
        
        const backendCourseId = data.courseId; 
        if (!backendCourseId) {
           throw new Error("Backend response did not include a courseId");
        }
        
        console.log("generateCourse: Using backend courseId for Firestore:", backendCourseId);
        const courseRef = doc(db, "courses", backendCourseId); 
                                                    
        const structuredModules = data.modules.map((module: ModuleData) => ({
           id: module.id,
           title: module.title,
           description: module.description || `Learn about ${module.title}`,
           progress: 0,
           topics: module.topics.map((topic: TopicData) => ({
             id: topic.id,
             title: topic.title,
             content: topic.content || ""
           }))
        }));

        setStatusMessage("Saving your course...");
        await setDoc(courseRef, {
          userId: user.uid,
          title: data.title || `${learningGoal} Course`,
          modules: structuredModules,
          learningGoal,
          createdAt: new Date().toISOString(),
          progress: 0,
        });

        console.log("generateCourse: Course saved/updated in Firestore with ID:", courseRef.id);

        setCourseDocId(courseRef.id); 
        setStatusMessage("Course ready!");
        setIsLoading(false);

      } catch (error) {
        console.error("Error during course generation/saving:", error);
        setStatusMessage("Failed to create course.");
        setIsLoading(false);
      } finally {
        isRequestInProgress.current = false;
        console.log("generateCourse: Process finished.")
      }
    };

    generateCourse();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, learningGoal, assessmentId]);

  const handleStartLearning = () => {
    if (!courseDocId) {
      console.error("Cannot start learning, courseDocId is not set.");
      return;
    }
    const url = `/course/${courseDocId}`;
    console.log("Navigating to course:", url)
    router.push(url);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <LoadingContent quoteIndex={quoteIndex} statusMessage={statusMessage} />
        ) : (
          <CompletedContent learningGoal={learningGoal} onStartLearning={handleStartLearning} />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoadingContent({ quoteIndex, statusMessage }: { quoteIndex: number, statusMessage: string }) {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      <Loader2 className="h-16 w-16 animate-spin mx-auto mb-6" />
      <h1 className="text-3xl font-bold mb-3">Curating Your Learning Path</h1>
      <p className="text-lg text-muted-foreground mb-6 min-h-[28px]">{statusMessage}</p> 
      <motion.p
        key={quoteIndex}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="text-md italic text-muted-foreground/80 min-h-[40px]"
      >
        "{funQuotes[quoteIndex]}"
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

