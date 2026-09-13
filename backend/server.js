import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { farm } from './data/demo.js'
import { assessRisk, propagate, weights } from './services/riskEngine.js'
const app=express(); app.use(cors({origin:process.env.FRONTEND_ORIGIN||'http://localhost:5174'})); app.use(express.json())
const observations=[{id:'obs-01',subplotId:'P5',trapId:'T5-01',pest:'Thrips',count:6,date:'2026-09-04'},{id:'obs-02',subplotId:'P5',trapId:'T5-01',pest:'Thrips',count:9,date:'2026-09-07'},{id:'obs-03',subplotId:'P5',trapId:'T5-01',pest:'Thrips',count:14,date:'2026-09-10'},{id:'obs-04',subplotId:'P5',trapId:'T5-01',pest:'Thrips',count:18,date:'2026-09-13'}]
const actionPlans=[{id:'action-1',title:'Inspect P4 leaf undersides',completed:false},{id:'action-2',title:'Check P6 trap condition',completed:false},{id:'action-3',title:'Recheck P5 symptoms',completed:false}]
const officerCases=[{id:'case-p5',farm:'Demo Chilli Farm',subplot:'P5',crop:'Chilli',problem:'Thrips',severity:'Moderate',confidence:91,risk:'High',status:'Pending review'}]
app.get('/api/health',(_,res)=>res.json({service:'fasalyn-api',status:'ok'}))
app.post('/api/auth/login',(req,res)=>{const role=req.body.role==='officer'?'officer':'farmer';res.json({token:'demo-token-not-for-production',user:{id:`demo-${role}`,name:role==='officer'?'Demo Officer':'Demo Farmer',role}})})
app.post('/api/auth/register',(req,res)=>res.status(201).json({user:{id:`user-${Date.now()}`,name:req.body.name||'New Farmer',role:'farmer'},token:'demo-token-not-for-production'}))
app.get('/api/farms/demo',(_,res)=>res.json(farm))
app.get('/api/farms',(_,res)=>res.json([farm]))
app.get('/api/weather',(_,res)=>res.json({provider:'demo/open-meteo',temperature:28,humidity:67,rainfall:0,windSpeed:12,windDirection:'SW'}))
app.get('/api/risk/:plotId',(req,res)=>{const plot=farm.plots.find(p=>p.id===req.params.plotId);if(!plot)return res.status(404).json({error:'Plot not found'});res.json({plotId:plot.id,current:assessRisk({trapCount:plot.trapCount||0,nearbyRisk:plot.risk}),propagation:propagate(plot.risk),weights})})
app.post('/api/observations',(req,res)=>{const {plotId,trapCount=0}=req.body;const plot=farm.plots.find(p=>p.id===plotId);if(!plot)return res.status(404).json({error:'Plot not found'});const risk=assessRisk({trapCount,nearbyRisk:plot.risk});res.status(201).json({id:`obs-${Date.now()}`,plotId,trapCount,risk,queued:false})})
app.post('/api/diagnoses',(req,res)=>res.status(202).json({id:`case-${Date.now()}`,status:'analyzed',diagnosis:{pest:'Thrips',confidence:91,severity:'Moderate'},message:'Demo inference result; replace ai-service stub with trained model.'}))
app.get('/api/subplots/:id/traps',(req,res)=>res.json(observations.filter(item=>item.subplotId===req.params.id)))
app.post('/api/traps/observations',(req,res)=>{const item={id:`obs-${Date.now()}`,subplotId:req.body.subplotId||'P5',trapId:req.body.trapId||'T5-01',pest:req.body.pest||'Thrips',count:Number(req.body.count||0),date:req.body.date||new Date().toISOString().slice(0,10)};observations.push(item);res.status(201).json(item)})
app.get('/api/risk/farm/:farmId',(_,res)=>res.json({farmId:'demo-chilli-farm',health:78,reasoning:{stable:4,weather:-6,pestPressure:-10,recovery:3},weights}))
app.get('/api/propagation/:farmId',(_,res)=>res.json({source:'P5',message:'Predicted elevated risk within 24–72 hours.',predictions:propagate(86,24)}))
app.get('/api/alerts',(_,res)=>res.json([{id:'risk-p5',priority:'high',title:'Pest pressure increasing',subplot:'P5'},{id:'weather-p2',priority:'attention',title:'Weather stress watch',subplot:'P2'}]))
app.get('/api/action-plans',(_,res)=>res.json(actionPlans))
app.patch('/api/action-plans/:id',(req,res)=>{const action=actionPlans.find(item=>item.id===req.params.id);if(!action)return res.status(404).json({error:'Action not found'});action.completed=Boolean(req.body.completed);res.json(action)})
app.post('/api/followups',(req,res)=>{const followup={id:`followup-${Date.now()}`,caseId:req.body.caseId||'case-p5',condition:req.body.condition||'Same',status:req.body.condition==='Worse'?'Needs Review':'Stable'};if(followup.status==='Needs Review')officerCases[0].status='Worsening — review required';res.status(201).json(followup)})
app.get('/api/officer/cases',(_,res)=>res.json(officerCases))
app.post('/api/officer/validate',(req,res)=>res.json({id:`validation-${Date.now()}`,caseId:req.body.caseId||'case-p5',decision:req.body.decision||'Confirmed',validatedBy:'demo-officer'}))
app.get('/api/regional/hotspots',(_,res)=>res.json([{id:'hotspot-1',crop:'Chilli',problem:'Thrips',severity:'Moderate',coordinates:[17.385,78.486]},{id:'hotspot-2',crop:'Tomato',problem:'Leaf issue',severity:'High',coordinates:[17.4,78.5]}]))
app.listen(process.env.PORT||4000,()=>console.log(`Fasalyn API on :${process.env.PORT||4000}`))
