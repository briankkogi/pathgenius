from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from typing import List, Dict, Any, Optional
import json
import re
import time

app = FastAPI(title="PathGenius Assessment API")

# Configure CORS to allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Update with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AssessmentRequest(BaseModel):
    learningGoal: str
    professionLevel: str
    userId: str

class AssessmentQuestion(BaseModel):
    id: int
    question: str

class AssessmentResponse(BaseModel):
    questions: List[AssessmentQuestion]
    sessionId: str

# In-memory storage for assessment sessions
assessment_sessions = {}

@app.post("/api/generate-assessment", response_model=AssessmentResponse)
async def generate_assessment(request: AssessmentRequest):
    """Generate a text-based assessment based on learning goal and profession level"""
    try:
        # Use a direct prompt for text-based questions
        prompt = f"""
        Create an assessment test for someone learning {request.learningGoal} 
        at a {request.professionLevel} level.
        
        Generate 5 short-answer questions that help evaluate their knowledge.
        
        Format your response as a JSON array like this:
        [
            {{
                "id": 1,
                "question": "Explain what X is and how it works?"
            }},
            {{
                "id": 2,
                "question": "What are the key principles of Y?"
            }},
            ...more questions...
        ]
        
        Only return the JSON array and nothing else.
        """
        
        # Try to get questions from Ollama first
        questions = None
        
        # Attempt to use Ollama
        max_retries = 2
        for attempt in range(max_retries):
            try:
                print(f"Attempt {attempt+1} to generate text-based questions")
                async with httpx.AsyncClient(timeout=20.0) as client:
                    response = await client.post(
                        "http://localhost:11434/api/generate",
                        json={
                            "model": "llama3.2:latest",
                            "prompt": prompt,
                            "stream": False,
                            "temperature": 0.1
                        }
                    )
                    
                    if response.status_code != 200:
                        print(f"Ollama returned status code: {response.status_code}")
                        continue
                    
                    result = response.json()
                    content = result.get("response", "")
                    
                    # Try to find JSON in the response
                    json_match = re.search(r'\[.*\]', content, re.DOTALL)
                    
                    if not json_match:
                        print("Could not find JSON array in Ollama response")
                        continue
                    
                    try:
                        json_str = json_match.group(0)
                        questions_data = json.loads(json_str)
                        
                        if isinstance(questions_data, list) and len(questions_data) > 0:
                            print(f"Successfully extracted {len(questions_data)} questions")
                            questions = questions_data
                            break
                    except json.JSONDecodeError:
                        print("JSON decode error")
                        continue
            except Exception as e:
                print(f"Error during attempt {attempt+1}: {str(e)}")
                
        # If we couldn't get questions from Ollama, use preset questions
        if not questions:
            print("Using fallback questions")
            questions = generate_text_questions(request.learningGoal)
        
        # Create a session ID
        session_id = f"session_{request.userId}_{int(time.time())}"
        
        # Store the session
        assessment_sessions[session_id] = {
            "userId": request.userId,
            "questions": questions,
            "learningGoal": request.learningGoal,
            "professionLevel": request.professionLevel
        }
        
        return {
            "questions": questions,
            "sessionId": session_id
        }
        
    except Exception as e:
        print(f"Outer exception: {str(e)}")
        fallback_questions = generate_text_questions(request.learningGoal)
        
        # Create a session ID for the fallback
        session_id = f"session_{request.userId}_{int(time.time())}"
        
        # Store the session with fallback questions
        assessment_sessions[session_id] = {
            "userId": request.userId,
            "questions": fallback_questions,
            "learningGoal": request.learningGoal,
            "professionLevel": request.professionLevel
        }
        
        return {
            "questions": fallback_questions,
            "sessionId": session_id
        }

