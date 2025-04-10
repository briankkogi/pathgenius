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

# Track processing requests to prevent duplicate processing
processing_requests = set()

# Synchronization lock to prevent multiple identical requests
curation_locks = {}

# Add these new models after your existing ones
class ModuleQuizRequest(BaseModel):
    moduleId: str
    userId: str
    courseId: str
    topicContent: List[Dict[str, str]]

class ModuleQuizResponse(BaseModel):
    questions: List[AssessmentQuestion]
    quizId: str

class ModuleQuizSubmission(BaseModel):
    quizId: str
    answers: Dict[str, str]

class ModuleQuizResult(BaseModel):
    score: float
    feedback: str
    completionStatus: str

class ModuleContentRequest(BaseModel):
    userId: str
    courseId: str
    moduleId: str
    learningGoal: str = ""
    moduleTitle: str

# Add these near the top of the file with other global variables
module_content_requests = set()  # Track in-flight module content requests
module_content_locks = {}  # Locks for module content generation

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
    print(f"\033[92m{content[:500]}...\033[0m") 

    
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
    user_id = request.userId
    learning_goal = request.learningGoal
    # Use a more persistent key for the lock, not time-based
    request_key = f"curate_{user_id}_{learning_goal}"

    # Get or create a lock for this specific user/goal combination
    lock = curation_locks.get(request_key)
    if lock is None:
        lock = asyncio.Lock()
        curation_locks[request_key] = lock

    async with lock: # Acquire the lock for this specific request key
        try:
            # Check if a course already exists for this user/goal in memory
            # This check is quick and avoids DB queries if we just created it
            existing_course_id_memory = None
            for course_id, course_data in curated_courses.items():
                 if course_data.get("userId") == user_id and \
                    course_data.get("title", "").startswith(f"{learning_goal}"):
                     existing_course_id_memory = course_id
                     break # Found one

            if existing_course_id_memory:
                 logger.info(f"Returning existing course from memory: {existing_course_id_memory}")
                 # Ensure the returned structure matches CourseResponse
                 return CourseResponse(**curated_courses[existing_course_id_memory])



            # If we reach here, no existing course was found, proceed with generation
            logger.info(f"No existing course found. Starting course curation for user {user_id}, goal: {learning_goal}")

            # Check if this specific request instance is already marked as processing
            # (This handles the case where the same instance retries quickly)
            if request_key in processing_requests:
                 logger.warning(f"Request key {request_key} marked as processing but lock acquired. Possible race condition or stale state.")
                 # You might choose to raise an error or wait again here, but the lock should prevent actual double processing.

            processing_requests.add(request_key) # Mark as processing *after* lock acquisition

            try:
                # --- Course Generation Logic ---
                course_id = f"course_{user_id}_{int(time.time())}" # Unique ID based on current time

                # Validate recommended modules (same as before)
                if not request.recommendedModules or len(request.recommendedModules) == 0:
                    logger.warning(f"No recommended modules provided from assessment.")
                    # Return a different status or structure if modules are required
                    # For now, proceeding without them might be okay if assessment isn't mandatory
                    # raise HTTPException(status_code=400, detail="No recommended modules provided. Please complete an assessment first.")
                    recommended_modules = [] # Allow proceeding without modules for now
                else:
                    recommended_modules = request.recommendedModules
                logger.info(f"Using recommended modules: {len(recommended_modules)} found")

                processed_modules: List[CourseModule] = [] # Ensure type

                if not recommended_modules:
                     logger.info("No recommended modules, creating default structure.")
                     # Create a default first module based on learning goal
                     default_topic_title = f"Introduction to {learning_goal}"
                     default_topic_content = await generate_default_topic_content(learning_goal, default_topic_title) # Need a helper for this

                     processed_modules = [
                         CourseModule(
                             id=1,
                             title=f"Getting Started with {learning_goal}",
                             description=f"An introduction to the core concepts of {learning_goal}.",
                             topics=[
                                 { "id": "1-1", "title": default_topic_title, "content": default_topic_content }
                                 # Add more default topics if needed
                             ]
                         )
                     ]

                else:
                     # --- Existing Logic to process recommended_modules ---
                     if len(recommended_modules) > 0:
                        first_module_data = recommended_modules[0]
                        module_title = first_module_data.get('title', f"Module 1 on {learning_goal}")
                        topics = []

                        if "topics" in first_module_data and isinstance(first_module_data["topics"], list):
                            for j, topic_data in enumerate(first_module_data["topics"][:3]):
                                topic_title = topic_data if isinstance(topic_data, str) else topic_data.get('title', f"Topic {j+1}")
                                # Generate content for this topic (using improved prompt)
                                topic_content = await generate_topic_content(learning_goal, topic_title) # Refactored AI call
                                topics.append({
                                    "id": f"1-{j+1}",
                                    "title": topic_title,
                                    "content": topic_content
                                })

                        first_module = CourseModule(
                            id=1,
                            title=module_title,
                            description=f"Learn about {module_title} for {learning_goal}",
                            topics=topics
                        )
                        processed_modules.append(first_module)

                        # Add remaining recommended modules (without content for now)
                        for i, module_data in enumerate(recommended_modules[1:5], start=1):
                             module_title = module_data.get('title', f"Module {i+1} on {learning_goal}")
                             empty_topics = []
                             if "topics" in module_data and isinstance(module_data["topics"], list):
                                 for j, topic_data in enumerate(module_data["topics"][:3]):
                                     topic_title = topic_data if isinstance(topic_data, str) else topic_data.get('title', f"Topic {j+1}")
                                     empty_topics.append({ "id": f"{i+1}-{j+1}", "title": topic_title, "content": "" })

                             processed_modules.append(CourseModule(
                                 id=i + 1,
                                 title=module_title,
                                 description=f"Learn about {module_title} for {learning_goal}",
                                 topics=empty_topics
                             ))
                     # --- End of processing recommended_modules ---


                # --- Course Saving and Response ---
                created_at_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                created_timestamp = time.time()

                # Prepare final course data matching CourseResponse structure
                final_course_data = {
                    "courseId": course_id,
                    "userId": user_id, # Add userId for potential future filtering
                    "title": f"{learning_goal} Course",
                    "modules": [mod.dict() for mod in processed_modules], # Convert Pydantic models to dicts
                    "createdAt": created_at_str,
                    "createdTimestamp": created_timestamp, # Keep internal timestamp
                    # Add any other fields expected by CourseResponse/frontend
                }

                # Store in memory
                curated_courses[course_id] = final_course_data

                logger.info(f"Successfully curated and stored course: {course_id}")

                # Return using the Pydantic model for validation
                return CourseResponse(**final_course_data)

            finally:
                # Clean up processing request marker
                if request_key in processing_requests:
                    processing_requests.remove(request_key)

        except Exception as e:
            logger.error(f"Error during locked course curation for {request_key}: {str(e)}", exc_info=True)
            # Clean up lock state if error occurs
            if request_key in processing_requests:
                processing_requests.remove(request_key)
            raise HTTPException(status_code=500, detail=f"Failed to generate course: {str(e)}")

    # Lock is released automatically when exiting 'async with'

