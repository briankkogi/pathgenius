"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, AlertTriangle, BookText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "./components/Badge"

// Add interfaces for module recommendations
interface ModuleRecommendation {
  title: string;
  topics: string[];
}

interface AssessmentData {
  learningGoal: string;
  professionLevel: string;
  score: number;
  feedback: string;
  nextSteps: string;
  completedAt: string;
  userId: string;
  strengths: string[];
  knowledgeGaps: any[];
  recommendedModules?: ModuleRecommendation[];
}

export default function AssessmentResults() {
  const [assessment, setAssessment] = useState<AssessmentData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading } = useFirebase()
  
  const assessmentId = searchParams?.get('id') || ""

  useEffect(() => {
    // Redirect if not authenticated
    if (!loading && !user) {
      toast.error("Please sign in to continue")
      router.push("/sign-in")
      return
    }

    const fetchAssessmentData = async () => {
      if (!user || !assessmentId) return;
      
      try {
        // Fetch the assessment data from Firestore
        const assessmentDoc = await getDoc(doc(db, "assessments", assessmentId));
        
        if (!assessmentDoc.exists()) {
          setError("Assessment not found.");
          setIsLoading(false);
          return;
        }
        
        const assessmentData = assessmentDoc.data() as AssessmentData;
        
        // Security check - ensure this assessment belongs to the current user
        if (assessmentData.userId !== user.uid) {
          setError("You don't have permission to access this assessment.");
          setIsLoading(false);
          return;
        }
        
        console.log("Loaded assessment data:", assessmentData);
        
        // Check if we have all the required fields
        if (!assessmentData.feedback || assessmentData.feedback.trim() === '') {
          console.warn("Assessment is missing feedback");
          assessmentData.feedback = `Based on your assessment for ${assessmentData.learningGoal}, we've created a personalized learning path to help you build your skills.`;
        }
        
        if (!assessmentData.nextSteps || assessmentData.nextSteps.trim() === '') {
          console.warn("Assessment is missing nextSteps");
          assessmentData.nextSteps = `Follow the recommended modules to build your understanding of ${assessmentData.learningGoal}. These modules are specifically designed to address your current knowledge level.`;
        }
        
        // Enhanced logging for recommended modules
        if (!assessmentData.recommendedModules || assessmentData.recommendedModules.length === 0) {
          console.warn("Assessment is missing recommendedModules");
        } else {
          console.log(`Found ${assessmentData.recommendedModules.length} recommended modules:`);
          assessmentData.recommendedModules.forEach((module, index) => {
            console.log(`Module ${index+1}: ${module.title} with ${module.topics?.length || 0} topics`);
            if (module.topics?.length > 0) {
              console.log(`  Topics: ${module.topics.join(', ')}`);
            } else {
              console.warn(`  Module ${index+1} has no topics`);
            }
          });
        }
        
        setAssessment(assessmentData);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching assessment:", err);
        setError("Failed to load assessment results. Please try again.");
        setIsLoading(false);
      }
    };
    
    if (!loading) {
      fetchAssessmentData();
    }
  }, [user, loading, router, assessmentId]);

  if (loading || isLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-8">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
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

  if (!assessment) {
    return (
      <div className="container max-w-4xl mx-auto py-10 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Assessment not found</CardTitle>
            <CardDescription>
              We couldn't find the assessment results you're looking for.
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

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold mb-6">Assessment Results</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{assessment.learningGoal}</span>
              <Badge variant={assessment.score >= 80 ? "success" : assessment.score >= 50 ? "warning" : "secondary"}>
                {assessment.professionLevel}
              </Badge>
            </CardTitle>
            <CardDescription>
              Completed on {new Date(assessment.completedAt).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Knowledge Score</span>
                <span className="font-semibold">{Math.round(assessment.score)}%</span>
              </div>
              <Progress value={assessment.score} className="h-2" 
                style={{
                  backgroundColor: "var(--background)",
                  "--progress-background": assessment.score >= 80 ? "var(--success)" 
                    : assessment.score >= 60 ? "var(--warning)" 
                    : "var(--muted)"
                } as React.CSSProperties}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {assessment.score >= 80 ? "Excellent understanding" 
                  : assessment.score >= 60 ? "Good understanding with some gaps" 
                  : "Foundational understanding with learning opportunities"}
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Feedback</h3>
              <p className="text-muted-foreground">{assessment.feedback}</p>
            </div>
            
            {assessment.nextSteps && (
              <div>
                <h3 className="font-semibold mb-2">Next Steps</h3>
                <p className="text-muted-foreground">{assessment.nextSteps}</p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
            <Button 
              onClick={() => router.push(`/loading-curation?goal=${encodeURIComponent(assessment.learningGoal)}&assessment=${assessmentId}&useModules=true`)}
              className="gap-2"
            >
              <span>Start Learning</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
        
        {/* New Section: Recommended Learning Modules */}
        {assessment.recommendedModules && assessment.recommendedModules.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookText className="h-5 w-5 text-primary" />
                Recommended Learning Modules
              </CardTitle>
              <CardDescription>
                Based on your assessment, we've created a personalized learning path
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {assessment.recommendedModules.map((module, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-background">
                    <h3 className="text-lg font-semibold mb-2">
                      Module {index + 1}: {module.title}
                    </h3>
                    {module.topics && module.topics.length > 0 ? (
                      <ul className="space-y-1 list-disc pl-5">
                        {module.topics.map((topic, topicIndex) => (
                          <li key={topicIndex} className="text-muted-foreground">
                            {topic}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-muted-foreground italic">Topics will be available when you start this module</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => router.push(`/loading-curation?goal=${encodeURIComponent(assessment.learningGoal)}&assessment=${assessmentId}`)}
                className="w-full gap-2"
              >
                <span>Start Learning Path</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}
      </motion.div>
    </div>
  );
} 