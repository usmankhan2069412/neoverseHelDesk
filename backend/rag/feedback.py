from typing import Dict, List
from rag.config import logger, BOOST_MULTIPLIER, BOOST_CAP
from services import supabase_client as db

class FeedbackSystem:
    """
    Manages user feedback.
    Delegates all storage to Supabase for scalability and thread-safety.
    """

    def __init__(self):
        pass  # No local state needed

    def thumbs_up(self, sources: List[str]):
        """Thumbs up — increase boost score in Supabase database."""
        logger.info("Feedback: Thumbs Up")
        for source in sources:
            try:
                db.increment_document_boost(source, BOOST_MULTIPLIER, BOOST_CAP)
                logger.info(f"Boosted document in DB: {source}")
            except Exception as e:
                logger.error(f"Failed to boost document {source}: {e}")

    def thumbs_down(self, query: str, answer: str, sources: List[str]):
        """Thumbs down — flag for review (managed via knowledge gaps / message UI instead of JSON file)."""
        logger.info("Feedback: 👎 Thumbs Down — flagged for review in database")
        # In a fully scaled system, we would log this to a human-review table.
        # Currently, the front-end handles thumbs_down directly by inserting into the feedback table 
        # and creating knowledge gaps. So we don't strictly need to do anything here anymore.

    def get_boost_scores(self) -> Dict[str, float]:
        """Return current boost scores from Supabase."""
        try:
            return db.get_document_boosts()
        except Exception as e:
            logger.error(f"Failed to fetch boost scores: {e}")
            return {}

