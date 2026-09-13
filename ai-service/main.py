"""Fasalyn demo AI boundary. Replace the deterministic response with a trained crop model."""
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel

app = FastAPI(title='Fasalyn AI Service', version='0.1.0')
class Diagnosis(BaseModel):
    pest: str; confidence: int; severity: str; advice: str
@app.get('/health')
def health(): return {'status':'ok','service':'fasalyn-ai'}
@app.post('/infer', response_model=Diagnosis)
async def infer(image: UploadFile = File(...)):
    # Input validation and model preprocessing belong here in production.
    return Diagnosis(pest='Thrips', confidence=91, severity='Moderate', advice='Inspect P5 and record a trap observation.')
