"use client"
import { useState, useRef, useEffect } from "react"
import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Send, ChevronDown } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import "katex/dist/katex.min.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { db, auth } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, where } from "firebase/firestore"
import { useAuthState } from "react-firebase-hooks/auth"
import { toast } from "sonner"

interface Message {
  role: "user" | "assistant"
  content: string
  thinking?: string
  timestamp?: Date
}

const models = [
  { value: "codeqwen", label: "CodeQwen" },
  { value: "deepseek-1.5b", label: "DeepSeek 1.5B" },
  { value: "deepseek-7b", label: "DeepSeek 7B" },
  { value: "llama3.2", label: "Llama 3.2" },
]

export function AIChatBox() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi there! I'm your AI assistant. How can I help you today?",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showThinking, setShowThinking] = useState<Record<number, boolean>>({})
  const [selectedModel, setSelectedModel] = useState("codeqwen")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [userScrolled, setUserScrolled] = useState(false)
  const [user] = useAuthState(auth)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isUsingLocalChat, setIsUsingLocalChat] = useState(false)

  // Load previous messages from Firestore when component mounts
  useEffect(() => {
    async function loadLatestConversation() {
      if (!user) {
        setIsLoadingHistory(false)
        return
      }
      
      try {
        // Get conversations for this user (without orderBy)
        const conversationsRef = collection(db, "conversations")
        const q = query(
          conversationsRef,
          where("userId", "==", user.uid)
        )
        
        const querySnapshot = await getDocs(q)
        
        if (!querySnapshot.empty) {
          // Find the most recent conversation manually
          let mostRecentDoc = querySnapshot.docs[0];
          let mostRecentDate = mostRecentDoc.data().createdAt?.toDate() || new Date(0);
          
          querySnapshot.docs.forEach(doc => {
            const docDate = doc.data().createdAt?.toDate() || new Date(0);
            if (docDate > mostRecentDate) {
              mostRecentDate = docDate;
              mostRecentDoc = doc;
            }
          });
          
          const conversationDoc = mostRecentDoc;
          const conversationData = conversationDoc.data();
          
          setConversationId(conversationDoc.id);
          
          try {
            // Get messages for this conversation
            const messagesRef = collection(db, "conversations", conversationDoc.id, "messages")
            const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"))
            const messagesSnapshot = await getDocs(messagesQuery)
            
            if (!messagesSnapshot.empty) {
              const loadedMessages = messagesSnapshot.docs.map(doc => {
                const data = doc.data()
                return {
                  role: data.role,
                  content: data.content,
                  thinking: data.thinking || undefined,
                  timestamp: data.timestamp?.toDate() || new Date()
                } as Message
              })
              setMessages(loadedMessages)
            }
          } catch (messageError) {
            console.error("Error loading messages:", messageError)
            // Continue with empty messages rather than failing completely
            console.log("Starting with empty conversation due to message loading error")
          }
        } else {
          // Create a new conversation
          await createNewConversation()
        }
      } catch (error) {
        console.error("Error loading chat history:", error)
        toast.error("Failed to load chat history. Using local chat only.")
        
        // Fall back to local-only chat when Firebase permissions fail
        setIsUsingLocalChat(true)
      } finally {
        setIsLoadingHistory(false)
      }
    }
    
    loadLatestConversation()
  }, [user])

  // Create a new conversation
  const createNewConversation = async () => {
    if (!user) return null
    
    try {
      const conversationRef = await addDoc(collection(db, "conversations"), {
        userId: user.uid,
        model: selectedModel,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
      
      setConversationId(conversationRef.id)
      
      // Add the initial welcome message
      const welcomeMessage = {
        role: "assistant",
        content: "Hi there! I'm your AI assistant. How can I help you today?",
        timestamp: new Date()
      }
      
      await addDoc(collection(db, "conversations", conversationRef.id, "messages"), {
        ...welcomeMessage,
        timestamp: serverTimestamp()
      })
      
      return conversationRef.id
    } catch (error) {
      console.error("Error creating new conversation:", error)
      return null
    }
  }

  // Save a message to Firestore with better error handling
  const saveMessageToFirestore = async (message: Message) => {
    if (!user || isUsingLocalChat) return
    
    let currentConversationId = conversationId
    
    try {
      // If no conversation exists, create one
      if (!currentConversationId) {
        currentConversationId = await createNewConversation()
        if (!currentConversationId) return
      }
      
      // Add message to the conversation
      await addDoc(collection(db, "conversations", currentConversationId, "messages"), {
        role: message.role,
        content: message.content,
        thinking: message.thinking || null,
        timestamp: serverTimestamp()
      })
      
    } catch (error) {
      console.error("Error saving message:", error)
    }
  }

  // Auto-scroll effect
  useEffect(() => {
    if (!userScrolled) {
      scrollToBottom(false)
    }
  }, [messages, userScrolled])

  // Scroll event listener
  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    
    if (!scrollArea) return
    
    const handleScroll = () => {
      if (!scrollArea) return
      
      const isScrolledToBottom = 
        scrollArea.scrollHeight - scrollArea.scrollTop <= scrollArea.clientHeight + 50
      
      if (!isScrolledToBottom) {
        setUserScrolled(true)
      }
    }
    
    scrollArea.addEventListener('scroll', handleScroll)
    
    return () => {
      scrollArea.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const resetScroll = () => {
    setUserScrolled(false)
    scrollToBottom(true)
  }

  const scrollToBottom = (smooth = true) => {
    if (userScrolled) return
    
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
      }
    }, 10)
  }

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    resetScroll()

    const userMessage: Message = { role: "user", content: input, timestamp: new Date() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    scrollToBottom()
    
    // Save user message to Firestore
    await saveMessageToFirestore(userMessage)

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
      const aiMessage: Message = { role: "assistant", content: "", thinking: "", timestamp: new Date() }
      
      setMessages((prev) => [...prev, aiMessage])
      scrollToBottom()

      let updateCounter = 0
      const SCROLL_UPDATE_FREQUENCY = 5
      
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
            
            setMessages((prev) => {
              const updatedMessages = [...prev]
              updatedMessages[updatedMessages.length - 1] = { ...aiMessage }
              return updatedMessages
            })
            
            updateCounter++
            if (!userScrolled && updateCounter % SCROLL_UPDATE_FREQUENCY === 0) {
              scrollToBottom(true)
            }
          }
        }
      }
      
      // Save the complete AI response to Firestore
      await saveMessageToFirestore(aiMessage)
      
      if (!userScrolled) {
        scrollToBottom()
      }
    } catch (error) {
      console.error("Error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }
      setMessages((prev) => [...prev, errorMessage])
      
      // Save error message to Firestore
      await saveMessageToFirestore(errorMessage)
    } finally {
      setIsLoading(false)
      if (!userScrolled) {
        scrollToBottom()
      }
    }
  }

  const toggleThinking = (index: number) => {
    setShowThinking((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const handleScrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
    setUserScrolled(false)
  }

  return (
    <Card className="w-full h-full flex flex-col bg-gradient-to-b from-background to-background/80 shadow-lg">
      <CardHeader className="bg-primary text-primary-foreground py-3 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-bold">AI Assistant</CardTitle>
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-[200px] bg-primary-foreground text-primary">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            align="end"
            className="w-[200px]"
          >
            {models.map((model) => (
              <SelectItem
                key={model.value}
                value={model.value}
                className={`py-2 px-4 cursor-pointer transition-colors ${
                  selectedModel === model.value ? "bg-primary/10 text-primary" : "hover:bg-primary/5"
                }`}
              >
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden p-4" ref={scrollAreaRef}>
        <ScrollArea className="h-full pr-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Start a conversation by sending a message.
            </div>
          ) : (
            messages.map((message, index) => (
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
                      : "bg-muted text-muted-foreground"
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
                  {message.timestamp && (
                    <div className="mt-1 text-xs text-muted-foreground/70">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || ""} alt="User" />
                    <AvatarFallback>{user?.displayName?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">AI is thinking...</span>
            </div>
          )}
          <div ref={messagesEndRef} style={{ height: '1px' }}></div>
        </ScrollArea>
        
        {userScrolled && messages.length > 2 && (
          <Button 
            onClick={handleScrollToBottom}
            size="sm"
            className="absolute bottom-5 right-5 rounded-full p-2 shadow-md opacity-90 hover:opacity-100"
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
      <CardFooter className="border-t bg-muted/50 p-4">
        <form onSubmit={handleSubmit} className="flex w-full space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user ? "Ask the AI assistant a question..." : "Sign in to chat with the AI"}
            className="flex-grow"
            disabled={!user || isLoading}
          />
          <Button type="submit" disabled={!user || isLoading}>
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}

