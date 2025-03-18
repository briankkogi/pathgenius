from fastapi import FastAPI, HTTPException # type: ignore
from fastapi.middleware.cors import CORSMiddleware  # type: ignore
from pydantic import BaseModel # type: ignore
import httpx # type: ignore
import os
from typing import List, Dict, Any, Optional
import json
import re
import time
import logging
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

# Track active session IDs for each user to prevent duplicates
active_user_sessions = {}

# Track processing requests to prevent duplicate processing
processing_requests = set()

# Synchronization lock to prevent multiple identical requests
request_locks = {}

@app.post("/api/generate-assessment", response_model=AssessmentResponse)
async def generate_assessment(request: AssessmentRequest):
    """Generate a text-based assessment based on learning goal and profession level"""
    try:
        # Check if there's already an active request for this user
        user_id = request.userId
        request_key = f"{user_id}_{request.learningGoal}_{request.professionLevel}"
        
        # Create a lock for this specific request if it doesn't exist
        if request_key not in request_locks:
            request_locks[request_key] = asyncio.Lock()
            
        # Use the lock to ensure only one request processes at a time
        async with request_locks[request_key]:
            # Check if we already have a session for this user before doing any work
            if user_id in active_user_sessions:
                session_id = active_user_sessions[user_id]
                if session_id in assessment_sessions:
                    logger.info(f"Returning existing session for user {user_id}")
                    return {
                        "questions": assessment_sessions[session_id]["questions"],
                        "sessionId": session_id
                    }
            
            # If this request is already being processed, don't proceed
            if request_key in processing_requests:
                logger.info(f"Request {request_key} is already being processed. Waiting for completion.")
                # Wait a moment then return the current session if available
                for _ in range(5):  # Try checking 5 times with a delay
                    await asyncio.sleep(1)
                    if user_id in active_user_sessions:
                        session_id = active_user_sessions[user_id]
                        if session_id in assessment_sessions:
                            return {
                                "questions": assessment_sessions[session_id]["questions"],
                                "sessionId": session_id
                            }
                
                # If we still don't have a session, create an emergency one
                logger.warning(f"Waited for request {request_key} but no session was created. Creating emergency questions.")
                return create_emergency_questions(request)
                
            # Mark this request as processing
            processing_requests.add(request_key)
            logger.info(f"Starting to process request: {request_key}")
            
            try:
                # Use a refined prompt that encourages more thinking
                prompt = f"""
                You are an educational assessment expert. Your task is to create exactly 5 thoughtful, open-ended questions to evaluate a student's knowledge of {request.learningGoal}. The student identifies as having a {request.professionLevel} level of experience.

                Take your time to really think about what makes a good assessment question. The questions should:
                1. Be appropriate for a {request.professionLevel} level of expertise
                2. Require critical thinking and application of knowledge
                3. Allow the student to demonstrate depth of understanding
                4. Cover different aspects of {request.learningGoal}
                5. Be clear and unambiguous

                First, spend some time thinking about the domain of {request.learningGoal} and what a {request.professionLevel} level student should know.

                <think>
                You can use this space to plan your questions. Think deeply about what aspects of {request.learningGoal} would be most important to assess.
                </think>

                Format your final response ONLY as a JSON array with exactly 5 questions like this:
                [
                    {{
                        "id": 1,
                        "question": "First question text here?"
                    }},
                    {{
                        "id": 2, 
                        "question": "Second question text here?"
                    }},
                    ...and so on
                ]

                IMPORTANT: Use double quotes for all JSON properties and string values. Do NOT use single quotes or apostrophes (').
                If you need to include apostrophes in your text, please escape them like this: \\'

                DO NOT include any explanations, thinking, or comments outside the JSON array - ONLY return the JSON array.
                """
                
                print("\n\033[94m=== ASSESSMENT REQUEST ===\033[0m")
                print(f"\033[96mLearning Goal:\033[0m {request.learningGoal}")
                print(f"\033[96mProfession Level:\033[0m {request.professionLevel}")
                
                # Make the request to Ollama using the deepseek model
                async with httpx.AsyncClient(timeout=180.0) as client:  # Increased timeout for more thinking time
                    print("\n\033[94m=== SENDING REQUEST TO MODEL ===\033[0m")
                    print(f"\033[93mPrompt:\033[0m {prompt[:300]}...")  # Print beginning of prompt
                    
                    # Only make one request with increased temperature for more diverse thinking
                    response = await client.post(
                        "http://localhost:11434/api/generate",
                        json={
                            "model": "deepseek-r1:1.5b",
                            "prompt": prompt,
                            "stream": False,
                            "temperature": 0.7,  # Increased for more creative thinking
                            "max_tokens": 4000,  # Increased for more thinking space
                            "top_p": 0.9,       # Slightly more diverse sampling
                        }
                    )
                    
                    if response.status_code != 200:
                        print(f"\033[91mOllama API Error: {response.status_code}\033[0m")
                        raise HTTPException(status_code=500, detail=f"Failed to connect to Ollama: {response.status_code}")
                    
                    # Process the model response
                    questions_data = await process_model_response(response, request)
                    
                    # Create session with a timestamp to ensure uniqueness
                    session_id = f"session_{request.userId}_{int(time.time())}"
                    assessment_sessions[session_id] = {
                        "userId": request.userId,
                        "questions": questions_data,
                        "learningGoal": request.learningGoal,
                        "professionLevel": request.professionLevel,
                        "createdAt": time.time()
                    }
                    
                    # Track this session for this user
                    active_user_sessions[user_id] = session_id
                    
                    return {
                        "questions": questions_data,
                        "sessionId": session_id
                    }
                        
            except Exception as e:
                print(f"\n\033[91mUnexpected Error: {str(e)}\033[0m")
                return create_emergency_questions(request)
            finally:
                # Remove from processing set when done
                if request_key in processing_requests:
                    processing_requests.remove(request_key)
    
    except Exception as e:
        # If any error occurs in the outer try/except
        print(f"\n\033[91mOuter exception: {str(e)}\033[0m")
        request_key = f"{request.userId}_{request.learningGoal}_{request.professionLevel}"
        if request_key in processing_requests:
            processing_requests.remove(request_key)
        return create_emergency_questions(request)
    finally:
        # Clean up locks if they're no longer needed
        request_key = f"{request.userId}_{request.learningGoal}_{request.professionLevel}"
        if request_key in request_locks and len(processing_requests) == 0:
            del request_locks[request_key]

