"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, ArrowRight, CheckCircle, Video, FileText, MessageSquare } from "lucide-react"
import YouTube from "react-youtube"
import { motion, AnimatePresence } from "framer-motion"
import { AIChatBox } from "@/components/AIChatBox"

// Mock course data structure with more comprehensive content
const coursesData = {
  1: {
    modules: [
      {
        id: 1,
        title: "Introduction to Web Development",
        description: "An overview of web development and its core technologies.",
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
      // ... other modules
    ],
  },
  // Add more courses as needed
}

export default function ModulePage() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.id as string
  const moduleId = params.moduleId as string
  const [module, setModule] = useState<any>(null)
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [quizAnswers, setQuizAnswers] = useState<number[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [activeTab, setActiveTab] = useState("content")
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    const course = coursesData[courseId]
    if (course) {
      const foundModule = course.modules.find((m) => m.id.toString() === moduleId)
      if (foundModule) {
        setModule(foundModule)
        setQuizAnswers(new Array(foundModule.quiz.length).fill(-1))
      }
    }
  }, [courseId, moduleId])

  useEffect(() => {
    if (module) {
      const newProgress = Math.round(((currentTopicIndex + 1) / module.topics.length) * 100)
      setProgress(newProgress)
    }
  }, [currentTopicIndex, module])

  const handleTopicComplete = () => {
    if (currentTopicIndex < module.topics.length - 1) {
      setCurrentTopicIndex(currentTopicIndex + 1)
    } else {
      setActiveTab("quiz")
    }
  }

  const handleQuizAnswer = (questionIndex: number, answerIndex: number) => {
    const newAnswers = [...quizAnswers]
    newAnswers[questionIndex] = answerIndex
    setQuizAnswers(newAnswers)
  }

  const handleQuizSubmit = () => {
    const correctAnswers = module.quiz.filter((q, i) => q.correctAnswer === quizAnswers[i]).length
    const quizProgress = Math.round((correctAnswers / module.quiz.length) * 100)
    setProgress(quizProgress)
    setQuizSubmitted(true)
  }

  const navigateToModule = (direction: "prev" | "next") => {
    const course = coursesData[courseId]
    const currentIndex = course.modules.findIndex((m) => m.id.toString() === moduleId)
    const newIndex = direction === "prev" ? currentIndex - 1 : currentIndex + 1
    if (newIndex >= 0 && newIndex < course.modules.length) {
      router.push(`/course/${courseId}/module/${course.modules[newIndex].id}`)
    }
  }

  if (!module) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Module Not Found</h1>
        <p>Sorry, we couldn't find the module you're looking for.</p>
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
          <Button variant="outline" onClick={() => navigateToModule("prev")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Previous Module
          </Button>
          <Button onClick={() => navigateToModule("next")}>
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
                <TabsTrigger value="content">Module Content</TabsTrigger>
                <TabsTrigger value="quiz">Module Quiz</TabsTrigger>
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
                    {module.topics.map((topic, index) => (
                      <div key={topic.id} className={index === currentTopicIndex ? "block" : "hidden"}>
                        <h3 className="text-2xl font-semibold mb-4">{topic.title}</h3>
                        {topic.type === "video" ? (
                          <div className="space-y-4">
                            <div className="aspect-video rounded-lg overflow-hidden shadow-lg">
                              <YouTube
                                videoId={topic.videoId}
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
                                onEnd={() => index === currentTopicIndex && handleTopicComplete()}
                              />
                            </div>
                            <div className="prose max-w-none">
                              <h4 className="text-lg font-semibold mb-2">AI-Generated Notes:</h4>
                              <div dangerouslySetInnerHTML={{ __html: topic.notes }} />
                            </div>
                          </div>
                        ) : (
                          <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: topic.content }} />
                        )}
                        <Button onClick={handleTopicComplete} className="mt-6">
                          {index === module.topics.length - 1 ? "Finish Module" : "Next Topic"}
                        </Button>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
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
                    {module.quiz.map((question, qIndex) => (
                      <Card key={qIndex} className="p-4">
                        <h4 className="font-semibold mb-2">{question.question}</h4>
                        <div className="space-y-2">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id={`q${qIndex}a${oIndex}`}
                                name={`question${qIndex}`}
                                value={oIndex}
                                checked={quizAnswers[qIndex] === oIndex}
                                onChange={() => handleQuizAnswer(qIndex, oIndex)}
                                disabled={quizSubmitted}
                                className="text-primary focus:ring-primary"
                              />
                              <label htmlFor={`q${qIndex}a${oIndex}`} className="text-sm">
                                {option}
                              </label>
                              {quizSubmitted && oIndex === question.correctAnswer && (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </Card>
                    ))}
                    {!quizSubmitted ? (
                      <Button onClick={handleQuizSubmit} disabled={quizAnswers.includes(-1)} className="w-full">
                        Submit Quiz
                      </Button>
                    ) : (
                      <Card className="p-4 bg-primary text-primary-foreground">
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-semibold">Quiz Result</span>
                          <span className="text-2xl font-bold">{progress}%</span>
                        </div>
                        <Progress value={progress} className="mt-2" />
                      </Card>
                    )}
                  </motion.div>
                </AnimatePresence>
              </TabsContent>
              <TabsContent value="chat">
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
                {currentTopicIndex + 1} of {module.topics.length} topics completed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Module Contents</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {module.topics.map((topic, index) => (
                  <li key={topic.id} className="flex items-center space-x-2">
                    {topic.type === "video" ? (
                      <Video className="h-4 w-4 text-primary" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                    <span className={index <= currentTopicIndex ? "text-primary" : "text-muted-foreground"}>
                      {topic.title}
                    </span>
                    {index < currentTopicIndex && <CheckCircle className="h-4 w-4 text-green-500" />}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

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

