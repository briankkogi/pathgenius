"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export default function CallToAction() {
  return (
    <section id="cta" className="py-20">
      <div className="container mx-auto px-4 text-center">
        <div className="bg-primary/90 backdrop-blur-md text-primary-foreground py-12 px-6 rounded-lg shadow-lg">
          <motion.h2
            className="text-3xl font-bold mb-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            Ready to Revolutionize Your Learning?
          </motion.h2>
          <motion.p
            className="text-xl mb-8 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            Join thousands of learners already using PathGenius to achieve their educational goals.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Button size="lg" variant="secondary" asChild>
              <Link href="/sign-up">Start Your Learning Journey</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

