import re
from transformers import pipeline
from rag.config import logger, BASE_DIR

class QueryPreprocessor:
    """Normalizes user query: lowercase + collapse whitespace."""

    def __init__(self):
        pass  # No heavy model needed — LLM rewrite handles typos and translation.

    def sanitize(self, text: str) -> str:
        """
        Sanitize input to prevent prompt injection.
        - Truncate to 500 chars.
        - Strip common injection keywords and tags.
        """
        # 1. Truncate
        text = text[:500]
        
        # 2. Strip tags (XML/HTML) often used in jailbreaks
        text = re.sub(r'<[^>]+>', '', text)
        
        # 3. Neutralize common injection phrases
        _INJECTION_PATS = re.compile(
            r"(ignore (all )?(previous |prior )?instructions?|system:|\/imagine|you are now)",
            re.IGNORECASE,
        )
        text = _INJECTION_PATS.sub("[cleaned]", text)
        
        return text

    def normalize(self, text: str) -> str:
        """Convert to lowercase and remove extra spaces."""
        text = text.strip().lower()
        text = re.sub(r'\s+', ' ', text)
        return text

    def process(self, query: str) -> str:
        """Sanitize and normalize query."""
        logger.info("=== STEP 1: Query Preprocessing ===")
        query = self.sanitize(query)
        query = self.normalize(query)
        logger.info(f"Processed query: {query}")
        return query


class IntentClassifier:
    def __init__(self):
        try:
            MODEL_PATH = str(BASE_DIR / "intent_model_v1")

            self.classifier = pipeline(
                "text-classification",
                model=MODEL_PATH,
                tokenizer=MODEL_PATH
            )
            self.model_loaded = True
            logger.info("Custom Intent model loaded.")
        except Exception as e:
            logger.warning(f"Model load failed: {e}")
            self.model_loaded = False

    # Minimum confidence to trust the model prediction
    CONFIDENCE_THRESHOLD = 0.6

    def classify(self, query: str) -> str:
        logger.info("=== STEP 2: Intent Classification ===")

        q = query.lower()

        # Try model first, but only trust high-confidence predictions
        if self.model_loaded:
            result = self.classifier(query)[0]
            logger.info(f"Model prediction: {result['label']} ({result['score']:.3f})")
            if result["score"] >= self.CONFIDENCE_THRESHOLD:
                intent = result["label"]
                logger.info(f"Intent: {intent} (model, high confidence)")
                return intent

        # Keyword-based fallback
        words = set(q.split())
        greeting_words = {"hello", "hi", "hey", "bye", "thanks"}
        greeting_phrases = ["thank you", "good morning", "good night", "how are you",
                            "what's up", "see you", "take care", "good evening"]
        is_greeting = (words & greeting_words) or any(p in q for p in greeting_phrases)
        if is_greeting and len(words) <= 6:
            intent = "Small_Talk"
        elif any(w in q for w in ["complain", "complaint", "angry", "worst",
                                   "terrible", "unacceptable", "frustrated", "disappointed"]):
            intent = "Complaint"
        else:
            intent = "FAQ"

        logger.info(f"Intent: {intent} (keyword fallback)")
        return intent
