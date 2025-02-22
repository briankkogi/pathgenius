"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Award, TrendingUp, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"

// Mock data for demonstration purposes
const userData = {
  name: "John Doe",
  overallProgress: 100,
  coursesInProgress: 3,
  coursesCompleted: 2,
}

const initialCourses = [
  { id: 1, title: "Introduction to AI", progress: 0 },
  { id: 2, title: "Machine Learning Basics", progress: 30 },
  { id: 3, title: "Data Structures and Algorithms", progress: 75 },
  { id: 4, title: "Web Development Fundamentals", progress: 0 },
]

export default function Dashboard() {
  const [courses, setCourses] = useState(initialCourses)

  return (
    <div className="space-y-8">
      <DashboardHeader name={userData.name} />
      <StatsSection userData={userData} />
      <CoursesSection courses={courses} />
    </div>
  )
}

function DashboardHeader({ name }) {
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
      <Link href="/onboarding" passHref>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Course
        </Button>
      </Link>
    </div>
  )
}

function StatsSection({ userData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ProgressCard
        title="Overall Progress"
        value={userData.overallProgress}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <StatsCard
        title="Courses in Progress"
        value={userData.coursesInProgress}
        icon={<BookOpen className="h-6 w-6" />}
      />
      <StatsCard title="Courses Completed" value={userData.coursesCompleted} icon={<Award className="h-6 w-6" />} />
    </div>
  )
}

function CoursesSection({ courses }) {
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

function ProgressCard({ title, value, icon }) {
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

function StatsCard({ title, value, icon }) {
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

function CourseCard({ course, index }) {
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

