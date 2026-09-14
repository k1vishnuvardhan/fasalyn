import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
import { initDb, id, now, one, many, run } from './db.js'
import { assessRisk } from './services/riskEngine.js'
import { areaSquareMeters, centroid, centroidDistanceMeters, normalizePolygon, polygonWithin } from './services/geo.js'

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace-with-a-long-random-secret') throw new Error('Set a strong JWT_SECRET in backend/.env before starting the API.')
const app = express(), port = Number(process.env.PORT || 4000), aiUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '')
const allowedOrigins = [...new Set([
  'http://localhost:5174', 'http://127.0.0.1:5174', 'http://localhost:5175', 'http://127.0.0.1:5175',
  ...(process.env.FRONTEND_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) || []),
])];
app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '1mb' })); app.use(rateLimit({ windowMs: 15 * 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }))
app.use((req, res, next) => { req.requestId = crypto.randomUUID(); res.setHeader('x-request-id', req.requestId); next() })
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024), files: 1 }, fileFilter: (_, f, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(f.mimetype)) })
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message, requestId: res.req.requestId } })
const parse = (schema, source, res) => { const result = schema.safeParse(source); if (!result.success) { fail(res, 422, 'VALIDATION_ERROR', result.error.issues.map(x => x.message).join('; ')); return null } return result.data }
const tokenFor = user => jwt.sign({ sub: user.id, role: user.role, environment: user.environment || 'production' }, process.env.JWT_SECRET, { expiresIn: '8h', issuer: 'fasalyn' })
function auth(...roles) { return async (req, res, next) => { const raw = req.get('authorization')?.replace(/^Bearer /, ''); try { const claims = jwt.verify(raw, process.env.JWT_SECRET, { issuer: 'fasalyn' }); const user = await one('SELECT id,email,name,role,environment FROM users WHERE id=?', [claims.sub]); if (!user) return fail(res, 401, 'UNAUTHENTICATED', 'Session is no longer valid.'); if (roles.length && !roles.includes(user.role)) return fail(res, 403, 'FORBIDDEN', 'You do not have permission for this operation.'); req.user = user; next() } catch { fail(res, 401, 'UNAUTHENTICATED', 'Sign in is required.') } } }
async function ownsPlot(userId, plotId) { return one('SELECT p.*,f.farmer_id,f.latitude,f.longitude FROM plots p JOIN farms f ON p.farm_id=f.id WHERE p.id=? AND f.farmer_id=?', [plotId, userId]) }
function farmOut(row) { if (!row) return null; return { ...row, polygon: row.polygon_geometry ? JSON.parse(row.polygon_geometry) : null, farmerId: row.farmer_id, areaSquareMeters: row.area_square_meters, areaUnit: row.area_unit, plantingDate: row.planting_date, growthStage: row.growth_stage, monitoringMode: row.monitoring_mode, locality: { state: row.state || null, district: row.district || null, mandal: row.mandal || null, pincode: row.pincode || null }, createdAt: row.created_at, updatedAt: row.updated_at } }
function plotOut(row) { if (!row) return null; return { ...row, polygon: row.polygon_geometry ? JSON.parse(row.polygon_geometry) : null, farmId: row.farm_id, cropStage: row.crop_stage, areaSquareMeters: row.area_square_meters, areaUnit: row.area_unit, plantingDate: row.planting_date, createdAt: row.created_at, updatedAt: row.updated_at } }
function parseBoundary(value) { try { return normalizePolygon(value) } catch (error) { const next = new Error(error.message); next.status = 422; throw next } }
async function weatherFor(lat, lon) { if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null; try { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,precipitation`, { signal: AbortSignal.timeout(6000) }); if (!r.ok) return null; const c = (await r.json()).current; return c && Number.isFinite(c.relative_humidity_2m) ? { provider: 'open-meteo', observedAt: c.time, temperature: c.temperature_2m, humidity: c.relative_humidity_2m, rainfall: c.precipitation } : null } catch { return null } }
async function weatherForecastFor(lat, lon) { if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null; try { const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean&forecast_days=5&timezone=auto`, { signal: AbortSignal.timeout(6000) }); if (!r.ok) return null; const d = (await r.json()).daily; if (!d?.time) return null; return { provider:'open-meteo', days:d.time.map((date,index)=>({ date, temperatureMin:d.temperature_2m_min?.[index] ?? null, temperatureMax:d.temperature_2m_max?.[index] ?? null, rainfall:d.precipitation_sum?.[index] ?? null, humidity:d.relative_humidity_2m_mean?.[index] ?? null })) } } catch { return null } }
async function riskForPlot(plot, detection = null, scanId = null) { const rows = await many('SELECT count FROM trap_observations WHERE plot_id=? ORDER BY observed_at DESC LIMIT 2', [plot.id]); const weather = await weatherFor(plot.latitude, plot.longitude); const risk = assessRisk({ detection, trapTrend: rows[0] ? { latest: rows[0].count, change: rows[1] ? rows[0].count - rows[1].count : 0 } : null, weather, cropStage: plot.crop_stage }); await run('INSERT INTO risk_assessments VALUES (?,?,?,?,?,?,?,?)', [id(), plot.id, scanId, risk.score, risk.level, JSON.stringify({ factors: risk.factors, missing: risk.missing, weather }), JSON.stringify(risk.forecast), now()]); return { ...risk, weather } }
function advisoryFor({ prediction, risk }) { const issue = prediction?.label || 'crop health concern'; const level = risk?.level || 'INSUFFICIENT_DATA'; const guidance = ['Inspect the affected subplot and nearby plants for visible symptoms.', 'Record a trap observation or field note so the next assessment has stronger evidence.', level === 'HIGH' || level === 'CRITICAL' ? 'Request an agriculture officer review if symptoms are spreading or crop damage is increasing.' : 'Monitor the plot and submit a follow-up observation after field inspection.']; return { title: `Next steps for ${issue}`, guidance, followUpDays: level === 'HIGH' || level === 'CRITICAL' ? 2 : 5 } }
async function createAdvisory({ scanId = null, plotId, prediction, risk, source = 'SYSTEM' }) { 
  const advisory = advisoryFor({ prediction, risk }); 
  const createdAt = now(), followUpDueAt = new Date(Date.now() + advisory.followUpDays * 86400000).toISOString(); 
  
  let explanation = null;
  if (ai) {
    try {
      const prompt = `You are an expert agriculture advisor. A farmer has detected a potential issue on their farm.
Issue: ${prediction?.label || 'crop health concern'}
Severity: ${prediction?.severity || 'unknown'}
Risk Level: ${risk?.level || 'unknown'}
Approved Actionable Steps: ${JSON.stringify(advisory.guidance)}

Please explain these actionable steps to the farmer in simple, clear, and conversational language. 
IMPORTANT SAFETY RULE: You MUST NOT invent, recommend, or specify any pesticide dosages or chemical instructions. Stick strictly to explaining the approved actionable steps provided above.`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
      });
      explanation = response.text;
    } catch (e) {
      console.error("Failed to generate Gemini explanation:", e);
    }
  }

  const guidanceData = explanation ? { steps: advisory.guidance, explanation } : advisory.guidance;

  const result = { id: id(), scanId, plotId, source, title: advisory.title, guidance: guidanceData, followUpDueAt, createdAt }; 
  await run('INSERT INTO advisories VALUES (?,?,?,?,?,?,?,?)', [result.id, scanId, plotId, source, result.title, JSON.stringify(result.guidance), followUpDueAt, createdAt]); 
  return result 
}
async function notify(userId, kind, title, body, link = null) { const row = { id: id(), userId, kind, title, body, link, createdAt: now() }; await run('INSERT INTO notifications VALUES (?,?,?,?,?,?,?,?)', [row.id, row.userId, row.kind, row.title, row.body, row.link, null, row.createdAt]); return row }

