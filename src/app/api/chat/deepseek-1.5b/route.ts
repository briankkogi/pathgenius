export async function POST(req: Request) {
    const { message } = await req.json()
  
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          console.log("Sending request to Ollama (DeepSeek 1.5B)...")
          const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "deepseek-r1:1.5b",
              prompt: message,
              stream: true,
            }),
          })
  
          console.log("Ollama response status:", response.status)
  
          if (!response.ok) {
            const errorText = await response.text()
            console.error("Ollama error response:", errorText)
            throw new Error(`Failed to get response from Ollama: ${response.status} ${errorText}`)
          }
  
          const reader = response.body?.getReader()
          if (!reader) throw new Error("No reader available")
  
          let thinking = ""
          let content = ""
          let isThinking = false
  
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
  
            const chunk = new TextDecoder().decode(value)
            const lines = chunk.split("\n")
  
            for (const line of lines) {
              if (line.trim() === "") continue
              const data = JSON.parse(line)
  
              if (data.response.startsWith("<think>")) {
                isThinking = true
                thinking = ""
              } else if (data.response.endsWith("</think>")) {
                isThinking = false
                thinking += data.response.replace("</think>", "")
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking", content: thinking })}\n\n`))
              } else if (isThinking) {
                thinking += data.response
              } else {
                content += data.response
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "content", content: data.response })}\n\n`),
                )
              }
            }
          }
  
          controller.close()
        } catch (error) {
          console.error("Error in API route:", error)
          controller.error(error)
        }
      },
    })
  
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  }
  
  