# Helper function Refactors (add these outside the endpoint function)
async def generate_topic_content(learning_goal: str, topic_title: str) -> str:
    # (Contains the improved topic_prompt and httpx call logic)
    topic_prompt = f"""
    You are an expert educational content creator specializing in {learning_goal}.
    Your task is to write a detailed and comprehensive article about "{topic_title}".
    Assume the audience is learning this topic as part of a larger course on {learning_goal}.

    **Content Requirements:**
    1.  **Depth and Detail:** Provide in-depth explanations (aim for 500-600 words). Go beyond surface-level definitions.
    2.  **Clarity:** Explain concepts clearly and logically.
    3.  **Practical Examples:** Include relevant examples, but ensure they are illustrative and well-explained within the context. **AVOID trivial or overly simple code snippets like basic list creation or printing unless they are part of a larger, complex example demonstrating a key concept.** Focus on explaining *why* the example works and what it demonstrates.
    4.  **Structure:** Use markdown formatting effectively (headers with `#`, ##`, ###`, bullet points `*` or `-`, numbered lists, bold text `**text**`) for readability.
    5.  **Accuracy:** Ensure all information is factually correct.
    6.  **Engagement:** Write in an informative and engaging style suitable for learning.

    **Instructions:**
    -   Write ONLY the article content in markdown format.
    -   Start directly with the content (e.g., a header like `# {topic_title}`). Do NOT include introductory phrases like "In this article..." or "This topic covers...".
    -   Do NOT include placeholder text like "[Example Here]".
    -   Focus on teaching the concepts thoroughly.

    Begin the article now:
    """
    try:
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
                return f"# {topic_title}\n\nContent generation failed. Please try again later."

            result = response.json()
            topic_content = result.get("response", "")

            # Clean up content (same as before)
            if "```" in topic_content:
                 match = re.search(r'```(?:markdown)?\s*([\s\S]*?)\s*```', topic_content, re.DOTALL)
                 if match: topic_content = match.group(1).strip()
            if not topic_content.strip().startswith("#"):
                 topic_content = f"# {topic_title}\n\n{topic_content}"

            logger.info(f"Generated {len(topic_content)} characters for topic {topic_title}")
            return topic_content.strip()
    except Exception as e:
        logger.error(f"Exception generating content for {topic_title}: {e}")
        return f"# {topic_title}\n\nError generating content."

