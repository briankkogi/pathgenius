import { CheckCircle, Search, BookOpen } from "lucide-react"

const steps = [
  {
    icon: <Search className="h-12 w-12 text-primary" />,
    title: "Define Your Goals",
    description: "Tell us what you want to learn and your current knowledge level.",
  },
  {
    icon: <BookOpen className="h-12 w-12 text-primary" />,
    title: "AI-Powered Curation",
    description: "Our AI aggregates and organizes the best learning resources for you.",
  },
  {
    icon: <CheckCircle className="h-12 w-12 text-primary" />,
    title: "Learn and Progress",
    description: "Follow your personalized path and track your progress in real-time.",
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">How PathGenius Works</h2>
        <div className="flex flex-col md:flex-row justify-center items-center md:items-start space-y-8 md:space-y-0 md:space-x-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center max-w-xs bg-background/80 backdrop-blur-md p-6 rounded-lg shadow-md"
            >
              <div className="mb-4">{step.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

