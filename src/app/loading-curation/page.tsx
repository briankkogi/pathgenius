"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import LoadingCuration from "../components/LoadingCuration"

export default function LoadingCurationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const learningGoal = searchParams.get("goal") || "Your Course"
  const assessmentId = searchParams.get("assessment") || null

  useEffect(() => {
  }, [assessmentId])

  return <LoadingCuration learningGoal={learningGoal} assessmentId={assessmentId} />
}
