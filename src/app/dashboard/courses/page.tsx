"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowRight, Clock } from "lucide-react"
import Link from "next/link"
import { useFirebase } from "@/contexts/FirebaseContext"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface Course {
  id: string
  title: string
  progress: number
  learningGoal: string
  moduleCount: number
  createdAt: string
}

export default function Courses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useFirebase()

  useEffect(() => {
    const fetchCourses = async () => {
      if (!user) return
      
      try {
        setIsLoading(true)
        
        const coursesRef = collection(db, "courses")
        const q = query(coursesRef, where("userId", "==", user.uid))
        const querySnapshot = await getDocs(q)
        
        const userCourses: Course[] = []
        querySnapshot.forEach((doc) => {
          const data = doc.data()
          userCourses.push({
            id: doc.id,
            title: data.title || "Untitled Course",
            progress: data.progress || 0,
            learningGoal: data.learningGoal || "General Learning",
            moduleCount: Array.isArray(data.modules) ? data.modules.length : 0,
            createdAt: data.createdAt || new Date().toISOString()
          })
        })
        
        // Sort courses by creation date (newest first)
        userCourses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        
        setCourses(userCourses)
      } catch (error) {
        console.error("Error fetching courses:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchCourses()
  }, [user])

  if (isLoading) {
    return <CoursesLoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold mb-6">My Courses</h1>
        <Button asChild>
          <Link href="/onboarding?mode=add-course">Add Course</Link>
        </Button>
      </div>
      
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course, index) => (
            <CourseCard key={course.id} course={course} index={index} />
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-muted-foreground mb-4">You don't have any courses yet.</p>
          <Button asChild>
            <Link href="/onboarding?mode=add-course">Add Your First Course</Link>
          </Button>
        </Card>
      )}
    </div>
  )
}

function CoursesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

interface CourseCardProps {
  course: Course
  index: number
}

function CourseCard({ course, index }: CourseCardProps) {
  // Format date to be more readable
  const formattedDate = new Date(course.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="line-clamp-1">{course.title}</CardTitle>
          <CardDescription className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Added {formattedDate}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Progress: {course.progress}%</p>
            <Progress value={course.progress} />
          </div>
          <div className="text-sm">
            <span className="font-medium">{course.moduleCount}</span> modules
          </div>
          <div className="text-sm line-clamp-1">
            <span className="text-muted-foreground">Goal: </span>{course.learningGoal}
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href={`/course/${course.id}`}>
              {course.progress > 0 ? "Continue" : "Start"} Course <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

