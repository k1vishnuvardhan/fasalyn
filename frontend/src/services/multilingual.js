const API=import.meta.env.VITE_API_URL||'http://localhost:4000/api'
async function request(path,body){const response=await fetch(`${API}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||result.detail||'Multilingual service is unavailable');return result}
export const translateText=(text,sourceLanguage,targetLanguage)=>request('/translate',{text,sourceLanguage,targetLanguage})
export const requestSpeech=(text,language)=>request('/tts',{text,language})
export const audioUrl=name=>`${API}/tts/audio/${name.split('/').pop()}`
