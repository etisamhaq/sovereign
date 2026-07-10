import json
import logging
import math
import re
from collections import Counter
from typing import Any, Dict, List, Optional

from django.conf import settings

from agents.models import AgentMemory

logger = logging.getLogger(__name__)

TOKEN_RE = re.compile(r"[a-z0-9_]{2,}", re.IGNORECASE)

_embedding_cache: Dict[str, List[float]] = {}


def _textify_payload(payload: Any) -> str:
    if payload is None:
        return ''
    if isinstance(payload, str):
        return payload
    if isinstance(payload, (int, float, bool)):
        return str(payload)
    try:
        return json.dumps(payload, ensure_ascii=False)
    except Exception:
        return str(payload)


def _tokenize(text: str) -> List[str]:
    return [t.lower() for t in TOKEN_RE.findall(text or '')]


def _hash_vector(tokens: List[str], dimensions: int) -> List[float]:
    if dimensions <= 0:
        dimensions = 128
    vec = [0.0] * dimensions
    counts = Counter(tokens)
    for token, count in counts.items():
        slot = hash(token) % dimensions
        vec[slot] += float(count)
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [x / norm for x in vec]


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    return sum(a[i] * b[i] for i in range(n))


def _memory_text(memory: AgentMemory) -> str:
    return f"{memory.memory_type} {memory.key} {_textify_payload(memory.value_json)}"


def _get_embedding(text: str) -> Optional[List[float]]:
    """Get embedding vector using Groq or compatible API. Returns None on failure."""
    if not text.strip():
        return None

    cache_key = text[:200]
    if cache_key in _embedding_cache:
        return _embedding_cache[cache_key]

    try:
        from groq import Groq
        api_key = getattr(settings, 'GROQ_API_KEY', '')
        if not api_key or api_key == 'your_groq_api_key_here':
            return None

        client = Groq(api_key=api_key)
        response = client.embeddings.create(
            model=getattr(settings, 'AGENT_EMBEDDING_MODEL', 'nomic-embed-text-v1_5'),
            input=[text[:8000],],
        )
        vector = response.data[0].embedding
        _embedding_cache[cache_key] = vector
        return vector
    except Exception as e:
        logger.debug(f"Embedding API unavailable, falling back to hash vectors: {e}")
        return None


def _get_embedding_batch(texts: List[str]) -> List[Optional[List[float]]]:
    """Batch embedding call. Returns list aligned with input; None for failures."""
    if not texts:
        return []

    try:
        from groq import Groq
        api_key = getattr(settings, 'GROQ_API_KEY', '')
        if not api_key or api_key == 'your_groq_api_key_here':
            return [None] * len(texts)

        client = Groq(api_key=api_key)
        truncated = [t[:8000] for t in texts]
        response = client.embeddings.create(
            model=getattr(settings, 'AGENT_EMBEDDING_MODEL', 'nomic-embed-text-v1_5'),
            input=truncated,
        )
        results: List[Optional[List[float]]] = [None] * len(texts)
        for item in response.data:
            results[item.index] = item.embedding
        return results
    except Exception as e:
        logger.debug(f"Batch embedding failed, falling back: {e}")
        return [None] * len(texts)


def retrieve_ranked_memories(
    *,
    user_id,
    input_payload: Dict[str, Any],
    limit: int = 8,
    include_workspace_memory: bool = False,
    workspace_id=None,
    semantic_weight: float = 0.8,
    lexical_weight: float = 0.2,
) -> List[Dict[str, Any]]:
    limit = max(1, min(int(limit or 8), 50))
    dimensions = int(getattr(settings, 'AGENT_MEMORY_VECTOR_DIMENSIONS', 128))

    user_memories = AgentMemory.objects.filter(
        created_by_id=user_id,
        is_active=True,
        owner_type='user',
        owner_id=user_id,
    )
    workspace_memories = AgentMemory.objects.none()
    if include_workspace_memory and workspace_id:
        workspace_memories = AgentMemory.objects.filter(
            is_active=True,
            owner_type='workspace',
            owner_id=workspace_id,
        )

    candidate_memories = list((user_memories | workspace_memories).order_by('-updated_at')[:300])
    if not candidate_memories:
        return []

    query_text = ' '.join([
        _textify_payload(input_payload.get('prompt')),
        _textify_payload(input_payload.get('context')),
        _textify_payload(input_payload.get('query')),
        _textify_payload(input_payload.get('url')),
        _textify_payload(input_payload),
    ]).strip()

    query_tokens = _tokenize(query_text)
    if not query_tokens:
        ranked = candidate_memories[:limit]
        return [
            {
                'memory_type': m.memory_type,
                'key': m.key,
                'value_json': m.value_json,
                'score': 0.0,
            }
            for m in ranked
        ]

    memory_texts = [_memory_text(m) for m in candidate_memories]

    query_embedding = _get_embedding(query_text)
    use_real_embeddings = query_embedding is not None

    if use_real_embeddings:
        memory_embeddings = _get_embedding_batch(memory_texts)
    else:
        memory_embeddings = [None] * len(candidate_memories)

    query_vec_hash = _hash_vector(query_tokens, dimensions)
    query_set = set(query_tokens)

    scored = []
    for i, memory in enumerate(candidate_memories):
        tokens = _tokenize(memory_texts[i])
        overlap = len(query_set.intersection(tokens)) / max(len(query_set), 1)

        if use_real_embeddings and memory_embeddings[i] is not None:
            cosine = _cosine_similarity(query_embedding, memory_embeddings[i])
        else:
            vec = _hash_vector(tokens, dimensions)
            cosine = _cosine_similarity(query_vec_hash, vec)

        sem = max(0.0, float(semantic_weight))
        lex = max(0.0, float(lexical_weight))
        denom = sem + lex
        if denom <= 0:
            sem, lex, denom = 0.8, 0.2, 1.0
        score = ((sem * cosine) + (lex * overlap)) / denom
        scored.append((score, memory))

    scored.sort(key=lambda row: row[0], reverse=True)
    top = scored[:limit]

    return [
        {
            'memory_type': memory.memory_type,
            'key': memory.key,
            'value_json': memory.value_json,
            'score': round(float(score), 6),
        }
        for score, memory in top
    ]
