import {BrowserRouter,Route,Routes} from 'react-router-dom'
import {lazy,Suspense} from 'react'
import {I18nProvider} from './i18n/I18nProvider'
import {useOfflineQueue} from './hooks/useOfflineQueue'
import AppShell from './components/AppShell'
const Demo=lazy(()=>import('./pages/Demo')),Dashboard=lazy(()=>import('./pages/Dashboard')),Setup=lazy(()=>import('./pages/Setup')),Login=lazy(()=>import('./pages/Login')),Scanner=lazy(()=>import('./pages/Scanner')),Risk=lazy(()=>import('./pages/Risk')),Monitoring=lazy(()=>import('./pages/Monitoring')),Analytics=lazy(()=>import('./pages/Analytics')),Farm=lazy(()=>import('./pages/Farm'))
const Officer=lazy(()=>import('./pages/UtilityPages').then(m=>({default:m.Officer}))),Settings=lazy(()=>import('./pages/UtilityPages').then(m=>({default:m.Settings})))
function Routed(){const queue=useOfflineQueue();return <Suspense fallback={<main className="route-loading">Loading…</main>}><Routes><Route path="/" element={<Demo/>}/><Route path="/demo" element={<Demo/>}/><Route element={<AppShell queue={queue}/>}><Route path="/dashboard" element={<Dashboard/>}/><Route path="/setup" element={<Setup/>}/><Route path="/farm" element={<Farm/>}/><Route path="/login" element={<Login/>}/><Route path="/scanner" element={<Scanner/>}/><Route path="/risk" element={<Risk/>}/><Route path="/monitoring" element={<Monitoring/>}/><Route path="/pests" element={<Monitoring/>}/><Route path="/analytics" element={<Analytics/>}/><Route path="/officer" element={<Officer/>}/><Route path="/settings" element={<Settings/>}/></Route></Routes></Suspense>}
export default function App(){return <I18nProvider><BrowserRouter><Routed/></BrowserRouter></I18nProvider>}