def generate_text_questions(topic: str) -> List[Dict[str, Any]]:
    """Generate preset text-based questions for a given topic"""
    topic_lower = topic.lower()
    
    # Python questions
    if "python" in topic_lower or "coding" in topic_lower or "programming" in topic_lower:
        return [
            {"id": 1, "question": f"What are variables in {topic} and how do you define them?"},
            {"id": 2, "question": f"Explain the concept of functions in {topic} and provide a simple example."},
            {"id": 3, "question": f"What are data structures in {topic} and name a few common ones."},
            {"id": 4, "question": f"Explain the difference between loops and conditionals in {topic}."},
            {"id": 5, "question": f"What is error handling in {topic} and why is it important?"}
        ]
    
    # Web development questions
    elif "web" in topic_lower or "html" in topic_lower or "css" in topic_lower or "javascript" in topic_lower:
        return [
            {"id": 1, "question": f"What is the basic structure of an HTML document?"},
            {"id": 2, "question": f"Explain the difference between inline and block elements in HTML/CSS."},
            {"id": 3, "question": f"What is the CSS box model and what are its components?"},
            {"id": 4, "question": f"Explain the concept of DOM manipulation in JavaScript."},
            {"id": 5, "question": f"What are responsive design principles and why are they important?"}
        ]
        
    # Data science questions
    elif "data" in topic_lower or "machine learning" in topic_lower or "ai" in topic_lower:
        return [
            {"id": 1, "question": f"What is the difference between supervised and unsupervised learning?"},
            {"id": 2, "question": f"Explain what data preprocessing is and why it's important."},
            {"id": 3, "question": f"What is overfitting and how can it be prevented?"},
            {"id": 4, "question": f"Explain the concept of feature selection in machine learning."},
            {"id": 5, "question": f"What are common evaluation metrics for classification models?"}
        ]
    
    # Generic questions for any topic
    else:
        return [
            {"id": 1, "question": f"What are the foundational concepts of {topic}?"},
            {"id": 2, "question": f"Explain a practical application of {topic} in the real world."},
            {"id": 3, "question": f"What are the key skills needed to excel in {topic}?"},
            {"id": 4, "question": f"Describe the evolution of {topic} over the past few years."},
            {"id": 5, "question": f"What resources would you recommend for someone starting to learn {topic}?"}
        ]

class AssessmentSubmission(BaseModel):
    sessionId: str
    answers: Dict[str, str]

class AssessmentResult(BaseModel):
    score: float
    feedback: str
    nextSteps: str

@app.post("/api/evaluate-assessment", response_model=AssessmentResult)
async def evaluate_assessment(submission: AssessmentSubmission):
    """Evaluate a text-based assessment submission"""
    if submission.sessionId not in assessment_sessions:
        raise HTTPException(status_code=404, detail="Assessment session not found")
    
    session = assessment_sessions[submission.sessionId]
    
    # For text-based answers, we'll provide general feedback based on completion
    # since we can't truly evaluate the correctness automatically
    
    # Count how many questions were answered
    questions = session["questions"]
    total = len(questions)
    answered = sum(1 for q_id in [str(q["id"]) for q in questions] if q_id in submission.answers and submission.answers[q_id].strip())
    
    # Calculate a completion score
    completion_score = (answered / total) * 100 if total > 0 else 0
    
    # Store the answers in the session
    session["answers"] = submission.answers
    
    # Generate feedback
    feedback = f"You've completed {answered} out of {total} questions on {session['learningGoal']}."
    
    if completion_score == 100:
        next_steps = f"Great job answering all questions! Based on your responses, we'll create a personalized learning path for {session['learningGoal']}."
    elif completion_score >= 60:
        next_steps = f"You've made a good start with {session['learningGoal']}. We'll use your responses to create a learning path that builds on your knowledge."
    else:
        next_steps = f"We'll create a learning plan for {session['learningGoal']} starting with the fundamentals to help you build a strong foundation."
    
    return {
        "score": completion_score,
        "feedback": feedback,
        "nextSteps": next_steps
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "timestamp": time.time()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 