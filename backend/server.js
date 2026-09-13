import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { farm } from './data/demo.js'
import { assessRisk, propagate, weights } from './services/riskEngine.js'
const app=express(); app.use(cors({origin:process.env.FRONTEND_ORIGIN||'http://localhost:5173'})); app.use(express.json())
app.get('/api/health',(_,res)=>res.json({service:'fasalyn-api',status:'ok'}))
app.get('/api/farms/demo',(_,res)=>res.json(farm))
app.get('/api/weather',(_,res)=>res.json({provider:'demo/open-meteo',temperature:28,humidity:67,rainfall:0,windSpeed:12,windDirection:'SW'}))
app.get('/api/risk/:plotId',(req,res)=>{const plot=farm.plots.find(p=>p.id===req.params.plotId);if(!plot)return res.status(404).json({error:'Plot not found'});res.json({plotId:plot.id,current:assessRisk({trapCount:plot.trapCount||0,nearbyRisk:plot.risk}),propagation:propagate(plot.risk),weights})})
app.post('/api/observations',(req,res)=>{const {plotId,trapCount=0}=req.body;const plot=farm.plots.find(p=>p.id===plotId);if(!plot)return res.status(404).json({error:'Plot not found'});const risk=assessRisk({trapCount,nearbyRisk:plot.risk});res.status(201).json({id:`obs-${Date.now()}`,plotId,trapCount,risk,queued:false})})
app.post('/api/diagnoses',(req,res)=>res.status(202).json({id:`case-${Date.now()}`,status:'analyzed',diagnosis:{pest:'Thrips',confidence:91,severity:'Moderate'},message:'Demo inference result; replace ai-service stub with trained model.'}))
app.listen(process.env.PORT||4000,()=>console.log(`Fasalyn API on :${process.env.PORT||4000}`))
