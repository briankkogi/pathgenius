"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, CheckCircle, Video, FileText, PenTool, Clock, BarChart } from "lucide-react"
import Link from "next/link"

// Mock course data structure with filler content
const coursesData = {
  1: {
    modules: 5,
    initialProgress: 0,
    content: [
      {
        id: 1,
        title: "Introduction to Web Development",
        type: "video",
        duration: "15 minutes",
        description: "An overview of web development and its core technologies.",
        videoId: "UB1O30fR-EE", // Example YouTube video ID
        progress: 0,
      },
      {
        id: 2,
        title: "HTML Basics",
        type: "article",
        duration: "20 minutes read",
        description: "Learn the fundamentals of HTML and document structure.",
        progress: 0,
      },
      {
        id: 3,
        title: "CSS Fundamentals",
        type: "video",
        duration: "25 minutes",
        description: "Understand how to style web pages using CSS.",
        videoId: "yfoY53QXEnI", // Example YouTube video ID
        progress: 0,
      },
      {
        id: 4,
        title: "JavaScript Essentials",
        type: "article",
        duration: "30 minutes read",
        description: "Get started with JavaScript programming for the web.",
        progress: 0,
      },
      {
        id: 5,
        title: "Building Your First Webpage",
        type: "exercise",
        duration: "45 minutes",
        description: "Apply your knowledge to create a simple webpage.",
        progress: 0,
      },
    ],
  },
  // Add more courses as needed
}

export default function CoursePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const courseId = params.id as string
  const learningGoal = searchParams.get("goal") || "Your Course"
  const [course, setCourse] = useState<any>(null)
  const [completedModules, setCompletedModules] = useState<number[]>([])

  useEffect(() => {
    if (coursesData[courseId]) {
      setCourse({
        ...coursesData[courseId],
        title: decodeURIComponent(learningGoal),
        progress: coursesData[courseId].initialProgress,
      })
    }
  }, [courseId, learningGoal])

  useEffect(() => {
    if (course) {
      const initialCompletedModules = Array.from(
        { length: Math.floor((course.initialProgress / 100) * course.modules) },
        (_, index) => index,
      )
      setCompletedModules(initialCompletedModules)
    }
  }, [course])

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Course Not Found</h1>
        <p>Sorry, we couldn't find the course you're looking for.</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <motion.h1
        className="text-3xl font-bold mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {course.title}
      </motion.h1>

      <CourseProgress course={course} completedModules={completedModules.length} />

      <ModuleList courseId={courseId} course={course} completedModules={completedModules} />
    </div>
  )
}

function CourseProgress({ course, completedModules }) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Course Progress</CardTitle>
        <CardDescription>You've completed {course.progress}% of this course</CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={course.progress} className="mb-2" />
        <p className="text-sm text-muted-foreground">
          {completedModules} of {course.modules} modules completed
        </p>
      </CardContent>
    </Card>
  )
}

function ModuleList({ courseId, course, completedModules }) {
  return (
    <div className="space-y-4">
      {course.content.map((module, index) => (
        <ModuleCard
          key={module.id}
          courseId={courseId}
          module={module}
          isCompleted={completedModules.includes(index)}
        />
      ))}
    </div>
  )
}

function ModuleCard({ courseId, module, isCompleted }) {
  const getIcon = (type) => {
    switch (type) {
      case "video":
        return <Video className="h-6 w-6" />
      case "article":
        return <FileText className="h-6 w-6" />
      case "exercise":
        return <PenTool className="h-6 w-6" />
      default:
        return <BookOpen className="h-6 w-6" />
    }
  }

  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${isCompleted ? "bg-primary/5" : ""}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`p-2 rounded-full ${isCompleted ? "bg-primary" : "bg-muted"}`}>
            {isCompleted ? <CheckCircle className="h-6 w-6 text-primary-foreground" /> : getIcon(module.type)}
          </div>
          <div className="flex-grow">
            <h3 className="text-lg font-semibold mb-2">{module.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{module.description}</p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {module.duration}
              </div>
              <div className="flex items-center">
                <BarChart className="h-4 w-4 mr-1" />
                {isCompleted ? "Completed" : "Not started"}
              </div>
            </div>
          </div>
          <Button variant={isCompleted ? "outline" : "default"} asChild>
            <Link href={`/course/${courseId}/module/${module.id}`}>{isCompleted ? "Review" : "Start"}</Link>
          </Button>
        </div>
        {!isCompleted && (
          <div className="mt-4">
            <Progress value={module.progress} className="h-1" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

