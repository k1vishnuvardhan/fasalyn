"""Fasalyn inference boundary.

This service never returns a diagnosis unless a configured, loadable model has
actually produced it. The supported artifact is a Hugging Face image-classifier
with an explicit label map. Object detection can be added as a separate adapter.
"""
from __future__ import annotations
import io, os
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from PIL import Image, ImageStat, UnidentifiedImageError
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))

MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MIN_EDGE = int(os.getenv("MIN_IMAGE_EDGE", "96"))
MIN_CONFIDENCE = float(os.getenv("MIN_MODEL_CONFIDENCE", "0.60"))
MODEL_ID = os.getenv("DISEASE_MODEL_ID", "")
MODEL_REVISION = os.getenv("DISEASE_MODEL_REVISION")
AI_PROVIDER = os.getenv("AI_PROVIDER", "model").lower()
DEVICE = "cpu"
app = FastAPI(title="Fasalyn model service", version="1.0.0")

class Prediction(BaseModel):
    label: str | None
    confidence: float
    severity: Literal["unknown", "low", "moderate", "high"]
    status: Literal["DETECTED", "LOW_CONFIDENCE"]

class ModelAdapter:
    def __init__(self): self.model = self.processor = None; self.error: str | None = None
    def load(self):
        if not MODEL_ID:
            self.error = "DISEASE_MODEL_ID is not configured"
            return
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForImageClassification
            global DEVICE
            DEVICE = "cuda" if os.getenv("FORCE_CPU") != "1" and torch.cuda.is_available() else "cpu"
            self.processor = AutoImageProcessor.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
            self.model = AutoModelForImageClassification.from_pretrained(MODEL_ID, revision=MODEL_REVISION).to(DEVICE).eval()
        except Exception as exc: self.error = str(exc)
    @property
    def ready(self): return self.model is not None and self.processor is not None
    def infer(self, image: Image.Image) -> tuple[str, float]:
        import torch
        inputs = self.processor(images=image, return_tensors="pt").to(DEVICE)
        with torch.inference_mode(): probabilities = self.model(**inputs).logits.softmax(dim=-1)[0]
        index = int(probabilities.argmax().item())
        return str(self.model.config.id2label[index]), float(probabilities[index].item())

model = ModelAdapter()
@app.on_event("startup")
def startup(): model.load()

def image_quality(image: Image.Image) -> list[str]:
    flags: list[str] = []
    if min(image.size) < MIN_EDGE: flags.append(f"image is smaller than {MIN_EDGE}px on one edge")
    gray = image.convert("L")
    brightness = ImageStat.Stat(gray).mean[0]
    if brightness < 20: flags.append("image is too dark")
    if brightness > 245: flags.append("image is too bright")
    return flags

def severity(label: str, confidence: float) -> Literal["unknown", "low", "moderate", "high"]:
    # Severity is not inferred from a class label alone. It remains unknown until a
    # validated severity model or an officer assessment is configured.
    return "unknown"

@app.get("/health")
def health(): return {"ready": model.ready or AI_PROVIDER == "demo", "provider": AI_PROVIDER, "modelId": MODEL_ID or None, "device": DEVICE, "error": model.error}

@app.post("/infer")
async def infer(request: Request):
    content_type = request.headers.get("content-type", "").split(";", 1)[0]
    if content_type not in {"image/jpeg", "image/png", "image/webp"}: raise HTTPException(415, "Only JPEG, PNG, and WebP images are supported.")
    raw = await request.body()
    if not raw or len(raw) > MAX_IMAGE_BYTES: raise HTTPException(413, "Image is empty or exceeds the upload size limit.")
    try:
        image = Image.open(io.BytesIO(raw)); image.verify()
        image = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError): raise HTTPException(400, "Uploaded content is not a valid image.")
    flags = image_quality(image)
    if flags: raise HTTPException(422, {"code": "IMAGE_QUALITY", "message": "Please retake the photo.", "issues": flags})
    # The demo provider is deliberately deterministic and explicitly identified.
    # It is a UX fallback for the SIH scenario, never evidence of a trained model.
    if AI_PROVIDER == "demo":
        crop = request.headers.get("x-fasalyn-crop", "Chilli")
        prediction = Prediction(label="Thrips", confidence=0.91, severity="moderate", status="DETECTED")
        return {"provider": "demo", "modelId": "demo-rule-fallback", "image": {"width": image.width, "height": image.height}, "prediction": prediction, "disease": {"crop": crop, "diagnosis": None, "confidence": 0.0, "status": "NOT_DETECTED"}, "pest": {"pest": "Thrips", "confidence": 0.91, "count_estimate": 12, "status": "DETECTED"}, "message": "Demo fallback result. It is not a trained-model diagnosis and requires field verification."}
    if AI_PROVIDER != "model": raise HTTPException(500, "AI_PROVIDER must be 'model' or 'demo'.")
    if not model.ready: raise HTTPException(503, f"No configured model is available: {model.error}")
    label, confidence = model.infer(image)
    if confidence < MIN_CONFIDENCE:
        prediction = Prediction(label=None, confidence=confidence, severity="unknown", status="LOW_CONFIDENCE")
        message = "Unable to confidently identify the condition. Retake a clearer image or send it for officer review."
    else:
        prediction = Prediction(label=label, confidence=confidence, severity=severity(label, confidence), status="DETECTED")
        message = "Model output requires field verification; it is not a confirmed diagnosis."
    return {"provider": "model", "modelId": MODEL_ID, "modelRevision": MODEL_REVISION, "image": {"width": image.width, "height": image.height}, "prediction": prediction, "disease": {"status": "MODEL_ADAPTER_REQUIRED"}, "pest": {"status": "MODEL_ADAPTER_REQUIRED"}, "message": message}