async def generate_default_topic_content(learning_goal: str, topic_title: str) -> str:
     # Similar to generate_topic_content but maybe simpler prompt if needed
     return await generate_topic_content(learning_goal, topic_title) # Reuse main generator for now

@app.get("/api/course/{course_id}")
async def get_course(course_id: str):
    """Retrieve a curated course by ID"""
    if course_id not in curated_courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return curated_courses[course_id]

# Add these new endpoints
@app.post("/api/generate-module-quiz", response_model=ModuleQuizResponse)
async def generate_module_quiz(request: ModuleQuizRequest):
    """Generate a quiz based on module content"""
    try:
        user_id = request.userId
        module_id = request.moduleId
        
        # Create a request key for locking
        request_key = f"quiz_{user_id}_{module_id}"
        
        # Create a lock for this specific request if it doesn't exist
        if request_key not in request_locks:
            request_locks[request_key] = asyncio.Lock()
            
        # Use the lock to ensure only one request processes at a time
        async with request_locks[request_key]:
            # Check if this request is already being processed
            if request_key in processing_requests:
                logger.info(f"Quiz request {request_key} is already being processed.")
                # Wait for completion - similar to assessment logic
                for _ in range(5):  # Try checking 5 times with a delay
                    await asyncio.sleep(1)
                    # Could check for an existing quiz here, similar to assessments
            
            # Mark this request as processing
            processing_requests.add(request_key)
            logger.info(f"Starting to process module quiz request: {request_key}")
            
            try:
                # Extract all content from topics to use for question generation
                module_content = ""
                for topic in request.topicContent:
                    module_content += topic.get("content", "") + "\n\n"
                
                # Create a prompt for generating questions based on module content
                prompt = f"""
                You are an educational assessment expert. Your task is to create 5 thoughtful, open-ended questions to evaluate a student's understanding of the module content below.

                The questions should:
                1. Test comprehension of the key concepts presented in the module
                2. Require critical thinking and application of knowledge
                3. Cover different aspects of the material
                4. Be clearly worded and unambiguous
                5. Be answerable based solely on the module content (don't require external knowledge)

                Here is the module content to create questions about:
                
                {module_content[:6000]}  # Limit content to prevent token overload
                
                Format your response ONLY as a JSON array with exactly 5 questions like this:
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

                IMPORTANT: Use double quotes for all JSON properties and string values. Do NOT include any explanations or comments outside the JSON array.
                """
                
                logger.info(f"Generating quiz questions for module {module_id}")
                
                # Make the request to the AI model
                async with httpx.AsyncClient(timeout=180.0) as client:
                    response = await client.post(
                        "http://localhost:11434/api/generate",
                        json={
                            "model": "gemma3:4b",  # Use a potentially better model for quiz generation
                            "prompt": prompt,
                            "stream": False,
                            "temperature": 0.7,
                            "max_tokens": 2000
                        }
                    )
                    
                    if response.status_code != 200:
                        logger.error(f"AI Error: {response.status_code}")
                        raise HTTPException(status_code=500, detail=f"Failed to generate quiz: {response.status_code}")
                    
                    # Process the model response, similar to assessment processing
                    questions_data = await process_model_response(response, request)
                    
                    # Create a unique quiz ID
                    quiz_id = f"quiz_{request.userId}_{request.moduleId}_{int(time.time())}"
                    
                    # Store in memory for later evaluation (similar to assessment sessions)
                    assessment_sessions[quiz_id] = {
                        "userId": request.userId,
                        "moduleId": request.moduleId,
                        "courseId": request.courseId,
                        "questions": questions_data,
                        "createdAt": time.time()
                    }
                    
                    return {
                        "questions": questions_data,
                        "quizId": quiz_id
                    }
                    
            except Exception as e:
                logger.error(f"Error generating module quiz: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error generating quiz: {str(e)}")
            finally:
                # Remove from processing set when done
                if request_key in processing_requests:
                    processing_requests.remove(request_key)
    
    except Exception as e:
        logger.error(f"Outer exception in generate_module_quiz: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process quiz request: {str(e)}")

