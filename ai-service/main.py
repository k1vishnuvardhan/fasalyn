"""Truthful ML and Indic-language boundary for Fasalyn.

No model result is manufactured: unavailable or unconfigured models return 503.
"""
from __future__ import annotations
import base64
import io
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from PIL import Image, ImageStat, UnidentifiedImageError
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).with_name(".env"))
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(10 * 1024 * 1024)))
MIN_EDGE = int(os.getenv("MIN_IMAGE_EDGE", "96"))
MIN_CONFIDENCE = float(os.getenv("MIN_MODEL_CONFIDENCE", "0.25"))
DISEASE_MODEL_ID = os.getenv("DISEASE_MODEL_ID", "").strip()
DISEASE_MODEL_REVISION = os.getenv("DISEASE_MODEL_REVISION")
PEST_MODEL_PATH = os.getenv("PEST_YOLO_MODEL_PATH", "").strip()
PEST_MODEL_ID = os.getenv("PEST_MODEL_ID", "").strip()
TRANSLATION_EN_INDIC_MODEL = os.getenv("TRANSLATION_EN_INDIC_MODEL", "ai4bharat/indictrans2-en-indic-dist-200M")
TRANSLATION_INDIC_EN_MODEL = os.getenv("TRANSLATION_INDIC_EN_MODEL", "ai4bharat/indictrans2-indic-en-dist-200M")
HF_TOKEN = os.getenv("HF_TOKEN")
DEVICE = "cpu"
app = FastAPI(title="Fasalyn AI service", version="2.0.0")

class TranslateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2_000)
    source: Literal["en", "te"] = "en"
    target: Literal["en", "te"] = "te"

class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2_000)
    language: Literal["en", "te"] = "te"

class DiseaseModelAdapter:
    def __init__(self): self.model = self.processor = None; self.error: str | None = None
    @property
    def ready(self): return self.model is not None and self.processor is not None
    def load(self):
        if not DISEASE_MODEL_ID:
            self.error = "DISEASE_MODEL_ID is not configured"; return
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForImageClassification
            global DEVICE
            DEVICE = "cuda" if os.getenv("FORCE_CPU") != "1" and torch.cuda.is_available() else "cpu"
            self.processor = AutoImageProcessor.from_pretrained(DISEASE_MODEL_ID, revision=DISEASE_MODEL_REVISION, token=HF_TOKEN)
            self.model = AutoModelForImageClassification.from_pretrained(DISEASE_MODEL_ID, revision=DISEASE_MODEL_REVISION, token=HF_TOKEN).to(DEVICE).eval()
        except Exception as exc: self.error = str(exc)
    def infer(self, image):
        import torch
        inputs = self.processor(images=image, return_tensors="pt").to(DEVICE)
        with torch.inference_mode(): probabilities = self.model(**inputs).logits.softmax(dim=-1)[0]
        index = int(probabilities.argmax().item())
        return str(self.model.config.id2label[index]), float(probabilities[index].item())

def is_pest_label(label: str) -> bool:
    """Classify the model's label category without inventing a pest name."""
    normalized = label.lower()
    return any(token in normalized for token in ("bollworm", "mealy_bug", "mealybug", "whitefly", "armyworm", "stem_borer", "red_cotton_bug", "thrips", "thirps"))

def is_actionable_label(label: str) -> bool:
    """Do not turn taxonomy placeholders such as Unknown into farmer diagnoses."""
    normalized = label.strip().lower()
    return bool(normalized) and normalized not in ("unknown", "unidentified", "other", "background", "background_without_leaves", "other_disease")

def label_conflicts_with_crop(label: str, crop: str) -> bool:
    """A narrow guard for labels that explicitly name a different crop.

    It avoids guessing crop aliases; lack of a named crop never becomes a mismatch.
    """
    normalized_label, normalized_crop = label.lower(), crop.strip().lower()
    named_crops = ("cotton", "rice", "paddy", "tomato", "chilli", "chili", "maize", "wheat", "potato", "grape", "mango")
    named_in_label = next((item for item in named_crops if item in normalized_label), None)
    if not named_in_label or not normalized_crop: return False
    accepted = {normalized_crop}
    if normalized_crop == "rice": accepted.add("paddy")
    if normalized_crop == "paddy": accepted.add("rice")
    if normalized_crop == "chilli": accepted.add("chili")
    if normalized_crop == "chili": accepted.add("chilli")
    return named_in_label not in accepted

