"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight, CheckCircle, Video, FileText, MessageSquare, BookOpen, PenTool, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import YouTube from "react-youtube"
import { AIChatBox } from "@/components/AIChatBox"
import { doc, getDoc, updateDoc, collection, query, where, getDocs, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useFirebase } from "@/contexts/FirebaseContext"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CourseModule, ModuleTopic, QuizQuestion } from "@/app/types/course"
import { Textarea } from "@/components/ui/textarea"
import { CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

// Add the FirebaseCourseData interface that's used in this file
interface FirebaseCourseData {
  userId: string;
  title: string;
  modules: CourseModule[];
  progress?: number;
  learningGoal?: string;
  createdAt: string;
}

//mock data as fallback
const coursesData = {
  1: {
    modules: [
      {
        id: 1,
        title: "Introduction to Web Development",
        description: "An overview of web development and its core technologies.",
        type: "mixed",
        duration: "45 minutes",
        progress: 0,
        topics: [
          {
            id: "1-1",
            title: "What is Web Development?",
            type: "video",
            videoId: "UB1O30fR-EE",
            duration: "10 minutes",
            notes: `
              Web development is the process of building and maintaining websites. It encompasses several aspects:
              
              1. Front-end development: Creating the user interface and user experience
              2. Back-end development: Building the server-side logic and databases
              3. Full-stack development: Combining both front-end and back-end skills
              
              Web developers use various technologies and programming languages to create dynamic and interactive websites.
            `,
          },
          {
            id: "1-2",
            title: "Core Technologies: HTML, CSS, and JavaScript",
            type: "article",
            duration: "15 minutes read",
            content: `
              <h2>The Three Pillars of Web Development</h2>
              <p>Web development relies on three core technologies:</p>
              <ul>
                <li><strong>HTML (HyperText Markup Language):</strong> Provides the structure and content of web pages</li>
                <li><strong>CSS (Cascading Style Sheets):</strong> Handles the presentation and styling of web pages</li>
                <li><strong>JavaScript:</strong> Adds interactivity and dynamic behavior to web pages</li>
              </ul>
              <p>Together, these technologies form the foundation of modern web development.</p>
            `,
          },
          {
            id: "1-3",
            title: "The Role of Web Browsers",
            type: "video",
            videoId: "DuSURHrZG6I",
            duration: "8 minutes",
            notes: `
              Web browsers play a crucial role in web development:
              
              1. They interpret and render HTML, CSS, and JavaScript
              2. Provide a user interface for interacting with web content
              3. Implement web standards and APIs for developers to use
              4. Offer developer tools for debugging and optimizing web applications
              
              Popular web browsers include Chrome, Firefox, Safari, and Edge.
            `,
          },
        ],
        quiz: [
          {
            question: "What are the three core technologies of web development?",
            options: [
              "HTML, CSS, and JavaScript",
              "Python, Java, and C++",
              "React, Angular, and Vue",
              "MySQL, MongoDB, and PostgreSQL",
            ],
            correctAnswer: 0,
          },
          {
            question: "Which of the following is NOT a primary responsibility of web browsers?",
            options: [
              "Interpreting HTML",
              "Rendering CSS styles",
              "Executing JavaScript code",
              "Hosting website files",
            ],
            correctAnswer: 3,
          },
        ],
      },
      // Add more modules here
    ],
  },
  // Add more courses as needed
}

export default function ModulePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params?.id as string || "1"
  const moduleId = params?.moduleId as string || "1"
  const [module, setModule] = useState<CourseModule | null>(null)
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("content")
  const { user } = useFirebase()
  // Add a state to track if we've checked for authentication
  const [authChecked, setAuthChecked] = useState(false)

  // For quiz functionality
  const [isQuizLoading, setIsQuizLoading] = useState(false)
  const [quizStarted, setQuizStarted] = useState(false)
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizQuestions, setQuizQuestions] = useState<any[]>([])
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
  const [quizId, setQuizId] = useState("")
  const [quizScore, setQuizScore] = useState<number | null>(null)
  const [quizFeedback, setQuizFeedback] = useState("")

  // Create topics array from module content if needed
  const [topics, setTopics] = useState<ModuleTopic[]>([])
  
  // Add a separate effect to check for authentication state
  useEffect(() => {
    // This will run when the user state changes
    // Firebase will set user to null if not authenticated
    // and to the user object when authenticated
    
    // We only want to show the error if we're sure authentication is complete
    // and the user is not available
    if (user === null) {
      // User is definitely not authenticated
      setError("Please sign in to view this module");
      setAuthChecked(true);
    } else if (user) {
      // User is authenticated, clear any auth error
      setError(null);
      setAuthChecked(true);
    }
    // If user is undefined, we're still initializing, don't set error yet
  }, [user]);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        setIsLoading(true);
        
        // Only proceed with fetching data if user is available
        if (!user) {
          // Don't set an error here, as the auth check effect will handle it
          setIsLoading(false);
          return;
        }
        
        // Load course from Firebase
        const courseDoc = await getDoc(doc(db, "courses", courseId));
        
        if (courseDoc.exists()) {
          const courseData = courseDoc.data() as FirebaseCourseData;
          
          // Check if user has access to this course
          if (courseData.userId === user.uid) {
            // Find the module by ID
            const moduleIndex = courseData.modules.findIndex(
              m => m.id.toString() === moduleId.toString()
            );
            
            if (moduleIndex !== -1) {
              const moduleData = courseData.modules[moduleIndex];
              const normalizedModule = {
                ...moduleData,
                id: moduleData.id || moduleIndex + 1,
                title: moduleData.title || `Module ${moduleIndex + 1}`,
                description: moduleData.description || `Module ${moduleIndex + 1} content`,
                progress: moduleData.progress || 0,
                // Load completed topics if available
                completedTopics: moduleData.completedTopics || []
              };
              
              setModule(normalizedModule);
              setProgress(normalizedModule.progress || 0);
              
              // Check if module has topics property
              if (normalizedModule.topics && normalizedModule.topics.length > 0) {
                // Normalize each topic to ensure it has all required fields
                const normalizedTopics = normalizedModule.topics.map((topic: ModuleTopic) => {
                  return {
                    id: topic.id || `${normalizedModule.id}-1`,
                    title: topic.title || 'Untitled Topic',
                    content: topic.content || `# ${topic.title || 'Untitled Topic'}\n\nThis content is being prepared.`
                  };
                });
                
                setTopics(normalizedTopics);
                
                // Check if we should restore a specific topic index (e.g., from a saved state)
                // If not, just start from the first topic
                setCurrentTopicIndex(0);
              } else {
                // Create default topics if none exist
                const defaultTopics = [
                  {
                    id: `${normalizedModule.id}-1`,
                    title: normalizedModule.title,
                    content: `# ${normalizedModule.title}\n\nThis module content is being prepared.`
                  }
                ];
                setTopics(defaultTopics);
              }
            } else {
              setError("Module not found");
            }
          } else {
            setError("You don't have permission to access this course");
          }
        } else {
          setError("Course not found");
        }
      } catch (error) {
        console.error("Error fetching module:", error);
        setError("Failed to load module");
      } finally {
        setIsLoading(false);
      }
    };
    
    // Only fetch module if user is available
    if (courseId && moduleId && user) {
      fetchModule();
    }
  }, [courseId, moduleId, user]);

  useEffect(() => {
    if (module) {
      // Update progress based on current topic
      const newProgress = topics.length > 0 
        ? Math.round(((currentTopicIndex + 1) / topics.length) * 100)
        : 0
      setProgress(newProgress)
    }
  }, [currentTopicIndex, module, topics])

  const handleTopicNavigation = async (direction: "prev" | "next") => {
    // Mark current topic as completed if navigating to next
    if (direction === "next" && topics.length > 0) {
      await markTopicAsCompleted(currentTopicIndex);
    }
    
    // Update current topic index
    if (direction === "next" && currentTopicIndex < topics.length - 1) {
      setCurrentTopicIndex(prevIndex => prevIndex + 1);
      // Remove scrolling behavior
    } else if (direction === "prev" && currentTopicIndex > 0) {
      setCurrentTopicIndex(prevIndex => prevIndex - 1);
      // Remove scrolling behavior
    }
  };

  // Add a function to mark a topic as completed
  const markTopicAsCompleted = async (topicIndex: number) => {
    if (!user || !module || topicIndex >= topics.length) return;
    
    try {
      // Get the current topic
      const topic = topics[topicIndex];
      
      // Update module progress in Firebase
      const courseRef = doc(db, "courses", courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (courseDoc.exists()) {
        const courseData = courseDoc.data();
        const modules = courseData.modules || [];
        
        // Find the module being updated
        const moduleIndex = modules.findIndex((m: any) => 
          m.id.toString() === moduleId.toString()
        );
        
        if (moduleIndex !== -1) {
          // Calculate completed topics
          const completedTopics = new Set([
            ...(modules[moduleIndex].completedTopics || []),
            topicIndex
          ]);
          
          // Update the module with completed topics
          modules[moduleIndex].completedTopics = Array.from(completedTopics);
          
          // Calculate module progress (percentage of completed topics)
          const totalTopics = topics.length;
          const completedCount = completedTopics.size;
          const moduleProgress = Math.round((completedCount / totalTopics) * 100);
          
          // Update module progress
          modules[moduleIndex].progress = moduleProgress;
          
          // Calculate overall course progress (average of all module progress)
          const totalProgress = modules.reduce(
            (sum: number, mod: any) => sum + (mod.progress || 0), 
            0
          );
          const courseProgress = Math.round(totalProgress / modules.length);
          
          // Update Firebase with new progress data
          await updateDoc(courseRef, {
            modules: modules,
            progress: courseProgress,
            updatedAt: new Date().toISOString()
          });
          
          // Update local state
          setProgress(moduleProgress);
          
          // Show success notification
          toast.success("Progress saved");
        }
      }
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error("Failed to save progress");
    }
  };

  const navigateToModule = (direction: "prev" | "next") => {
    // Convert moduleId to number for comparison
    const currentModuleNum = parseInt(moduleId)
    const newModuleNum = direction === "prev" ? currentModuleNum - 1 : currentModuleNum + 1
    
    // Navigate if the new module number is valid (between 1 and 5)
    if (newModuleNum >= 1 && newModuleNum <= 5) {
      router.push(`/course/${courseId}/module/${newModuleNum}`)
    }
  }

  const handleStartQuiz = async () => {
    if (!user || !module || !topics) return;
    
    setIsQuizLoading(true);
    
    try {
      // Prepare content for quiz generation
      const topicContent = topics.map(topic => ({
        title: topic.title,
        content: topic.content || ""
      }));
      
      // Call backend to generate quiz questions
      const response = await fetch('http://localhost:8000/api/generate-module-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.uid,
          moduleId,
          courseId,
          topicContent
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate quiz questions");
      }
      
      const data = await response.json();
      setQuizQuestions(data.questions);
      setQuizId(data.quizId);
      setQuizStarted(true);
      
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Failed to generate quiz questions");
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleQuizAnswerChange = (questionId: string, answer: string) => {
    setQuizAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleSubmitQuiz = async () => {
    if (!user || !quizId) return;
    
    setIsQuizLoading(true);
    
    try {
      // Call backend to evaluate quiz
      const response = await fetch('http://localhost:8000/api/evaluate-module-quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          quizId,
          answers: quizAnswers
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to evaluate quiz");
      }
      
      const data = await response.json();
      setQuizScore(data.score);
      setQuizFeedback(data.feedback);
      setQuizSubmitted(true);
      
      // If the quiz score is passing (>=70%), update module progress
      if (data.score >= 70) {
        // Save the quiz results to Firebase
        const quizResultRef = doc(db, "quizResults", quizId);
        await setDoc(quizResultRef, {
          userId: user.uid,
          courseId,
          moduleId,
          score: data.score,
          feedback: data.feedback,
          completionStatus: data.completionStatus,
          answers: quizAnswers,
          questions: quizQuestions, // Save the questions along with answers
          completedAt: new Date().toISOString()
        });
        
        // Update course progress to indicate this module has been completed via quiz
        await updateModuleProgress(100);
        
        toast.success("Quiz completed successfully!");
      } else {
        // Still save quiz results even if score is below passing
        const quizResultRef = doc(db, "quizResults", quizId);
        await setDoc(quizResultRef, {
          userId: user.uid,
          courseId,
          moduleId,
          score: data.score,
          feedback: data.feedback,
          completionStatus: "needs_review",
          answers: quizAnswers,
          questions: quizQuestions, // Save questions for all quiz attempts
          completedAt: new Date().toISOString()
        });
        
        toast.info("Quiz submitted. Further review recommended.");
      }
      
    } catch (error) {
      console.error("Error evaluating quiz:", error);
      toast.error("Failed to evaluate quiz");
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleMarkModuleComplete = async () => {
    if (!user) return;
    
    try {
      // Update module progress to 100%
      await updateModuleProgress(100);
      
      // Get the next module ID
      const currentModuleId = parseInt(moduleId);
      const nextModuleId = currentModuleId + 1;
      
      // Check if there's another module in the course
      const courseRef = doc(db, "courses", courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (courseDoc.exists()) {
        const courseData = courseDoc.data();
        const totalModules = courseData.modules.length;
        
        // If there are more modules, navigate to the next one
        if (nextModuleId <= totalModules) {
          router.push(`/course/${courseId}/module/${nextModuleId}`);
          toast.success("Module completed! Moving to the next module.");
        } else {
          // If this was the last module, go back to course page
          router.push(`/course/${courseId}`);
          toast.success("Congratulations! You've completed the final module.");
        }
      }
    } catch (error) {
      console.error("Error marking module as complete:", error);
      toast.error("Failed to update progress");
    }
  };

  // Add this helper function to update module progress
  const updateModuleProgress = async (progress: number) => {
    try {
      const courseRef = doc(db, "courses", courseId);
      const courseDoc = await getDoc(courseRef);
      
      if (courseDoc.exists()) {
        const courseData = courseDoc.data();
        const modules = courseData.modules || [];
        
        // Find the module being updated
        const moduleIndex = modules.findIndex((m: any) => 
          m.id.toString() === moduleId.toString()
        );
        
        if (moduleIndex !== -1) {
          // Update module progress
          modules[moduleIndex].progress = progress;
          
          // Calculate overall course progress (average of all module progress)
          const totalProgress = modules.reduce(
            (sum: number, mod: any) => sum + (mod.progress || 0), 
            0
          );
          const courseProgress = Math.round(totalProgress / modules.length);
          
          // Update Firebase with new progress data
          await updateDoc(courseRef, {
            modules: modules,
            progress: courseProgress,
            updatedAt: new Date().toISOString()
          });
          
          // Update local state
          setProgress(progress);
        }
      }
    } catch (error) {
      console.error("Error updating module progress:", error);
      throw error;
    }
  };

  // Update the checkExistingQuiz function to better handle loading completed quizzes
  const checkExistingQuiz = async () => {
    if (!user) return;
    
    try {
      // Query all quiz results for this module, not just completed ones
      const quizQuery = query(
        collection(db, "quizResults"),
        where("userId", "==", user.uid),
        where("courseId", "==", courseId),
        where("moduleId", "==", moduleId)
      );
      
      const quizSnapshot = await getDocs(quizQuery);
      
      if (!quizSnapshot.empty) {
        // Use the most recent quiz result (in case there are multiple attempts)
        const sortedDocs = quizSnapshot.docs.sort((a, b) => {
          const dateA = new Date(a.data().completedAt || 0);
          const dateB = new Date(b.data().completedAt || 0);
          return dateB.getTime() - dateA.getTime(); // Sort in descending order (newest first)
        });
        
        const quizData = sortedDocs[0].data();
        setQuizId(sortedDocs[0].id); // Store the quiz ID for potential updates
        setQuizSubmitted(true);
        setQuizScore(quizData.score);
        setQuizFeedback(quizData.feedback || "");
        setQuizAnswers(quizData.answers || {});
        
        // Set quiz questions from saved data
        if (quizData.questions && Array.isArray(quizData.questions)) {
          setQuizQuestions(quizData.questions);
        } else {
          // Create placeholder questions based on answers if no questions saved
          const placeholderQuestions = Object.keys(quizData.answers || {}).map((qId, index) => ({
            id: qId,
            question: `Question ${index + 1}`
          }));
          setQuizQuestions(placeholderQuestions);
        }
        
        // If a completed quiz exists, automatically set the active tab to quiz
        if (quizData.completionStatus === "completed" || quizData.score >= 70) {
          // Set a small delay to ensure component is mounted
          setTimeout(() => {
            setActiveTab("quiz");
          }, 100);
        }
      }
    } catch (error) {
      console.error("Error checking existing quiz:", error);
    }
  };

  // Move this call to useEffect to ensure it runs only once
  useEffect(() => {
    if (user && courseId && moduleId) {
      checkExistingQuiz();
    }
  }, [user, courseId, moduleId]);

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-3/4 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  // Only show auth error if we've checked auth state and user is not available
  if ((authChecked && !user) || error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error || "Failed to load module"}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push(`/course/${courseId}`)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Course
        </Button>
      </div>
    )
  }

  if (!module) {
    return (
      <div className="container max-w-7xl mx-auto px-4 py-8">
        <Skeleton className="h-12 w-3/4 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Skeleton className="h-[500px] w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      <nav className="flex items-center justify-between mb-8">
        <Button variant="ghost" onClick={() => router.push(`/course/${courseId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Course
        </Button>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={() => navigateToModule("prev")}
            disabled={parseInt(moduleId) === 1}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous Module
          </Button>
          <Button
            onClick={() => navigateToModule("next")}
            disabled={parseInt(moduleId) === 5}
          >
            Next Module <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader className="bg-primary text-primary-foreground">
            <CardTitle className="text-3xl">{module.title}</CardTitle>
            <CardDescription className="text-primary-foreground/80">{module.description}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="quiz" disabled={!module.quiz || module.quiz.length === 0}>Quiz</TabsTrigger>
                <TabsTrigger value="chat">AI Chat</TabsTrigger>
              </TabsList>
              <TabsContent value="content">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentTopicIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {topics.length > 0 ? (
                      topics.map((topic, index) => (
                      <div key={topic.id} className={index === currentTopicIndex ? "block" : "hidden"}>
                        <h3 className="text-2xl font-semibold mb-4">{topic.title}</h3>
                          {('videoId' in topic) && topic.videoId ? (
                            <div className="space-y-4">
                              <div className="aspect-video rounded-lg overflow-hidden shadow-lg">
                                <YouTube
                                  videoId={topic.videoId as string}
                                  opts={{
                                    width: "100%",
                                    height: "100%",
                                    playerVars: {
                                      autoplay: 0,
                                      modestbranding: 1,
                                      rel: 0,
                                      showinfo: 0,
                                    },
                                  }}
                                  className="w-full h-full"
                                  onEnd={() => index === currentTopicIndex && handleTopicNavigation("next")}
                                />
                              </div>
                              {('notes' in topic) && (
                                <div className="prose max-w-none">
                                  <h4 className="text-lg font-semibold mb-2">Notes:</h4>
                                  <div dangerouslySetInnerHTML={{ 
                                    __html: typeof topic.notes === 'string' ? topic.notes : '' 
                                  }} />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="prose max-w-none" 
                                 dangerouslySetInnerHTML={{ 
                                   __html: topic.content ? 
                                     // Convert markdown to HTML (basic version)
                                     topic.content
                                       .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                                       .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                                       .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                                       .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
                                       .replace(/\*(.*)\*/gm, '<em>$1</em>')
                                       .replace(/\n/gm, '<br>') : 
                                     'No content available.' 
                                 }} 
                            />
                          )}
                          
                          {/* For single item modules without a topic list, don't show navigation */}
                          {topics.length > 1 && (
                            <div className="flex justify-between mt-6">
                              <Button 
                                onClick={() => handleTopicNavigation("prev")} 
                                disabled={currentTopicIndex === 0}
                                variant="outline"
                              >
                                <ArrowLeft className="mr-2 h-4 w-4" /> Previous Topic
                              </Button>
                              
                              {currentTopicIndex === topics.length - 1 ? (
                                <Button 
                                  onClick={async () => {
                                    // Mark last topic as completed
                                    await markTopicAsCompleted(currentTopicIndex);
                                    
                                    // Get the next module ID
                                    const currentModuleId = parseInt(moduleId);
                                    const nextModuleId = currentModuleId + 1;
                                    
                                    // Check if there's another module in the course
                                    const courseRef = doc(db, "courses", courseId);
                                    const courseDoc = await getDoc(courseRef);
                                    
                                    if (courseDoc.exists()) {
                                      const courseData = courseDoc.data();
                                      const totalModules = courseData.modules.length;
                                      
                                      // If there are more modules, navigate to the next one
                                      if (nextModuleId <= totalModules) {
                                        router.push(`/course/${courseId}/module/${nextModuleId}`);
                                        toast.success("Module completed! Moving to the next module.");
                                      } else {
                                        // If this was the last module, go back to course page
                                        router.push(`/course/${courseId}`);
                                        toast.success("Congratulations! You've completed the final module.");
                                      }
                                    } else {
                                      // Fallback if course data not found
                                      router.push(`/course/${courseId}`);
                                    }
                                  }}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Complete Module <CheckCircle className="ml-2 h-4 w-4" />
                                </Button>
                              ) : (
                                <Button 
                                  onClick={() => handleTopicNavigation("next")} 
                                  disabled={currentTopicIndex === topics.length - 1}
                                >
                                  Next Topic <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      // Handle modules without topics - show direct content
                      <div>
                        {('videoId' in module) && module.videoId ? (
                          <div className="space-y-4">
                            <div className="aspect-video rounded-lg overflow-hidden shadow-lg">
                              <YouTube
                                videoId={module.videoId as string}
                                opts={{
                                  width: "100%",
                                  height: "100%",
                                  playerVars: {
                                    autoplay: 0,
                                    modestbranding: 1,
                                    rel: 0,
                                    showinfo: 0,
                                  },
                                }}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="prose max-w-none">
                              <h4 className="text-lg font-semibold mb-2">Description:</h4>
                              <p>{module.description}</p>
                            </div>
                          </div>
                        ) : module.content ? (
                          <div className="prose max-w-none" 
                               dangerouslySetInnerHTML={{ 
                                 __html: module.content
                                   .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                                   .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                                   .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                                   .replace(/\*\*(.*)\*\*/gm, '<strong>$1</strong>')
                                   .replace(/\*(.*)\*/gm, '<em>$1</em>')
                                   .replace(/\n/gm, '<br>') 
                               }} 
                          />
                        ) : (
                          <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md">
                            <p>This module doesn't contain any content yet.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
              
              {/* Quiz Tab Content */}
              <TabsContent value="quiz">
                <AnimatePresence mode="wait">
                  <motion.div
                    key="quiz"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-6"
                  >
                    {!isQuizLoading && !quizStarted && !quizSubmitted && (
                      <div className="text-center space-y-4 py-6">
                        <h3 className="text-2xl font-semibold">Module Quiz</h3>
                        <p className="text-muted-foreground max-w-lg mx-auto">
                          Test your understanding of this module by answering a few essay-style questions.
                          This will help reinforce your learning and identify areas for further study.
                        </p>
                        <Button 
                          id="start-quiz-button"
                          onClick={handleStartQuiz} 
                          size="lg"
                          className="mt-4 px-8 py-6 text-lg animate-pulse hover:animate-none"
                        >
                          <PenTool className="mr-2 h-5 w-5" />
                          Start Quiz
                        </Button>
                      </div>
                    )}

                    {isQuizLoading && (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin mb-4" />
                        <p className="text-muted-foreground">Generating quiz questions...</p>
                      </div>
                    )}

                    {quizStarted && !quizSubmitted && quizQuestions.length > 0 && (
                      <>
                        <h3 className="text-2xl font-semibold mb-6">Module Quiz: Answer the following questions</h3>
                        
                        {quizQuestions.map((question, qIndex) => (
                          <Card key={qIndex} className="mb-6">
                            <CardHeader>
                              <CardTitle className="text-lg font-medium">{qIndex + 1}. {question.question}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <Textarea
                                placeholder="Write your answer here..."
                                className="min-h-[120px]"
                                value={quizAnswers[question.id.toString()] || ""}
                                onChange={(e) => handleQuizAnswerChange(question.id.toString(), e.target.value)}
                              />
                            </CardContent>
                          </Card>
                        ))}
                        
                        <div className="flex justify-between">
                          <Button 
                            variant="outline" 
                            onClick={() => setQuizStarted(false)}
                          >
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleSubmitQuiz} 
                            disabled={Object.keys(quizAnswers).length < quizQuestions.length}
                            className="gap-2"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Submit Quiz
                          </Button>
                        </div>
                      </>
                    )}

                    {quizSubmitted && quizScore !== null && (
                      <div className="space-y-6">
                        <Card className="bg-primary/5 border-primary/20">
                          <CardHeader className="border-b pb-3">
                            <div className="flex justify-between items-center">
                              <CardTitle>Quiz Results</CardTitle>
                              <div className="flex items-center gap-3">
                                <Badge variant={quizScore >= 70 ? "success" : "warning"}>
                                  {quizScore >= 70 ? "Passed" : "Needs Review"}
                                </Badge>
                                <div className="text-2xl font-bold">{Math.round(quizScore)}%</div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4 space-y-4">
                            <div>
                              <Progress value={quizScore} className="h-2">
                                <div 
                                  className={`h-full ${quizScore >= 70 ? "bg-green-500" : "bg-yellow-500"}`} 
                                  style={{ width: `${quizScore}%` }} 
                                />
                              </Progress>
                            </div>
                            
                            <div className="space-y-2">
                              <h4 className="font-medium">Feedback:</h4>
                              <p className="text-muted-foreground">{quizFeedback}</p>
                            </div>
                            
                            {quizScore >= 70 ? (
                              <Alert className="bg-success/10 border-success text-success">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>Success!</AlertTitle>
                                <AlertDescription>
                                  Congratulations! You've successfully completed this module quiz.
                                </AlertDescription>
                              </Alert>
                            ) : (
                              <Alert className="bg-warning/10 border-warning">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Review Recommended</AlertTitle>
                                <AlertDescription>
                                  You might want to review the module content again to strengthen your understanding.
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                          <CardFooter className="border-t pt-4">
                            <Button 
                              className="w-full"
                              onClick={() => {
                                // Mark module as completed when quiz is passed
                                if (quizScore >= 70) {
                                  handleMarkModuleComplete();
                                } else {
                                  setActiveTab("content");
                                }
                              }}
                            >
                              {quizScore >= 70 ? "Continue to Next Module" : "Review Module Content"}
                            </Button>
                          </CardFooter>
                        </Card>
                        
                        <Card>
                          <CardHeader className="border-b">
                            <CardTitle>Your Quiz Responses</CardTitle>
                            <CardDescription>
                              Completed on {new Date().toLocaleDateString()}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6 pt-4">
                            {quizQuestions.map((question, qIndex) => (
                              <div key={qIndex} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                                <h4 className="font-medium text-lg">{qIndex + 1}. {question.question}</h4>
                                <div>
                                  <p className="text-sm text-muted-foreground mb-2">Your answer:</p>
                                  <div className="bg-muted p-3 rounded-md">
                                    <p className="whitespace-pre-wrap">{quizAnswers[question.id.toString()] || "No answer provided"}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
              
              <TabsContent value="chat" className="h-[600px]">
                <AIChatBox />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Module Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progress} className="mb-2">
                <div 
                  className={`h-full ${quizSubmitted && quizScore && quizScore >= 70 ? "bg-green-500" : ""}`} 
                  style={{ width: `${progress}%` }} 
                />
              </Progress>
              <p className="text-sm text-muted-foreground">
                {topics.length > 0 ? 
                  `${currentTopicIndex + 1} of ${topics.length} topics completed` : 
                  `Module ${moduleId} of 5`}
              </p>
              
              {quizSubmitted && quizScore !== null ? (
                // Show quiz result button if quiz is completed
                <div className="mt-4">
                  <Button 
                    variant={quizScore >= 70 ? "default" : "outline"} 
                    onClick={() => setActiveTab("quiz")} 
                    className={`w-full ${quizScore >= 70 ? "bg-green-500 hover:bg-green-600 text-white" : ""}`}
                  >
                    {quizScore >= 70 ? 
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Quiz Passed ({Math.round(quizScore)}%)</> : 
                      <><AlertTriangle className="mr-2 h-4 w-4" /> Quiz Needs Review ({Math.round(quizScore)}%)</>
                    }
                  </Button>
                </div>
              ) : (
                // Show quiz options if not yet completed
                <>
                  {progress >= 80 && !quizSubmitted && (
                    <div className="mt-4">
                      <Button 
                        variant="default" 
                        onClick={() => {
                          setActiveTab("quiz");
                          setTimeout(() => {
                            document.getElementById("start-quiz-button")?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                        }}
                        className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-md"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Ready to Test Your Knowledge?
                      </Button>
                    </div>
                  )}
                  
                  {!quizSubmitted && (
                    <div className="mt-4">
                      <Button 
                        variant="outline" 
                        onClick={() => setActiveTab("quiz")} 
                        className="w-full"
                      >
                        <PenTool className="mr-2 h-4 w-4" />
                        Take Module Quiz
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {topics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Module Contents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                  {topics.map((topic, index) => {
                    // Check if this topic is marked as completed
                    const isCompleted = module?.completedTopics?.includes(index);
                    
                    return (
                      <li 
                        key={topic.id} 
                        className={`flex items-center space-x-2 py-2 px-3 rounded-md cursor-pointer
                          ${index === currentTopicIndex ? "bg-primary/10" : ""}
                          ${isCompleted ? "text-primary" : "text-muted-foreground"}`}
                        onClick={() => setCurrentTopicIndex(index)}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="truncate flex-1">{topic.title}</span>
                        {isCompleted && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
                  </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Have questions about this module? Use our AI-powered chat assistant for instant help!
              </p>
              <Button onClick={() => setActiveTab("chat")} className="w-full">
                <MessageSquare className="mr-2 h-4 w-4" /> Open AI Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