@app.post("/api/evaluate-module-quiz", response_model=ModuleQuizResult)
async def evaluate_module_quiz(submission: ModuleQuizSubmission):
    """Evaluate a module quiz submission using AI assistance"""
    if submission.quizId not in assessment_sessions:
        raise HTTPException(status_code=404, detail="Quiz session not found")
    
    session = assessment_sessions[submission.quizId]
    
    # Basic completion calculation
    questions = session["questions"]
    total = len(questions)
    answered = sum(1 for q_id in [str(q["id"]) for q in questions] if q_id in submission.answers and submission.answers[q_id].strip())
    
    # Calculate a completion score
    completion_score = (answered / total) * 100 if total > 0 else 0
    
    # Store the answers in the session
    session["answers"] = submission.answers
    
    logger.info(f"Evaluating module quiz for module {session['moduleId']}")
    
    # Initialize variables for AI evaluation
    knowledge_score = completion_score  # Default to completion score
    detailed_feedback = ""
    
    if answered > 0:
        try:
            # Create a prompt for evaluation
            eval_prompt = f"""
            You are an educational assessment expert evaluating a student's understanding of module content.
            
            You will analyze the student's answers to quiz questions and provide a concise evaluation.
            
            Here are the student's answers:
            """
            
            # Add only the answered questions to the prompt
            for q in questions:
                q_id = str(q["id"])
                if q_id in submission.answers and submission.answers[q_id].strip():
                    question = q["question"]
                    answer = submission.answers[q_id]
                    eval_prompt += f"\nQuestion: {question}\nAnswer: {answer}\n"
            
            # Instructions for structured output
            eval_prompt += """
            Based on your analysis, provide a JSON object with this structure:
            {
              "score": a number between 0 and 100 representing the student's understanding,
              "feedback": "Constructive feedback on their answers, including what they understood well and where they could improve."
            }

            Return ONLY the JSON object with no additional text.
            Use double quotes for strings. Be concise but helpful in the feedback.
            """
            
            logger.info("Sending quiz evaluation request to AI")
            
            # Make the request to the AI model
            async with httpx.AsyncClient(timeout=180.0) as client:
                ai_response = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "gemma3:4b",
                        "prompt": eval_prompt,
                        "stream": False,
                        "temperature": 0.1,
                        "max_tokens": 1000
                    }
                )
                
                if ai_response.status_code != 200:
                    logger.error(f"AI Evaluation Error: {ai_response.status_code}")
                    raise HTTPException(status_code=500, detail="Failed to evaluate quiz")
                
                result = ai_response.json()
                content = result.get("response", "")
                
                # Extract JSON from the response
                try:
                    # Find a JSON object with braces
                    json_pattern = r'({[\s\S]*})'
                    json_match = re.search(json_pattern, content, re.DOTALL)
                    
                    if json_match:
                        json_str = json_match.group(1)
                        # Clean up the JSON string
                        json_str = json_str.replace("'", '"')
                        json_str = re.sub(r',\s*}', '}', json_str)
                        
                        # Parse JSON
                        ai_data = json.loads(json_str)
                        
                        # Extract the fields
                        if "score" in ai_data:
                            knowledge_score = float(ai_data.get("score", completion_score))
                            knowledge_score = max(0, min(100, knowledge_score))
                            
                        if "feedback" in ai_data:
                            detailed_feedback = ai_data.get("feedback", "").strip()
                    else:
                        logger.warning("Could not extract JSON from AI response")
                except Exception as e:
                    logger.error(f"Error processing AI evaluation: {str(e)}")
        
        except Exception as e:
            logger.error(f"Module quiz evaluation error: {str(e)}")
            detailed_feedback = "An error occurred during evaluation. Your quiz has been recorded but couldn't be automatically graded."
    
    # Determine completion status based on score
    completion_status = "completed"
    if knowledge_score < 70:
        completion_status = "needs_review"
    
    # Store the evaluation results in the session
    session["evaluation"] = {
        "score": knowledge_score,
        "feedback": detailed_feedback,
        "completionStatus": completion_status,
        "evaluatedAt": time.time()
    }
    
    # Return the evaluation
    return {
        "score": knowledge_score,
        "feedback": detailed_feedback,
        "completionStatus": completion_status
    }

