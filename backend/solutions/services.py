import logging
import json
from typing import Tuple, Optional

logger = logging.getLogger(__name__)


def analyze_request(requirements: str, business_type: str, tools_used: str,
                    service_type: str, budget: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Use Groq via AIService to produce an AI summary and suggested solution
    for a service request. Returns (ai_summary, ai_suggested_solution).
    """
    from tools.ai_service import AIService

    try:
        ai = AIService()
    except Exception as e:
        logger.error(f"Could not initialize AIService: {e}")
        return None, None

    service_labels = {
        'automation': 'AI Automation Setup',
        'agents': 'Custom AI Agents',
        'optimization': 'Workflow Optimization',
    }

    prompt = (
        "You are an AI solutions architect at Sovereign, an AI tools and agent platform. "
        "A client has submitted a service request. Analyze it and provide:\n\n"
        "1. **Summary**: A concise 2-3 sentence summary of the client's core problem and needs.\n"
        "2. **Suggested Solution**: A concrete, actionable recommendation (4-8 bullet points) "
        "describing what automation, agents, or workflow optimizations you would build for them. "
        "Reference specific AI capabilities (LLM agents, workflow automation, API integrations, "
        "data pipelines, etc.) where relevant.\n\n"
        f"Service Requested: {service_labels.get(service_type, service_type)}\n"
        f"Business Type: {business_type}\n"
        f"Budget Range: {budget}\n"
        f"Current Tools: {tools_used or 'Not specified'}\n\n"
        f"Client Requirements:\n{requirements}\n\n"
        "Respond in this exact JSON format:\n"
        '{"summary": "...", "suggested_solution": "..."}'
    )

    messages = [
        {"role": "system", "content": "You are a senior AI solutions architect. Respond only with valid JSON."},
        {"role": "user", "content": prompt},
    ]

    try:
        raw = ai._generate_completion(
            messages=messages,
            temperature=0.4,
            max_tokens=1000,
            use_cache=False,
        )

        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        parsed = json.loads(cleaned)
        return parsed.get("summary"), parsed.get("suggested_solution")
    except json.JSONDecodeError:
        logger.warning("AI response was not valid JSON, using raw text")
        return raw[:500] if raw else None, None
    except Exception as e:
        logger.error(f"AI analysis failed: {e}", exc_info=True)
        return None, None
