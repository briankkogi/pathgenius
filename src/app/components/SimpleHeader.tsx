import Link from "next/link"
import { DarkModeToggle } from "./DarkModeToggle"

export default function SimpleHeader() {
  return (
    <header className="bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-50 py-4">
      <div className="container mx-auto px-4 flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-primary">
          PathGenius
        </Link>
        <DarkModeToggle />
      </div>
    </header>
  )
}

