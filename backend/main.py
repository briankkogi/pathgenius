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

class AssessmentResult(BaseModel):
    score: float
    feedback: str
    nextSteps: str
    knowledgeGaps: Optional[List[KnowledgeGap]] = None
    strengths: Optional[List[str]] = None

# New models for course curation
class CurationRequest(BaseModel):
    learningGoal: str
    professionLevel: str
    userId: str
    assessmentId: Optional[str] = None
    strengths: Optional[List[str]] = None
    knowledgeGaps: Optional[List[Dict[str, Any]]] = None

class CourseModule(BaseModel):
    id: int
    title: str
    type: str
    duration: str
    description: str
    videoId: Optional[str] = None
    content: Optional[str] = None
    progress: int = 0

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
    ai_next_steps = f"Focus on building your understanding of {session['learningGoal']} concepts through practice and application."
    
    if answered > 0:
        try:
            # Create a simplified prompt focused on just score and feedback
            eval_prompt = f"""
            You are an educational assessment expert evaluating a student's knowledge of {session['learningGoal']}. 
            The student is at a {session['professionLevel']} level.
            
            You will analyze the student's answers and provide a concise evaluation.
            
            IMPORTANT: Always speak directly to the student using "you" (not "they" or "the student").
            
            Here are the student's answers:
            """
            
            # Add only the answered questions to the prompt
            for q in questions:
                q_id = str(q["id"])
                if q_id in submission.answers and submission.answers[q_id].strip() and submission.answers[q_id] != "Skipped":
                    question = q["question"]
                    answer = submission.answers[q_id]
                    eval_prompt += f"\nQuestion: {question}\nAnswer: {answer}\n"
            
            # Instructions for structured output with very explicit JSON formatting
            eval_prompt += """
            First, analyze the student's answers in a thinking section. Use <think></think> tags:

            <think>
            [Your detailed analysis of the student's knowledge]
            </think>

            IMMEDIATELY AFTER your thinking section, provide ONLY a COMPLETE, PROPERLY FORMATTED JSON object.
            
            Use this EXACT JSON format without any deviations:
            {
              "knowledgeScore": 75,
              "feedback": "Overall assessment of your understanding including strengths and areas for improvement",
              "nextSteps": "Clear recommendations for what you should learn next"
            }

            EXTREMELY IMPORTANT JSON FORMATTING RULES:
            1. Use double quotes (") for ALL strings and property names - NEVER use single quotes (')
            2. Ensure ALL property names DO NOT contain periods or special characters
            3. Each property must be followed by a colon (:)
            4. Each property-value pair must end with a comma (,) EXCEPT the last item
            5. Address the student directly using "you" not "they" or "the student"
            6. Provide detailed feedback that includes strengths and areas for improvement
            7. Keep the structure simple - ONLY include knowledgeScore, feedback, and nextSteps

            The JSON object MUST be valid and parseable with NO syntax errors.
            """
            
            print("\n\033[94m=== EVALUATION PROMPT ===\033[0m")
            print(f"\033[95m{eval_prompt}\033[0m")
            print("\n\033[94m=== REQUESTING AI EVALUATION ===\033[0m")
            
            # Make the request to the model for evaluation
            async with httpx.AsyncClient(timeout=240.0) as client:  # Extended timeout
                ai_response = await client.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "deepseek-r1:1.5b",
                        "prompt": eval_prompt,
                        "stream": False,
                        "temperature": 0.1,
                        "max_tokens": 4000  # Increased token limit
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
                
                # Extract JSON from the response
                try:
                    # First, remove the thinking section if present
                    content_without_thinking = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL)
                    
                    # Try to find JSON content - look for matching braces
                    json_match = re.search(r'({[\s\S]*?"knowledgeScore"[\s\S]*?})', content_without_thinking, re.DOTALL)
                    
                    # If not found, try with more relaxed pattern
                    if not json_match:
                        json_match = re.search(r'({[\s\S]*})', content_without_thinking, re.DOTALL)
                        
                    if json_match:
                        json_str = json_match.group(1)
                        print("\n\033[94m=== EXTRACTED JSON STRING ===\033[0m")
                        print(f"\033[92m{json_str}\033[0m")
                        
                        # Normalize and clean the JSON string
                        json_str = json_str.replace("'", '"')  # Replace single quotes with double quotes
                        json_str = re.sub(r'"([^"]+)\.\s*":', r'"\1":', json_str)  # Remove periods in property names
                        json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas
                        
                        try:
                            ai_eval_data = json.loads(json_str)
                            
                            # Extract knowledge score
                            if "knowledgeScore" in ai_eval_data and isinstance(ai_eval_data["knowledgeScore"], (int, float)):
                                knowledge_score = float(ai_eval_data["knowledgeScore"])
                                knowledge_score = max(0, min(100, knowledge_score))
                                print(f"\033[96mKnowledge Score:\033[0m {knowledge_score}%")
                            
                            # Process feedback
                            if "feedback" in ai_eval_data and isinstance(ai_eval_data["feedback"], str):
                                detailed_feedback = ai_eval_data["feedback"]
                            
                            # Process next steps
                            if "nextSteps" in ai_eval_data and isinstance(ai_eval_data["nextSteps"], str):
                                ai_next_steps = ai_eval_data["nextSteps"]
                            
                        except json.JSONDecodeError as e:
                            print(f"\033[91mJSON decode error: {str(e)}\033[0m")
                            
                            # Extract individual fields using regex
                            score_match = re.search(r'"knowledgeScore"[^0-9]*([0-9.]+)', json_str)
                            knowledge_score = float(score_match.group(1)) if score_match else completion_score
                            
                            feedback_match = re.search(r'"feedback"\s*:\s*"([^"]+)"', json_str)
                            detailed_feedback = feedback_match.group(1) if feedback_match else f"You've completed {answered} out of {total} questions on {session['learningGoal']}. Your knowledge score is {knowledge_score:.0f}%."
                            
                            next_steps_match = re.search(r'"nextSteps"\s*:\s*"([^"]+)"', json_str)
                            ai_next_steps = next_steps_match.group(1) if next_steps_match else f"Continue learning about {session['learningGoal']}."
                    else:
                        print("\033[91mNo JSON object found in the model response\033[0m")
                        raise ValueError("No JSON object found in the model response")
                                
                except Exception as e:
                    print(f"\033[91mError extracting and processing JSON: {str(e)}\033[0m")
                    raise HTTPException(status_code=500, detail=f"Failed to process AI evaluation: {str(e)}")
        
        except Exception as e:
            print(f"\033[91mEvaluation error: {str(e)}\033[0m")
            raise HTTPException(status_code=500, detail=f"Assessment evaluation failed: {str(e)}")
    
    # Ensure we have at least some data for a valid response
    if not detailed_feedback:
        detailed_feedback = f"You've completed {answered} out of {total} questions on {session['learningGoal']}. Your knowledge score is {knowledge_score:.0f}%."
    
    if not ai_next_steps:
        ai_next_steps = f"Focus on building your understanding of {session['learningGoal']} concepts through practice and application."
    
    # Store AI evaluation in the session - with empty strengths and knowledge gaps
    session["aiEvaluation"] = {
        "strengths": [],
        "knowledgeGaps": [],
        "detailedFeedback": detailed_feedback,
        "aiNextSteps": ai_next_steps,
        "knowledgeScore": knowledge_score,
        "evaluatedAt": time.time()
    }
    
    # Return the evaluation with empty strengths and knowledge gaps arrays
    return {
        "score": knowledge_score,
        "feedback": detailed_feedback,
        "nextSteps": ai_next_steps,
        "knowledgeGaps": [],
        "strengths": []
    }

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    # Clean up old sessions when health check is called
    cleanup_old_sessions()
    return {"status": "ok", "timestamp": time.time()}