@app.post("/api/generate-module-content")
async def generate_module_content(request: ModuleContentRequest):
    """Generate content for a module that has no content"""
    try:
        # Create a unique request key based on the request parameters
        request_key = f"content_{request.userId}_{request.courseId}_{request.moduleId}_{request.moduleTitle}"
        
        # Get or create a lock for this specific request
        if request_key not in module_content_locks:
            module_content_locks[request_key] = asyncio.Lock()
            
        # Use the lock to ensure only one request processes at a time
        async with module_content_locks[request_key]:
            # Check if this request is already being processed
            if request_key in module_content_requests:
                logger.info(f"Content request {request_key} is already being processed. Waiting...")
                
                # Wait for a bit to see if the other request completes
                for _ in range(3):  # Try checking 3 times
                    await asyncio.sleep(1)
                    # Check if we can return cached content (add a cache if needed)
                    # For now, just inform the client to retry
                
                # If still processing after waiting, return an appropriate message
                if request_key in module_content_requests:
                    return {"status": "processing", "message": "Content generation is in progress, please retry shortly"}
            
            # Mark this request as processing
            module_content_requests.add(request_key)
            
            try:
                logger.info(f"Generating content for module: '{request.moduleTitle}' (Goal: {request.learningGoal})")
                
                # First, try to find a relevant YouTube video
                video_id = None
                video_title = None
                
                try:
                    # Search for a relevant video first
                    logger.info(f"Searching YouTube for: {request.moduleTitle} tutorial {request.learningGoal}")
                    youtube_api_key = os.environ.get("YOUTUBE_API_KEY", "")
                    search_query = f"{request.moduleTitle} tutorial {request.learningGoal}"
                    
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(
                            "https://www.googleapis.com/youtube/v3/search",
                            params={
                                "part": "snippet",
                                "q": search_query,
                                "key": youtube_api_key,
                                "maxResults": 1,
                                "type": "video",
                                "videoEmbeddable": "true"
                            }
                        )
                        
                        if response.status_code == 200:
                            search_results = response.json()
                            if search_results.get("items") and len(search_results["items"]) > 0:
                                video_id = search_results["items"][0]["id"]["videoId"]
                                video_title = search_results["items"][0]["snippet"]["title"]
                                logger.info(f"Found YouTube video: ID={video_id}, Title='{video_title}'")
                        else:
                            logger.error(f"YouTube API error: {response.status_code}")
                            
                except Exception as e:
                    logger.error(f"HTTP error during YouTube search for '{search_query}': {str(e)}")
                    # Try a simpler query as fallback
                    logger.info(f"Fallback YouTube search for: {request.moduleTitle}")
                    try:
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            response = await client.get(
                                "https://www.googleapis.com/youtube/v3/search",
                                params={
                                    "part": "snippet",
                                    "q": request.moduleTitle,
                                    "key": youtube_api_key,
                                    "maxResults": 1,
                                    "type": "video",
                                    "videoEmbeddable": "true"
                                }
                            )
                            
                            if response.status_code == 200:
                                search_results = response.json()
                                if search_results.get("items") and len(search_results["items"]) > 0:
                                    video_id = search_results["items"][0]["id"]["videoId"]
                                    video_title = search_results["items"][0]["snippet"]["title"]
                                    logger.info(f"Found YouTube video: ID={video_id}, Title='{video_title}'")
                            else:
                                logger.error(f"YouTube API error: {response.status_code}")
                    except Exception as e2:
                        logger.error(f"HTTP error during fallback YouTube search for '{request.moduleTitle}': {str(e2)}")
                
                # Generate text content as well
                text_content = None
                try:
                    logger.info(f"Making request to AI for topic TEXT: {request.moduleTitle}")
                    text_content = await generate_topic_content(request.learningGoal, request.moduleTitle)
                    logger.info(f"Generated {len(text_content)} characters of TEXT for topic {request.moduleTitle}")
                except Exception as e:
                    logger.error(f"Exception generating TEXT content for {request.moduleTitle}: {str(e)}")
                
                # Return the response with video, text, or both
                result = {
                    "content": text_content,
                    "videoId": video_id,
                    "videoTitle": video_title
                }
                
                return result
                
            except Exception as e:
                logger.error(f"Error generating module content: {e}")
                raise HTTPException(status_code=500, detail=f"Error generating content: {str(e)}")
            finally:
                # Remove from processing set when done
                if request_key in module_content_requests:
                    module_content_requests.remove(request_key)
                    
    except Exception as e:
        logger.error(f"Outer exception in generate_module_content: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process content request: {str(e)}")
    finally:
        # Clean up locks if they're no longer needed
        # Only remove if there are no active requests using this lock
        if request_key in module_content_locks and request_key not in module_content_requests:
            del module_content_locks[request_key]

if __name__ == "__main__":
    import uvicorn # type: ignore
    uvicorn.run(app, host="0.0.0.0", port=8000) 