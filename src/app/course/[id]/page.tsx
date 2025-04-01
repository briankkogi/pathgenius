"use client"

import { useParams, useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, CheckCircle, Video, FileText, PenTool, Clock, BarChart } from "lucide-react"
import Link from "next/link"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useFirebase } from "@/contexts/FirebaseContext"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { CourseModule, Course } from "@/app/types/course"

// Define interfaces to fix type errors
interface CourseData {
  modules: number;
  initialProgress: number;
  content: CourseModule[];
}

interface FirebaseCourseData {
  userId: string;
  title: string;
  modules: CourseModule[];
  progress?: number;
  learningGoal?: string;
  createdAt: string;
}

// Update to use typed record
const coursesData: Record<string, {modules: number, initialProgress: number, content: CourseModule[]}> = {
  "1": {
    modules: 5,
    initialProgress: 0,
    content: [
      {
        id: 1,
        title: "Introduction to Web Development",
        description: "An overview of web development and its core technologies.",
        progress: 0,
      },
      {
        id: 2,
        title: "HTML Basics",
        description: "Learn the fundamentals of HTML and document structure.",
        progress: 0,
      },
      {
        id: 3,
        title: "CSS Fundamentals",
        description: "Understand how to style web pages using CSS.",
        progress: 0,
      },
      {
        id: 4,
        title: "JavaScript Essentials",
        description: "Get started with JavaScript programming for the web.",
        progress: 0,
      },
      {
        id: 5,
        title: "Building Your First Webpage",
        description: "Apply your knowledge to create a simple webpage.",
        progress: 0,
      },
    ]
  },
  // Add more courses as needed
}

export default function CoursePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const courseId = params?.id as string || "1"
  const learningGoal = searchParams?.get("goal") || "Your Course"
  const [course, setCourse] = useState<Course | null>(null)
  const [completedModules, setCompletedModules] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useFirebase()

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        if (!user) return;
        
        // Load course from Firebase
        const courseDoc = await getDoc(doc(db, "courses", courseId));
        
        if (courseDoc.exists()) {
          const courseData = courseDoc.data() as FirebaseCourseData;
          
          // Check if course belongs to the user
          if (courseData.userId === user.uid) {
            console.log("Retrieved course data:", courseData);
            
            // Prepare the course object
            const course: Course = {
              id: courseId,
              title: courseData.title || `Course on ${learningGoal}`,
              progress: courseData.progress || 0,
              content: courseData.modules.map((module: CourseModule) => ({
                id: module.id,
                title: module.title,
                description: module.description,
                progress: module.progress || 0,
                topics: module.topics || []
              }))
            };
            
            setCourse(course);
            
            // Calculate which modules are completed (100% progress)
            const completedModuleIndices = courseData.modules
              .map((module: CourseModule, index: number) => 
                (module.progress || 0) === 100 ? index : -1)
              .filter((index: number) => index !== -1);
              
            setCompletedModules(completedModuleIndices);
          } else {
            setError("You don't have permission to view this course");
          }
        } else {
          // If not found in Firebase, try to load from mock data
          if (coursesData[courseId]) {
            const mockData = coursesData[courseId];
            const mockCourse = {
              id: courseId,
              title: `Course on ${learningGoal}`,
              progress: mockData.initialProgress,
              content: mockData.content
            };
            
            setCourse(mockCourse);
          } else {
            setError("Course not found");
          }
        }
      } catch (error) {
        console.error("Error fetching course:", error);
        setError("Failed to load course");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchCourse();
  }, [courseId, learningGoal, user]);

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-12 w-3/4 mb-6" />
        <Skeleton className="h-48 w-full mb-8" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Course Not Found</h1>
        <p>{error || "Sorry, we couldn't find the course you're looking for."}</p>
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

// Add prop types to components
interface CourseProgressProps {
  course: Course;
  completedModules: number;
}

function CourseProgress({ course, completedModules }: CourseProgressProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Course Progress</CardTitle>
        <CardDescription>You've completed {course.progress}% of this course</CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={course.progress} className="mb-2" />
        <p className="text-sm text-muted-foreground">
          {completedModules} of {course.modules || course.content.length} modules completed
        </p>
      </CardContent>
    </Card>
  )
}

interface ModuleListProps {
  courseId: string;
  course: Course;
  completedModules: number[];
}

function ModuleList({ courseId, course, completedModules }: ModuleListProps) {
  return (
    <div className="space-y-4">
      {course.content.map((module: CourseModule, index: number) => (
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

interface ModuleCardProps {
  courseId: string;
  module: CourseModule;
  isCompleted: boolean;
}

function ModuleCard({ courseId, module, isCompleted }: ModuleCardProps) {
  return (
    <Card className={`transition-all duration-300 hover:shadow-md ${isCompleted ? "bg-primary/5" : ""}`}>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          <div className={`p-2 rounded-full ${isCompleted ? "bg-primary" : "bg-muted"}`}>
            {isCompleted ? 
              <CheckCircle className="h-6 w-6 text-primary-foreground" /> : 
              <BookOpen className="h-6 w-6" />
            }
          </div>
          <div className="flex-grow">
            <h3 className="text-lg font-semibold mb-2">{module.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{module.description}</p>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center">
                <BarChart className="h-4 w-4 mr-1" />
                {isCompleted ? "Completed" : 
                  module.progress > 0 ? `${module.progress}% complete` : "Not started"}
              </div>
            </div>
          </div>
          <Button variant={isCompleted ? "outline" : "default"} asChild>
            <Link href={`/course/${courseId}/module/${module.id}`}>
              {isCompleted ? "Review" : module.progress > 0 ? "Continue" : "Start"}
            </Link>
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

