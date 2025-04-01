"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { useFirebase } from "@/contexts/FirebaseContext"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"

interface Course {
  id: string
  title: string
  progress: number
  lastUpdated?: string
}

interface ProgressTrend {
  course: Course
  change: number
}

export default function ProgressPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useFirebase()

  useEffect(() => {
    const fetchCourseProgress = async () => {
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
            lastUpdated: data.updatedAt || data.createdAt || new Date().toISOString()
          })
        })
        
        // Sort courses by progress (highest first)
        userCourses.sort((a, b) => b.progress - a.progress)
        
        setCourses(userCourses)
      } catch (error) {
        console.error("Error fetching course progress:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchCourseProgress()
  }, [user])

  // Calculate overview metrics
  const overallProgress = courses.length > 0 
    ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length) 
    : 0
    
  const mostProgressCourse = courses.length > 0 ? courses[0] : null
  const leastProgressCourse = courses.length > 0 ? courses[courses.length - 1] : null

  if (isLoading) {
    return <ProgressSkeleton />
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold mb-6">My Progress</h1>
      
      <ProgressOverview 
        overallProgress={overallProgress} 
        courseCount={courses.length} 
        mostProgressCourse={mostProgressCourse}
        leastProgressCourse={leastProgressCourse}
      />
      
      <CourseProgressList courses={courses} />
    </div>
  )
}

function ProgressSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-48" />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
      
      <Skeleton className="h-96 w-full rounded-lg" />
    </div>
  )
}

interface ProgressOverviewProps {
  overallProgress: number
  courseCount: number
  mostProgressCourse: Course | null
  leastProgressCourse: Course | null
}

function ProgressOverview({ 
  overallProgress, 
  courseCount, 
  mostProgressCourse, 
  leastProgressCourse 
}: ProgressOverviewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{overallProgress}%</div>
          <Progress value={overallProgress} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Across {courseCount} course{courseCount !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Most Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {mostProgressCourse ? (
            <>
              <div className="text-lg font-semibold truncate">{mostProgressCourse.title}</div>
              <div className="flex items-center mt-1">
                <Progress value={mostProgressCourse.progress} className="flex-1 mr-2" />
                <span className="text-sm font-medium">{mostProgressCourse.progress}%</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No courses available</p>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Least Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {leastProgressCourse ? (
            <>
              <div className="text-lg font-semibold truncate">{leastProgressCourse.title}</div>
              <div className="flex items-center mt-1">
                <Progress value={leastProgressCourse.progress} className="flex-1 mr-2" />
                <span className="text-sm font-medium">{leastProgressCourse.progress}%</span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No courses available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

interface CourseProgressListProps {
  courses: Course[]
}

function CourseProgressList({ courses }: CourseProgressListProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Course Progress</CardTitle>
        <CardDescription>Progress across all your courses</CardDescription>
      </CardHeader>
      <CardContent>
        {courses.length > 0 ? (
          <div className="space-y-4">
            {courses.map((course) => (
              <div key={course.id} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium truncate max-w-[70%]">{course.title}</span>
                  <span className="text-sm">{course.progress}%</span>
                </div>
                <Progress value={course.progress} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            You haven't started any courses yet
          </p>
        )}
      </CardContent>
    </Card>
  )
}

