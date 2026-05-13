import os
import logging
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("rag")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("huggingface_hub").setLevel(logging.WARNING)

BASE_DIR            = Path(__file__).parent.parent
DATA_DIR            = BASE_DIR / "Data"
EMBEDDING_MODEL     = "paraphrase-multilingual-MiniLM-L12-v2"
RERANKER_MODEL      = "cross-encoder/ms-marco-MiniLM-L-6-v2"
CHUNK_SIZE          = 800       # Larger chunks for IT support docs
CHUNK_OVERLAP       = 200
TOP_K_RETRIEVAL     = 10        # Candidates from hybrid retrieval
TOP_N_RERANK        = 5         # Top docs after reranking
RELEVANCE_THRESHOLD = 0.01      # Lowered because MS-MARCO is very strict (trained on Bing exact-answer data)
BOOST_MULTIPLIER    = 1.3       # Feedback boost for thumbs-up documents
BOOST_CAP           = 3.0       # Max boost any document can accumulate
HISTORY_SIZE        = 5         # Last N conversation turns to keep
NO_INFO_RESPONSE_EN = (
    "Sorry, I don't have this information right now. "
    "For further assistance, please contact support@neoverse.io."
)
NO_INFO_RESPONSE_UR = (
    "معاف کیجیے، میرے پاس اس وقت یہ معلومات موجود نہیں ہیں۔ "
    "مزید مدد کے لیے براہ کرم support@neoverse.io سے رابطہ کریں۔"
)
NO_INFO_RESPONSE_UR_ROMAN = (
    "Maaf kijiye, mere paas is waqt yeh maloomat maujood nahi hain. "
    "Mazeed madad ke liye barah-e-karam support@neoverse.io se rabta karein."
)
NO_INFO_RESPONSES = {
    NO_INFO_RESPONSE_EN,
    NO_INFO_RESPONSE_UR,
    NO_INFO_RESPONSE_UR_ROMAN,
}