@app.post("/api/curate-course", response_model=CourseResponse)
async def curate_course(request: CurationRequest):
    """Generate a curated learning path based on assessment results"""
    try:
        # Check if the user already has a course for this learning goal
        user_id = request.userId
        learning_goal = request.learningGoal
        request_key = f"{user_id}_{learning_goal}_course"
        
        # Create a unique course ID
        course_id = f"course_{user_id}_{int(time.time())}"
        
        # Get assessment session if provided
        assessment_data = {}
        if request.assessmentId and request.assessmentId in assessment_sessions:
            assessment_data = assessment_sessions[request.assessmentId]
        
        # Use a detailed prompt for course curation with improved content generation
        prompt = f"""
        You are an educational content curator specializing in creating personalized learning paths. 
        Your task is to create a structured course for a student learning {learning_goal} at a {request.professionLevel} level.
        
        Create exactly 5 modules that form a coherent learning path. Each module should have:
        1. A clear title and description
        2. Multiple topics within each module (2-3 topics per module) with video and article content
        3. A quiz section with 2-3 multiple choice questions for each module
        
        {f"Based on their assessment, they have these knowledge gaps: {request.knowledgeGaps}" if request.knowledgeGaps else ""}
        {f"Their strengths are: {request.strengths}" if request.strengths else ""}
        
        Guidelines:
        - For videos, find actual educational YouTube videos that teach the specific topic
        - Provide REAL YouTube video IDs (the part after v= in YouTube URLs, e.g., "dQw4w9WgXcQ")
        - Make sure videos are appropriate for the user's level ({request.professionLevel})
        - Write detailed notes for each video that summarize key points
        - Each article should have comprehensive markdown content (minimum 300 words)
        - Include accurate durations for all content items
        - Each quiz should have 2-3 well-crafted multiple choice questions with one correct answer
        
        Format your response EXACTLY as a valid JSON object with this structure:
        {{
          "title": "Complete Course Title",
          "modules": [
            {{
              "id": 1,
              "title": "Module Title",
              "description": "Detailed module description",
              "type": "mixed",
              "duration": "XX minutes",
              "progress": 0,
              "topics": [
                {{
                  "id": "1-1",
                  "title": "First Topic Title",
                  "type": "video",
                  "duration": "XX minutes",
                  "videoId": "ACTUAL_YOUTUBE_ID",
                  "notes": "Detailed notes about this video that summarize key points..."
                }},
                {{
                  "id": "1-2",
                  "title": "Second Topic Title",
                  "type": "article",
                  "duration": "XX minutes read",
                  "content": "Full markdown content here with multiple paragraphs, lists, etc."
                }}
              ],
              "quiz": [
                {{
                  "question": "A multiple choice question about the module content?",
                  "options": [
                    "Option 1",
                    "Option 2",
                    "Option 3",
                    "Option 4"
                  ],
                  "correctAnswer": 0
                }},
                {{
                  "question": "Another question?",
                  "options": [
                    "Option 1",
                    "Option 2",
                    "Option 3", 
                    "Option 4"
                  ],
                  "correctAnswer": 2
                }}
              ]
            }}
            // Repeat for all 5 modules
          ]
        }}
        
        Be extremely detailed in the content. Write comprehensive explanations and tutorials in the markdown content.
        Do not skimp on the content length. Be thorough and educational.
        
        VERY IMPORTANT:
        1. Only use double quotes, not single quotes
        2. Include 5 modules, each with 2-3 topics
        3. Include 2-3 quiz questions per module
        4. For videos, include REAL YouTube IDs that teach the topic
        5. Do not include any text outside the JSON structure
        """
        
        # Make the request to Ollama with increased temperature for creativity
        async with httpx.AsyncClient(timeout=300.0) as client:  # Increased timeout
            logger.info(f"Requesting course curation for {learning_goal}")
            
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "deepseek-r1:1.5b",
                    "prompt": prompt,
                    "stream": False,
                    "temperature": 0.9,  # Increased temperature for more detail and creativity
                    "max_tokens": 12000,  # Increased token limit for more content
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama API Error: {response.status_code}")
                raise HTTPException(status_code=500, detail=f"Failed to connect to Ollama: {response.status_code}")
            
            # Process model response
            result = response.json()
            content = result.get("response", "")
            
            logger.info("Received course curation response from model")
            
            # Attempt to extract JSON
            try:
                # Clean up the response to ensure valid JSON
                json_match = re.search(r'({[\s\S]*})', content, re.DOTALL)
                
                if not json_match:
                    logger.error("No JSON content found in response")
                    raise HTTPException(status_code=500, detail="Failed to generate course structure")
                
                json_str = json_match.group(1)
                
                # More aggressive JSON cleaning
                json_str = json_str.replace("'", '"')  # Replace single quotes with double quotes
                json_str = re.sub(r'//.*?(\n|$)', '\n', json_str)  # Remove JavaScript-style comments
                json_str = re.sub(r',\s*}', '}', json_str)  # Remove trailing commas in objects
                json_str = re.sub(r',\s*]', ']', json_str)  # Remove trailing commas in arrays
                
                # Try to parse the cleaned JSON
                try:
                    course_data = json.loads(json_str)
                except json.JSONDecodeError as e:
                    logger.error(f"JSON decode error: {str(e)}")
                    logger.info(f"Attempting to fix malformed JSON: {json_str[:100]}...")
                    
                    # More aggressive fixing for common JSON errors
                    # Fix missing quotes around property names
                    json_str = re.sub(r'([{,]\s*)([a-zA-Z0-9_]+)(\s*:)', r'\1"\2"\3', json_str)
                    
                    # Fix unescaped quotes in strings
                    json_str = re.sub(r'(?<!")(".*?[^\\]")(?!")', r'"\1"', json_str)
                    
                    try:
                        course_data = json.loads(json_str)
                    except json.JSONDecodeError:
                        # If still failing, create an emergency course structure
                        logger.error("Could not fix JSON, creating fallback course structure")
                        course_data = create_detailed_fallback_course(learning_goal, request.professionLevel)
                
                # Include fallback content generator if parsing fails
                if not isinstance(course_data, dict) or "modules" not in course_data:
                    logger.warning("Invalid course structure, creating detailed fallback")
                    course_data = create_detailed_fallback_course(learning_goal, request.professionLevel)
                    
                # Update the modules processing to ensure topics and quizzes
                modules = course_data.get("modules", [])
                
                # Make sure we have exactly 5 modules
                if len(modules) < 5:
                    # Pad with detailed modules
                    while len(modules) < 5:
                        module_index = len(modules) + 1
                        new_module = create_detailed_module(learning_goal, module_index)
                        modules.append(new_module)
                
                modules = modules[:5]  # Limit to 5 modules
                
                # Process and normalize each module
                for i, module in enumerate(modules):
                    module["id"] = i + 1
                    
                    # Ensure required fields
                    if "type" not in module:
                        module["type"] = "mixed"
                    
                    if "progress" not in module:
                        module["progress"] = 0
                    
                    if "description" not in module:
                        module["description"] = f"Learn about {module['title']} in this comprehensive module"
                    
                    # Ensure topics exist and are properly formed
                    if "topics" not in module or not isinstance(module["topics"], list) or len(module["topics"]) < 2:
                        module["topics"] = create_module_topics(module["title"], learning_goal, i+1)
                    
                    # Ensure quiz exists and is properly formed
                    if "quiz" not in module or not isinstance(module["quiz"], list) or len(module["quiz"]) < 2:
                        module["quiz"] = create_module_quiz(module["title"], learning_goal)
                
                # Store the course data
                course_response = {
                    "courseId": course_id,
                    "title": course_data.get("title", f"Comprehensive {learning_goal} Course"),
                    "modules": modules,
                    "createdAt": time.time()
                }
                
                # Save in memory
                curated_courses[course_id] = course_response
                
                return {
                    "courseId": course_id,
                    "title": course_response["title"],
                    "modules": course_response["modules"],
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                }
                
            except json.JSONDecodeError as e:
                logger.error(f"JSON parsing error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Failed to parse course structure: {str(e)}")
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Error generating course: {str(e)}")
                
    except Exception as e:
        logger.error(f"Course curation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/course/{course_id}")
