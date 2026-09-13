"""Fasalyn AI4Bharat multilingual inference gateway.

No endpoint fabricates translations or audio. Install the official AI4Bharat
models before this service reports itself ready.
"""
from __future__ import annotations
import hashlib, os, threading
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

Language = Literal['en', 'te', 'hi']; MAX_TEXT=4000
ROOT=Path(__file__).parent; CACHE=Path(os.getenv('AUDIO_CACHE_DIR',ROOT/'audio-cache')).resolve(); CACHE.mkdir(parents=True,exist_ok=True)
try:
    import torch
    DEVICE='cuda' if os.getenv('FORCE_CPU')!='1' and torch.cuda.is_available() else 'cpu'
except ImportError: DEVICE='cpu'
class TranslateRequest(BaseModel):
    text:str=Field(min_length=1,max_length=MAX_TEXT); sourceLanguage:Language; targetLanguage:Language
class TTSRequest(BaseModel): text:str=Field(min_length=1,max_length=MAX_TEXT); language:Literal['te','hi']
class IndicTrans2Adapter:
    def __init__(self): self.model=self.tokenizer=None; self.error=None
    def load(self):
        model_id=os.getenv('INDICTRANS2_MODEL_ID')
        if not model_id: self.error='INDICTRANS2_MODEL_ID is not configured'; return
        try:
            from transformers import AutoModelForSeq2SeqLM,AutoTokenizer
            self.tokenizer=AutoTokenizer.from_pretrained(model_id,trust_remote_code=True)
            self.model=AutoModelForSeq2SeqLM.from_pretrained(model_id,trust_remote_code=True).to(DEVICE);self.model.eval()
        except Exception as exc:self.error=str(exc)
    @property
    def ready(self):return self.model is not None and self.tokenizer is not None
    def translate(self,text,source,target):
        if not self.ready:raise RuntimeError(self.error or 'IndicTrans2 model is unavailable')
        tags={'en':'eng_Latn','te':'tel_Telu','hi':'hin_Deva'}
        import torch
        encoded=self.tokenizer(text,return_tensors='pt',truncation=True).to(DEVICE)
        with torch.inference_mode():result=self.model.generate(**encoded,forced_bos_token_id=self.tokenizer.convert_tokens_to_ids(tags[target]),max_new_tokens=512)
        return self.tokenizer.batch_decode(result,skip_special_tokens=True)[0]
class IndicF5Adapter:
    def __init__(self):self.engine=None;self.error=None
    def load(self):
        try:
            # The official IndicF5 package must be installed from AI4Bharat/IndicF5.
            from indicf5.inference import IndicF5Inference
            self.engine=IndicF5Inference(checkpoint_path=os.environ['INDICF5_MODEL_PATH'],device=DEVICE)
        except Exception as exc:self.error=str(exc)
    @property
    def ready(self):return self.engine is not None
    def synthesize(self,text,language,path):
        if not self.ready:raise RuntimeError(self.error or 'IndicF5 model is unavailable')
        self.engine.synthesize(text=text,language=language,output_path=str(path))
        if not path.exists() or path.stat().st_size==0:raise RuntimeError('IndicF5 returned no audio output')
translator,tts=IndicTrans2Adapter(),IndicF5Adapter();lock=threading.Lock();app=FastAPI(title='Fasalyn AI4Bharat service',version='0.2.0')
@app.on_event('startup')
def startup():translator.load();tts.load()
@app.get('/health')
def health():return {'ready':translator.ready and tts.ready,'device':DEVICE,'translation':{'ready':translator.ready,'error':translator.error},'tts':{'ready':tts.ready,'error':tts.error}}
@app.post('/translate')
def translate(body:TranslateRequest):
    if body.sourceLanguage==body.targetLanguage:return {'success':True,'sourceLanguage':body.sourceLanguage,'targetLanguage':body.targetLanguage,'translatedText':body.text}
    try:
        with lock:result=translator.translate(body.text,body.sourceLanguage,body.targetLanguage)
        return {'success':True,'sourceLanguage':body.sourceLanguage,'targetLanguage':body.targetLanguage,'translatedText':result}
    except Exception as exc:raise HTTPException(503,f'Translation service is unavailable: {exc}')
@app.post('/tts')
def generate_tts(body:TTSRequest):
    key=hashlib.sha256(f'{body.language}:{body.text}:indicf5'.encode()).hexdigest();audio=CACHE/f'{key}.wav'
    try:
        with lock:
            if not audio.exists():tts.synthesize(body.text,body.language,audio)
        return {'success':True,'audioUrl':f'/audio/{key}.wav','cacheKey':key}
    except Exception as exc:raise HTTPException(503,f'Voice generation is unavailable: {exc}')
@app.get('/audio/{name}')
def audio(name:str):
    if not name.endswith('.wav') or '/' in name or '\\' in name:raise HTTPException(400,'Invalid audio name')
    file=(CACHE/name).resolve()
    if CACHE not in file.parents or not file.exists():raise HTTPException(404,'Audio not found')
    return FileResponse(file,media_type='audio/wav')
