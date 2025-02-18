"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Send } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Message {
  role: "user" | "assistant"
  content: string
  thinking?: string
}

const models = [
  { value: "codeqwen", label: "CodeQwen" },
  { value: "deepseek-1.5b", label: "DeepSeek 1.5B" },
  { value: "deepseek-7b", label: "DeepSeek 7B" },
  { value: "llama3.2", label: "Llama 3.2" },
]

export function AIChatBox() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({})
  const [selectedModel, setSelectedModel] = useState("codeqwen")
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [scrollAreaRef]) //Corrected dependency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage: Message = { role: "user", content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch(`/api/chat/${selectedModel}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: input }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response from AI")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()
      const aiMessage: Message = { role: "assistant", content: "", thinking: "" }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(5))
            if (data.type === "thinking") {
              aiMessage.thinking = (aiMessage.thinking || "") + data.content
            } else {
              aiMessage.content = (aiMessage.content || "") + data.content
            }
            setMessages((prev) => [...prev.slice(0, -1), aiMessage])
          }
        }
      }
    } catch (error) {
      console.error("Error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const toggleThinking = (index: number) => {
    setShowThinking((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  return (
    <Card className="w-full h-full flex flex-col bg-gradient-to-b from-background to-background/80 shadow-lg">
      <CardHeader className="bg-primary text-primary-foreground py-3">
        <CardTitle className="text-xl font-bold flex items-center justify-between">
          AI Assistant
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.value} value={model.value}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-4" ref={scrollAreaRef}>
        <ScrollArea className="h-full pr-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start space-x-2 mb-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/ai-avatar.png" alt="AI" />
                  <AvatarFallback>AI</AvatarFallback>
                </Avatar>
              )}
              <div
                className={`rounded-lg p-3 max-w-[80%] ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  className="prose dark:prose-invert max-w-none"
                >
                  {message.content}
                </ReactMarkdown>
                {message.thinking && (
                  <div className="mt-2">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => toggleThinking(index)}
                      className="p-0 h-auto text-xs text-muted-foreground"
                    >
                      {showThinking[index] ? "Hide thinking process" : "Show thinking process"}
                    </Button>
                    {showThinking[index] && (
                      <pre className="mt-2 text-xs whitespace-pre-wrap bg-muted-foreground/10 p-2 rounded">
                        {message.thinking}
                      </pre>
                    )}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/user-avatar.png" alt="User" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">AI is thinking...</span>
            </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t bg-muted/50 p-4">
        <form onSubmit={handleSubmit} className="flex w-full space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask the AI assistant a question..."
            className="flex-grow"
          />
          <Button type="submit" disabled={isLoading}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