class PestModelAdapter:
    """Only an explicitly configured checkpoint can act as the pest detector."""
    def __init__(self): self.model = None; self.error: str | None = None
    @property
    def ready(self): return self.model is not None
    def load(self):
        if not PEST_MODEL_PATH:
            self.error = "PEST_YOLO_MODEL_PATH is not configured; generic object detection is not accepted as pest detection"; return
        path = Path(PEST_MODEL_PATH)
        if not path.is_absolute(): path = Path(__file__).parent / path
        if not path.is_file(): self.error = f"Configured pest checkpoint was not found: {path.name}"; return
        try:
            from ultralytics import YOLO
            import torch
            global DEVICE
            DEVICE = "cuda" if os.getenv("FORCE_CPU") != "1" and torch.cuda.is_available() else "cpu"
            self.model = YOLO(str(path)); self.model.to(DEVICE)
        except Exception as exc: self.error = str(exc)
    def infer(self, image):
        detections = []
        for result in self.model(image, verbose=False):
            for box in result.boxes:
                confidence = float(box.conf[0])
                if confidence < MIN_CONFIDENCE: continue
                class_id = int(box.cls[0]); x1, y1, x2, y2 = (float(v) for v in box.xyxy[0].tolist())
                detections.append({"className": str(self.model.names[class_id]), "classId": class_id, "confidence": confidence, "bbox": {"x": x1, "y": y1, "width": x2-x1, "height": y2-y1}})
        return detections

class IndicTranslationAdapter:
    def __init__(self): self.models = {}; self.tokenizers = {}; self.processor = None; self.errors = {}
    def load(self, direction):
        if direction in self.models or direction in self.errors: return
        model_id = TRANSLATION_EN_INDIC_MODEL if direction == "en-te" else TRANSLATION_INDIC_EN_MODEL
        try:
            import torch
            from IndicTransToolkit.processor import IndicProcessor
            from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
            global DEVICE
            DEVICE = "cuda" if os.getenv("FORCE_CPU") != "1" and torch.cuda.is_available() else "cpu"
            self.tokenizers[direction] = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, token=HF_TOKEN)
            self.models[direction] = AutoModelForSeq2SeqLM.from_pretrained(model_id, trust_remote_code=True, token=HF_TOKEN).to(DEVICE).eval()
            self.processor = IndicProcessor(inference=True)
        except Exception as exc: self.errors[direction] = str(exc)
    def translate(self, text, source, target):
        if source == target: return text
        direction = f"{source}-{target}"
        if direction not in {"en-te", "te-en"}: raise HTTPException(422, "Only English and Telugu are supported.")
        self.load(direction)
        if direction not in self.models:
            raise HTTPException(503, {"code": "TRANSLATION_UNAVAILABLE", "message": "IndicTrans2 is unavailable.", "detail": self.errors.get(direction)})
        import torch
        src, tgt = ("eng_Latn", "tel_Telu") if direction == "en-te" else ("tel_Telu", "eng_Latn")
        batch = self.processor.preprocess_batch([text], src_lang=src, tgt_lang=tgt)
        encoded = self.tokenizers[direction](batch, truncation=True, padding=True, return_tensors="pt").to(DEVICE)
        with torch.inference_mode(): generated = self.models[direction].generate(**encoded, max_new_tokens=256, num_beams=4)
        return self.processor.postprocess_batch(self.tokenizers[direction].batch_decode(generated, skip_special_tokens=True), lang=tgt)[0]

disease_model, pest_model, translation_model = DiseaseModelAdapter(), PestModelAdapter(), IndicTranslationAdapter()
@app.on_event("startup")
def startup(): disease_model.load(); pest_model.load()

def image_quality(image):
    flags = []
    if min(image.size) < MIN_EDGE: flags.append(f"image is smaller than {MIN_EDGE}px on one edge")
    brightness = ImageStat.Stat(image.convert("L")).mean[0]
    if brightness < 20: flags.append("image is too dark")
    if brightness > 245: flags.append("image is too bright")
    return flags

@app.get("/health")
def health(): return {"ready": disease_model.ready or pest_model.ready, "device": DEVICE}

@app.get("/model-status")
def model_status():
    return {"diseaseModel": {"loaded": disease_model.ready, "model": DISEASE_MODEL_ID or None, "revision": DISEASE_MODEL_REVISION, "task": "classification", "device": DEVICE, "error": disease_model.error}, "pestModel": {"loaded": pest_model.ready, "model": PEST_MODEL_ID or (Path(PEST_MODEL_PATH).name if PEST_MODEL_PATH else None), "task": "object_detection", "device": DEVICE, "error": pest_model.error, "classes": list(pest_model.model.names.values()) if pest_model.ready else []}, "translation": {"provider": "IndicTrans2", "enToTeLoaded": "en-te" in translation_model.models, "teToEnLoaded": "te-en" in translation_model.models, "errors": translation_model.errors}}