async def process_model_response(response, request):
    """Process the model response and extract questions"""
    result = response.json()
    content = result.get("response", "")
    
    print("\n\033[94m=== MODEL RESPONSE ===\033[0m")
    print(f"\033[92m{content[:500]}...\033[0m") # Print only the first 500 chars to avoid log spam
    
    # Fix apostrophes in the JSON string before extraction
    content = content.replace('"s ', '"\'s ')
    content = content.replace(' s"', '\'s"')
    content = content.replace("don't", "don\\'t")
    content = content.replace("won't", "won\\'t")
    content = content.replace("can't", "can\\'t")
    content = content.replace("it's", "it\\'s")
    content = content.replace("you're", "you\\'re")
    content = content.replace("they're", "they\\'re")
    
    # Extract the JSON array more robustly
    json_pattern = r'\[\s*\{.*?\}\s*\]'
    json_match = re.search(json_pattern, content, re.DOTALL)
    
    if not json_match:
        # Try with different regex if initial one fails
        json_match = re.search(r'\[[\s\S]*?\]', content, re.DOTALL)
        
    if not json_match:
        print("\n\033[91mFailed to extract JSON from model response\033[0m")
        
        # Try to manually create questions from the model output
        fallback_questions = extract_questions_manually(content)
        if fallback_questions:
            questions_data = fallback_questions
        else:
            raise HTTPException(status_code=500, detail="Could not extract valid questions from model response")
    else:
        try:
            json_str = json_match.group(0)
            
            # Fix common JSON formatting issues
            json_str = json_str.replace("'", '"')  # Replace single quotes with double quotes
            json_str = re.sub(r',\s*\]', ']', json_str)  # Remove trailing commas
            json_str = re.sub(r'(\w)"(\w)', r'\1\\"\2', json_str)  # Escape unescaped quotes within words
            
            try:
                questions_data = json.loads(json_str)
            except json.JSONDecodeError as e:
                # If JSON parsing fails, fix problematic quotes
                print(f"\n\033[91mJSON Decode Error: {str(e)}\033[0m")
                print(f"Attempting to fix JSON string: {json_str[:100]}...")
                
                # Advanced apostrophe and quote handling
                lines = json_str.split('\n')
                for i, line in enumerate(lines):
                    if '"question":' in line and ('"s ' in line or ' s"' in line):
                        lines[i] = line.replace('"s ', '"\\\'s ')
                        lines[i] = lines[i].replace(' s"', '\\\'s"')
                    
                json_str = '\n'.join(lines)
                
                # Try to parse the fixed JSON string
                try:
                    questions_data = json.loads(json_str)
                except json.JSONDecodeError:
                    # If it still fails, use regex to extract questions
                    fallback_questions = extract_questions_manually(content)
                    if fallback_questions:
                        questions_data = fallback_questions
                    else:
                        raise HTTPException(status_code=500, detail=f"Failed to parse model response as JSON: {str(e)}")
        
        except Exception as e:
            print(f"\n\033[91mException during JSON processing: {str(e)}\033[0m")
            raise HTTPException(status_code=500, detail=f"Error processing model response: {str(e)}")
    
    # Ensure we have exactly 5 questions and normalize IDs
    if not isinstance(questions_data, list):
        print("\n\033[91mQuestions data is not a list\033[0m")
        raise HTTPException(status_code=500, detail="Model response is not in expected format")
        
    # Limit to exactly 5 questions and normalize IDs
    # Pad with generic questions if we have fewer than 5
    while len(questions_data) < 5:
        questions_data.append({
            "id": len(questions_data) + 1,
            "question": f"Please describe your understanding of {request.learningGoal} at your current level."
        })
        
    questions_data = questions_data[:5]  # Truncate if more than 5
    
    # Normalize IDs
    for i, q in enumerate(questions_data):
        q["id"] = i + 1
        
        # Ensure question is a string
        if not isinstance(q.get("question"), str):
            q["question"] = f"Please explain a concept from {request.learningGoal} that you find interesting."
    
    print("\n\033[94m=== FINAL EXTRACTED QUESTIONS ===\033[0m")
    for q in questions_data:
        print(f"\033[92m{q.get('id', 'N/A')}: {q.get('question', 'No question text')}\033[0m")
        
    return questions_data