async def get_course(course_id: str):
    """Retrieve a curated course by ID"""
    if course_id not in curated_courses:
        raise HTTPException(status_code=404, detail="Course not found")
    
    return curated_courses[course_id]

# Add these helper functions near the end of the file
def create_detailed_fallback_course(learning_goal, profession_level):
    """Create a detailed fallback course structure if parsing fails"""
    
    course = {
        "title": f"Comprehensive {learning_goal} Course for {profession_level}s",
        "modules": []
    }
    
    # Generate 5 detailed modules
    for i in range(1, 6):
        course["modules"].append(create_detailed_module(learning_goal, i))
    
    return course

def create_detailed_module(learning_goal, module_index):
    """Create a detailed module with topics and quiz"""
    
    # Define module templates based on index
    module_templates = [
        {
            "title": f"Introduction to {learning_goal}",
            "description": f"Learn the fundamentals and core concepts of {learning_goal}."
        },
        {
            "title": f"Essential {learning_goal} Techniques",
            "description": f"Master the essential techniques and methods used in {learning_goal}."
        },
        {
            "title": f"Intermediate {learning_goal} Concepts",
            "description": f"Build on the basics and learn more complex concepts in {learning_goal}."
        },
        {
            "title": f"Advanced {learning_goal} Applications",
            "description": f"Apply your knowledge to real-world problems and advanced scenarios."
        },
        {
            "title": f"Mastering {learning_goal}: Best Practices",
            "description": f"Learn best practices, optimization techniques, and professional workflows."
        }
    ]
    
    # Use the appropriate template or fallback to generic
    template_index = min(module_index - 1, len(module_templates) - 1)
    template = module_templates[template_index]
    
    # Create the module
    module = {
        "id": module_index,
        "title": template["title"],
        "description": template["description"],
        "type": "mixed",
        "duration": f"{30 + module_index * 10} minutes",
        "progress": 0,
        "topics": create_module_topics(template["title"], learning_goal, module_index),
        "quiz": create_module_quiz(template["title"], learning_goal)
    }
    
    return module