@app.post("/infer")
async def infer(request: Request):
    content_type = request.headers.get("content-type", "").split(";", 1)[0]
    if content_type not in {"image/jpeg", "image/png", "image/webp"}: raise HTTPException(415, "Only JPEG, PNG, and WebP images are supported.")
    raw = await request.body()
    if not raw or len(raw) > MAX_IMAGE_BYTES: raise HTTPException(413, "Image is empty or exceeds the upload size limit.")
    try: image = Image.open(io.BytesIO(raw)).convert("RGB")
    except (UnidentifiedImageError, OSError, ValueError): raise HTTPException(400, "Uploaded content is not a valid image.")
    if issues := image_quality(image): raise HTTPException(422, {"code": "IMAGE_QUALITY", "message": "Please retake the photo.", "issues": issues})
    if not disease_model.ready and not pest_model.ready: raise HTTPException(503, {"code": "MODEL_UNAVAILABLE", "message": "No configured model is loaded.", "modelStatus": model_status()})
    crop_header = request.headers.get("x-fasalyn-crop", "")
    result: dict[str, Any] = {"timestamp": datetime.now(timezone.utc).isoformat(), "image": {"width": image.width, "height": image.height}, "prediction": {"label": None, "confidence": None, "confidenceCalibrated": False, "severity": "unknown", "status": "UNAVAILABLE"}, "classification": {"status": "UNAVAILABLE"}, "disease": {"status": "UNAVAILABLE"}, "pest": {"status": "UNAVAILABLE", "detections": []}, "models": [], "message": "No verified model assessment is available for this image."}
    if disease_model.ready:
        label, confidence = disease_model.infer(image); status = "CLASSIFIED" if confidence >= MIN_CONFIDENCE else "LOW_CONFIDENCE"; conflict = label_conflicts_with_crop(label, crop_header); actionable = is_actionable_label(label) and not conflict; result["classification"] = {"status": status if actionable else ("CROP_MISMATCH" if conflict else "UNVERIFIED_LABEL"), "label": label, "rawScore": confidence, "confidenceCalibrated": False}; result["models"].append({"id": DISEASE_MODEL_ID, "revision": DISEASE_MODEL_REVISION, "task": "classification", "device": DEVICE})
        if actionable and is_pest_label(label): result["pest"] = {"status": status, "label": label, "rawScore": confidence, "detections": []}
        elif actionable: result["disease"] = {"status": status, "label": label, "rawScore": confidence}
        if confidence >= MIN_CONFIDENCE and actionable: result["prediction"] = {"label": label, "confidence": None, "confidenceCalibrated": False, "severity": "unknown", "status": "DETECTED"}; result["message"] = "Whole-image classification output; it does not locate or count individual pests. Field verification is required."
        elif conflict: result["message"] = "The model label names a crop that does not match the selected subplot. Select the correct crop or request officer review; no diagnosis was created."
        elif not is_actionable_label(label): result["message"] = "The model returned an unverified taxonomy label. No farmer diagnosis or automated treatment was created."
    if pest_model.ready:
        detections = pest_model.infer(image); result["pest"] = {"status": "DETECTED" if detections else "NO_DETECTION", "detections": detections}; result["models"].append({"id": PEST_MODEL_ID or Path(PEST_MODEL_PATH).name, "task": "object_detection", "device": DEVICE, "classes": list(pest_model.model.names.values())})
        if detections:
            best = max(detections, key=lambda item: item["confidence"])
            current_score = result["prediction"].get("confidence") or 0
            if best["confidence"] > current_score: result["prediction"] = {"label": best["className"], "confidence": None, "confidenceCalibrated": False, "severity": "unknown", "status": "DETECTED"}; result["message"] = "Object-detection model output requires field verification."
    result["modelId"] = ",".join(model["id"] for model in result["models"] if model.get("id")) or None
    return result

@app.post("/translate")
async def translate_text(req: TranslateRequest):
    translated = translation_model.translate(req.text, req.source, req.target)
    model = TRANSLATION_EN_INDIC_MODEL if req.source == "en" else TRANSLATION_INDIC_EN_MODEL
    return {"success": True, "translatedText": translated, "provider": "IndicTrans2", "model": model, "sourceLanguage": req.source, "targetLanguage": req.target}

@app.post("/tts")
async def generate_tts(req: TTSRequest):
    try:
        from gtts import gTTS
        buffer = io.BytesIO(); gTTS(text=req.text, lang=req.language).write_to_fp(buffer)
        return {"audioBase64": base64.b64encode(buffer.getvalue()).decode("ascii"), "mimeType": "audio/mpeg", "language": req.language, "provider": "gTTS"}
    except Exception as exc: raise HTTPException(503, {"code": "TTS_UNAVAILABLE", "message": "Text-to-speech provider is unavailable.", "detail": str(exc)})
