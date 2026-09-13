import {ArrowRight,Check,ChevronRight,Mic,Volume2} from 'lucide-react';import {useI18n} from '../i18n/I18nProvider'
export function PageTitle({eyebrow,title,children}){return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>}
export function RiskBadge({risk}){const{t}=useI18n();return <span className={`risk-badge ${risk.toLowerCase()}`}>{t(risk.toLowerCase())}</span>}
export function Empty({title,body,action}){return <div className="empty"><div>◌</div><h3>{title}</h3><p>{body}</p>{action}</div>}
export function SpeakButton({text}){const{language}=useI18n();const speak=()=>{if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){window.alert('Voice playback is unavailable in this browser.');return}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=language==='te'?'te-IN':language==='hi'?'hi-IN':'en-IN';window.speechSynthesis.speak(utterance)};return <button className="speak" onClick={speak}><Volume2 size={16}/> Listen</button>}
export function SectionLink({to,children}){return <a href={to} className="section-link">{children}<ChevronRight size={17}/></a>}
