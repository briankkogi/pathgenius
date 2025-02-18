"use client"

import { Brain, Target, Clock, Zap } from "lucide-react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"

const features = [
  {
    icon: <Brain className="h-8 w-8 text-primary" />,
    title: "Personalized Learning Paths",
    description: "AI-curated content tailored to your knowledge level and learning style.",
  },
  {
    icon: <Target className="h-8 w-8 text-primary" />,
    title: "Diverse Content Sources",
    description: "Access high-quality resources from Google, YouTube, and Open Educational Resources.",
  },
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: "Adaptive Learning",
    description: "Your learning path evolves as you progress, ensuring optimal challenge and growth.",
  },
  {
    icon: <Zap className="h-8 w-8 text-primary" />,
    title: "Real-time Progress Tracking",
    description: "Monitor your advancement and receive personalized recommendations.",
  },
]

export default function Features() {
  const { theme } = useTheme()

  return (
    <section id="features" className={`py-20 ${theme === "dark" ? "bg-gray-900/50" : "bg-gray-50/50"}`}>
      <div className="container mx-auto px-4">
        <motion.h2
          className="text-3xl font-bold text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          Unlock Your Learning Potential
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="bg-background/80 backdrop-blur-md p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

