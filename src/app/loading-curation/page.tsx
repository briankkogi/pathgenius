"use client"

import LoadingCuration from "../components/LoadingCuration"
import { useSearchParams } from "next/navigation"

export default function LoadingCurationPage() {
  const searchParams = useSearchParams()
  const learningGoal = searchParams.get("goal") || "Your Course"
  return <LoadingCuration learningGoal={learningGoal} />
}

