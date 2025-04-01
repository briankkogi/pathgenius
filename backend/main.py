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

class AssessmentSubmission(BaseModel):
    sessionId: str
    answers: Dict[str, str]

class KnowledgeGap(BaseModel):
    topic: str
    description: str
    recommendedResources: List[str]

class ModuleRecommendation(BaseModel):
    title: str
    topics: List[str]

class AssessmentResult(BaseModel):
    score: float
    feedback: str
    nextSteps: str
    recommendedModules: Optional[List[ModuleRecommendation]] = None

# New models for course curation
class CurationRequest(BaseModel):
    learningGoal: str
    professionLevel: str
    userId: str
    assessmentId: Optional[str] = None
    strengths: Optional[List[str]] = None
    knowledgeGaps: Optional[List[Dict[str, Any]]] = None
    recommendedModules: Optional[List[Dict[str, Any]]] = None

class CourseModule(BaseModel):
    id: int
    title: str
    description: str
    progress: int = 0
    content: Optional[str] = None
    topics: Optional[List[Dict[str, Any]]] = None
    createdAt: Optional[str] = None

class CourseResponse(BaseModel):
    courseId: str
    title: str
    modules: List[CourseModule]
    createdAt: str

# In-memory storage for assessment sessions
assessment_sessions = {}

# Track active session IDs for each user to prevent duplicates
active_user_sessions = {}

# Track processing requests to prevent duplicate processing
processing_requests = set()

# Synchronization lock to prevent multiple identical requests
request_locks = {}

# In-memory storage for curated courses
curated_courses = {}

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