def create_module_topics(module_title, learning_goal, module_index):
    """Create detailed topics for a module"""
    
    # Topic templates for different module positions
    if module_index == 1:  # Introduction module
        topics = [
            {
                "id": f"{module_index}-1",
                "title": f"What is {learning_goal}?",
                "type": "video",
                "duration": "10 minutes",
                "videoId": find_topic_video(f"introduction to {learning_goal}", module_index),
                "notes": f"""
                This video provides a comprehensive introduction to {learning_goal}.
                
                Key points covered:
                - Definition and scope of {learning_goal}
                - Historical development and context
                - Why {learning_goal} is important in today's world
                - Overview of fundamental concepts
                - Examples of {learning_goal} in real-world applications
                
                After watching this video, you'll have a solid understanding of what {learning_goal} entails and why it's worth studying.
                """
            },
            {
                "id": f"{module_index}-2",
                "title": f"Core Principles of {learning_goal}",
                "type": "article",
                "duration": "15 minutes read",
                "content": f"""
                # Core Principles of {learning_goal}
                
                In this article, we'll explore the fundamental principles that form the foundation of {learning_goal}. Understanding these principles is essential for mastering more advanced concepts later in the course.
                
                ## Foundational Concepts
                
                {learning_goal} is built on several key principles that guide its application and development. These principles include:
                
                1. **First Principle**: The foundation of all {learning_goal} practices begins with understanding this core concept.
                   - How it works: This principle operates by establishing a framework for approaching problems.
                   - Why it matters: Without this principle, the entire field would lack coherence and direction.
                
                2. **Second Principle**: Building on the first principle, this concept extends our understanding.
                   - Key applications: This principle is applied when working with complex systems or problems.
                   - Historical context: This principle emerged as the field evolved to address new challenges.
                
                3. **Third Principle**: This principle completes the foundational triad of {learning_goal}.
                   - Relationship to other principles: This works in conjunction with the first two principles.
                   - Modern interpretations: How this principle has evolved in contemporary practice.
                
                ## Practical Applications
                
                The principles of {learning_goal} are not merely theoretical constructs but have practical applications in various domains:
                
                * **Industry Application**: How these principles are applied in professional settings
                * **Research Directions**: Current research areas that build upon these foundations
                * **Everyday Examples**: How you might encounter these principles in daily life
                
                ## Getting Started
                
                To begin applying these principles, try these starter exercises:
                
                1. Identify examples of the first principle in action in your own experience
                2. Compare and contrast the second and third principles
                3. Create a simple project that incorporates all three principles
                
                ## Conclusion
                
                These core principles form the foundation upon which all {learning_goal} knowledge is built. In the next topics, we'll explore how to apply these principles to solve real-world problems and develop more advanced skills.
                """
            },
            {
                "id": f"{module_index}-3",
                "title": f"Getting Started with {learning_goal}",
                "type": "video",
                "duration": "12 minutes",
                "videoId": find_topic_video(f"getting started with {learning_goal}", module_index + 10),
                "notes": f"""
                This video walks you through the first steps of working with {learning_goal}.
                
                Key points covered:
                - Setting up your environment for {learning_goal}
                - Essential tools and resources you'll need
                - First exercises to practice your skills
                - Common beginner mistakes and how to avoid them
                - Next steps after completing this module
                
                After watching this tutorial, you'll be ready to start practicing {learning_goal} on your own.
                """
            }
        ]
    else:  # Other modules
        # Generate topic titles based on module index
        topic_titles = [
            f"Advanced Concept {(module_index-1)*2 + 1} in {learning_goal}",
            f"Practical Applications of {learning_goal} - Part {module_index}",
            f"Problem Solving with {learning_goal} Techniques"
        ]
        
        topics = [
            {
                "id": f"{module_index}-1",
                "title": topic_titles[0],
                "type": "video",
                "duration": f"{8 + module_index} minutes",
                "videoId": find_topic_video(topic_titles[0], module_index * 3),
                "notes": f"""
                This video explores advanced concepts in {learning_goal} that build on the foundation you've already established.
                
                Key points covered:
                - Detailed explanation of {topic_titles[0]}
                - How this concept connects to previous modules
                - Step-by-step demonstrations
                - Expert tips for mastering this concept
                - Common challenges and solutions
                
                These advanced techniques will significantly enhance your capabilities in {learning_goal}.
                """
            },
            {
                "id": f"{module_index}-2",
                "title": topic_titles[1],
                "type": "article",
                "duration": "20 minutes read",
                "content": f"""
                # {topic_titles[1]}
                
                In this article, we'll explore practical applications of {learning_goal} that demonstrate how the concepts you've learned can be applied to real-world situations.
                
                ## Real-World Applications
                
                {learning_goal} has numerous applications across different industries and domains. Here are some key examples:
                
                ### Application Area 1
                
                One of the most significant applications of {learning_goal} is in this first area. This involves:
                
                - Using {learning_goal} to solve specific problems in this domain
                - How professionals in this field leverage these techniques
                - Case studies of successful implementations
                - Tools and frameworks commonly used
                
                For example, a typical workflow might look like this:
                
                1. Identify the problem that needs solving
                2. Apply the principles from Module {module_index-1}
                3. Implement the solution using techniques covered in this module
                4. Evaluate results and refine the approach
                
                ### Application Area 2
                
                Another important application domain includes:
                
                - Specific challenges in this area that {learning_goal} helps address
                - Adaptations of core techniques for this specific domain
                - Integration with other systems or methodologies
                - Performance considerations and optimization strategies
                
                ## Hands-On Project
                
                To reinforce your understanding, try completing this hands-on project:
                
                1. **Project Goal**: Create a solution that addresses a specific problem using {learning_goal}
                2. **Requirements**:
                   - Apply at least two techniques covered in this module
                   - Document your process and decisions
                   - Evaluate the effectiveness of your solution
                3. **Extension Ideas**:
                   - Try alternative approaches and compare results
                   - Scale your solution to handle larger inputs
                   - Optimize for better performance
                
                ## Best Practices
                
                When applying {learning_goal} in real-world scenarios, keep these best practices in mind:
                
                - Always start by clearly defining the problem
                - Choose the right technique for the specific situation
                - Test your solutions thoroughly
                - Document your approach and results
                - Continuously refine and improve your implementation
                
                ## Next Steps
                
                After mastering these practical applications, you'll be ready to:
                
                - Take on more complex problems
                - Combine multiple techniques for more sophisticated solutions
                - Develop your own custom approaches based on core principles
                
                In the next topic, we'll explore problem-solving strategies that will further enhance your skills.
                """
            },
            {
                "id": f"{module_index}-3",
                "title": topic_titles[2],
                "type": "video",
                "duration": f"{10 + module_index * 2} minutes",
                "videoId": find_topic_video(topic_titles[2], module_index * 5),
                "notes": f"""
                This video demonstrates how to approach and solve problems using {learning_goal} techniques.
                
                Key points covered:
                - Problem-solving framework specific to {learning_goal}
                - Analysis of complex examples
                - Step-by-step walkthrough of solving challenging problems
                - Common pitfalls and how to avoid them
                - Strategies for approaching unfamiliar problems
                
                After completing this video, you'll have stronger problem-solving skills that you can apply to a wide range of {learning_goal} challenges.
                """
            }
        ]
    
    return topics

