import {createContext,useContext,useEffect,useState} from 'react'
import {translations} from './translations'
const I18n=createContext()
export function I18nProvider({children}){const [language,setLanguage]=useState(()=>localStorage.getItem('fasalyn-language')||'en');useEffect(()=>localStorage.setItem('fasalyn-language',language),[language]);const t=(key)=>translations[language][key]||translations.en[key]||key;return <I18n.Provider value={{language,setLanguage,t}}>{children}</I18n.Provider>}
export const useI18n=()=>useContext(I18n)
