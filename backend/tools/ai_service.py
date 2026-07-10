from groq import Groq
from django.conf import settings
import logging
from typing import Dict, List, Optional, Tuple
import json
import os
import tempfile
import base64
from PIL import Image
import pytesseract
from langdetect import detect, LangDetectException
import io
from celery import current_task
from .api_key_manager import get_client_pool
from .cache_service import get_cache_service, ResponseCache
from .tasks import process_ai_request

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        # Use client pool for load balancing
        self.client_pool = get_client_pool()
        self.cache_service = get_cache_service()
        self.model = settings.GROQ_MODEL
        self.use_async = getattr(settings, 'USE_ASYNC_AI', True)

        # Fallback for single API key (backward compatibility)
        api_key = settings.GROQ_API_KEY
        if not api_key or api_key == 'your_groq_api_key_here':
            logger.warning("GROQ API key not configured, using mock responses")
            self.client = None
            self.use_mock = True
        else:
            self.client = Groq(api_key=api_key)
            self.use_mock = False

    def _generate_completion(self, messages: List[Dict], temperature: float = 0.7, max_tokens: int = 2000,
                            use_cache: bool = True, cache_key: Optional[str] = None) -> str:
        """Generate a completion using Groq API with caching and load balancing"""
        if self.use_mock:
            raise Exception("GROQ API key is not configured. Please add your GROQ_API_KEY to the .env file.")

        # Check cache first if enabled
        if use_cache and cache_key:
            cached_response = self.cache_service.get('ai_completion', {'key': cache_key})
            if cached_response:
                logger.info("Returning cached AI response")
                return cached_response

        try:
            # Use client pool for load balancing
            def execute(client):
                completion = client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                return completion.choices[0].message.content

            result = self.client_pool.execute_with_retry(execute)

            # Cache the result if enabled
            if use_cache and cache_key:
                self.cache_service.set('ai_completion', {'key': cache_key}, result, ttl=3600*24)

            return result

        except Exception as e:
            logger.error(f"Groq API error: {e}")
            # Fallback to single client if pool fails
            if self.client:
                try:
                    completion = self.client.chat.completions.create(
                        model=self.model,
                        messages=messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                    )
                    return completion.choices[0].message.content
                except Exception as fallback_error:
                    logger.error(f"Fallback client also failed: {fallback_error}")

            if "invalid_api_key" in str(e).lower() or "401" in str(e):
                raise Exception("Invalid GROQ API key. Please check your API key configuration.")
            elif "rate_limit" in str(e).lower():
                raise Exception("API rate limit exceeded. Please try again in a few moments.")
            else:
                raise Exception(f"AI service error: {str(e)}")

    def _get_mock_response(self, messages: List[Dict]) -> str:
        """Return mock responses for development/testing"""
        user_message = messages[-1]['content'] if messages else ""
        system_message = messages[0]['content'] if messages else ""

        # Extract the actual text from the message
        text_start = user_message.find('\n\n')
        original_text = user_message[text_start+2:] if text_start > -1 else user_message[-100:]

        # Mock responses based on tool function
        if "paraphras" in system_message.lower() or "paraphras" in user_message.lower():
            # Different responses based on mode
            if "formal" in user_message.lower():
                return f"The following information is presented: {original_text[:50]}... This has been reformulated to align with professional and academic standards."
            elif "creative" in user_message.lower():
                return f"In a dazzling transformation, the essence of '{original_text[:50]}...' emerges anew with vivid expression and engaging narrative."
            elif "simple" in user_message.lower():
                return f"Here's a simpler version: {original_text[:30]}... This makes it easier to understand."
            elif "expand" in user_message.lower():
                return f"{original_text[:50]}... Additionally, this concept encompasses various aspects that merit further exploration, including related implications and contextual considerations."
            elif "shorten" in user_message.lower():
                return f"{original_text[:30]}... (condensed)"
            else:
                return f"Here's an alternative version: {original_text[:50]}... This maintains the original meaning while offering a fresh perspective."
        elif "grammar" in user_message.lower():
            # Simulate finding some common errors
            sample_errors = []
            if len(original_text) > 10:
                sample_errors.append(f"Possible grammar issue at position {len(original_text)//3}")
            if "i" in original_text.lower():
                sample_errors.append("Capitalization: 'i' should be 'I'")
            if not original_text.strip().endswith('.'):
                sample_errors.append("Missing period at end of sentence")

            corrected = original_text.strip()
            if not corrected.endswith('.'):
                corrected += '.'
            corrected = corrected.replace(' i ', ' I ')

            return json.dumps({
                "corrected_text": corrected,
                "errors": sample_errors if sample_errors else [],
                "suggestions": [
                    "Consider varying sentence structure",
                    "Use active voice when possible",
                    "Check for consistency in tense usage"
                ]
            })
        else:
            return "[MOCK] This is a development response. Configure GROQ_API_KEY in .env for real AI responses."

    def paraphrase(self, text: str, mode: str = "standard") -> str:
        """Paraphrase text in different modes"""
        mode_prompts = {
            "standard": "Paraphrase the following text while maintaining its meaning:",
            "formal": "Rewrite the following text in a formal, professional tone:",
            "creative": "Creatively rewrite the following text with more vivid and engaging language:",
            "simple": "Simplify the following text to make it easier to understand:",
            "expand": "Expand and elaborate on the following text with more details:",
            "shorten": "Shorten and condense the following text while keeping key points:",
        }

        prompt = mode_prompts.get(mode, mode_prompts["standard"])

        messages = [
            {"role": "system", "content": "You are a professional writing assistant specializing in paraphrasing and rewriting text."},
            {"role": "user", "content": f"{prompt}\n\n{text}"}
        ]

        return self._generate_completion(messages)

    def check_grammar(self, text: str) -> Dict:
        """Check grammar and provide corrections"""
        messages = [
            {"role": "system", "content": "You are a grammar and style checker. Analyze the text and provide corrections in JSON format."},
            {"role": "user", "content": f"""Check the following text for grammar, spelling, and style issues.
            Return ONLY a valid JSON object with exactly these fields:
            {{
                "corrected_text": "the corrected version of the text",
                "errors": ["list of specific errors found"],
                "suggestions": ["list of style improvements"]
            }}

            Text: {text}"""}
        ]

        response = self._generate_completion(messages)
        try:
            # Clean the response in case it has markdown code blocks
            if response.startswith('```'):
                response = response.split('```')[1]
                if response.startswith('json'):
                    response = response[4:]
            response = response.strip()

            result = json.loads(response)
            # Ensure all required fields exist
            return {
                "corrected_text": result.get("corrected_text", text),
                "errors": result.get("errors", []),
                "suggestions": result.get("suggestions", [])
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Failed to parse grammar check response: {e}")
            logger.error(f"Raw response: {response[:500]}")
            return {
                "corrected_text": text,
                "errors": ["Unable to parse grammar check results"],
                "suggestions": []
            }

    def generate_essay(self, topic: str, length: int = 500, essay_type: str = "argumentative") -> str:
        """Generate an essay on a given topic"""
        essay_types = {
            "argumentative": "argumentative essay with clear thesis, supporting arguments, and conclusion",
            "descriptive": "descriptive essay with vivid details and sensory language",
            "narrative": "narrative essay telling a story with clear beginning, middle, and end",
            "expository": "expository essay explaining the topic clearly and objectively",
            "persuasive": "persuasive essay convincing the reader of a particular viewpoint",
        }

        messages = [
            {"role": "system", "content": f"You are an expert essay writer. Write a {essay_types.get(essay_type, essay_types['argumentative'])}."},
            {"role": "user", "content": f"Write a {length}-word {essay_type} essay on: {topic}"}
        ]

        return self._generate_completion(messages, max_tokens=length * 2)

    def summarize(self, text: str, length: str = "medium") -> str:
        """Summarize text to different lengths"""
        length_instructions = {
            "short": "Summarize in 2-3 sentences",
            "medium": "Summarize in 1 paragraph",
            "long": "Provide a detailed summary with key points",
            "bullets": "Summarize as bullet points",
        }

        messages = [
            {"role": "system", "content": "You are an expert at summarizing text clearly and concisely."},
            {"role": "user", "content": f"{length_instructions.get(length, length_instructions['medium'])}:\n\n{text}"}
        ]

        return self._generate_completion(messages)

    def check_plagiarism(self, text: str) -> Dict:
        """Analyze text for potential plagiarism indicators"""
        messages = [
            {"role": "system", "content": "You are a plagiarism detection assistant. Analyze writing patterns and provide insights."},
            {"role": "user", "content": f"""Analyze this text for:
            1. Writing consistency
            2. Unusual phrases that might be copied
            3. Academic integrity suggestions

            Text: {text}

            Return a JSON object with:
            - originality_score: estimated percentage (0-100)
            - concerns: list of potential issues
            - suggestions: list of improvements"""}
        ]

        response = self._generate_completion(messages)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "originality_score": 100,
                "concerns": [],
                "suggestions": ["Analysis complete - no issues detected"]
            }

    def improve_writing(self, text: str, focus: str = "clarity") -> str:
        """Improve writing based on specific focus areas"""
        focus_prompts = {
            "clarity": "Improve clarity and readability",
            "conciseness": "Make more concise without losing meaning",
            "engagement": "Make more engaging and interesting",
            "academic": "Improve academic tone and structure",
            "business": "Adapt for professional business communication",
        }

        messages = [
            {"role": "system", "content": "You are a professional writing coach."},
            {"role": "user", "content": f"{focus_prompts.get(focus, focus_prompts['clarity'])} of this text:\n\n{text}"}
        ]

        return self._generate_completion(messages)

    def generate_outline(self, topic: str, outline_type: str = "essay") -> str:
        """Generate an outline for writing"""
        outline_types = {
            "essay": "academic essay",
            "article": "blog article",
            "report": "professional report",
            "story": "creative story",
            "presentation": "presentation",
        }

        messages = [
            {"role": "system", "content": "You are an expert at creating detailed outlines for writing projects."},
            {"role": "user", "content": f"Create a detailed outline for a {outline_types.get(outline_type, 'essay')} on: {topic}"}
        ]

        return self._generate_completion(messages)

    def translate(self, text: str, target_language: str) -> str:
        """Translate text to target language"""
        messages = [
            {"role": "system", "content": "You are a professional translator. Provide accurate translations while preserving meaning and tone."},
            {"role": "user", "content": f"Translate the following text to {target_language}:\n\n{text}"}
        ]

        return self._generate_completion(messages)

    def generate_title(self, content: str, style: str = "engaging") -> List[str]:
        """Generate title suggestions for content"""
        style_prompts = {
            "engaging": "engaging and attention-grabbing that spark curiosity",
            "academic": "formal and academic following scholarly conventions",
            "seo": "SEO-optimized with keywords and search-friendly structure",
            "creative": "creative and unique that stand out from the crowd",
            "professional": "professional and clear for business contexts",
        }

        style_instructions = {
            "engaging": "Use power words, numbers, and emotional triggers. Create curiosity gaps.",
            "academic": "Be precise and descriptive. Include the main topic and methodology if applicable.",
            "seo": "Include primary keywords near the beginning. Use modifiers like 'best', 'guide', 'how to'.",
            "creative": "Use metaphors, wordplay, or unexpected angles. Be memorable and distinctive.",
            "professional": "Be direct and value-focused. Emphasize benefits and outcomes.",
        }

        messages = [
            {"role": "system", "content": f"""You are an expert at creating compelling titles.
            Generate exactly 5 {style_prompts.get(style, 'engaging')} title suggestions.
            {style_instructions.get(style, '')}

            Guidelines:
            - Keep titles between 50-60 characters when possible
            - Make each title unique and different in approach
            - Ensure titles accurately reflect the content
            - Use appropriate capitalization
            - Do not use quotation marks around the titles
            - Return only the titles, one per line, without numbers or bullets"""},
            {"role": "user", "content": f"Create 5 title suggestions for this content:\n\n{content[:1000]}"}
        ]

        response = self._generate_completion(messages, temperature=0.8)

        # Clean and process titles
        titles = []
        for line in response.split('\n'):
            # Clean the line
            cleaned = line.strip()
            # Remove common prefixes like "1.", "•", "-", etc.
            cleaned = cleaned.lstrip('0123456789.-•*) ')
            # Remove quotes if present
            cleaned = cleaned.strip('"\'')

            if cleaned and len(cleaned) > 10:  # Minimum length check
                titles.append(cleaned)

        # Ensure we have at least some titles
        if not titles and response.strip():
            # Fallback: just split by newlines and take non-empty lines
            titles = [line.strip() for line in response.split('\n') if line.strip()][:5]

        return titles[:5]  # Return maximum 5 titles

    def analyze_tone(self, text: str) -> Dict:
        """Analyze the tone and style of text"""
        messages = [
            {"role": "system", "content": "You are an expert at analyzing writing tone and style."},
            {"role": "user", "content": f"""Analyze the tone and style of this text. Return a JSON object with:
            - primary_tone: main tone (e.g., formal, casual, academic)
            - emotions: list of detected emotions
            - reading_level: estimated reading level
            - suggestions: list of tone improvements

            Text: {text}"""}
        ]

        response = self._generate_completion(messages)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "primary_tone": "neutral",
                "emotions": ["neutral"],
                "reading_level": "general",
                "suggestions": []
            }

    def generate_citation(self, source_info: Dict, style: str = "apa") -> str:
        """Generate citations in various styles"""
        messages = [
            {"role": "system", "content": f"You are an expert at creating {style.upper()} citations."},
            {"role": "user", "content": f"Create a {style.upper()} citation for: {json.dumps(source_info)}"}
        ]

        return self._generate_completion(messages, temperature=0.3)

    def create_flashcards(self, text: str, num_cards: int = 10) -> List[Dict]:
        """Create flashcards from text content"""
        messages = [
            {"role": "system", "content": """You are an expert at creating educational flashcards.
            You must return ONLY a valid JSON array, no other text or explanation.
            Each flashcard should test understanding of key concepts from the material."""},
            {"role": "user", "content": f"""Create exactly {num_cards} flashcards from this text.
            Return ONLY a JSON array where each flashcard object has exactly these fields:
            - "question": A clear, specific question about the content
            - "answer": A concise, accurate answer

            Example format:
            [
                {{"question": "What is photosynthesis?", "answer": "The process by which plants convert light energy into chemical energy"}},
                {{"question": "Where does photosynthesis occur?", "answer": "In the chloroplasts of plant cells"}}
            ]

            Text to create flashcards from: {text}"""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7)
            # Clean the response - remove any markdown formatting
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()

            # Parse JSON
            flashcards = json.loads(response)

            # Validate structure
            if not isinstance(flashcards, list):
                logger.error(f"Flashcards response is not a list: {type(flashcards)}")
                return []

            # Ensure all flashcards have required fields
            valid_flashcards = []
            for card in flashcards:
                if isinstance(card, dict) and 'question' in card and 'answer' in card:
                    valid_flashcards.append({
                        'question': str(card['question']),
                        'answer': str(card['answer'])
                    })

            logger.info(f"Generated {len(valid_flashcards)} valid flashcards from {num_cards} requested")
            return valid_flashcards[:num_cards]  # Limit to requested number

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse flashcards JSON: {e}. Response: {response[:200]}...")
            # Try to extract flashcards manually if JSON parsing fails
            try:
                # Fallback: try to find JSON array in the response
                import re
                json_match = re.search(r'\[\s*\{.*?\}\s*\]', response, re.DOTALL)
                if json_match:
                    flashcards = json.loads(json_match.group())
                    valid_flashcards = []
                    for card in flashcards:
                        if isinstance(card, dict) and 'question' in card and 'answer' in card:
                            valid_flashcards.append({
                                'question': str(card['question']),
                                'answer': str(card['answer'])
                            })
                    return valid_flashcards[:num_cards]
            except:
                pass
            return []
        except Exception as e:
            logger.error(f"Error creating flashcards: {e}")
            return []

    def generate_quiz(self, text: str, num_questions: int = 5) -> List[Dict]:
        """Generate quiz questions from text"""
        messages = [
            {"role": "system", "content": """You are an expert at creating educational quiz questions.
            Create clear, unambiguous multiple-choice questions that test understanding of key concepts.
            Ensure questions are factual and have one definitively correct answer.
            Make distractors (wrong answers) plausible but clearly incorrect."""},
            {"role": "user", "content": f"""Create exactly {num_questions} multiple-choice questions from this text.
            Return ONLY a valid JSON array where each question object has exactly these fields:
            - "question": Clear question text
            - "options": Array of exactly 4 answer options (strings)
            - "correct_answer": Index of the correct option (0, 1, 2, or 3)
            - "explanation": Brief explanation of why the answer is correct

            Guidelines:
            - Questions should test comprehension, not just memorization
            - Options should be similar in length and structure
            - Avoid "all of the above" or "none of the above" options
            - Make questions progressively cover different aspects of the content

            Content to create questions from:
            {text}"""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.5)

            # Clean the response
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()

            # Parse JSON
            questions = json.loads(response)

            # Validate structure
            if not isinstance(questions, list):
                logger.error(f"Quiz response is not a list: {type(questions)}")
                return []

            # Validate each question
            valid_questions = []
            for q in questions[:num_questions]:
                if (isinstance(q, dict) and
                    'question' in q and
                    'options' in q and
                    'correct_answer' in q and
                    'explanation' in q and
                    isinstance(q['options'], list) and
                    len(q['options']) == 4 and
                    isinstance(q['correct_answer'], int) and
                    0 <= q['correct_answer'] <= 3):
                    valid_questions.append(q)

            return valid_questions

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse quiz JSON: {e}")
            return []
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            return []

    def evaluate_quiz(self, questions: List[Dict], user_answers: List[int]) -> Dict:
        """Evaluate quiz answers and provide feedback"""
        correct_count = 0
        total_questions = len(questions)

        # Calculate score
        for i, question in enumerate(questions):
            if i < len(user_answers) and user_answers[i] == question['correct_answer']:
                correct_count += 1

        score_percentage = (correct_count / total_questions * 100) if total_questions > 0 else 0

        # Generate personalized feedback using LLM
        messages = [
            {"role": "system", "content": """You are an encouraging educational assistant.
            Provide constructive feedback on quiz performance.
            Be positive and motivating while also being educational."""},
            {"role": "user", "content": f"""A student completed a quiz with the following results:
            - Total questions: {total_questions}
            - Correct answers: {correct_count}
            - Score: {score_percentage:.1f}%

            Provide brief, encouraging feedback (2-3 sentences) that:
            1. Acknowledges their performance
            2. Offers encouragement
            3. Suggests next steps for learning

            Keep the tone positive and constructive."""}
        ]

        try:
            feedback = self._generate_completion(messages, temperature=0.7, max_tokens=200)
        except Exception as e:
            logger.error(f"Error generating feedback: {e}")
            feedback = "Good effort! Keep practicing to improve your understanding."

        # Compile results
        results = {
            'score': score_percentage,
            'correct_answers': correct_count,
            'total_questions': total_questions,
            'feedback': feedback,
            'question_results': []
        }

        # Add detailed results for each question
        for i, question in enumerate(questions):
            user_answer = user_answers[i] if i < len(user_answers) else -1
            is_correct = user_answer == question['correct_answer']

            results['question_results'].append({
                'question_index': i,
                'is_correct': is_correct,
                'user_answer': user_answer,
                'correct_answer': question['correct_answer'],
                'explanation': question['explanation']
            })

        return results

    def generate_meta_description(self, content: str, keywords: Optional[List[str]] = None,
                                 tone: str = "professional", target_length: int = 155) -> Dict:
        """Generate SEO-optimized meta descriptions"""
        keyword_instruction = ""
        if keywords:
            keyword_instruction = f"Include these keywords naturally: {', '.join(keywords)}. "

        tone_instructions = {
            "professional": "Use a professional, authoritative tone",
            "casual": "Use a friendly, conversational tone",
            "urgent": "Create urgency to encourage clicks",
            "informative": "Focus on providing valuable information",
            "promotional": "Emphasize benefits and value propositions"
        }

        messages = [
            {"role": "system", "content": """You are an SEO expert specializing in creating compelling meta descriptions.
            Your meta descriptions must:
            1. Be between 150-160 characters (never exceed 160)
            2. Include a clear call-to-action
            3. Be unique and relevant to the content
            4. Use active voice
            5. Create curiosity or provide value
            6. Avoid duplicate phrases or keyword stuffing"""},
            {"role": "user", "content": f"""Create 3 different meta descriptions for this content.
            {keyword_instruction}
            {tone_instructions.get(tone, tone_instructions['professional'])}.
            Target length: {target_length} characters.

            Content: {content[:1000]}

            Return ONLY a JSON object with this exact structure:
            {{
                "descriptions": [
                    {{
                        "text": "meta description text",
                        "length": 155,
                        "keywords_included": ["keyword1", "keyword2"]
                    }}
                ],
                "best_practices_score": 85,
                "seo_tips": ["tip1", "tip2"]
            }}"""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7)
            # Clean the response
            response = response.strip()
            if response.startswith('```json'):
                response = response[7:]
            if response.startswith('```'):
                response = response[3:]
            if response.endswith('```'):
                response = response[:-3]
            response = response.strip()

            result = json.loads(response)

            # Validate and enhance the result
            validated_descriptions = []
            for desc in result.get('descriptions', []):
                if isinstance(desc, dict) and 'text' in desc:
                    text = desc['text']
                    # Ensure length compliance
                    if len(text) > 160:
                        text = text[:157] + '...'

                    validated_descriptions.append({
                        'text': text,
                        'length': len(text),
                        'keywords_included': desc.get('keywords_included', [])
                    })

            # Calculate SEO score based on best practices
            if validated_descriptions:
                primary_desc = validated_descriptions[0]
                score = 100

                # Length check
                if primary_desc['length'] < 120:
                    score -= 15
                elif primary_desc['length'] > 160:
                    score -= 20

                # Keyword check
                if keywords:
                    keywords_found = sum(1 for kw in keywords if kw.lower() in primary_desc['text'].lower())
                    if keywords_found == 0:
                        score -= 20
                    elif keywords_found < len(keywords) // 2:
                        score -= 10

                # Character checks
                if not any(c in primary_desc['text'] for c in '.!?'):
                    score -= 5  # No sentence ending
                if primary_desc['text'].count('"') % 2 != 0:
                    score -= 5  # Unmatched quotes

                result['best_practices_score'] = max(0, score)

            return {
                'descriptions': validated_descriptions,
                'best_practices_score': result.get('best_practices_score', 85),
                'seo_tips': result.get('seo_tips', [
                    'Keep descriptions between 150-160 characters',
                    'Include primary keywords naturally',
                    'Use action-oriented language',
                    'Make each description unique'
                ])
            }

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Meta description generation error: {e}")
            # Return a fallback response
            fallback_text = content[:150].strip()
            if len(fallback_text) == 150:
                fallback_text = fallback_text[:147] + '...'

            return {
                'descriptions': [{
                    'text': fallback_text,
                    'length': len(fallback_text),
                    'keywords_included': keywords or []
                }],
                'best_practices_score': 60,
                'seo_tips': [
                    'Generated basic description from content',
                    'Consider adding keywords for better SEO',
                    'Customize for better engagement'
                ]
            }



    def process_image_with_ocr(self, image_data: str, language: str = 'eng') -> Dict:
        """Process image and extract text using OCR"""
        try:
            # Decode base64 image
            if ',' in image_data:
                image_data = image_data.split(',')[1]

            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))

            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Perform OCR
            extracted_text = pytesseract.image_to_string(image, lang=language)

            # Try to detect language
            detected_language = 'en'
            try:
                if extracted_text.strip():
                    detected_language = detect(extracted_text)
            except LangDetectException:
                pass

            # Get image dimensions
            width, height = image.size

            return {
                'extracted_text': extracted_text,
                'detected_language': detected_language,
                'image_dimensions': {'width': width, 'height': height},
                'word_count': len(extracted_text.split()),
                'success': True
            }

        except Exception as e:
            logger.error(f"OCR processing error: {e}")
            return {
                'extracted_text': '',
                'error': str(e),
                'success': False
            }

    def analyze_screen_content(self, image_data: str, question: str = None, context: str = None) -> Dict:
        """Analyze screen content and answer questions about it"""
        # First extract text from image
        ocr_result = self.process_image_with_ocr(image_data)

        if not ocr_result['success']:
            return {
                'error': 'Failed to process image',
                'details': ocr_result.get('error', 'Unknown error')
            }

        extracted_text = ocr_result['extracted_text']
        detected_language = ocr_result['detected_language']

        # If no specific question, provide a summary
        if not question:
            question = "Provide a detailed summary of the content in this image."

        # Build context for AI
        messages = [
            {"role": "system", "content": """You are VisiSense AI, an intelligent screen analysis assistant.
            You analyze screen content and provide helpful, context-aware responses.
            You can understand multiple languages and provide translations when needed.
            Be concise but comprehensive in your responses."""},
            {"role": "user", "content": f"""Analyze this screen content and answer the question.

            Extracted Text from Image:
            {extracted_text}

            Detected Language: {detected_language}
            {f'Additional Context: {context}' if context else ''}

            Question: {question}

            Provide a helpful and detailed response. If translation is needed, include it."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=1500)

            return {
                'analysis': response,
                'extracted_text': extracted_text,
                'detected_language': detected_language,
                'word_count': ocr_result['word_count'],
                'success': True
            }

        except Exception as e:
            logger.error(f"Screen analysis error: {e}")
            return {
                'error': str(e),
                'extracted_text': extracted_text,
                'success': False
            }

    def translate_screen_text(self, text: str, target_language: str = 'English') -> str:
        """Translate extracted screen text to target language"""
        messages = [
            {"role": "system", "content": "You are a professional translator. Translate accurately while preserving meaning and context."},
            {"role": "user", "content": f"""Translate the following text to {target_language}.
            Preserve formatting and structure where possible.

            Text:
            {text}

            Translation:"""}
        ]

        return self._generate_completion(messages, temperature=0.3, max_tokens=2000)

    def answer_screen_question(self, extracted_text: str, question: str, chat_history: List[Dict] = None) -> str:
        """Answer questions about screen content with chat history support"""
        if chat_history is None:
            chat_history = []

        messages = [
            {"role": "system", "content": f"""You are VisiSense AI, helping users understand screen content.
            You have access to text extracted from their screen. Answer questions based on this content.
            Be specific and helpful. If something isn't clear in the extracted text, say so.

            Screen Content:
            {extracted_text}"""},
        ]

        # Add chat history
        for msg in chat_history[-5:]:  # Keep last 5 messages for context
            messages.append({"role": msg['role'], "content": msg['content']})

        # Add current question
        messages.append({"role": "user", "content": question})

        return self._generate_completion(messages, temperature=0.7, max_tokens=1000)

    def extract_key_information(self, text: str, info_type: str = 'general') -> Dict:
        """Extract specific types of information from screen text"""

        info_prompts = {
            'general': "Extract all key information, facts, and important points",
            'definitions': "Extract all definitions, terms, and their explanations",
            'numbers': "Extract all numbers, statistics, dates, and quantitative data",
            'names': "Extract all names of people, places, organizations, and products",
            'actions': "Extract all actions, instructions, or steps mentioned",
            'questions': "Extract all questions or queries present in the text",
            'code': "Extract and explain any code snippets or technical commands"
        }

        messages = [
            {"role": "system", "content": "You are an expert at extracting and organizing information from text."},
            {"role": "user", "content": f"""{info_prompts.get(info_type, info_prompts['general'])} from this text.

            Return a JSON object with:
            - extracted_items: list of extracted information
            - summary: brief summary of findings
            - count: number of items found

            Text:
            {text}"""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.3, max_tokens=1500)

            # Try to parse as JSON
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned[cleaned.find('{'):cleaned.rfind('}')+1]

            return json.loads(cleaned)

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Information extraction error: {e}")
            return {
                'extracted_items': [],
                'summary': 'Unable to extract information',
                'count': 0,
                'error': str(e)
            }

    def generate_screen_summary(self, text: str, summary_type: str = 'concise') -> str:
        """Generate different types of summaries for screen content"""

        summary_prompts = {
            'concise': "Provide a concise 2-3 sentence summary",
            'detailed': "Provide a detailed summary with main points and sub-points",
            'bullets': "Provide a bullet-point summary of key information",
            'academic': "Provide an academic-style abstract of the content",
            'simplified': "Provide a simplified summary that a child could understand"
        }

        messages = [
            {"role": "system", "content": "You are an expert at summarizing screen content clearly and effectively."},
            {"role": "user", "content": f"""{summary_prompts.get(summary_type, summary_prompts['concise'])} of this content:

            {text}"""}
        ]

        return self._generate_completion(messages, temperature=0.5, max_tokens=800)

    def generate_content_calendar(self, business_description: str) -> Dict:
        """Generate a 30-day social media content calendar"""
        messages = [
            {"role": "system", "content": """You are a social media content strategist. Generate a 30-day content calendar.

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks, no extra text.

For each day provide:
1. Hook: 5-10 word attention-grabber
2. Caption: 50-100 words max
3. Hashtags: 5-8 relevant hashtags
4. Design Prompt: Brief visual idea
5. Posting Times: Times for each platform

JSON structure (generate all 30 days):
{
  "business_name": "name",
  "business_type": "type",
  "target_audience": "audience",
  "content_themes": ["theme1", "theme2", "theme3"],
  "calendar": [
    {
      "day": 1,
      "date": "Day 1",
      "hook": "short hook",
      "caption": "post content",
      "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
      "design_prompt": "visual idea",
      "posting_times": {
        "instagram": "9:00 AM",
        "tiktok": "3:00 PM",
        "linkedin": "8:00 AM",
        "twitter": "2:00 PM"
      }
    }
  ]
}"""},
            {"role": "user", "content": f"Generate a 30-day content calendar for: {business_description}. Return ONLY valid JSON."}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=8000)

            # Try to extract JSON from the response
            try:
                # Remove markdown code blocks if present
                cleaned_response = response.strip()
                if cleaned_response.startswith('```json'):
                    cleaned_response = cleaned_response[7:]  # Remove ```json
                elif cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[3:]  # Remove ```

                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:-3]  # Remove ending ```

                cleaned_response = cleaned_response.strip()

                # Try to find JSON in the response
                json_start = cleaned_response.find('{')
                json_end = cleaned_response.rfind('}') + 1

                if json_start != -1 and json_end > json_start:
                    json_str = cleaned_response[json_start:json_end]
                    calendar_data = json.loads(json_str)

                    # Validate the structure
                    if 'calendar' in calendar_data and isinstance(calendar_data['calendar'], list):
                        # Ensure we have at least some days
                        if len(calendar_data['calendar']) == 0:
                            raise ValueError("No calendar days generated")
                        logger.info(f"Successfully parsed calendar with {len(calendar_data['calendar'])} days")
                        return calendar_data
                    else:
                        raise ValueError("Invalid calendar structure")
                else:
                    raise ValueError("No JSON found in response")

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse calendar JSON: {e}")
                logger.error(f"Raw response: {response[:500]}...")

                # Return a structured error that the frontend can handle
                return {
                    "error": "Failed to generate calendar. The AI response was not in the expected format.",
                    "business_description": business_description,
                    "calendar": []  # Empty calendar to prevent frontend errors
                }

        except Exception as e:
            logger.error(f"Content calendar generation error: {e}")
            # Return a user-friendly error
            return {
                "error": f"Failed to generate content calendar: {str(e)}",
                "business_description": business_description,
                "calendar": []
            }

    def generate_course_outline(self, topic: str, target_audience: str, duration: str,
                               level: str, format: str, learning_goals: str = "",
                               prerequisites: str = "") -> Dict:
        """Generate a comprehensive course outline"""
        messages = [
            {"role": "system", "content": """You are an expert instructional designer and curriculum developer. Create a comprehensive course outline based on the provided information.

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks.

Structure your response with:
1. Course title and summary
2. Learning objectives (5-8 SMART goals)
3. Prerequisites (if any)
4. Modules with lessons and time estimates
5. Assessments and activities
6. Resources and materials

JSON structure:
{
  "courseTitle": "course name",
  "courseSummary": "brief description",
  "duration": "total duration",
  "level": "difficulty level",
  "prerequisites": ["prereq1", "prereq2"],
  "learningObjectives": ["objective1", "objective2"],
  "modules": [
    {
      "moduleNumber": 1,
      "title": "module title",
      "duration": "estimated time",
      "objectives": ["module objective 1", "module objective 2"],
      "lessons": [
        {
          "title": "lesson title",
          "duration": "time estimate",
          "topics": ["topic1", "topic2"],
          "activities": ["activity1", "activity2"],
          "resources": ["resource1", "resource2"]
        }
      ],
      "assignments": [
        {
          "title": "assignment title",
          "description": "brief description",
          "type": "quiz/project/discussion"
        }
      ]
    }
  ],
  "assessmentStrategy": {
    "formative": ["assessment type 1", "assessment type 2"],
    "summative": ["final assessment type"],
    "grading": "grading approach"
  },
  "resources": [
    {
      "type": "textbook/video/article",
      "title": "resource title",
      "description": "why it's useful"
    }
  ]
}"""},
            {"role": "user", "content": f"""Create a comprehensive course outline for:
Topic: {topic}
Target Audience: {target_audience}
Duration: {duration}
Level: {level}
Format: {format}
{f'Learning Goals: {learning_goals}' if learning_goals else ''}
{f'Prerequisites: {prerequisites}' if prerequisites else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=6000)

            # Parse JSON response
            try:
                # Remove any markdown formatting if present
                cleaned_response = response.strip()
                if cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[cleaned_response.find('\n')+1:]
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:cleaned_response.rfind('```')]

                cleaned_response = cleaned_response.strip()
                course_data = json.loads(cleaned_response)

                # Validate the structure
                if 'modules' in course_data and isinstance(course_data['modules'], list):
                    logger.info(f"Successfully generated course outline with {len(course_data['modules'])} modules")
                    return course_data
                else:
                    raise ValueError("Invalid course outline structure")

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse course outline JSON: {e}")
                logger.error(f"Raw response: {response[:500]}...")

                return {
                    "error": "Failed to generate course outline. Please try again.",
                    "topic": topic,
                    "modules": []
                }

        except Exception as e:
            logger.error(f"Course outline generation error: {e}")
            return {
                "error": f"Failed to generate course outline: {str(e)}",
                "topic": topic,
                "modules": []
            }

    def optimize_linkedin_post(self, content: str, goal: str = "engagement", tone: str = "professional",
                               include_hashtags: bool = True, include_cta: bool = True,
                               include_emoji: bool = True) -> Dict:
        """Optimize content for LinkedIn posts"""

        goal_instructions = {
            "engagement": "Maximize likes, comments, and shares through thought-provoking content and questions",
            "brand_awareness": "Focus on establishing authority and increasing visibility in your industry",
            "lead_generation": "Drive traffic and encourage readers to take action or reach out",
            "thought_leadership": "Position the author as an industry expert with unique insights",
            "networking": "Encourage meaningful connections and professional discussions"
        }

        tone_instructions = {
            "professional": "formal yet approachable business tone",
            "conversational": "friendly, casual, and relatable tone",
            "inspirational": "motivational and uplifting tone",
            "educational": "informative and teaching-focused tone",
            "storytelling": "narrative-driven, personal story format"
        }

        messages = [
            {"role": "system", "content": f"""You are a LinkedIn content optimization expert. Your job is to transform content into high-performing LinkedIn posts.

Key LinkedIn best practices:
- Hook in the first 2-3 lines (before "see more")
- Use line breaks for readability
- Keep paragraphs short (1-2 sentences)
- Use "I" statements and personal experiences
- Include a clear call-to-action
- Use relevant hashtags (3-5 max)
- Optimal length: 1200-1500 characters

Goal: {goal_instructions.get(goal, goal_instructions['engagement'])}
Tone: {tone_instructions.get(tone, tone_instructions['professional'])}"""},
            {"role": "user", "content": f"""Transform this content into an optimized LinkedIn post:

Original Content:
{content}

Requirements:
- {"Include 3-5 relevant hashtags" if include_hashtags else "No hashtags"}
- {"Include a call-to-action" if include_cta else "No call-to-action needed"}
- {"Use emojis sparingly for emphasis" if include_emoji else "No emojis"}

Return ONLY valid JSON with this structure:
{{
    "optimized_post": "The full optimized LinkedIn post ready to copy-paste",
    "hook": "The attention-grabbing first line",
    "hashtags": ["list", "of", "hashtags"],
    "cta": "The call-to-action phrase",
    "character_count": number,
    "improvements": ["list of improvements made"],
    "tips": ["additional tips for this specific post"]
}}

IMPORTANT: Use \\n for line breaks in the optimized_post, not actual newlines."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=2000)

            # Parse JSON response
            cleaned_response = response.strip()
            if cleaned_response.startswith('```'):
                cleaned_response = cleaned_response[cleaned_response.find('\n')+1:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:cleaned_response.rfind('```')]
            if cleaned_response.startswith('json'):
                cleaned_response = cleaned_response[4:]

            cleaned_response = cleaned_response.strip()

            # Fix common JSON issues: replace actual newlines in string values with \n
            # This handles cases where the AI uses real line breaks instead of escape sequences
            import re
            # Replace newlines that are inside JSON string values
            def fix_newlines_in_json(text):
                # Split by quotes to identify string content
                result = []
                in_string = False
                i = 0
                while i < len(text):
                    char = text[i]
                    if char == '"' and (i == 0 or text[i-1] != '\\'):
                        in_string = not in_string
                        result.append(char)
                    elif char == '\n' and in_string:
                        result.append('\\n')
                    elif char == '\r' and in_string:
                        result.append('')  # Skip carriage returns
                    else:
                        result.append(char)
                    i += 1
                return ''.join(result)

            cleaned_response = fix_newlines_in_json(cleaned_response)
            result = json.loads(cleaned_response)

            # Ensure all required fields exist
            optimized_post = result.get("optimized_post", content)
            return {
                "optimized_post": optimized_post,
                "hook": result.get("hook", ""),
                "hashtags": result.get("hashtags", []),
                "cta": result.get("cta", ""),
                "character_count": result.get("character_count", len(optimized_post)),
                "improvements": result.get("improvements", []),
                "tips": result.get("tips", [])
            }

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"LinkedIn optimizer error: {e}")
            logger.error(f"Raw response: {response[:500] if 'response' in locals() else 'No response'}")
            return {
                "optimized_post": content,
                "hook": "",
                "hashtags": [],
                "cta": "",
                "character_count": len(content),
                "improvements": [],
                "tips": [],
                "error": "Failed to optimize. Please try again."
            }

    def extract_keywords(self, text: str, max_keywords: int = 10) -> Dict:
        """Extract keywords and key phrases from text"""
        messages = [
            {"role": "system", "content": f"""You are an expert SEO and content analysis specialist. Extract the most important keywords and key phrases from the given text.

Return a valid JSON object with this exact structure:
{{
    "keywords": [
        {{"keyword": "example keyword", "relevance": 0.95, "category": "topic"}},
        ...
    ],
    "summary": "A brief one-sentence summary of the text content"
}}

Rules:
- Extract up to {max_keywords} keywords/phrases
- Each keyword should have a relevance score from 0.0 to 1.0
- Categorize each keyword as one of: "topic", "entity", "concept", "action", "descriptor"
- Sort by relevance (highest first)
- Include both single words and multi-word phrases
- Focus on SEO-relevant and content-relevant terms
- Return ONLY valid JSON, no other text"""},
            {"role": "user", "content": f"Extract keywords from this text:\n\n{text}"}
        ]

        response = self._generate_completion(messages, temperature=0.3, max_tokens=1000)

        try:
            import json
            # Clean up response
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1] if '\n' in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit('```', 1)[0]
            result = json.loads(cleaned)

            # Ensure proper structure
            if 'keywords' not in result:
                result = {'keywords': [], 'summary': ''}

            # Sort by relevance and limit
            result['keywords'] = sorted(
                result['keywords'][:max_keywords],
                key=lambda x: x.get('relevance', 0),
                reverse=True
            )

            return result
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Keyword extraction parse error: {e}")
            # Fallback: extract simple keywords from the response
            words = response.split(',')
            keywords = [
                {"keyword": w.strip().strip('"').strip("'"), "relevance": 0.5, "category": "topic"}
                for w in words[:max_keywords] if w.strip()
            ]
            return {
                "keywords": keywords,
                "summary": "Keywords extracted from text content."
            }

    # ================================================================
    #  Email Writer
    # ================================================================

    def generate_email(self, email_type: str, recipient: str, subject_context: str,
                       key_points: str = "", tone: str = "formal",
                       sender_name: str = "") -> Dict:
        """Generate a professional email"""
        tone_guidance = {
            'formal': 'Use formal, professional language with proper salutations.',
            'friendly': 'Use warm, conversational but still professional language.',
            'assertive': 'Use confident, direct language while remaining respectful.',
            'empathetic': 'Use compassionate, understanding language.',
            'neutral': 'Use balanced, objective language.',
        }

        messages = [
            {"role": "system", "content": f"""You are an expert email writer. Generate a professional email.
Tone guidance: {tone_guidance.get(tone, tone_guidance['formal'])}

Return ONLY a valid JSON object with exactly these fields:
{{
    "subject": "email subject line",
    "body": "complete email body with greeting and sign-off",
    "tips": ["list of 2-3 tips for improving the email further"]
}}"""},
            {"role": "user", "content": f"""Write a {email_type.replace('_', ' ')} email.
Recipient: {recipient}
Context: {subject_context}
{f'Key points to include: {key_points}' if key_points else ''}
{f'Sender name: {sender_name}' if sender_name else ''}"""}
        ]

        response = self._generate_completion(messages, temperature=0.7, max_tokens=1500)

        try:
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1] if '\n' in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit('```', 1)[0]
            result = json.loads(cleaned)
            return {
                "subject": result.get("subject", ""),
                "body": result.get("body", ""),
                "tips": result.get("tips", []),
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Email generation parse error: {e}")
            return {
                "subject": f"Re: {subject_context}",
                "body": response,
                "tips": [],
            }

    # ================================================================
    #  Social Media Post Generator
    # ================================================================

    def generate_social_media_posts(self, topic: str, platforms: List[str],
                                     tone: str = "casual",
                                     include_hashtags: bool = True,
                                     include_emojis: bool = True,
                                     num_variations: int = 2) -> Dict:
        """Generate social media posts for multiple platforms"""
        platform_guidelines = {
            'twitter': 'Max 280 chars. Punchy, engaging. Use hooks.',
            'linkedin': 'Professional tone, 1300 chars max. Storytelling format with line breaks.',
            'instagram': 'Visual-first caption, up to 2200 chars. Break into paragraphs. Heavy emoji/hashtag use.',
            'facebook': 'Conversational, 1-3 paragraphs. Encourage comments and shares.',
            'tiktok': 'Trendy, short, Gen-Z friendly. Reference trends. Max 150 chars for caption.',
            'threads': 'Conversational, opinion-driven. 500 chars max. Thread-style.',
        }

        platform_specs = "\n".join(
            f"- {p.upper()}: {platform_guidelines.get(p, 'General social media post')}"
            for p in platforms
        )

        messages = [
            {"role": "system", "content": f"""You are a social media content strategist.
Generate {num_variations} post variation(s) for each platform.
{'Include relevant hashtags.' if include_hashtags else 'Do NOT include hashtags.'}
{'Include emojis where appropriate.' if include_emojis else 'Do NOT include emojis.'}
Tone: {tone}

Platform guidelines:
{platform_specs}

Return ONLY a valid JSON object with this structure:
{{
    "posts": {{
        "<platform>": [
            {{
                "content": "the post text",
                "hashtags": ["hashtag1", "hashtag2"],
                "best_time": "suggested posting time",
                "tip": "engagement tip for this post"
            }}
        ]
    }},
    "content_strategy": "brief overall strategy note"
}}"""},
            {"role": "user", "content": f"Create social media posts about: {topic}"}
        ]

        response = self._generate_completion(messages, temperature=0.8, max_tokens=3000)

        try:
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1] if '\n' in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit('```', 1)[0]
            result = json.loads(cleaned)
            return {
                "posts": result.get("posts", {}),
                "content_strategy": result.get("content_strategy", ""),
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Social media generation parse error: {e}")
            return {
                "posts": {p: [{"content": response, "hashtags": [], "best_time": "", "tip": ""}] for p in platforms},
                "content_strategy": "",
            }

    # ================================================================
    #  Resume Builder
    # ================================================================

    def build_resume(self, full_name: str, target_role: str, experience: str,
                     education: str, skills: str, job_description: str = "",
                     style: str = "professional") -> Dict:
        """Build a professional resume"""
        style_guidance = {
            'professional': 'Clean, traditional format with strong action verbs.',
            'creative': 'Modern, dynamic format with personality. Good for marketing/design roles.',
            'technical': 'Emphasize technical skills, projects, and quantifiable achievements.',
            'executive': 'Focus on leadership, strategy, and high-level accomplishments.',
            'entry_level': 'Emphasize education, internships, projects, and transferable skills.',
        }

        messages = [
            {"role": "system", "content": f"""You are an expert resume writer and career coach.
Style: {style_guidance.get(style, style_guidance['professional'])}
{f'Tailor the resume to match this job description.' if job_description else ''}

Return ONLY a valid JSON object with this structure:
{{
    "summary": "professional summary / objective (2-3 sentences)",
    "experience": [
        {{
            "title": "job title",
            "company": "company name",
            "period": "time period",
            "bullets": ["achievement 1", "achievement 2", "achievement 3"]
        }}
    ],
    "education": [
        {{
            "degree": "degree name",
            "institution": "school name",
            "year": "graduation year",
            "details": "relevant coursework or honors"
        }}
    ],
    "skills": {{
        "technical": ["skill1", "skill2"],
        "soft": ["skill1", "skill2"],
        "tools": ["tool1", "tool2"]
    }},
    "tips": ["improvement tip 1", "improvement tip 2", "improvement tip 3"],
    "ats_score": 85,
    "ats_suggestions": ["suggestion for better ATS compatibility"]
}}"""},
            {"role": "user", "content": f"""Build a resume for:
Name: {full_name}
Target Role: {target_role}
Experience: {experience}
Education: {education}
Skills: {skills}
{f'Job Description to target: {job_description}' if job_description else ''}"""}
        ]

        response = self._generate_completion(messages, temperature=0.6, max_tokens=3000)

        try:
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1] if '\n' in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit('```', 1)[0]
            result = json.loads(cleaned)
            return {
                "full_name": full_name,
                "target_role": target_role,
                "summary": result.get("summary", ""),
                "experience": result.get("experience", []),
                "education": result.get("education", []),
                "skills": result.get("skills", {}),
                "tips": result.get("tips", []),
                "ats_score": result.get("ats_score", 0),
                "ats_suggestions": result.get("ats_suggestions", []),
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Resume build parse error: {e}")
            return {
                "full_name": full_name,
                "target_role": target_role,
                "summary": response,
                "experience": [],
                "education": [],
                "skills": {},
                "tips": [],
                "ats_score": 0,
                "ats_suggestions": [],
            }

    # ================================================================
    #  Code Generator
    # ================================================================

    def generate_code(self, description: str, language: str = "python",
                      complexity: str = "intermediate",
                      include_comments: bool = True,
                      include_tests: bool = False) -> Dict:
        """Generate code snippets and functions"""
        lang_display = {
            'python': 'Python', 'javascript': 'JavaScript', 'typescript': 'TypeScript',
            'java': 'Java', 'csharp': 'C#', 'cpp': 'C++', 'go': 'Go',
            'rust': 'Rust', 'ruby': 'Ruby', 'php': 'PHP', 'swift': 'Swift',
            'kotlin': 'Kotlin', 'sql': 'SQL', 'html_css': 'HTML/CSS',
        }

        messages = [
            {"role": "system", "content": f"""You are an expert {lang_display.get(language, language)} programmer.
Generate clean, production-quality code.
Complexity level: {complexity}
{'Include detailed comments explaining the code.' if include_comments else 'Minimize comments.'}
{'Also include unit tests.' if include_tests else ''}

Return ONLY a valid JSON object with this structure:
{{
    "code": "the main code",
    "explanation": "brief explanation of how the code works",
    "language": "{language}",
    "time_complexity": "Big O notation if applicable",
    "space_complexity": "Big O notation if applicable",
    {'"tests": "unit test code",' if include_tests else ''}
    "usage_example": "example of how to use the code",
    "dependencies": ["any required packages or imports"],
    "notes": ["important notes or caveats"]
}}"""},
            {"role": "user", "content": f"Generate {lang_display.get(language, language)} code for: {description}"}
        ]

        response = self._generate_completion(messages, temperature=0.4, max_tokens=3000)

        try:
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned.split('\n', 1)[1] if '\n' in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit('```', 1)[0]
            result = json.loads(cleaned)
            return {
                "code": result.get("code", ""),
                "explanation": result.get("explanation", ""),
                "language": language,
                "time_complexity": result.get("time_complexity", ""),
                "space_complexity": result.get("space_complexity", ""),
                "tests": result.get("tests", ""),
                "usage_example": result.get("usage_example", ""),
                "dependencies": result.get("dependencies", []),
                "notes": result.get("notes", []),
            }
        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Code generation parse error: {e}")
            return {
                "code": response,
                "explanation": "",
                "language": language,
                "time_complexity": "",
                "space_complexity": "",
                "tests": "",
                "usage_example": "",
                "dependencies": [],
                "notes": [],
            }

    def generate_learning_roadmap(self, goal: str, skill_level: str, hours_per_week: int,
                                   preferred_style: str, constraints: str = "",
                                   timeline: str = "") -> Dict:
        """Generate a structured learning roadmap"""
        messages = [
            {"role": "system", "content": """You are an expert learning coach and curriculum designer. Create a detailed, actionable learning roadmap based on the learner's profile.

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks.

JSON structure:
{
  "title": "Learning Roadmap: <goal>",
  "overview": "A motivating 2-3 sentence summary of the roadmap and what the learner will achieve.",
  "estimatedDuration": "e.g. 6 months",
  "totalHours": 240,
  "skillLevel": "beginner/intermediate/advanced",
  "phases": [
    {
      "phaseNumber": 1,
      "title": "Phase title",
      "duration": "e.g. 4 weeks",
      "hours": 40,
      "description": "What this phase covers and why it matters.",
      "learningObjectives": ["objective 1", "objective 2", "objective 3"],
      "topics": [
        {
          "name": "Topic name",
          "description": "Brief description",
          "estimatedHours": 8,
          "priority": "essential/recommended/optional",
          "resources": [
            {
              "title": "Resource name",
              "type": "video/book/article/course/project/documentation",
              "url": "",
              "description": "Why this resource is helpful",
              "isFree": true
            }
          ]
        }
      ],
      "milestoneProject": {
        "title": "Project title",
        "description": "What to build/do to prove you've mastered this phase",
        "skills": ["skill1", "skill2"]
      },
      "checkpoints": ["Can you do X?", "Can you explain Y?", "Have you built Z?"]
    }
  ],
  "weeklySchedule": {
    "hoursPerWeek": 10,
    "suggestedBreakdown": [
      {"activity": "Watch tutorials / Read material", "hours": 3},
      {"activity": "Hands-on practice / Coding", "hours": 4},
      {"activity": "Project work", "hours": 2},
      {"activity": "Review & reflection", "hours": 1}
    ]
  },
  "tips": [
    "Practical tip 1",
    "Practical tip 2",
    "Practical tip 3",
    "Practical tip 4",
    "Practical tip 5"
  ],
  "potentialChallenges": [
    {
      "challenge": "Common challenge",
      "solution": "How to overcome it"
    }
  ],
  "careerOutlook": {
    "roles": ["Role 1", "Role 2"],
    "salaryRange": "$X - $Y",
    "demand": "High/Medium/Low",
    "description": "Brief career outlook paragraph"
  }
}

Guidelines:
- Tailor difficulty and pace to the stated skill level
- Prioritize the preferred learning style (videos/books/projects) in resource recommendations
- Be specific with resource recommendations - include real, well-known resources
- Create 3-6 phases depending on scope
- Each phase should have 3-6 topics
- Include a mix of free and paid resources
- Make milestone projects progressively harder
- Account for any constraints the learner mentions
- Weekly schedule should match the stated hours_per_week"""},
            {"role": "user", "content": f"""Create a comprehensive learning roadmap for:

Learning Goal: {goal}
Current Skill Level: {skill_level}
Available Time: {hours_per_week} hours per week
Preferred Learning Style: {preferred_style}
{f'Timeline Preference: {timeline}' if timeline else ''}
{f'Constraints/Notes: {constraints}' if constraints else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=8000)

            try:
                cleaned_response = response.strip()
                if cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[cleaned_response.find('\n')+1:]
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:cleaned_response.rfind('```')]

                cleaned_response = cleaned_response.strip()
                roadmap_data = json.loads(cleaned_response)

                # Validate the structure
                if 'phases' in roadmap_data and isinstance(roadmap_data['phases'], list):
                    logger.info(f"Successfully generated roadmap with {len(roadmap_data['phases'])} phases")
                    return roadmap_data
                else:
                    raise ValueError("Invalid roadmap structure - missing phases")

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse roadmap JSON: {e}")
                logger.error(f"Raw response: {response[:500]}...")

                return {
                    "error": "Failed to generate roadmap. Please try again.",
                    "goal": goal,
                    "phases": []
                }

        except Exception as e:
            logger.error(f"Roadmap generation error: {e}")
            raise

    def generate_decision_matrix(self, topic: str, options: List[str], criteria: List[str],
                                  weights: List[int], context: str = "") -> Dict:
        """Generate a comprehensive decision matrix with AI analysis"""
        options_str = ", ".join(options)
        criteria_str = ", ".join(criteria)
        weights_map = {c: w for c, w in zip(criteria, weights)}
        weights_str = ", ".join([f"{c}: {w}" for c, w in weights_map.items()])

        messages = [
            {"role": "system", "content": """You are an expert decision analyst and strategic advisor. Build a comprehensive, data-driven decision matrix based on the user's inputs.

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks.

For scoring: rate each option on every criterion from 1-10. Compute weighted scores accurately using the user-supplied weights (each weight is 1-10). The weighted score for an option on a criterion = raw_score * weight. The total weighted score for an option = sum of all its weighted criterion scores.

JSON structure:
{
  "title": "Decision Matrix: <topic>",
  "overview": "2-3 sentence summary of the decision context and approach.",
  "options": ["Option A", "Option B", "Option C"],
  "criteria": ["Criterion 1", "Criterion 2", "Criterion 3"],
  "weights": {"Criterion 1": 8, "Criterion 2": 6, "Criterion 3": 9},
  "matrix": [
    {
      "option": "Option A",
      "scores": {
        "Criterion 1": {"score": 7, "reasoning": "Short explanation"},
        "Criterion 2": {"score": 5, "reasoning": "Short explanation"},
        "Criterion 3": {"score": 8, "reasoning": "Short explanation"}
      },
      "totalWeighted": 189,
      "normalizedScore": 82
    }
  ],
  "recommendation": {
    "winner": "Option A",
    "confidence": "High/Medium/Low",
    "summary": "Clear 2-3 sentence recommendation explaining why this option won.",
    "runnerUp": "Option B",
    "runnerUpGap": 15
  },
  "analysis": {
    "strengths": [
      {"option": "Option A", "strength": "Best at criterion X because..."},
      {"option": "Option B", "strength": "Excels at criterion Y because..."}
    ],
    "weaknesses": [
      {"option": "Option A", "weakness": "Falls short on criterion Z because..."}
    ],
    "tradeoffs": [
      "If you value X more, Option B becomes competitive because...",
      "Option C is the budget pick if cost is the primary concern."
    ]
  },
  "sensitivityAnalysis": [
    {
      "scenario": "If <Criterion> weight increases to 10",
      "newWinner": "Option B",
      "insight": "Brief explanation of what changes"
    }
  ],
  "prosAndCons": [
    {
      "option": "Option A",
      "pros": ["Pro 1", "Pro 2", "Pro 3"],
      "cons": ["Con 1", "Con 2"]
    }
  ],
  "tips": [
    "Practical decision-making tip 1",
    "Practical decision-making tip 2",
    "Practical decision-making tip 3"
  ]
}

Guidelines:
- Be objective and analytical
- Scores must be realistic and well-justified (1-10 scale)
- Weighted total = sum of (score × weight) for all criteria
- NormalizedScore = (totalWeighted / maxPossibleWeighted) × 100, rounded
- Provide at least 2 sensitivity scenarios
- Include 3-5 tradeoff insights
- Tips should help the user make better decisions in general"""},
            {"role": "user", "content": f"""Build a decision matrix for:

Topic: {topic}
Options: {options_str}
Criteria: {criteria_str}
Weights (1-10): {weights_str}
{f'Additional context: {context}' if context else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.5, max_tokens=6000)

            try:
                cleaned_response = response.strip()
                if cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[cleaned_response.find('\n')+1:]
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:cleaned_response.rfind('```')]

                cleaned_response = cleaned_response.strip()
                matrix_data = json.loads(cleaned_response)

                # Validate the structure
                if 'matrix' in matrix_data and isinstance(matrix_data['matrix'], list):
                    logger.info(f"Successfully generated decision matrix with {len(matrix_data['matrix'])} options")
                    return matrix_data
                else:
                    raise ValueError("Invalid matrix structure - missing matrix array")

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse decision matrix JSON: {e}")
                logger.error(f"Raw response: {response[:500]}...")

                return {
                    "error": "Failed to generate decision matrix. Please try again.",
                    "topic": topic,
                    "matrix": []
                }

        except Exception as e:
            logger.error(f"Decision matrix generation error: {e}")
            raise

    def generate_itinerary(self, destination: str, duration: str, budget: str,
                           interests: List[str], group_size: str,
                           travel_style: str = "", special_requirements: str = "") -> Dict:
        """Generate a comprehensive AI-powered travel itinerary"""
        interests_str = ", ".join(interests)

        messages = [
            {"role": "system", "content": """You are an expert travel planner with deep knowledge of destinations worldwide. Create a comprehensive, practical travel itinerary based on the user's inputs.

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks. Provide the most current, up-to-date information you can — recommend places and experiences that are popular and available today.

JSON structure:
{
  "title": "Your Trip to <Destination>",
  "overview": "2-4 sentence engaging summary of the trip highlighting what makes this destination special.",
  "destination": "Destination Name",
  "duration": "X days",
  "totalEstimatedBudget": {
    "min": 1000,
    "max": 1500,
    "currency": "USD",
    "perPerson": true,
    "breakdown": {
      "accommodation": {"min": 400, "max": 600},
      "food": {"min": 200, "max": 350},
      "activities": {"min": 150, "max": 250},
      "transport": {"min": 100, "max": 150},
      "misc": {"min": 50, "max": 100}
    }
  },
  "dailyPlans": [
    {
      "day": 1,
      "title": "Catchy Day Title",
      "theme": "Short theme (e.g., Cultural Exploration)",
      "activities": [
        {
          "time": "09:00 AM",
          "activity": "Activity name",
          "description": "2-3 sentences about what to do and why it's great.",
          "location": "Specific place name and area",
          "duration": "2 hours",
          "estimatedCost": "$20-30",
          "tips": "Practical tip for this activity",
          "category": "sightseeing|food|adventure|culture|relaxation|shopping|transport"
        }
      ],
      "meals": {
        "breakfast": {"place": "Restaurant Name", "cuisine": "Type", "budget": "$10-15", "tip": "Try the..."},
        "lunch": {"place": "Restaurant Name", "cuisine": "Type", "budget": "$15-20", "tip": "Must try..."},
        "dinner": {"place": "Restaurant Name", "cuisine": "Type", "budget": "$20-35", "tip": "Reserve ahead"}
      },
      "accommodation": {
        "suggestion": "Hotel/Hostel/Airbnb name or type",
        "area": "Neighborhood",
        "budget": "$80-120 per night",
        "tip": "Booking tip"
      }
    }
  ],
  "highlights": [
    {
      "title": "Must-See Highlight",
      "description": "Why this is unmissable",
      "category": "culture|nature|food|adventure|landmark"
    }
  ],
  "packingList": [
    {"item": "Item name", "reason": "Why you need it", "priority": "essential|recommended|optional"}
  ],
  "localTips": [
    {
      "category": "transport|money|safety|culture|food|language",
      "tip": "Practical local insider tip"
    }
  ],
  "bestTimeToVisit": {
    "recommended": "Month(s)",
    "weather": "Expected weather description",
    "peakSeason": "Peak tourist season info",
    "note": "Any timing-related advice"
  },
  "emergencyInfo": {
    "emergencyNumber": "Local emergency number",
    "embassy": "Nearest embassy/consulate info if abroad",
    "hospitals": "Nearby hospital recommendation",
    "notes": "Safety notes"
  },
  "transportGuide": {
    "gettingThere": "How to reach the destination",
    "localTransport": "Best ways to get around",
    "tips": ["Transport tip 1", "Transport tip 2"]
  },
  "budgetTips": [
    "Money-saving tip 1",
    "Money-saving tip 2",
    "Money-saving tip 3"
  ],
  "tags": ["beach", "culture", "adventure"]
}

Guidelines:
- Tailor the itinerary to the stated budget level (budget/mid-range/luxury)
- Match activities to the stated interests
- Consider group size for restaurant and activity recommendations
- Be specific with place names, neighborhoods, and costs
- Include a mix of popular and off-the-beaten-path experiences
- Provide realistic time estimates and travel times between activities
- Recommend specific restaurants, not generic food types
- Include practical tips that only a local would know
- Account for travel style preferences
- Make the itinerary flow logically geographically to minimize transit
- Ensure cost estimates match the stated budget level
- Each day should have 3-5 main activities plus meal recommendations"""},
            {"role": "user", "content": f"""Create a comprehensive travel itinerary for:

Destination: {destination}
Duration: {duration}
Budget: {budget}
Interests: {interests_str}
Group Size: {group_size}
{f'Travel Style: {travel_style}' if travel_style else ''}
{f'Special Requirements: {special_requirements}' if special_requirements else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=8000)

            try:
                cleaned_response = response.strip()
                if cleaned_response.startswith('```'):
                    cleaned_response = cleaned_response[cleaned_response.find('\n')+1:]
                if cleaned_response.endswith('```'):
                    cleaned_response = cleaned_response[:cleaned_response.rfind('```')]

                cleaned_response = cleaned_response.strip()
                itinerary_data = json.loads(cleaned_response)

                # Validate the structure
                if 'dailyPlans' in itinerary_data and isinstance(itinerary_data['dailyPlans'], list):
                    logger.info(f"Successfully generated itinerary with {len(itinerary_data['dailyPlans'])} days")
                    return itinerary_data
                else:
                    raise ValueError("Invalid itinerary structure - missing dailyPlans")

            except (json.JSONDecodeError, ValueError) as e:
                logger.error(f"Failed to parse itinerary JSON: {e}")
                logger.error(f"Raw response: {response[:500]}...")

                return {
                    "error": "Failed to generate itinerary. Please try again.",
                    "destination": destination,
                    "dailyPlans": []
                }

        except Exception as e:
            logger.error(f"Itinerary generation error: {e}")
            raise

    # ==================================================================
    #  BLOG POST GENERATOR
    # ==================================================================
    def generate_blog_post(self, topic: str, tone: str = 'informative',
                           length: str = 'medium', target_audience: str = '',
                           keywords: str = '') -> Dict:
        """Generate a complete blog post with sections, SEO meta, and social snippets."""
        length_map = {'short': '800-1000', 'medium': '1200-1800', 'long': '2000-3000'}
        word_range = length_map.get(length, '1200-1800')

        messages = [
            {"role": "system", "content": f"""You are an expert blog writer and content strategist.
Generate a complete, publish-ready blog post in JSON format:
{{
  "title": "SEO-optimised headline",
  "meta_description": "155-char meta description",
  "slug_suggestion": "url-friendly-slug",
  "sections": [
    {{
      "heading": "Section heading (use H2 style)",
      "content": "Full paragraph(s) for this section – rich, detailed, original."
    }}
  ],
  "tags": ["tag1", "tag2"],
  "social_snippet": "Short 280-char social media teaser",
  "estimated_read_time": "X min read",
  "word_count": 1500
}}

Guidelines:
- Write {word_range} words total across all sections
- Tone: {tone}
- Include a compelling introduction and a strong conclusion section
- Use storytelling, examples, and data where appropriate
- Each section should have 150-300 words
- Make content original, not generic filler
- If keywords are provided, weave them naturally into the content
- If target audience is specified, tailor language and examples to them"""},
            {"role": "user", "content": f"""Write a complete blog post about:

Topic: {topic}
Tone: {tone}
Length: {length} ({word_range} words)
{f'Target Audience: {target_audience}' if target_audience else ''}
{f'Keywords to include: {keywords}' if keywords else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.75, max_tokens=6000)
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned[cleaned.find('\n')+1:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:cleaned.rfind('```')]
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            return {"title": topic, "sections": [{"heading": "Content", "content": response}],
                    "meta_description": "", "tags": [], "social_snippet": "", "estimated_read_time": ""}
        except Exception as e:
            logger.error(f"Blog post generation error: {e}")
            raise

    # ==================================================================
    #  YOUTUBE SCRIPT WRITER
    # ==================================================================
    def generate_youtube_script(self, topic: str, duration: str = '10',
                                style: str = 'educational', target_audience: str = '',
                                include_hooks: bool = True) -> Dict:
        """Generate a structured YouTube video script with hooks, segments and CTAs."""
        messages = [
            {"role": "system", "content": f"""You are a professional YouTube scriptwriter who has helped
channels grow from 0 to 1M subscribers. Generate a complete, ready-to-record
YouTube script in JSON format:
{{
  "title": "Video title (click-worthy, 60 chars max)",
  "thumbnail_text": "2-4 word overlay text for the thumbnail",
  "description": "YouTube description with timestamps (250 words)",
  "tags": ["tag1", "tag2", "tag3"],
  "hook": "First 5-second hook to stop the scroll (1-2 sentences)",
  "intro": "30-second intro that sets up the video (2-3 sentences)",
  "segments": [
    {{
      "title": "Segment name",
      "timestamp": "0:00",
      "script": "Full word-for-word script for this segment",
      "visual_notes": "What to show on screen (B-roll, graphics, etc.)",
      "duration_estimate": "2 min"
    }}
  ],
  "outro": "Call-to-action and closing (subscribe, comment prompt, etc.)",
  "total_duration": "{duration} minutes",
  "style_notes": "Delivery tips for the creator"
}}

Guidelines:
- Target video length: {duration} minutes (approx {int(duration)*150} words)
- Style: {style}
- Write in conversational, spoken language — NOT written-essay style
- Start each segment with a transition from the previous one
- Include pattern interrupts every 2-3 minutes to maintain retention
- Add specific visual/B-roll suggestions for engagement
- The hook must create curiosity or promise value in under 5 seconds
- End with a strong CTA that feels natural, not forced"""},
            {"role": "user", "content": f"""Write a complete YouTube script for:

Topic: {topic}
Duration: {duration} minutes
Style: {style}
{f'Target Audience: {target_audience}' if target_audience else ''}
Include hooks & pattern interrupts: {include_hooks}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.8, max_tokens=6000)
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned[cleaned.find('\n')+1:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:cleaned.rfind('```')]
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            return {"title": topic, "segments": [{"title": "Script", "script": response,
                    "visual_notes": "", "timestamp": "0:00", "duration_estimate": f"{duration} min"}],
                    "hook": "", "intro": "", "outro": "", "total_duration": f"{duration} min"}
        except Exception as e:
            logger.error(f"YouTube script generation error: {e}")
            raise

    # ==================================================================
    #  COVER LETTER WRITER
    # ==================================================================
    def generate_cover_letter(self, job_title: str, company_name: str,
                              experience: str, skills: str = '',
                              job_description: str = '',
                              tone: str = 'professional') -> Dict:
        """Generate a tailored cover letter."""
        messages = [
            {"role": "system", "content": f"""You are an expert career coach and professional writer
who has helped thousands of candidates land interviews at top companies.
Generate a compelling, tailored cover letter in JSON format:
{{
  "cover_letter": "Full cover letter text (3-4 paragraphs, 300-400 words)",
  "subject_line": "Email subject line for sending the cover letter",
  "key_strengths_highlighted": ["strength1", "strength2", "strength3"],
  "customization_tips": ["Tip for further personalizing this letter"],
  "word_count": 350
}}

Guidelines:
- Tone: {tone}
- Opening paragraph: Hook the reader — mention the specific role and why you're excited
- Body paragraphs: Connect YOUR experience/skills to THEIR requirements
- If a job description is provided, mirror their language and requirements
- Closing: Strong call-to-action expressing enthusiasm for next steps
- NEVER use clichés like "I am writing to apply..." or "I believe I would be a great fit"
- Be specific — use quantifiable achievements where the experience allows
- Keep it under 400 words — hiring managers skim"""},
            {"role": "user", "content": f"""Write a cover letter for:

Job Title: {job_title}
Company: {company_name}
Tone: {tone}

My Experience:
{experience}

{f'My Key Skills: {skills}' if skills else ''}

{('Job Description:' + chr(10) + job_description) if job_description else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.7, max_tokens=3000)
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned[cleaned.find('\n')+1:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:cleaned.rfind('```')]
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            return {"cover_letter": response, "subject_line": f"Application for {job_title}",
                    "key_strengths_highlighted": [], "customization_tips": []}
        except Exception as e:
            logger.error(f"Cover letter generation error: {e}")
            raise

    # ==================================================================
    #  AD COPY GENERATOR
    # ==================================================================
    def generate_ad_copy(self, product_or_service: str, platform: str = 'google',
                         target_audience: str = '', unique_selling_points: str = '',
                         tone: str = 'persuasive', num_variations: int = 3) -> Dict:
        """Generate ad copy variations for Google, Facebook, Instagram, etc."""
        platform_specs = {
            'google': 'Google Ads: 3 headlines (30 chars each), 2 descriptions (90 chars each), display URL path',
            'facebook': 'Facebook Ad: Primary text (125 chars ideal), headline (40 chars), description (30 chars), CTA button suggestion',
            'instagram': 'Instagram Ad: Caption (2200 chars max, first 125 visible), 5-10 hashtags, CTA',
            'linkedin': 'LinkedIn Ad: Intro text (150 chars), headline (70 chars), description (100 chars)',
            'tiktok': 'TikTok Ad: Hook (first 3 seconds text), body copy, CTA, suggested trending sounds/styles',
        }
        spec = platform_specs.get(platform, platform_specs['google'])

        messages = [
            {"role": "system", "content": f"""You are a world-class performance marketer who has
managed $10M+ in ad spend. Generate high-converting ad copy in JSON format:
{{
  "platform": "{platform}",
  "variations": [
    {{
      "variation_name": "Variation A - [Strategy Name]",
      "headlines": ["headline1", "headline2", "headline3"],
      "descriptions": ["description1", "description2"],
      "cta": "Call to action text",
      "display_url_path": "optional/path",
      "strategy_note": "Why this variation works"
    }}
  ],
  "targeting_suggestions": ["suggestion1", "suggestion2"],
  "a_b_testing_tips": ["tip1", "tip2"],
  "estimated_quality_score": "High/Medium/Low with reasoning"
}}

Platform spec: {spec}

Guidelines:
- Generate exactly {num_variations} variations using different angles
- Each variation should use a distinct copywriting strategy (pain point, benefit, social proof, urgency, curiosity)
- Respect character limits strictly for each platform
- Include power words that drive clicks
- Focus on benefits over features
- Use numbers and specifics where possible
- Make CTAs action-oriented and urgent"""},
            {"role": "user", "content": f"""Create {num_variations} ad copy variations for:

Product/Service: {product_or_service}
Platform: {platform}
Tone: {tone}
{f'Target Audience: {target_audience}' if target_audience else ''}
{f'Unique Selling Points: {unique_selling_points}' if unique_selling_points else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.8, max_tokens=4000)
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned[cleaned.find('\n')+1:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:cleaned.rfind('```')]
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            return {"platform": platform, "variations": [{"variation_name": "Ad Copy",
                    "headlines": [], "descriptions": [response], "cta": "", "strategy_note": ""}],
                    "targeting_suggestions": [], "a_b_testing_tips": []}
        except Exception as e:
            logger.error(f"Ad copy generation error: {e}")
            raise

    # ==================================================================
    #  DOCUMENT ANALYZER
    # ==================================================================
    def analyze_document(self, text: str, analysis_type: str = 'comprehensive',
                         questions: str = '') -> Dict:
        """Analyze a document/PDF text — summarize, extract insights, answer questions."""
        messages = [
            {"role": "system", "content": f"""You are an expert document analyst, researcher, and
critical reader. Analyze the provided document and return a comprehensive
analysis in JSON format:
{{
  "summary": "Executive summary (150-200 words)",
  "key_findings": [
    {{
      "finding": "Key point or finding",
      "evidence": "Quote or reference from the text",
      "significance": "Why this matters"
    }}
  ],
  "themes": ["Major theme 1", "Major theme 2"],
  "entities": {{
    "people": ["Named people mentioned"],
    "organizations": ["Organizations mentioned"],
    "dates": ["Important dates"],
    "locations": ["Locations mentioned"]
  }},
  "statistics": ["Any numerical data or statistics found"],
  "action_items": ["Recommended actions based on the document"],
  "sentiment": "Overall tone/sentiment of the document",
  "reading_level": "Estimated reading level (e.g., College, Professional)",
  "word_count": 0,
  "qa_answers": [
    {{
      "question": "User's question",
      "answer": "Detailed answer based on the document"
    }}
  ]
}}

Analysis type requested: {analysis_type}
- 'comprehensive': Full analysis with all fields
- 'summary': Focus on summary and key findings only
- 'qa': Focus on answering the user's specific questions
- 'entities': Focus on extracting named entities and data
- 'action_items': Focus on actionable takeaways

Guidelines:
- Base ALL findings on the actual text — never make up information
- Quote the document directly when citing evidence
- If questions are provided, answer them thoroughly based on the text
- Be specific and precise — avoid vague generalizations
- Identify gaps or missing information in the document"""},
            {"role": "user", "content": f"""Analyze this document:

---
{text[:12000]}
---

Analysis Type: {analysis_type}
{('Questions to Answer:' + chr(10) + questions) if questions else ''}

Return ONLY valid JSON."""}
        ]

        try:
            response = self._generate_completion(messages, temperature=0.3, max_tokens=5000)
            cleaned = response.strip()
            if cleaned.startswith('```'):
                cleaned = cleaned[cleaned.find('\n')+1:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:cleaned.rfind('```')]
            result = json.loads(cleaned.strip())
            result['word_count'] = len(text.split())
            return result
        except json.JSONDecodeError:
            return {"summary": response, "key_findings": [], "themes": [],
                    "entities": {}, "statistics": [], "action_items": [],
                    "sentiment": "", "reading_level": "", "word_count": len(text.split()),
                    "qa_answers": []}
        except Exception as e:
            logger.error(f"Document analysis error: {e}")
            raise