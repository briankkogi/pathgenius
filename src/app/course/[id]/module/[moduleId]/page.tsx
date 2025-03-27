"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight, CheckCircle, Video, FileText, MessageSquare, BookOpen, PenTool } from "lucide-react"
import YouTube from "react-youtube"
import { AIChatBox } from "@/components/AIChatBox"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useFirebase } from "@/contexts/FirebaseContext"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { CourseModule, ModuleTopic, QuizQuestion } from "@/app/types/course"

// Add the FirebaseCourseData interface that's used in this file
interface FirebaseCourseData {
  userId: string;
  title: string;
  modules: CourseModule[];
  progress?: number;
  learningGoal?: string;
  createdAt: string;
}

// Keep the mock data as fallback
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

  // For quiz functionality
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [quizScore, setQuizScore] = useState(0)

  // Create topics array from module content if needed
  const [topics, setTopics] = useState<ModuleTopic[]>([])
  
  useEffect(() => {
    const fetchModule = async () => {
      try {
        if (!user) return;
        
        const courseDoc = await getDoc(doc(db, "courses", courseId));
        
        if (courseDoc.exists()) {
          const courseData = courseDoc.data() as FirebaseCourseData;
          
          // Ensure this course belongs to the user
          if (courseData.userId === user.uid) {
            // Find the specific module by ID
            const moduleIndex = parseInt(moduleId) - 1;
            const moduleData = courseData.modules[moduleIndex];
            
            if (moduleData) {
              setModule(moduleData);
              
              // Explicitly log the retrieved module data for debugging
              console.log("Retrieved module data:", moduleData);
              console.log("Module topics:", moduleData.topics);
              
              // Normalize the module structure
              const normalizedModule = {
                ...moduleData,
                id: moduleData.id || moduleIndex + 1,
                title: moduleData.title || `Module ${moduleIndex + 1}`,
                description: moduleData.description || `Module ${moduleIndex + 1} content`,
                quiz: moduleData.quiz || []
              };
              
              // Check if module has topics property
              if (normalizedModule.topics && normalizedModule.topics.length > 0) {
                // Normalize each topic to ensure it has all required fields, removing type and duration
                const normalizedTopics = normalizedModule.topics.map((topic: ModuleTopic) => {
                  return {
                    id: topic.id || `${normalizedModule.id}-1`,
                    title: topic.title || 'Untitled Topic',
                    content: topic.content || `# ${topic.title || 'Untitled Topic'}\n\nThis content is being prepared.`
                  };
                });
                
                console.log("Normalized topics:", normalizedTopics);
                setTopics(normalizedTopics);
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
          // Fallback to mock data
          const course = coursesData[parseInt(courseId) as keyof typeof coursesData]
          if (course) {
            const foundModule = course.modules.find(m => m.id.toString() === moduleId)
            if (foundModule) {
              // Create a properly shaped module object with all required properties
              const mockModule: CourseModule = {
                id: foundModule.id,
                title: foundModule.title,
                description: foundModule.description,
                progress: foundModule.progress || 0,
                topics: foundModule.topics,
                quiz: foundModule.quiz || []
              }
              
              setModule(mockModule)
              setTopics(mockModule.topics || [])
              
              // Initialize quiz answers if there are quiz questions
              if (mockModule.quiz && mockModule.quiz.length > 0) {
                setQuizAnswers(new Array(mockModule.quiz.length).fill(-1))
              }
            } else {
              setError("Module not found")
            }
          } else {
            setError("Course not found")
          }
        }
      } catch (error) {
        console.error("Error fetching module:", error);
        setError("Failed to load module content");
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchModule()
  }, [courseId, moduleId, user])

  useEffect(() => {
    if (module) {
      // Update progress based on current topic
      const newProgress = topics.length > 0 
        ? Math.round(((currentTopicIndex + 1) / topics.length) * 100)
        : 0
      setProgress(newProgress)
    }
  }, [currentTopicIndex, module, topics])

  const handleTopicNavigation = (direction: "prev" | "next") => {
    if (direction === "prev" && currentTopicIndex > 0) {
      setCurrentTopicIndex(currentTopicIndex - 1)
    } else if (direction === "next" && currentTopicIndex < topics.length - 1) {
      setCurrentTopicIndex(currentTopicIndex + 1)
    }
  }

  const navigateToModule = (direction: "prev" | "next") => {
    // Convert moduleId to number for comparison
    const currentModuleNum = parseInt(moduleId)
    const newModuleNum = direction === "prev" ? currentModuleNum - 1 : currentModuleNum + 1
    
    // Navigate if the new module number is valid (between 1 and 5)
    if (newModuleNum >= 1 && newModuleNum <= 5) {
      router.push(`/course/${courseId}/module/${newModuleNum}`)
    }
  }

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    if (quizSubmitted) return; // Don't allow changing answers after submission
    
    const newAnswers = [...quizAnswers];
    newAnswers[questionIndex] = answerIndex;
    setQuizAnswers(newAnswers);
  }

  const handleQuizSubmit = async () => {
    if (!module || !module.quiz || module.quiz.length === 0) return;
    
    // Calculate score
    const correctAnswers = module.quiz.filter((q: QuizQuestion, i: number) => 
      q.correctAnswer === quizAnswers[i]).length;
    const score = Math.round((correctAnswers / module.quiz.length) * 100);
    
    setQuizScore(score);
    setQuizSubmitted(true);
    
    // Update module progress in Firebase
    try {
      if (user) {
        // Get current course data
        const courseDoc = await getDoc(doc(db, "courses", courseId));
        if (courseDoc.exists()) {
          const courseData = courseDoc.data() as FirebaseCourseData;
          
          // Update the module's progress
          const updatedModules = [...courseData.modules];
          const moduleIndex = parseInt(moduleId) - 1;
          
          updatedModules[moduleIndex] = {
            ...updatedModules[moduleIndex],
            progress: 100 // Mark as complete after taking quiz
          };
          
          // Calculate overall course progress
          const totalModules = updatedModules.length;
          const completedModules = updatedModules.filter(m => m.progress === 100).length;
          const overallProgress = Math.round((completedModules / totalModules) * 100);
          
          // Update the course document
          await updateDoc(doc(db, "courses", courseId), {
            modules: updatedModules,
            progress: overallProgress
          });
          
          toast.success("Module completed! Progress saved.");
        }
      }
    } catch (error) {
      console.error("Error updating progress:", error);
      toast.error("Failed to save progress");
    }
  }

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

  if (error || !module) {
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
                              <Button onClick={() => handleTopicNavigation("prev")} disabled={currentTopicIndex === 0}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Previous Topic
                              </Button>
                              <Button onClick={() => handleTopicNavigation("next")} disabled={currentTopicIndex === topics.length - 1}>
                                Next Topic <ArrowRight className="ml-2 h-4 w-4" />
                              </Button>
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
                    <h3 className="text-2xl font-semibold mb-4">Module Quiz</h3>
                    {module.quiz && module.quiz.length > 0 ? (
                      <>
                        {module.quiz.map((question: QuizQuestion, qIndex: number) => (
                          <Card key={qIndex} className="p-4">
                            <CardContent>
                              <h4 className="font-semibold mb-4">{question.question}</h4>
                              <RadioGroup 
                                value={quizAnswers[qIndex]?.toString()} 
                                onValueChange={(value) => handleQuizAnswer(qIndex, parseInt(value))}
                                className="space-y-2"
                                disabled={quizSubmitted}
                              >
                                {question.options.map((option: string, oIndex: number) => (
                                  <div key={oIndex} className="flex items-center space-x-2">
                                    <RadioGroupItem 
                                      value={oIndex.toString()} 
                                      id={`q${qIndex}a${oIndex}`} 
                                      disabled={quizSubmitted}
                                    />
                                    <Label htmlFor={`q${qIndex}a${oIndex}`} className="text-sm">
                                      {option}
                                    </Label>
                                    {quizSubmitted && oIndex === question.correctAnswer && (
                                      <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                                    )}
                                  </div>
                                ))}
                              </RadioGroup>
                              
                              {quizSubmitted && quizAnswers[qIndex] !== question.correctAnswer && (
                                <div className="mt-2 text-sm text-red-500">
                                  Correct answer: {question.options[question.correctAnswer]}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                        
                        {!quizSubmitted ? (
                          <Button 
                            onClick={handleQuizSubmit} 
                            disabled={quizAnswers.includes(-1)} 
                            className="w-full"
                          >
                            Submit Quiz
                          </Button>
                        ) : (
                          <Card className="p-4 bg-primary text-primary-foreground">
                            <CardContent>
                              <div className="flex items-center justify-between">
                                <span className="text-lg font-semibold">Quiz Result</span>
                                <span className="text-2xl font-bold">{quizScore}%</span>
                              </div>
                              <Progress value={quizScore} className="mt-2" />
                              
                              <div className="mt-4">
                                {quizScore >= 70 ? (
                                  <p>Great job! You've passed this module quiz.</p>
                                ) : (
                                  <p>Keep learning! You might want to review the module content again.</p>
                                )}
                              </div>
                            </CardContent>
                            
                            <div className="px-4 pb-4">
                              <Button onClick={() => setActiveTab("content")} className="w-full">
                                Return to Content
                              </Button>
                            </div>
                          </Card>
                        )}
                      </>
                    ) : (
                      <div className="text-center p-6 bg-muted rounded-md">
                        <p>No quiz available for this module.</p>
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
              <Progress value={progress} className="mb-2" />
              <p className="text-sm text-muted-foreground">
                {topics.length > 0 ? 
                  `${currentTopicIndex + 1} of ${topics.length} topics completed` : 
                  `Module ${moduleId} of 5`}
              </p>
              
              {module.quiz && module.quiz.length > 0 && (
                <div className="mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setActiveTab("quiz")} 
                    className="w-full"
                    disabled={quizSubmitted}
                  >
                    <PenTool className="mr-2 h-4 w-4" />
                    {quizSubmitted ? "Quiz Completed" : "Take Module Quiz"}
                  </Button>
                </div>
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
                  {topics.map((topic, index) => (
                    <li key={topic.id} className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className={index <= currentTopicIndex ? "text-primary" : "text-muted-foreground"}>
                        {topic.title}
                      </span>
                      {index < currentTopicIndex && <CheckCircle className="h-4 w-4 text-green-500" />}
                    </li>
                  ))}
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