@app.post("/api/evaluate-assessment", response_model=AssessmentResult)
async def evaluate_assessment(submission: AssessmentSubmission):
    """Evaluate a text-based assessment submission using AI assistance"""
    if submission.sessionId not in assessment_sessions:
        raise HTTPException(status_code=404, detail="Assessment session not found")
    
    session = assessment_sessions[submission.sessionId]
    
    # Basic completion calculation
    questions = session["questions"]
    total = len(questions)
    answered = sum(1 for q_id in [str(q["id"]) for q in questions] if q_id in submission.answers and submission.answers[q_id].strip() and submission.answers[q_id] != "Skipped")
    
    # Calculate a completion score
    completion_score = (answered / total) * 100 if total > 0 else 0
    
    # Store the answers in the session
    session["answers"] = submission.answers
    
    print("\n\033[94m=== ASSESSMENT SUBMISSION ===\033[0m")
    print(f"\033[96mLearning Goal:\033[0m {session['learningGoal']}")
    print(f"\033[96mProfession Level:\033[0m {session['professionLevel']}")
    
    for q in questions:
        q_id = str(q["id"])
        answer = submission.answers.get(q_id, "Skipped")
        print(f"\033[96mQuestion {q_id}:\033[0m {q['question']}")
        print(f"\033[92mAnswer:\033[0m {answer}\n")
    
    # Initialize variables for AI evaluation
    knowledge_score = completion_score  # Default to completion score
    detailed_feedback = ""
    ai_next_steps = ""
    recommended_modules = []
    
    if answered > 0:
        try:
            # Create a prompt that also asks for module recommendations with more explicit formatting instructions
            eval_prompt = f"""
            You are an educational assessment expert evaluating a student's knowledge of {session['learningGoal']}. 
            The student is at a {session['professionLevel']} level.
            
            You will analyze the student's answers and provide a concise evaluation.
            
            IMPORTANT: Speak directly to the student using "you" (not "they" or "the student").
            
            Here are the student's answers:
            """
            
            # Add only the answered questions to the prompt
            for q in questions:
                q_id = str(q["id"])
                if q_id in submission.answers and submission.answers[q_id].strip() and submission.answers[q_id] != "Skipped":
                    question = q["question"]
                    answer = submission.answers[q_id]
                    eval_prompt += f"\nQuestion: {question}\nAnswer: {answer}\n"
            
            # Instructions for structured output with module recommendations - simplified
            eval_prompt += f"""
            Based on your analysis of the student's knowledge of {session['learningGoal']}, you must provide a JSON object with exactly this structure:

            {{
              "knowledgeScore": give a score between 0 and 100,
              "feedback": "1-2 sentences that provide a brief assessment of the student's understanding. Keep this very concise.",
              "nextSteps": "Clear recommendations for what to learn next, referring to the recommended modules below.",
              "recommendedModules": [
                {{
                  "title": "Module 1 Title",
                  "topics": ["Topic 1", "Topic 2", "Topic 3"]
                }},
                {{
                  "title": "Module 2 Title",
                  "topics": ["Topic 1", "Topic 2", "Topic 3"]
                }},
                {{
                  "title": "Module 3 Title",
                  "topics": ["Topic 1", "Topic 2", "Topic 3"]
                }},
                {{
                  "title": "Module 4 Title",
                  "topics": ["Topic 1", "Topic 2", "Topic 3"]
                }},
                {{
                  "title": "Module 5 Title",
                  "topics": ["Topic 1", "Topic 2", "Topic 3"]
                }}
              ]
            }}

            CRITICAL RULES:
            1. Return ONLY the JSON object above with no additional text
            2. Use double quotes for ALL strings and property names
            3. The feedback must be very brief (1-2 sentences)
            4. Include EXACTLY 5 modules with 3 topics each
            5. All module titles and topics must relate specifically to {session['learningGoal']}
            6. Do not include any comments, explanations, or thinking outside the JSON
            """
            
            print("\n\033[94m=== EVALUATION PROMPT ===\033[0m")
            print(f"\033[95m{eval_prompt}\033[0m")
            print("\n\033[94m=== REQUESTING AI EVALUATION ===\033[0m")
            
            # Make the request using the gemma3:4b model instead
            async with httpx.AsyncClient(timeout=240.0) as client:
                ai_response = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "gemma3:4b",  # Changed from deepseek to gemma3
                        "prompt": eval_prompt,
                        "stream": False,
                        "temperature": 0.1,     # Low temperature for more consistent formatting
                        "max_tokens": 8000,     # Plenty of tokens for full response
                        "top_p": 0.95          # Slightly higher top_p for better completion
                    }
                )
                
                if ai_response.status_code != 200:
                    print(f"\033[91mAI Evaluation Error: {ai_response.status_code}\033[0m")
                    raise HTTPException(status_code=500, detail="Model failed to evaluate the assessment")
                
                result = ai_response.json()
                content = result.get("response", "")
                
                # Print the FULL response for debugging
                print("\n\033[94m=== FULL AI EVALUATION RESPONSE ===\033[0m")
                print(f"\033[92m{content}\033[0m")
                
                # Extract JSON object - try multiple approaches
                try:
                    # First try direct JSON parsing in case the model responded with clean JSON
                    try:
                        # Clean up response (remove markdown code block indicators if present)
                        if "```json" in content:
                            content = re.sub(r'```json\s*(.*?)\s*```', r'\1', content, flags=re.DOTALL)
                        elif "```" in content:
                            content = re.sub(r'```\s*(.*?)\s*```', r'\1', content, flags=re.DOTALL)
                        
                        # Try to find a JSON object with braces
                        json_pattern = r'({[\s\S]*})'
                        json_match = re.search(json_pattern, content, re.DOTALL)
                        
                        if json_match:
                            json_str = json_match.group(1)
                            # Replace any single quotes with double quotes
                            json_str = json_str.replace("'", '"')
                            # Remove trailing commas before closing braces or brackets
                            json_str = re.sub(r',\s*}', '}', json_str)
                            json_str = re.sub(r',\s*]', ']', json_str)
                            
                            # Parse JSON
                            ai_data = json.loads(json_str)
                            
                            # Extract the relevant fields
                            if "knowledgeScore" in ai_data:
                                knowledge_score = float(ai_data.get("knowledgeScore", completion_score))
                                knowledge_score = max(0, min(100, knowledge_score))
                                
                            if "feedback" in ai_data:
                                detailed_feedback = ai_data.get("feedback", "").strip()
                                
                            if "nextSteps" in ai_data:
                                ai_next_steps = ai_data.get("nextSteps", "").strip()
                                
                            if "recommendedModules" in ai_data and isinstance(ai_data["recommendedModules"], list):
                                recommended_modules = ai_data["recommendedModules"]
                                print(f"\n\033[96mExtracted {len(recommended_modules)} modules from JSON\033[0m")
                    
                    except json.JSONDecodeError as e:
                        print(f"\033[91mJSON Decode Error: {str(e)}\033[0m")
                        
                        # Fall back to regex extraction for individual fields
                        knowledge_match = re.search(r'"knowledgeScore"\s*:\s*(\d+)', content)
                        if knowledge_match:
                            knowledge_score = float(knowledge_match.group(1))
                            
                        feedback_match = re.search(r'"feedback"\s*:\s*"([^"]+)"', content)
                        if feedback_match:
                            detailed_feedback = feedback_match.group(1).strip()
                            
                        nextsteps_match = re.search(r'"nextSteps"\s*:\s*"([^"]+)"', content)
                        if nextsteps_match:
                            ai_next_steps = nextsteps_match.group(1).strip()
                            
                        # Extract modules using regex
                        module_matches = re.finditer(r'{\s*"title"\s*:\s*"([^"]+)".*?"topics"\s*:\s*\[\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\]', content, re.DOTALL)
                        
                        for match in module_matches:
                            title = match.group(1)
                            topics = [match.group(2), match.group(3), match.group(4)]
                            recommended_modules.append({
                                "title": title,
                                "topics": topics
                            })
                            print(f"\033[96mExtracted Module: {title}\033[0m")
                    
                except Exception as e:
                    print(f"\033[91mError during JSON extraction: {str(e)}\033[0m")
        
        except Exception as e:
            print(f"\033[91mEvaluation error: {str(e)}\033[0m")
            raise HTTPException(status_code=500, detail=f"Assessment evaluation failed: {str(e)}")
    
    # Log the final extracted data
    print("\n\033[94m=== FINAL EVALUATION DATA (RAW FROM AI) ===\033[0m")
    print(f"\033[96mKnowledge Score:\033[0m {knowledge_score}%")
    print(f"\033[96mFeedback:\033[0m {detailed_feedback}")
    print(f"\033[96mNext Steps:\033[0m {ai_next_steps}")
    print(f"\033[96mRecommended Modules:\033[0m {len(recommended_modules)}")
    for i, module in enumerate(recommended_modules):
        print(f"  Module {i+1}: {module.get('title', 'No title')}")
        print(f"    Topics: {', '.join(module.get('topics', []))}")
    
    # Store the AI evaluation in the session
    session["aiEvaluation"] = {
        "detailedFeedback": detailed_feedback,
        "aiNextSteps": ai_next_steps,
        "knowledgeScore": knowledge_score,
        "evaluatedAt": time.time(),
        "recommendedModules": recommended_modules
    }
    
    # Return the evaluation directly
    return {
        "score": knowledge_score,
        "feedback": detailed_feedback,
        "nextSteps": ai_next_steps,
        "recommendedModules": recommended_modules
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    # Clean up old sessions when health check is called
    cleanup_old_sessions()
    return {"status": "ok", "timestamp": time.time()}

@app.post("/api/curate-course", response_model=CourseResponse)
async def curate_course(request: CurationRequest):
    """Generate a single module course based on the learning goal"""
    try:
        user_id = request.userId
        learning_goal = request.learningGoal
        
        # Create a unique key for this curation request to detect duplicates
        request_key = f"curate_{user_id}_{learning_goal}_{int(time.time()) // 60}"  # Group by minute
        
        # Check if this request is already being processed
        if request_key in processing_requests:
            logger.info(f"Duplicate curation request detected: {request_key}")
            # Wait a short time to see if the original request completes
            for _ in range(5):
                await asyncio.sleep(1)
                # Check if there's a recently created course we can return
                for course_id, course in curated_courses.items():
                    # If course was created in the last 2 minutes and matches our criteria
                    if (course.get("userId") == user_id and 
                        course.get("title", "").startswith(f"{learning_goal}") and
                        time.time() - course.get("createdTimestamp", 0) < 120):
                        logger.info(f"Returning existing course: {course_id}")
                        return course
            
            # If we couldn't find a course after waiting, proceed with creating a new one
        
        # Mark this request as processing
        processing_requests.add(request_key)
        logger.info(f"Starting course curation for user {user_id}, goal: {learning_goal}")
        
        try:
            # Continue with the existing course creation logic...
            course_id = f"course_{user_id}_{int(time.time())}"
            
            # Validate recommended modules
            if not request.recommendedModules or len(request.recommendedModules) == 0:
                logger.warning(f"No recommended modules provided from assessment.")
                raise HTTPException(status_code=400, detail="No recommended modules provided. Please complete an assessment first.")
            
            recommended_modules = request.recommendedModules
            logger.info(f"Using recommended modules from assessment, found {len(recommended_modules)} modules")
            
            # Initialize processed modules list - we'll only use the first module for content generation
            processed_modules = []
            
            # Get the first module only for processing
            if len(recommended_modules) > 0:
                first_module_data = recommended_modules[0]
                module_title = first_module_data.get('title', f"Module 1 on {learning_goal}")
                topics = []
                
                # Process topics from the first module
                if "topics" in first_module_data and isinstance(first_module_data["topics"], list):
                    for j, topic in enumerate(first_module_data["topics"][:3]):  # Limit to 3 topics
                        topic_title = topic if isinstance(topic, str) else topic.get('title', f"Topic {j+1}")
                        
                        # Removed type field
                        topics.append({
                            "id": f"1-{j+1}",
                            "title": topic_title,
                            "content": ""  # Will be populated with AI content
                        })
                
                # Create the first module structure - removed type field
                first_module = {
                    "id": 1,
                    "title": module_title,
                    "description": f"Learn about {module_title} for {learning_goal}",
                    "progress": 0,
                    "topics": topics
                }
                
                # Generate content for each topic in the first module
                for topic_index, topic in enumerate(first_module["topics"]):
                    topic_title = topic["title"]
                    logger.info(f"Generating content for topic: {topic_title}")
                    
                    # Create a focused prompt for this topic
                    topic_prompt = f"""
                    You are an educational content creator writing a detailed article about "{topic_title}" 
                    for a course on {learning_goal}.
                    
                    Create comprehensive, educational content that a student can learn from directly.
                    
                    The content should:
                    1. Be detailed and informative (at least 500 words)
                    2. Include examples and practical applications
                    3. Be well structured with headers and subheaders
                    4. Be factually accurate and comprehensive
                    5. Include markdown formatting (headers with #, lists, etc.)
                    
                    DO NOT use placeholder text or generic content - this will be shown directly to students.
                    DO NOT introduce the topic with phrases like "In this article we will discuss..." - 
                    instead, get straight into teaching the content.
                    
                    Write ONLY the article content in markdown format.
                    """
                    
                    # Generate content for this specific topic
                    async with httpx.AsyncClient(timeout=180.0) as client:
                        logger.info(f"Making request to AI for topic {topic_title}")
                        
                        response = await client.post(
                            "http://localhost:11434/api/generate",
                            json={
                                "model": "gemma3:4b",
                                "prompt": topic_prompt,
                                "stream": False,
                                "temperature": 0.7,
                                "max_tokens": 4000
                            }
                        )
                        
                        if response.status_code != 200:
                            logger.error(f"AI error for topic {topic_title}: {response.status_code}")
                            topic["content"] = ""
                            continue
                        
                        result = response.json()
                        topic_content = result.get("response", "")
                        
                        # Clean up any potential code blocks or extra content
                        if "```" in topic_content:
                            match = re.search(r'```(?:markdown)?\s*([\s\S]*?)\s*```', topic_content, re.DOTALL)
                            if match:
                                topic_content = match.group(1)
                        
                        # Ensure content has a title
                        if not topic_content.strip().startswith("#"):
                            topic_content = f"# {topic_title}\n\n{topic_content}"
                        
                        # Log the generated content
                        logger.info(f"Generated {len(topic_content)} characters for topic {topic_title}")
                        logger.info(f"Content preview: {topic_content[:100]}...")
                        
                        # Update the topic with the generated content
                        topic["content"] = topic_content
                
                # Add the processed first module
                processed_modules.append(first_module)
                
                # Add remaining modules without processing their content
                for i, module in enumerate(recommended_modules[1:5], start=1):
                    module_title = module.get('title', f"Module {i+1} on {learning_goal}")
                    empty_topics = []
                    
                    # Create empty topic structures for other modules - removed type field
                    if "topics" in module and isinstance(module["topics"], list):
                        for j, topic in enumerate(module["topics"][:3]):
                            topic_title = topic if isinstance(topic, str) else topic.get('title', f"Topic {j+1}")
                            empty_topics.append({
                                "id": f"{i+1}-{j+1}",
                                "title": topic_title,
                                "content": ""
                            })
                    
                    # Added to processed modules - removed type field
                    processed_modules.append({
                        "id": i+1,
                        "title": module_title,
                        "description": f"Learn about {module_title} for {learning_goal}",
                        "progress": 0,
                        "topics": empty_topics
                    })
            
            # Store the course in our in-memory storage with timestamp
            created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            curated_courses[course_id] = {
                "courseId": course_id,
                "userId": user_id,
                "title": f"{learning_goal} Course",
                "modules": processed_modules,
                "createdAt": created_at,
                "createdTimestamp": time.time(),  # Add timestamp for comparisons
                "isComplete": False,
                "firstModuleComplete": True
            }
            
            return curated_courses[course_id]
            
        finally:
            # Clean up after processing
            if request_key in processing_requests:
                processing_requests.remove(request_key)
                
    except Exception as e:
        logger.error(f"Error in curate_course: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate course: {str(e)}")

@app.get("/api/course/{course_id}")
async def get_course(course_id: str):
    """Retrieve a curated course by ID"""
    if course_id not in curated_courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return curated_courses[course_id]

if __name__ == "__main__":
    import uvicorn # type: ignore
    uvicorn.run(app, host="0.0.0.0", port=8000) 