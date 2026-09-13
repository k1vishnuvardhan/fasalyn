import {ArrowRight,Check,ChevronRight,Mic,Volume2} from 'lucide-react';import {useI18n} from '../i18n/I18nProvider'
export function PageTitle({eyebrow,title,children}){return <div className="page-title"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>{children}</div>}
export function RiskBadge({risk}){const{t}=useI18n();return <span className={`risk-badge ${risk.toLowerCase()}`}>{t(risk.toLowerCase())}</span>}
export function Empty({title,body,action}){return <div className="empty"><div>◌</div><h3>{title}</h3><p>{body}</p>{action}</div>}
export function SpeakButton({text}){const{language}=useI18n();return <button className="speak" onClick={()=>speechSynthesis.speak(new SpeechSynthesisUtterance(text,{lang:language==='te'?'te-IN':language==='hi'?'hi-IN':'en-IN'}))}><Volume2 size={16}/> Listen</button>}
export function SectionLink({to,children}){return <a href={to} className="section-link">{children}<ChevronRight size={17}/></a>}
