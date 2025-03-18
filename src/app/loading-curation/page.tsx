"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import LoadingCuration from "../components/LoadingCuration"

export default function LoadingCurationPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const learningGoal = searchParams.get("goal") || "Your Course"
  const assessmentId = searchParams.get("assessment") || null

  // If coming from assessment results, we can use that ID to enhance the curation
  useEffect(() => {
    // The LoadingCuration component will handle the actual curation process
    // We're just ensuring our URL params are properly handled
  }, [assessmentId])

  return <LoadingCuration learningGoal={learningGoal} assessmentId={assessmentId} />
}
