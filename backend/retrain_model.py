"""
=============================================================
RETRAIN INTENT MODEL — Self-Learning
=============================================================
Usage:   python retrain_model.py
Purpose: training_data.json se naya data le kar DistilBERT 
         intent model ko retrain karo.

Steps:
  1. training_data.json load karo
  2. thumbs up = sahi data, thumbs down = skip (ya correct_intent use karo)
  3. DistilBERT fine-tune karo
  4. Purana model backup karo
  5. Naya model intent_model_v1/ mein save karo
=============================================================
"""

import json
import shutil
from pathlib import Path
from datetime import datetime

from datasets import Dataset
from transformers import (
    DistilBertTokenizerFast,
    DistilBertForSequenceClassification,
    TrainingArguments,
    Trainer,
)

# ─── Config ───────────────────────────────────────────────
MODEL_PATH = Path("./intent_model_v1")
TRAINING_DATA_FILE = Path("training_data.json")
BACKUP_DIR = Path("./intent_model_backups")
INTENT_LABELS = ["FAQ", "IT_Issue", "Complaint", "Small_Talk"]
LABEL2ID = {label: i for i, label in enumerate(INTENT_LABELS)}

MIN_EXAMPLES = 20  # Minimum examples required to retrain


def load_training_data():
    """Load and filter training data from JSON."""
    if not TRAINING_DATA_FILE.exists():
        print("ERROR: training_data.json not found! Use the chatbot first to collect data.")
        return []

    with open(TRAINING_DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Total entries in training_data.json: {len(data)}")

    # Filter: use thumbs up data + thumbs down with correct_intent
    training_examples = []
    for entry in data:
        query = entry.get("query", "").strip()
        if not query:
            continue

        if entry.get("feedback") == "up":
            # Thumbs up = predicted intent was correct
            intent = entry.get("intent", "")
            if intent in INTENT_LABELS:
                training_examples.append({"text": query, "label": LABEL2ID[intent]})

        elif entry.get("feedback") == "down" and "correct_intent" in entry:
            # Thumbs down + manually corrected
            intent = entry["correct_intent"]
            if intent in INTENT_LABELS:
                training_examples.append({"text": query, "label": LABEL2ID[intent]})

    print(f"Usable training examples: {len(training_examples)}")
    return training_examples


def backup_model():
    """Backup current model before overwriting."""
    if not MODEL_PATH.exists():
        print("WARNING: No existing model to backup.")
        return

    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"intent_model_backup_{timestamp}"
    shutil.copytree(MODEL_PATH, backup_path)
    print(f"Model backup saved: {backup_path}")


def retrain():
    """Retrain the DistilBERT intent classifier."""
    # Step 1: Load data
    examples = load_training_data()

    if len(examples) < MIN_EXAMPLES:
        print(f"\nNot enough data! Need at least {MIN_EXAMPLES} examples, got {len(examples)}.")
        print("Keep using the chatbot and giving feedback to collect more data.")
        return

    # Step 2: Backup old model
    print("\nBacking up current model...")
    backup_model()

    # Step 3: Load model and tokenizer
    print("\nLoading model and tokenizer...")
    tokenizer = DistilBertTokenizerFast.from_pretrained(str(MODEL_PATH))
    model = DistilBertForSequenceClassification.from_pretrained(
        str(MODEL_PATH),
        num_labels=len(INTENT_LABELS),
    )

    # Step 4: Prepare dataset
    dataset = Dataset.from_list(examples)

    def tokenize(batch):
        return tokenizer(batch["text"], padding="max_length", truncation=True, max_length=128)

    dataset = dataset.map(tokenize, batched=True)
    dataset = dataset.train_test_split(test_size=0.2, seed=42)

    print(f"Train: {len(dataset['train'])} | Test: {len(dataset['test'])}")

    # Step 5: Train
    training_args = TrainingArguments(
        output_dir="./retrain_output",
        num_train_epochs=5,
        per_device_train_batch_size=8,
        per_device_eval_batch_size=8,
        learning_rate=2e-5,
        weight_decay=0.01,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        logging_steps=10,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset["train"],
        eval_dataset=dataset["test"],
        tokenizer=tokenizer,
    )

    print("\nTraining started...")
    trainer.train()

    # Step 6: Save retrained model
    print(f"\nSaving retrained model to {MODEL_PATH}...")
    model.save_pretrained(str(MODEL_PATH))
    tokenizer.save_pretrained(str(MODEL_PATH))

    # Cleanup temp output
    shutil.rmtree("./retrain_output", ignore_errors=True)

    print("\n" + "=" * 50)
    print("DONE! Model retrained successfully.")
    print(f"Backup: {BACKUP_DIR}/")
    print(f"Model:  {MODEL_PATH}/")
    print("Restart your chatbot to use the new model.")
    print("=" * 50)


if __name__ == "__main__":
    print("=" * 50)
    print("NEOVERSE — INTENT MODEL RETRAINER")
    print("=" * 50)
    retrain()
