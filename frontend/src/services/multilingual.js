const API=import.meta.env.VITE_API_URL||'http://localhost:4000/api'
async function request(path,body){const token=localStorage.getItem('token');const response=await fetch(`${API}${path}`,{method:'POST',headers:{'content-type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error?.message||result.detail?.message||result.detail||'Multilingual service is unavailable');return result}
export const translateText=(text,sourceLanguage,targetLanguage)=>request('/translate',{text,source:sourceLanguage,target:targetLanguage})
export const requestSpeech=(text,language)=>request('/tts',{text,language})
export const audioUrl=name=>`${API}/tts/audio/${name.split('/').pop()}`
