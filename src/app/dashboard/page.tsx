"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Award, TrendingUp, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface UserData {
  name: string
  email: string
  overallProgress?: number
  coursesInProgress?: number
  coursesCompleted?: number
}

interface Course {
  id: number
  title: string
  progress: number
}

const initialCourses: Course[] = [
  { id: 1, title: "Introduction to AI", progress: 0 },
  { id: 2, title: "Machine Learning Basics", progress: 30 },
  { id: 3, title: "Data Structures and Algorithms", progress: 75 },
  { id: 4, title: "Web Development Fundamentals", progress: 0 },
]

export default function Dashboard() {
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [userData, setUserData] = useState<UserData | null>(null)
  const { user } = useFirebase()

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid))
          if (userDoc.exists()) {
            setUserData({
              ...userDoc.data() as UserData,
              overallProgress: 100,
              coursesInProgress: 3,
              coursesCompleted: 2,
            })
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      }
    }
    fetchUserData()
  }, [user])

  if (!userData) {
    return null // Or a loading spinner
  }

  return (
    <div className="space-y-8">
      <DashboardHeader name={userData.name} />
      <StatsSection userData={userData} />
      <CoursesSection courses={courses} />
    </div>
  )
}

interface DashboardHeaderProps {
  name: string
}

function DashboardHeader({ name }: DashboardHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <motion.h1
        className="text-3xl font-bold"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Welcome back, {name}!
      </motion.h1>
      <Link href="/onboarding?mode=add-course" passHref>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Course
        </Button>
      </Link>
    </div>
  )
}

interface StatsSectionProps {
  userData: UserData
}

function StatsSection({ userData }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ProgressCard
        title="Overall Progress"
        value={userData.overallProgress || 0}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <StatsCard
        title="Courses in Progress"
        value={userData.coursesInProgress || 0}
        icon={<BookOpen className="h-6 w-6" />}
      />
      <StatsCard 
        title="Courses Completed" 
        value={userData.coursesCompleted || 0} 
        icon={<Award className="h-6 w-6" />} 
      />
    </div>
  )
}

interface CoursesSectionProps {
  courses: Course[]
}

function CoursesSection({ courses }: CoursesSectionProps) {
  return (
    <>
      <motion.h2
        className="text-2xl font-semibold"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Your Courses
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {courses.map((course, index) => (
          <CourseCard key={course.id} course={course} index={index} />
        ))}
      </div>
    </>
  )
}

interface CardProps {
  title: string
  value: number
  icon: React.ReactNode
}

function ProgressCard({ title, value, icon }: CardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}%</div>
        <Progress value={value} className="mt-2" />
      </CardContent>
    </Card>
  )
}

function StatsCard({ title, value, icon }: CardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

interface CourseCardProps {
  course: Course
  index: number
}

function CourseCard({ course, index }: CourseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{course.title}</CardTitle>
          <CardDescription>Progress: {course.progress}%</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={course.progress} className="mb-4" />
          <Button asChild className="w-full">
            <Link href={`/course/${course.id}`}>
              {course.progress > 0 ? "Continue" : "Start"} Course <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}