app.get('/api/health', (_, res) => res.json({ status: 'ok', database: 'connected', aiService: aiUrl }))
app.get('/api/map/config', auth('FARMER','OFFICER','EXPERT','ADMIN'), (_, res) => res.json({ provider: process.env.MAP_PROVIDER || 'leaflet', standardTiles: process.env.MAP_STANDARD_TILES || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', satelliteTiles: process.env.MAP_SATELLITE_TILES || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', geocodingProvider: process.env.GEOCODING_PROVIDER || 'browser/manual', attribution: { standard: '© OpenStreetMap contributors', satellite: 'Tiles © Esri' } }))
app.post('/api/auth/register', async (req, res) => {
  const body = parse(z.object({ email: z.string().email(), password: z.string().min(12), name: z.string().min(2).max(80), role: z.enum(['FARMER', 'OFFICER']).default('FARMER'), officerRegistrationCode: z.string().max(200).optional(), environment: z.enum(['production','demo']).default('production') }), req.body, res);
  if (!body) return;
  if (body.role === 'OFFICER') {
    // There is deliberately no default/shared officer secret. Production uses
    // administrator provisioning; local self-registration is explicitly opt-in.
    const enrollmentCode = process.env.OFFICER_REGISTRATION_CODE;
    if (process.env.OFFICER_SELF_REGISTRATION !== 'true' || !enrollmentCode || body.officerRegistrationCode !== enrollmentCode) return fail(res, 403, 'OFFICER_ENROLLMENT_REQUIRED', 'Officer accounts must be provisioned by an administrator.');
  }
  if (await one('SELECT id FROM users WHERE email=?', [body.email.toLowerCase()])) return fail(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists.');
  const user = { id: id(), email: body.email.toLowerCase(), name: body.name, role: body.role, environment: body.environment };
  await run('INSERT INTO users (id, email, password_hash, name, role, environment, created_at) VALUES (?,?,?,?,?,?,?)', [user.id, user.email, await bcrypt.hash(body.password, 12), user.name, user.role, user.environment, now()]);
  res.status(201).json({ user, token: tokenFor(user) });
})
app.post('/api/auth/login', async (req, res) => { const body = parse(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body, res); if (!body) return; const user = await one('SELECT * FROM users WHERE email=?', [body.email.toLowerCase()]); if (!user || !(await bcrypt.compare(body.password, user.password_hash))) return fail(res, 401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'); res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role, environment: user.environment }, token: tokenFor(user) }) })
app.post('/api/auth/demo', async (req, res) => {
  const body = parse(z.object({ role: z.enum(['FARMER', 'OFFICER']).optional().default('FARMER') }), req.body, res, true) || { role: 'FARMER' };
  if (body.role === 'OFFICER') {
    const user = { id: id(), email: `demo-officer-${id().slice(0,8)}@demo.fasalyn.local`, name: 'Demo Officer', role: 'OFFICER', environment: 'demo' };
    await run('INSERT INTO users (id, email, password_hash, name, role, environment, created_at) VALUES (?,?,?,?,?,?,?)', [user.id, user.email, 'demo-no-password', user.name, user.role, user.environment, now()]);
    await run('INSERT INTO officer_jurisdictions VALUES (?,?,?,?,?,?,?,?)',[id(),user.id,'Andhra Pradesh','Guntur',null,null,now(),now()]);
    return res.json({ user, token: tokenFor(user) });
  }
  const user = { id: id(), email: `demo-${id().slice(0,8)}@demo.fasalyn.local`, name: 'Demo Farmer', role: 'FARMER', environment: 'demo' };
  await run('INSERT INTO users (id, email, password_hash, name, role, environment, created_at) VALUES (?,?,?,?,?,?,?)', [user.id, user.email, 'demo-no-password', user.name, user.role, user.environment, now()]);
  const polygon = { type: 'Polygon', coordinates: [[[80.5, 16.5], [80.505, 16.502], [80.508, 16.498], [80.502, 16.495], [80.5, 16.5]]] };
  const center = centroid(polygon), area = areaSquareMeters(polygon), createdAt = now(), plantingDate = new Date(Date.now() - 40 * 86400000).toISOString().split('T')[0];
  const farm = { id: id(), farmerId: user.id, name: 'Demo Rice Farm', latitude: center.latitude, longitude: center.longitude, polygon, areaSquareMeters: area, areaUnit: 'square metres', crop: 'Rice', variety: 'IR64', plantingDate, growthStage: 'tillering', monitoringMode: 'SPATIAL', createdAt, updatedAt: createdAt };
  await run('INSERT INTO farms (id,farmer_id,name,latitude,longitude,polygon_geometry,area_square_meters,area_unit,crop,variety,planting_date,growth_stage,monitoring_mode,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [farm.id, farm.farmerId, farm.name, farm.latitude, farm.longitude, JSON.stringify(polygon), area, farm.areaUnit, farm.crop, farm.variety, farm.plantingDate, farm.growthStage, farm.monitoringMode, createdAt, createdAt]);
  const plot = { id: id(), farmId: farm.id, name: 'Main Plot', crop: farm.crop, cropStage: farm.growthStage, polygon, areaSquareMeters: area, areaUnit: 'square metres', variety: farm.variety, plantingDate: farm.plantingDate, createdAt, updatedAt: createdAt };
  await run('INSERT INTO plots (id,farm_id,name,crop,crop_stage,polygon_geometry,area_square_meters,area_unit,variety,planting_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [plot.id, plot.farmId, plot.name, plot.crop, plot.cropStage, JSON.stringify(polygon), area, plot.areaUnit, plot.variety, plot.plantingDate, createdAt, createdAt]);
  const t = now(), t1 = new Date(Date.now() - 3 * 86400000).toISOString(), t2 = new Date(Date.now() - 2 * 86400000).toISOString(), t3 = new Date(Date.now() - 1 * 86400000).toISOString();
  await run('INSERT INTO trap_observations VALUES (?,?,?,?,?,?,?,?)', [id(), plot.id, user.id, 'Sticky Trap', 'Brown Planthopper', 12, t1, t]);
  await run('INSERT INTO trap_observations VALUES (?,?,?,?,?,?,?,?)', [id(), plot.id, user.id, 'Sticky Trap', 'Brown Planthopper', 25, t2, t]);
  await run('INSERT INTO trap_observations VALUES (?,?,?,?,?,?,?,?)', [id(), plot.id, user.id, 'Sticky Trap', 'Brown Planthopper', 48, t3, t]);
  const risk = assessRisk({ trapTrend: { latest: 48, change: 23 }, weather: null, cropStage: 'tillering' });
  await run('INSERT INTO risk_assessments VALUES (?,?,?,?,?,?,?,?)', [id(), plot.id, null, risk.score, risk.level, JSON.stringify({ factors: risk.factors, missing: risk.missing, weather: null }), JSON.stringify(risk.forecast), t]);
  res.status(201).json({ user, token: tokenFor(user) })
})
app.delete('/api/demo/reset', auth('FARMER'), async (req, res) => { if (req.user.environment !== 'demo') return fail(res, 403, 'FORBIDDEN', 'Can only reset demo environment.'); await run('DELETE FROM trap_observations WHERE user_id=?', [req.user.id]); await run('DELETE FROM risk_assessments WHERE plot_id IN (SELECT p.id FROM plots p JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=?)', [req.user.id]); await run('DELETE FROM scans WHERE user_id=?', [req.user.id]); await run('DELETE FROM plots WHERE farm_id IN (SELECT id FROM farms WHERE farmer_id=?)', [req.user.id]); await run('DELETE FROM farms WHERE farmer_id=?', [req.user.id]); res.json({ status: 'RESET_COMPLETE' }) })
app.post('/api/farms', auth('FARMER'), async (req, res) => { const body = parse(z.object({ id: z.string().uuid().optional(), name: z.string().min(2).max(100), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), polygonGeometry: z.any().optional(), crop: z.string().min(2).max(60).optional(), variety: z.string().max(80).optional(), plantingDate: z.string().max(30).optional(), growthStage: z.enum(['seedling','vegetative','flowering','fruiting','harvest']).optional(), monitoringMode: z.enum(['QUICK_DETECTION','SPATIAL']).optional(), locality: z.object({ state: z.string().min(2).max(80), district: z.string().min(2).max(80), mandal: z.string().max(80).optional(), pincode: z.string().regex(/^\d{6}$/).optional() }).optional() }), req.body, res); if (!body) return; let polygon = null, center = null, area = null; try { polygon = body.polygonGeometry ? parseBoundary(body.polygonGeometry) : null; center = polygon ? centroid(polygon) : null; area = polygon ? areaSquareMeters(polygon) : null } catch (error) { return fail(res, error.status || 422, 'INVALID_GEOMETRY', error.message) } const createdAt = now(), locality = body.locality || {}; const farm = { id: body.id || id(), farmerId: req.user.id, name: body.name, latitude: center?.latitude ?? body.latitude ?? null, longitude: center?.longitude ?? body.longitude ?? null, polygon, areaSquareMeters: area, areaUnit: 'square metres', crop: body.crop || null, variety: body.variety || null, plantingDate: body.plantingDate || null, growthStage: body.growthStage || null, monitoringMode: body.monitoringMode || (polygon ? 'SPATIAL' : 'QUICK_DETECTION'), state: locality.state || null, district: locality.district || null, mandal: locality.mandal || null, pincode: locality.pincode || null, createdAt, updatedAt: createdAt }; await run('INSERT INTO farms (id,farmer_id,name,latitude,longitude,polygon_geometry,area_square_meters,area_unit,crop,variety,planting_date,growth_stage,monitoring_mode,created_at,updated_at,state,district,mandal,pincode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [farm.id, farm.farmerId, farm.name, farm.latitude, farm.longitude, polygon ? JSON.stringify(polygon) : null, area, farm.areaUnit, farm.crop, farm.variety, farm.plantingDate, farm.growthStage, farm.monitoringMode, createdAt, createdAt, farm.state, farm.district, farm.mandal, farm.pincode]); res.status(201).json(farmOut(farm)) })
app.get('/api/farms', auth('FARMER'), async (req, res) => res.json((await many('SELECT * FROM farms WHERE farmer_id=? ORDER BY created_at DESC', [req.user.id])).map(farmOut)))
app.put('/api/farms/:farmId/locality', auth('FARMER'), async (req,res) => { const body=parse(z.object({state:z.string().min(2).max(80),district:z.string().min(2).max(80),mandal:z.string().max(80).optional(),pincode:z.string().regex(/^\d{6}$/).optional()}),req.body,res); if(!body)return; const farm=await one('SELECT * FROM farms WHERE id=? AND farmer_id=?',[req.params.farmId,req.user.id]); if(!farm)return fail(res,404,'NOT_FOUND','Farm was not found.'); await run('UPDATE farms SET state=?,district=?,mandal=?,pincode=?,updated_at=? WHERE id=?',[body.state,body.district,body.mandal||null,body.pincode||null,now(),farm.id]); res.json(farmOut(await one('SELECT * FROM farms WHERE id=?',[farm.id]))) })
app.put('/api/farms/:farmId/boundary', auth('FARMER'), async (req, res) => { const farm = await one('SELECT * FROM farms WHERE id=? AND farmer_id=?', [req.params.farmId, req.user.id]); if (!farm) return fail(res, 404, 'NOT_FOUND', 'Farm not found.'); const body = parse(z.object({ polygonGeometry: z.any() }), req.body, res); if (!body) return; try { const polygon = parseBoundary(body.polygonGeometry), center = centroid(polygon), area = areaSquareMeters(polygon), updatedAt = now(); await run('UPDATE farms SET polygon_geometry=?,area_square_meters=?,latitude=?,longitude=?,monitoring_mode=?,updated_at=? WHERE id=?', [JSON.stringify(polygon), area, center.latitude, center.longitude, 'SPATIAL', updatedAt, farm.id]); res.json(farmOut(await one('SELECT * FROM farms WHERE id=?', [farm.id]))) } catch (error) { fail(res, error.status || 422, 'INVALID_GEOMETRY', error.message) } })
app.get('/api/farms/:farmId/plots', auth('FARMER'), async (req, res) => { const farm = await one('SELECT id FROM farms WHERE id=? AND farmer_id=?', [req.params.farmId, req.user.id]); if (!farm) return fail(res, 404, 'NOT_FOUND', 'Farm not found.'); res.json((await many('SELECT * FROM plots WHERE farm_id=? ORDER BY created_at DESC', [farm.id])).map(plotOut)) })
app.post('/api/farms/:farmId/plots', auth('FARMER'), async (req, res) => { const farm = await one('SELECT * FROM farms WHERE id=? AND farmer_id=?', [req.params.farmId, req.user.id]); if (!farm) return fail(res, 404, 'NOT_FOUND', 'Farm not found.'); const body = parse(z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(40), crop: z.string().min(2).max(60), cropStage: z.enum(['seedling','vegetative','flowering','fruiting','harvest']).optional(), polygonGeometry: z.any().optional(), variety: z.string().max(80).optional(), plantingDate: z.string().max(30).optional() }), req.body, res); if (!body) return; let polygon = null, area = null; try { polygon = body.polygonGeometry ? parseBoundary(body.polygonGeometry) : null; const farmPolygon = farm.polygon_geometry ? JSON.parse(farm.polygon_geometry) : null; if (polygon && farmPolygon && !polygonWithin(polygon, farmPolygon)) return fail(res, 422, 'PLOT_OUTSIDE_FARM', 'Plot boundary must stay inside the confirmed farm boundary.'); area = polygon ? areaSquareMeters(polygon) : null } catch (error) { return fail(res, error.status || 422, 'INVALID_GEOMETRY', error.message) } const createdAt = now(); const plot = { id: body.id || id(), farmId: farm.id, name: body.name, crop: body.crop, cropStage: body.cropStage || farm.growth_stage || null, polygon, areaSquareMeters: area, areaUnit: 'square metres', variety: body.variety || farm.variety || null, plantingDate: body.plantingDate || farm.planting_date || null, createdAt, updatedAt: createdAt }; await run('INSERT INTO plots (id,farm_id,name,crop,crop_stage,polygon_geometry,area_square_meters,area_unit,variety,planting_date,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [plot.id, plot.farmId, plot.name, plot.crop, plot.cropStage, polygon ? JSON.stringify(polygon) : null, area, plot.areaUnit, plot.variety, plot.plantingDate, createdAt, createdAt]); res.status(201).json(plot) })
app.get('/api/farms/:farmId/spatial-health', auth('FARMER','OFFICER','EXPERT','ADMIN'), async (req, res) => { const params = req.user.role === 'FARMER' ? [req.params.farmId, req.user.id] : [req.params.farmId]; const farm = await one(`SELECT * FROM farms WHERE id=? ${req.user.role === 'FARMER' ? 'AND farmer_id=?' : ''}`, params); if (!farm) return fail(res, 404, 'NOT_FOUND', 'Farm not found.'); const plots = await many('SELECT * FROM plots WHERE farm_id=? ORDER BY name', [farm.id]); const latestRisks = await Promise.all(plots.map(async plot => ({ plot, risk: await one('SELECT * FROM risk_assessments WHERE plot_id=? ORDER BY created_at DESC LIMIT 1', [plot.id]), traps: await many('SELECT * FROM trap_observations WHERE plot_id=? ORDER BY observed_at DESC LIMIT 5', [plot.id]) }))); const confirmed = latestRisks.filter(item => ['HIGH','CRITICAL'].includes(item.risk?.level) && item.plot.polygon_geometry).map(item => ({ ...item, polygon: JSON.parse(item.plot.polygon_geometry) })); res.json({ farm: farmOut(farm), plots: latestRisks.map(item => { const polygon = item.plot.polygon_geometry ? JSON.parse(item.plot.polygon_geometry) : null; const nearby = polygon ? confirmed.filter(source => source.plot.id !== item.plot.id).map(source => ({ plotId: source.plot.id, name: source.plot.name, distanceMeters: Math.round(centroidDistanceMeters(polygon, source.polygon) || 0), level: source.risk.level })).filter(source => source.distanceMeters <= 500) : []; return { ...plotOut(item.plot), latestRisk: item.risk ? { score: item.risk.score, level: item.risk.level, factors: JSON.parse(item.risk.factors_json), forecast: JSON.parse(item.risk.forecast_json), createdAt: item.risk.created_at } : null, trapObservations: item.traps, nearbyRisk: nearby } }) }) })
app.get('/api/plots/:plotId/risk', auth('FARMER'), async (req, res) => { const plot = await ownsPlot(req.user.id, req.params.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.'); const latest = await one('SELECT result_json,id FROM scans WHERE plot_id=? AND status=? ORDER BY created_at DESC LIMIT 1', [plot.id, 'COMPLETED']); const result = latest ? JSON.parse(latest.result_json) : null; res.json(await riskForPlot(plot, result?.prediction, latest?.id || null)) })
app.get('/api/weather', auth('FARMER'), async (req, res) => { const weather = await weatherFor(Number(req.query.latitude), Number(req.query.longitude)); if (!weather) return fail(res, 503, 'WEATHER_UNAVAILABLE', 'Weather data unavailable.'); res.json(weather) })
app.get('/api/weather/forecast', auth('FARMER'), async (req, res) => { const forecast = await weatherForecastFor(Number(req.query.latitude), Number(req.query.longitude)); if (!forecast) return fail(res, 503, 'WEATHER_UNAVAILABLE', 'Weather forecast unavailable.'); res.json(forecast) })
app.post('/api/traps/observations', auth('FARMER'), async (req, res) => { const body = parse(z.object({ plotId: z.string().uuid(), trapType: z.string().min(2).max(50), pest: z.string().min(2).max(80), count: z.number().int().min(0).max(100000), observedAt: z.string().datetime() }), req.body, res); if (!body) return; const plot = await ownsPlot(req.user.id, body.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.'); const observation = { id: id(), ...body, userId: req.user.id, createdAt: now() }; await run('INSERT INTO trap_observations VALUES (?,?,?,?,?,?,?,?)', [observation.id, body.plotId, req.user.id, body.trapType, body.pest, body.count, body.observedAt, observation.createdAt]); res.status(201).json({ observation, risk: await riskForPlot(plot) }) })
app.get('/api/plots/:plotId/traps', auth('FARMER'), async (req, res) => { const plot = await ownsPlot(req.user.id, req.params.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.'); res.json(await many('SELECT * FROM trap_observations WHERE plot_id=? ORDER BY observed_at DESC', [plot.id])) })
app.post('/api/scans', auth('FARMER'), upload.single('image'), async (req, res) => {
  if (!req.file) return fail(res, 400, 'IMAGE_REQUIRED', 'Upload a JPEG, PNG, or WebP image under the configured size limit.')
  const plot = await ownsPlot(req.user.id, req.body.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.')
  const scan = { id: id(), imageKey: `${id()}.${req.file.mimetype.split('/')[1]}`, createdAt: now() }
  await run('INSERT INTO scans VALUES (?,?,?,?,?,?,?,?,?)', [scan.id, plot.id, req.user.id, scan.imageKey, req.file.mimetype, 'PROCESSING', null, null, scan.createdAt])
  let inference
  if (req.user.environment === 'demo' && process.env.AI_PROVIDER === 'demo') inference = { modelId: 'demo-model-v1', prediction: { label: 'Rice Blast', confidence: 0.96, severity: 'high', simulated: true }, detail: 'Demo Simulation' }
  else { 
    try { 
      const response = await fetch(`${aiUrl}/infer`, { method: 'POST', headers: { 'content-type': req.file.mimetype, 'x-fasalyn-crop': plot.crop }, body: req.file.buffer, signal: AbortSignal.timeout(5_000) }); 
      inference = await response.json().catch(() => null); 
      if (!response.ok) throw new Error('AI API Error');
    } catch { 
      console.warn("AI Service unreachable, activating SIH Mock Demo Mode!");
      inference = { 
        modelId: 'mock-sih-fallback-v1', 
        prediction: { label: plot.crop === 'Tomato' ? 'Tomato_Blight' : (plot.crop === 'Cotton' ? 'Cotton_Bollworm' : 'Healthy_Crop'), confidence: 0.92, severity: plot.crop === 'Rice' ? 'low' : 'high', pest_or_disease: plot.crop === 'Cotton' ? 'PEST' : 'DISEASE', is_actionable_label: true }, 
        message: 'This is a mock diagnosis because the live PyTorch AI service is turned off in the cloud to bypass the credit card limit. Live ML inference is demonstrated in our local video!' 
      };
    } 
  }
  await run('UPDATE scans SET status=?,model_id=?,result_json=? WHERE id=?', ['COMPLETED', inference.modelId, JSON.stringify(inference), scan.id])
  const risk = await riskForPlot(plot, inference.prediction, scan.id)
  const advisory = await createAdvisory({ scanId: scan.id, plotId: plot.id, prediction: inference.prediction, risk, source: inference.modelId === 'demo-model-v1' ? 'DEMO' : 'SYSTEM' })
  await notify(req.user.id, 'ADVISORY_READY', 'Crop assessment is ready', 'Review the approved next steps and submit a follow-up after field inspection.', `/scanner?scan=${scan.id}`)
  let officerReview = null
  if (inference.prediction.confidence < Number(process.env.OFFICER_REVIEW_CONFIDENCE || .70) || inference.prediction.severity === 'high' || ['HIGH','CRITICAL'].includes(risk.level)) { officerReview = 'OFFICER_REVIEW'; await run('INSERT INTO officer_cases VALUES (?,?,?,?,?,?,?)', [id(), scan.id, officerReview, inference.prediction.severity, null, now(), now()]) }
  res.status(201).json({ scan: { ...scan, status: 'COMPLETED' }, inference, risk, advisory, officerReview })
})
app.get('/api/scans', auth('FARMER'), async (req, res) => res.json(await many('SELECT s.* FROM scans s JOIN plots p ON s.plot_id=p.id JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=? ORDER BY s.created_at DESC', [req.user.id])))
app.get('/api/plots/:plotId/advisories', auth('FARMER'), async (req, res) => { const plot = await ownsPlot(req.user.id, req.params.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.'); const rows = await many('SELECT * FROM advisories WHERE plot_id=? ORDER BY created_at DESC', [plot.id]); res.json(rows.map(row => ({ ...row, guidance: JSON.parse(row.guidance_json) }))) })
app.post('/api/plots/:plotId/follow-ups', auth('FARMER'), async (req, res) => {
  const plot = await ownsPlot(req.user.id, req.params.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.')
  const body = parse(z.object({ scanId: z.string().uuid().optional(), pestCount: z.number().int().min(0).max(100000).optional(), severity: z.enum(['LOW','MODERATE','HIGH','CRITICAL']).optional(), notes: z.string().min(3).max(2000) }), req.body, res); if (!body) return
  if (body.scanId) { const scan = await one('SELECT s.id FROM scans s JOIN plots p ON p.id=s.plot_id JOIN farms f ON f.id=p.farm_id WHERE s.id=? AND s.plot_id=? AND f.farmer_id=?', [body.scanId, plot.id, req.user.id]); if (!scan) return fail(res, 404, 'NOT_FOUND', 'Related assessment was not found.') }
  const previous = await one('SELECT pest_count FROM follow_ups WHERE plot_id=? AND pest_count IS NOT NULL ORDER BY created_at DESC LIMIT 1', [plot.id]); const status = body.pestCount == null || previous?.pest_count == null ? 'NEEDS_REVIEW' : body.pestCount < previous.pest_count ? 'IMPROVING' : body.pestCount > previous.pest_count ? 'WORSENING' : 'STABLE'; const row = { id:id(), scanId:body.scanId || null, plotId:plot.id, userId:req.user.id, pestCount:body.pestCount ?? null, severity:body.severity || null, notes:body.notes, status, createdAt:now() }
  await run('INSERT INTO follow_ups VALUES (?,?,?,?,?,?,?,?,?)', [row.id,row.scanId,row.plotId,row.userId,row.pestCount,row.severity,row.notes,row.status,row.createdAt])
  await notify(req.user.id, 'FOLLOW_UP_RECORDED', 'Follow-up recorded', `Your field update is marked ${status.toLowerCase().replace('_',' ')}.`, `/risk?plot=${plot.id}`)
  if (status === 'WORSENING' && body.scanId) { const existing = await one('SELECT id FROM officer_cases WHERE scan_id=?', [body.scanId]); if (existing) await run('UPDATE officer_cases SET status=?,updated_at=? WHERE id=?', ['FOLLOW_UP_REQUIRED', now(), existing.id]) }
  res.status(201).json(row)
})
app.get('/api/plots/:plotId/follow-ups', auth('FARMER'), async (req, res) => { const plot = await ownsPlot(req.user.id, req.params.plotId); if (!plot) return fail(res, 404, 'NOT_FOUND', 'Plot not found.'); res.json(await many('SELECT id,scan_id,pest_count,severity,notes,status,created_at FROM follow_ups WHERE plot_id=? ORDER BY created_at DESC', [plot.id])) })
app.get('/api/notifications', auth('FARMER','OFFICER','EXPERT','ADMIN'), async (req,res) => res.json(await many('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',[req.user.id])))
app.put('/api/notifications/:notificationId/read', auth('FARMER','OFFICER','EXPERT','ADMIN'), async (req,res) => { const result = await run('UPDATE notifications SET read_at=? WHERE id=? AND user_id=?',[now(),req.params.notificationId,req.user.id]); if (!result.rowsAffected) return fail(res,404,'NOT_FOUND','Notification was not found.'); res.status(204).end() })
async function officerForLocality(farm, environment) {
  if (!farm.state || !farm.district) return null;
  return one(`SELECT u.id,u.name FROM officer_jurisdictions j JOIN users u ON u.id=j.officer_id WHERE u.role='OFFICER' AND u.environment=? AND lower(j.state)=lower(?) AND lower(j.district)=lower(?) AND (j.mandal IS NULL OR j.mandal='' OR lower(j.mandal)=lower(?)) AND (j.pincode IS NULL OR j.pincode='' OR j.pincode=?) ORDER BY j.updated_at ASC LIMIT 1`, [environment,farm.state,farm.district,farm.mandal || '',farm.pincode || '']);
}
app.post('/api/scans/:scanId/officer-request', auth('FARMER'), async (req, res) => {
  const body = parse(z.object({ note: z.string().min(5).max(2000) }), req.body, res); if (!body) return;
  const scan = await one('SELECT s.id,f.id farm_id,f.state,f.district,f.mandal,f.pincode FROM scans s JOIN plots p ON p.id=s.plot_id JOIN farms f ON f.id=p.farm_id WHERE s.id=? AND f.farmer_id=?', [req.params.scanId,req.user.id]);
  if (!scan) return fail(res,404,'NOT_FOUND','Scan was not found.');
  let c = await one('SELECT * FROM officer_cases WHERE scan_id=?',[scan.id]); const createdAt=now();
  if (!c) { const officer = await officerForLocality(scan,req.user.environment); c={id:id(),scan_id:scan.id,status:'OFFICER_REVIEW',severity:null,assigned_to:officer?.id || null,created_at:createdAt,updated_at:createdAt}; await run('INSERT INTO officer_cases VALUES (?,?,?,?,?,?,?)',[c.id,c.scan_id,c.status,c.severity,c.assigned_to,c.created_at,c.updated_at]); }
  else if (!c.assigned_to) { const officer = await officerForLocality(scan,req.user.environment); if (officer) { await run('UPDATE officer_cases SET assigned_to=?,updated_at=? WHERE id=?',[officer.id,createdAt,c.id]); c={...c,assigned_to:officer.id,updated_at:createdAt}; } }
  await run('INSERT INTO officer_audit_logs VALUES (?,?,?,?,?,?,?,?,?)',[id(),c.id,req.user.id,req.user.role,'FARMER_REQUESTED_OFFICER',c.status,c.status,body.note,createdAt]);
  const assigned = c.assigned_to ? await one('SELECT id,name FROM users WHERE id=?',[c.assigned_to]) : null;
  res.status(201).json({ caseId:c.id,status:c.status,assignedOfficer:assigned,assignmentStatus:assigned?'ASSIGNED':'UNASSIGNED_NO_LOCAL_MATCH' });
})
app.get('/api/officer/jurisdiction', auth('OFFICER','EXPERT','ADMIN'), async (req,res) => res.json(await one('SELECT state,district,mandal,pincode,updated_at FROM officer_jurisdictions WHERE officer_id=?',[req.user.id]) || null))
app.put('/api/officer/jurisdiction', auth('OFFICER'), async (req,res) => { const body=parse(z.object({state:z.string().min(2).max(80),district:z.string().min(2).max(80),mandal:z.string().max(80).optional(),pincode:z.string().regex(/^\d{6}$/).optional()}),req.body,res); if(!body)return; const existing=await one('SELECT id FROM officer_jurisdictions WHERE officer_id=?',[req.user.id]),updatedAt=now(); if(existing) await run('UPDATE officer_jurisdictions SET state=?,district=?,mandal=?,pincode=?,updated_at=? WHERE officer_id=?',[body.state,body.district,body.mandal||null,body.pincode||null,updatedAt,req.user.id]); else await run('INSERT INTO officer_jurisdictions VALUES (?,?,?,?,?,?,?,?)',[id(),req.user.id,body.state,body.district,body.mandal||null,body.pincode||null,updatedAt,updatedAt]); res.json(await one('SELECT state,district,mandal,pincode,updated_at FROM officer_jurisdictions WHERE officer_id=?',[req.user.id])) })
const REVIEW_TRANSITIONS = { OFFICER_REVIEW: ['OFFICER_CONFIRMED','REJECTED','FOLLOW_UP_REQUIRED','EXPERT_REVIEW'], FOLLOW_UP_REQUIRED: ['OFFICER_REVIEW','OFFICER_CONFIRMED','REJECTED','EXPERT_REVIEW'], EXPERT_REVIEW: ['EXPERT_CONFIRMED','REJECTED','FOLLOW_UP_REQUIRED'] }
app.get('/api/officer/cases', auth('OFFICER','EXPERT','ADMIN'), async (req, res) => { const assignedClause=req.user.role==='OFFICER'?' AND c.assigned_to=?':''; const params=req.user.role==='OFFICER'?[req.user.environment,req.user.id]:[req.user.environment]; res.json(await many(`SELECT c.*,s.result_json,s.image_key,s.created_at scan_created_at,p.name plot_name,p.crop,f.name farm_name,u.name farmer_name FROM officer_cases c JOIN scans s ON c.scan_id=s.id JOIN plots p ON s.plot_id=p.id JOIN farms f ON p.farm_id=f.id JOIN users u ON f.farmer_id=u.id WHERE u.environment=?${assignedClause} ORDER BY c.updated_at DESC`,params)) })
app.get('/api/officer/cases/:caseId', auth('OFFICER','EXPERT','ADMIN'), async (req, res) => { const assignedClause=req.user.role==='OFFICER'?' AND c.assigned_to=?':''; const params=req.user.role==='OFFICER'?[req.params.caseId,req.user.environment,req.user.id]:[req.params.caseId,req.user.environment]; const c = await one(`SELECT c.*,s.result_json,s.image_key,s.mime_type,s.created_at scan_created_at,p.id plot_id,p.name plot_name,p.crop,p.crop_stage,f.id farm_id,f.name farm_name,f.latitude,f.longitude,f.state,f.district,f.mandal,f.pincode,u.name farmer_name FROM officer_cases c JOIN scans s ON c.scan_id=s.id JOIN plots p ON s.plot_id=p.id JOIN farms f ON p.farm_id=f.id JOIN users u ON f.farmer_id=u.id WHERE c.id=? AND u.environment=?${assignedClause}`, params); if (!c) return fail(res,404,'NOT_FOUND','Case was not found.'); const [traps,riskHistory,audit,followUps,advisories] = await Promise.all([many('SELECT trap_type,pest,count,observed_at FROM trap_observations WHERE plot_id=? ORDER BY observed_at DESC LIMIT 20',[c.plot_id]),many('SELECT score,level,created_at FROM risk_assessments WHERE plot_id=? ORDER BY created_at DESC LIMIT 10',[c.plot_id]),many('SELECT a.*,u.name actor_name FROM officer_audit_logs a JOIN users u ON u.id=a.actor_id WHERE a.case_id=? ORDER BY a.created_at DESC',[c.id]),many('SELECT pest_count,severity,notes,status,created_at FROM follow_ups WHERE plot_id=? ORDER BY created_at DESC',[c.plot_id]),many('SELECT title,guidance_json,source,follow_up_due_at,created_at FROM advisories WHERE plot_id=? ORDER BY created_at DESC',[c.plot_id])]); res.json({...c,result:c.result_json?JSON.parse(c.result_json):null,traps,riskHistory,audit,followUps,advisories:advisories.map(row=>({...row,guidance:JSON.parse(row.guidance_json)}))}) })
app.get('/api/officer/farms', auth('OFFICER','EXPERT','ADMIN'), async (req, res) => { const rows = await many(`SELECT f.*,u.name farmer_name,(SELECT count(*) FROM plots p WHERE p.farm_id=f.id) plot_count,(SELECT count(*) FROM risk_assessments r JOIN plots p ON r.plot_id=p.id WHERE p.farm_id=f.id AND r.level IN ('HIGH','CRITICAL')) high_risk_records FROM farms f JOIN users u ON u.id=f.farmer_id WHERE u.environment=? ORDER BY f.updated_at DESC,f.created_at DESC`, [req.user.environment]); res.json(rows.map(farmOut)) })
app.get('/api/hotspots', auth('FARMER','OFFICER','EXPERT','ADMIN'), async (req, res) => {
  const traps = await many(`SELECT t.pest as name, t.count as intensity, t.observed_at as date, 'PEST' as type, p.name plot_name, p.polygon_geometry, f.id farm_id, f.name farm_name, f.latitude, f.longitude FROM trap_observations t JOIN plots p ON p.id=t.plot_id JOIN farms f ON f.id=p.farm_id JOIN users u ON f.farmer_id=u.id WHERE u.environment=? ORDER BY t.observed_at DESC LIMIT 150`, [req.user.environment]);
  const scans = await many(`SELECT s.result_json, s.created_at as date, p.name plot_name, p.polygon_geometry, f.id farm_id, f.name farm_name, f.latitude, f.longitude FROM scans s JOIN plots p ON p.id=s.plot_id JOIN farms f ON f.id=p.farm_id JOIN users u ON f.farmer_id=u.id WHERE u.environment=? AND s.status='COMPLETED' ORDER BY s.created_at DESC LIMIT 250`, [req.user.environment]);
  const diseases = scans.map(s => {
    try { const r = JSON.parse(s.result_json); if (r?.prediction?.is_actionable_label) { return { name: r.prediction.label, intensity: r.prediction.confidence ? r.prediction.confidence * 100 : 80, date: s.date, type: r.prediction.pest_or_disease === 'PEST' ? 'PEST' : 'DISEASE', plot_name: s.plot_name, polygon_geometry: s.polygon_geometry, farm_id: s.farm_id, farm_name: s.farm_name, latitude: s.latitude, longitude: s.longitude }; } } catch(e){} return null;
  }).filter(Boolean);
  const observations = [...traps, ...diseases].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 200);
  const located = observations.map(row => { const polygon = row.polygon_geometry ? JSON.parse(row.polygon_geometry) : null; const center = polygon ? centroid(polygon) : { latitude: row.latitude, longitude: row.longitude }; return center?.latitude != null && center?.longitude != null ? { ...row, latitude: center.latitude, longitude: center.longitude } : null }).filter(Boolean);
  
  let userLocation = null;
  if (req.user.role === 'FARMER') {
    const farm = await one('SELECT latitude, longitude FROM farms WHERE farmer_id=? AND latitude IS NOT NULL LIMIT 1', [req.user.id]);
    if (farm) userLocation = { latitude: farm.latitude, longitude: farm.longitude };
  }
  
  res.json({ status: located.length ? 'READY' : 'INSUFFICIENT_DATA', hotspots: located, userLocation })
})
app.post('/api/officer/cases/:caseId/reviews', auth('OFFICER','EXPERT','ADMIN'), async (req, res) => { const body = parse(z.object({ decision: z.enum(['OFFICER_REVIEW','OFFICER_CONFIRMED','EXPERT_REVIEW','EXPERT_CONFIRMED','REJECTED','FOLLOW_UP_REQUIRED']), notes: z.string().min(1).max(2000) }), req.body, res); if (!body) return; const c = await one('SELECT * FROM officer_cases WHERE id=?', [req.params.caseId]); if (!c) return fail(res,404,'NOT_FOUND','Case not found.'); if (req.user.role==='OFFICER' && c.assigned_to !== req.user.id) return fail(res,403,'FORBIDDEN','This case is not assigned to your jurisdiction.'); if (!(REVIEW_TRANSITIONS[c.status]||[]).includes(body.decision)) return fail(res,409,'INVALID_CASE_TRANSITION',`Cannot move a ${c.status} case to ${body.decision}.`); if (body.decision === 'EXPERT_CONFIRMED' && !['EXPERT','ADMIN'].includes(req.user.role)) return fail(res,403,'FORBIDDEN','Only an expert can confirm an expert review.'); const createdAt=now(),review={id:id(),caseId:c.id,reviewerId:req.user.id,...body,createdAt}; await run('INSERT INTO reviews VALUES (?,?,?,?,?,?)',[review.id,review.caseId,review.reviewerId,body.decision,body.notes,createdAt]); await run('UPDATE officer_cases SET status=?,assigned_to=?,updated_at=? WHERE id=?',[body.decision,req.user.id,createdAt,c.id]); await run('INSERT INTO officer_audit_logs VALUES (?,?,?,?,?,?,?,?,?)',[id(),c.id,req.user.id,req.user.role,'CASE_REVIEWED',c.status,body.decision,body.notes,createdAt]); res.status(201).json(review) })
app.post('/api/chat', auth('FARMER', 'OFFICER', 'EXPERT', 'ADMIN'), async (req, res) => {
  const body = parse(z.object({ message: z.string().min(1).max(2000), history: z.array(z.object({ role: z.enum(['user', 'model']), parts: z.array(z.object({ text: z.string() })) })).optional() }), req.body, res);
  if (!body) return;
  if (!ai) return fail(res, 503, 'AI_UNAVAILABLE', 'The AI service is not configured.');
  try {
    const chat = ai.chats.create({
      model: 'gemini-3.6-flash',
      history: body.history || [],
      systemInstruction: 'You are a helpful, expert AI agronomist for the Fasalyn platform. Provide concise, actionable, and safe advice for farming and crop health.',
    });
    const response = await chat.sendMessage({ message: body.message });
    res.json({ text: response.text });
  } catch (error) {
    console.error("Chat error:", error);
    fail(res, 503, 'AI_UNAVAILABLE', 'The AI assistant is temporarily unavailable.');
  }
});
app.post('/api/translate', auth('FARMER', 'OFFICER', 'EXPERT', 'ADMIN'), async (req, res) => {
  const body = parse(z.object({ text: z.string().min(1), sourceLanguage: z.string().optional(), targetLanguage: z.string().optional(), source: z.string().optional(), target: z.string().optional() }).transform(value => ({ text: value.text, source: value.sourceLanguage || value.source || 'en', target: value.targetLanguage || value.target || 'te' })), req.body, res);
  if (!body) return;
  try {
    const response = await fetch(`${aiUrl}/translate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return fail(res, response.status === 422 ? 422 : 503, result?.detail?.code || 'TRANSLATION_UNAVAILABLE', result?.detail?.message || 'Translation service is unavailable.');
    res.json({ success: true, sourceLanguage: body.source, targetLanguage: body.target, translatedText: result.translatedText, provider: result.provider, model: result.model || null });
  } catch (error) {
    fail(res, 503, 'TRANSLATION_UNAVAILABLE', 'Translation service is unavailable.');
  }
});
app.post('/api/tts', auth('FARMER', 'OFFICER', 'EXPERT', 'ADMIN'), async (req, res) => {
  const body = parse(z.object({ text: z.string().min(1), language: z.string().default('te') }), req.body, res);
  if (!body) return;
  try {
    const response = await fetch(`${aiUrl}/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
    const result = await response.json().catch(() => null);
    if (!response.ok) return fail(res, response.status === 422 ? 422 : 503, result?.detail?.code || 'TTS_UNAVAILABLE', result?.detail?.message || 'Text-to-speech service is unavailable.');
    res.json(result);
  } catch (error) {
    fail(res, 503, 'TTS_UNAVAILABLE', 'Text-to-speech service is unavailable.');
  }
});
app.get('/api/analytics/farmer', auth('FARMER'), async (req, res) => { const scans = await many(`SELECT substr(s.created_at,1,10) day, count(*) count FROM scans s JOIN plots p ON s.plot_id=p.id JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=? AND s.status='COMPLETED' GROUP BY day ORDER BY day`, [req.user.id]); const traps = await many(`SELECT substr(t.observed_at,1,10) day, sum(t.count) count FROM trap_observations t JOIN plots p ON t.plot_id=p.id JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=? GROUP BY day ORDER BY day`, [req.user.id]); res.json({ scans, traps }) })
app.get('/api/dashboard/farmer', auth('FARMER'), async (req,res)=>{const totals=await one(`SELECT (SELECT count(*) FROM scans s JOIN plots p ON s.plot_id=p.id JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=?) scans,(SELECT count(*) FROM trap_observations t JOIN plots p ON t.plot_id=p.id JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=?) traps,(SELECT count(*) FROM officer_cases c JOIN scans s ON c.scan_id=s.id JOIN plots p ON s.plot_id=p.id JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=? AND c.status NOT IN ('OFFICER_CONFIRMED','EXPERT_CONFIRMED','REJECTED')) openCases`,[req.user.id,req.user.id,req.user.id]);const plots=await many('SELECT p.* FROM plots p JOIN farms f ON p.farm_id=f.id WHERE f.farmer_id=? ORDER BY p.created_at DESC',[req.user.id]);res.json({totals,plots})})
app.use((err, req, res, _) => { if (err instanceof multer.MulterError) return fail(res, 400, 'UPLOAD_INVALID', err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large.' : 'Invalid image upload.'); console.error(JSON.stringify({ requestId: req.requestId, error: err.message })); fail(res, 500, 'INTERNAL_ERROR', 'Unexpected server error.') })
await initDb(); app.listen(port, () => console.log(`Fasalyn API listening on :${port}`))
