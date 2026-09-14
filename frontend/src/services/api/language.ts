import { authHeaders, request } from './client';
export function requestSpeech(text: string, language: 'en' | 'te' = 'en') {
  return request<{ audioBase64: string; mimeType: string }>('/tts', { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language }) });
}
