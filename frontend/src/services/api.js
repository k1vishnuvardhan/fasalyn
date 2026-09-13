const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
function error(payload, fallback) { return payload?.error?.message || payload?.detail?.message || payload?.detail || fallback }
async function request(path, options = {}) { const response = await fetch(`${API}${path}`, options); const payload = await response.json().catch(() => null); if (!response.ok) throw new Error(error(payload, 'The request could not be completed.')); return payload }
export function authHeaders() { const token = localStorage.getItem('fasalyn-token'); return token ? { Authorization: `Bearer ${token}` } : {} }
export function isSignedIn() { return Boolean(localStorage.getItem('fasalyn-token')) }
export function signOut() { localStorage.removeItem('fasalyn-token');localStorage.removeItem('fasalyn-user');localStorage.removeItem('fasalyn-default-plot') }
export async function uploadScan({ plotId, file }) { const data = new FormData(); data.append('plotId', plotId); data.append('image', file); return request('/scans', { method: 'POST', headers: authHeaders(), body: data }) }
export async function getFarms() { return request('/farms', { headers: authHeaders() }) }
export async function getPlots(farmId) { return request(`/farms/${farmId}/plots`, { headers: authHeaders() }) }
export async function getMapConfig() { return request('/map/config', { headers: authHeaders() }) }
export async function saveFarmBoundary(farmId, polygonGeometry) { return request(`/farms/${farmId}/boundary`, { method: 'PUT', headers: {...authHeaders(),'content-type':'application/json'}, body: JSON.stringify({ polygonGeometry }) }) }
export async function getSpatialHealth(farmId) { return request(`/farms/${farmId}/spatial-health`, { headers: authHeaders() }) }
export async function getRisk(plotId) { return request(`/plots/${plotId}/risk`, { headers: authHeaders() }) }
export async function getTraps(plotId) { return request(`/plots/${plotId}/traps`, { headers: authHeaders() }) }
export async function saveTrap(data) { return request('/traps/observations', { method:'POST', headers:{...authHeaders(),'content-type':'application/json'},body:JSON.stringify(data) }) }
export async function getAnalytics() { return request('/analytics/farmer',{headers:authHeaders()}) }
export async function getDashboard() { return request('/dashboard/farmer',{headers:authHeaders()}) }
export async function getScans() { return request('/scans',{headers:authHeaders()}) }
export async function getOfficerCases() { return request('/officer/cases',{headers:authHeaders()}) }
export async function getOfficerFarms() { return request('/officer/farms',{headers:authHeaders()}) }
export async function getOfficerHotspots() { return request('/officer/hotspots',{headers:authHeaders()}) }
export async function registerAccount(data) { return request('/auth/register', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(data) }) }
export async function loginAccount(data) { return request('/auth/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(data) }) }
export async function createFarm(data) { return request('/farms', { method: 'POST', headers: {...authHeaders(),'content-type':'application/json'}, body: JSON.stringify(data) }) }
export async function createPlot(farmId, data) { return request(`/farms/${farmId}/plots`, { method: 'POST', headers: {...authHeaders(),'content-type':'application/json'}, body: JSON.stringify(data) }) }
