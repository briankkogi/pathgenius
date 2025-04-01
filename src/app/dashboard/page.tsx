"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BookOpen, Award, TrendingUp, Plus, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useFirebase } from "@/contexts/FirebaseContext"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Skeleton } from "@/components/ui/skeleton"

interface UserData {
  name: string
  email: string
  initialLearningGoal?: string
  topics?: Record<string, { professionLevel: string, addedAt: string }>
}

interface Course {
  id: string
  title: string
  progress: number
  learningGoal: string
}

export default function Dashboard() {
  const [courses, setCourses] = useState<Course[]>([])
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { user } = useFirebase()

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          setIsLoading(true);
          
          // Fetch user profile data
          const userDoc = await getDoc(doc(db, "users", user.uid))
          let userProfile: UserData | null = null;
          
          if (userDoc.exists()) {
            userProfile = userDoc.data() as UserData;
            // Use displayName from Firebase Auth as fallback
            if (!userProfile.name && user.displayName) {
              userProfile.name = user.displayName;
            }
            // Use email from Firebase Auth as fallback
            if (!userProfile.email && user.email) {
              userProfile.email = user.email;
            }
            setUserData(userProfile);
          } else {
            // Create basic user profile if it doesn't exist
            userProfile = {
              name: user.displayName || "User",
              email: user.email || ""
            };
            setUserData(userProfile);
          }
          
          // Fetch user's courses
          const coursesRef = collection(db, "courses");
          const q = query(coursesRef, where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          
          const userCourses: Course[] = [];
          querySnapshot.forEach((doc) => {
            const courseData = doc.data();
            userCourses.push({
              id: doc.id,
              title: courseData.title || "Untitled Course",
              progress: courseData.progress || 0,
              learningGoal: courseData.learningGoal || "General Learning"
            });
          });
          
          setCourses(userCourses);
        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    fetchUserData();
  }, [user]);

  // Calculate overall stats
  const overallProgress = courses.length > 0 
    ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length) 
    : 0;
    
  const coursesInProgress = courses.filter(course => course.progress > 0 && course.progress < 100).length;
  const coursesCompleted = courses.filter(course => course.progress === 100).length;

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!userData) {
    return null; // Or a better fallback UI
  }

  return (
    <div className="space-y-8">
      <DashboardHeader name={userData.name || "User"} />
      <StatsSection 
        overallProgress={overallProgress}
        coursesInProgress={coursesInProgress}
        coursesCompleted={coursesCompleted}
      />
      <CoursesSection courses={courses} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-36 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-8 w-36 my-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-48 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

interface DashboardHeaderProps {
  name: string;
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
  );
}

interface StatsSectionProps {
  overallProgress: number;
  coursesInProgress: number;
  coursesCompleted: number;
}

function StatsSection({ overallProgress, coursesInProgress, coursesCompleted }: StatsSectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <ProgressCard
        title="Overall Progress"
        value={overallProgress}
        icon={<TrendingUp className="h-6 w-6" />}
      />
      <StatsCard
        title="Courses in Progress"
        value={coursesInProgress}
        icon={<BookOpen className="h-6 w-6" />}
      />
      <StatsCard 
        title="Courses Completed" 
        value={coursesCompleted}
        icon={<Award className="h-6 w-6" />} 
      />
    </div>
  );
}

interface CoursesSectionProps {
  courses: Course[];
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
      {courses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
    </>
  );
}

interface CardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
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
  );
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
  );
}

interface CourseCardProps {
  course: Course;
  index: number;
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
  );
}