def create_module_quiz(module_title, learning_goal):
    """Create a quiz for a module"""
    
    # Generic quiz questions can be customized based on the learning goal
    quiz = [
        {
            "question": f"Which of the following is a key principle of {learning_goal}?",
            "options": [
                f"The fundamental concept that defines {learning_goal}",
                f"A concept unrelated to {learning_goal}",
                f"A technique from a different field entirely",
                f"None of the above"
            ],
            "correctAnswer": 0
        },
        {
            "question": f"What is the best approach when applying {learning_goal} to solve a problem?",
            "options": [
                "Skip the planning phase and start implementing immediately",
                "Use the most complex technique available regardless of the problem",
                "Analyze the problem, choose appropriate techniques, and test the solution",
                "Always use the exact same approach for all problems"
            ],
            "correctAnswer": 2
        },
        {
            "question": f"Which of these is NOT typically associated with {learning_goal}?",
            "options": [
                "Structured problem-solving",
                "Application of core principles",
                "Random guessing without methodology",
                "Continuous learning and improvement"
            ],
            "correctAnswer": 2
        }
    ]
    
    return quiz

def find_topic_video(topic, seed):
    """Find an appropriate YouTube video ID for a topic"""
    
    # Map of common topics to actual YouTube video IDs
    video_map = {
        "programming": ["fKl2JW_qrso", "JJmcL1N2KQs", "zOjov-2OZ0E", "bJzb-RuUcMU"],
        "python": ["kqtD5dpn9C8", "rfscVS0vtbw", "8DvywoWv6fI", "f79MRyMsjrQ"],
        "javascript": ["W6NZfCO5SIk", "PkZNo7MFNFg", "jS4aFq5-91M", "hdI2bqOjy3c"],
        "web development": ["UB1O30fR-EE", "5YDVJaItmaY", "gXLjWRteuWI", "qz0aGYrrlhU"],
        "data science": ["ua-CiDNNj30", "JL_grPfXcT4", "N6BghzuFLIg", "EF_1Ixm8TZM"],
        "machine learning": ["7eh4d6sabA0", "ukzFI9rgwfU", "i_LwzRVP7bg", "aircAruvnKk"],
        "artificial intelligence": ["kWmX3pd1f10", "mJeNghZXtMo", "fygRgiiqrgM", "oV74Najm6Nc"],
        "algorithms": ["kPRA0W1kECg", "zO_EXPwqbXk", "oruBLhAsDoc", "P3YpTkHLL0c"],
        "data structures": ["zg9ih6SVACc", "DuDz6B4cqVc", "B31LgI4Y4DQ", "9rhT3P1eOck"],
        "cybersecurity": ["inWWhr5tnEA", "bPVaOlJ6ln0", "3NM_b9OzHmM", "U_P23SqJaDc"],
        "blockchain": ["SSo_EIwHSd4", "qOVAbKKSH10", "bBC-nXj3Ng4", "IhJ509WL66Q"],
        "game development": ["Bg5GwioYt7I", "vFjXKOXdgGo", "AfTja-ZLLRQ", "yxnH8fqf9wI"],
        "mobile app development": ["TN8xZ64ibB0", "0-S5a0eXPoc", "SR6zDlbZozg", "fgdpvwEWJ9M"],
        "database": ["HXV3zeQKqGY", "7S_tz1z_5bA", "lpWIJgdM9co", "4cWkVbC2bfE"],
        "cloud computing": ["M988_fsOSWo", "IDLrwkBg3Bc", "b4P4adPgrqY", "1pBuwKwaHp0"],
        "devops": ["Wvf0mBNGjXY", "S0RTiI7iH7A", "Y-KD0I_h1GI", "0yWAtQ6wYNc"],
        "frontend": ["8gNrZ4lAnAw", "mU6anWqZJcc", "uK-zIOGi3j4", "zJSY8tbf_ys"],
        "backend": ["XBu54nfzxAQ", "TlB_eWDSMt4", "WpA-S5gX61s", "zaCJffoFfC4"],
        # Fallback/generic videos for other topics
        "default": ["1GWpC0lywZs", "ZWI4_gDdHRE", "YG_-3XAr1CA", "C72WkcUZvco"]
    }
    
    # Extract key terms from the topic
    topic_lower = topic.lower()
    
    # Try to find a matching video
    for key, videos in video_map.items():
        if key in topic_lower:
            # Use seed to pick a consistent but "random" video from the list
            return videos[seed % len(videos)]
    
    # Fallback to default videos
    return video_map["default"][seed % len(video_map["default"])]

if __name__ == "__main__":
    import uvicorn # type: ignore
    uvicorn.run(app, host="0.0.0.0", port=8000) 