def create_emergency_questions(request):
    """Create emergency questions when model fails"""
    emergency_questions = [
        {"id": 1, "question": f"What are the fundamental concepts of {request.learningGoal} that you understand?"},
        {"id": 2, "question": f"How would you apply {request.learningGoal} to solve a real-world problem?"},
        {"id": 3, "question": f"What tools or technologies do you use when working with {request.learningGoal}?"},
        {"id": 4, "question": f"Explain a challenging concept in {request.learningGoal} and how you would teach it to others."},
        {"id": 5, "question": f"What are your goals for learning more about {request.learningGoal}?"}
    ]
    
    # Create session with emergency questions
    session_id = f"session_{request.userId}_{int(time.time())}"
    assessment_sessions[session_id] = {
        "userId": request.userId,
        "questions": emergency_questions,
        "learningGoal": request.learningGoal,
        "professionLevel": request.professionLevel,
        "createdAt": time.time()
    }
    
    # Track this session for this user
    active_user_sessions[request.userId] = session_id
    
    return {
        "questions": emergency_questions,
        "sessionId": session_id
    }

def extract_questions_manually(content: str) -> List[Dict[str, Any]]:
    """Extract questions from model output using regex even if JSON parsing fails"""
    questions = []
    
    # Look for patterns like question text with numbers or "id"
    question_patterns = [
        r'"question"\s*:\s*"([^"]+)"',  # Standard JSON format
        r'question\s*:\s*"([^"]+)"',    # Missing quotes around property
        r'(\d+)\.\s+([^.?!]+\??)',      # Numbered list (1. What is X?)
        r'"id"\s*:\s*\d+\s*,\s*"question"\s*:\s*"([^"]+)"'  # Full JSON format
    ]
    
    for pattern in question_patterns:
        matches = re.findall(pattern, content)
        if matches:
            for i, match in enumerate(matches):
                if isinstance(match, tuple):
                    # Some patterns might capture in groups
                    question_text = match[-1]  # Last group is usually the text
                else:
                    question_text = match
                
                questions.append({
                    "id": i + 1,
                    "question": question_text.strip()
                })
    
    # Limit to 5 questions
    return questions[:5] if questions else []

# Clean up old sessions periodically (helper function)
def cleanup_old_sessions():
    current_time = time.time()
    expired_sessions = []
    
    for session_id, session_data in assessment_sessions.items():
        # Remove sessions older than 24 hours
        if current_time - session_data.get("createdAt", 0) > 86400:
            expired_sessions.append(session_id)
            
            # Also remove from active_user_sessions
            user_id = session_data.get("userId")
            if user_id in active_user_sessions and active_user_sessions[user_id] == session_id:
                del active_user_sessions[user_id]
    
    for session_id in expired_sessions:
        if session_id in assessment_sessions:
            del assessment_sessions[session_id]
    
    if expired_sessions:
        logger.info(f"Cleaned up {len(expired_sessions)} expired sessions")

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
    
    print("\n\033[94m=== ASSESSMENT SUBMISSION ===\033[0m")
    print(f"\033[96mLearning Goal:\033[0m {session['learningGoal']}")
    print(f"\033[96mProfession Level:\033[0m {session['professionLevel']}")
    print(f"\033[96mCompletion Score:\033[0m {completion_score}%")
    print("\n\033[94m=== STUDENT ANSWERS ===\033[0m")
    
    for q in questions:
        q_id = str(q["id"])
        answer = submission.answers.get(q_id, "Skipped")
        print(f"\033[96mQuestion {q_id}:\033[0m {q['question']}")
        print(f"\033[92mAnswer:\033[0m {answer}\n")
    
    # Generate feedback based on the learningGoal and professionLevel
    feedback = f"You've completed {answered} out of {total} questions on {session['learningGoal']}."
    
    if completion_score == 100:
        next_steps = f"Great job answering all questions about {session['learningGoal']}! Based on your responses, we'll create a personalized learning path tailored to a {session['professionLevel']} level."
    elif completion_score >= 60:
        next_steps = f"You've made a good start with {session['learningGoal']}. We'll use your responses to create a learning path that builds on your knowledge, considering your {session['professionLevel']} background."
    else:
        next_steps = f"We'll create a learning plan for {session['learningGoal']} starting with fundamentals suitable for someone at a {session['professionLevel']} level."
    
    return {
        "score": completion_score,
        "feedback": feedback,
        "nextSteps": next_steps
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    # Clean up old sessions when health check is called
    cleanup_old_sessions()
    return {"status": "ok", "timestamp": time.time()}

if __name__ == "__main__":
    import uvicorn # type: ignore
    uvicorn.run(app, host="0.0.0.0", port=8000) 