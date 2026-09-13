// Deterministic, explainable risk calculation. Missing observations are not imputed.
export function assessRisk({ detection, trapTrend, weather, cropStage, nearbyConfirmed = 0 }) {
  const factors = []
  let score = 0
  if (detection?.confidence >= 0.65) { const value = Math.round(detection.confidence * 35); score += value; factors.push({ signal: 'model_detection', points: value, detail: `${detection.label} model confidence ${Math.round(detection.confidence * 100)}%` }) }
  if (trapTrend?.latest != null) { const value = Math.min(20, Math.round(trapTrend.latest)); score += value; factors.push({ signal: 'trap_count', points: value, detail: `${trapTrend.latest} pests in latest trap observation` }); if (trapTrend.change > 0) { score += 8; factors.push({ signal: 'trap_trend', points: 8, detail: `trap count increased by ${trapTrend.change}` }) } }
  if (weather?.humidity != null) { const value = weather.humidity >= 80 ? 15 : weather.humidity >= 65 ? 8 : 0; score += value; if (value) factors.push({ signal: 'humidity', points: value, detail: `${weather.humidity}% humidity from weather provider` }) }
  if (cropStage === 'flowering') { score += 5; factors.push({ signal: 'crop_stage', points: 5, detail: 'flowering stage' }) }
  if (nearbyConfirmed) { const value = Math.min(17, nearbyConfirmed * 4); score += value; factors.push({ signal: 'nearby_confirmed_cases', points: value, detail: `${nearbyConfirmed} confirmed nearby cases` }) }
  const missing = []; if (!weather) missing.push('weather'); if (!trapTrend) missing.push('trap history'); if (!detection) missing.push('model detection')
  if (missing.length === 3) return { score: null, level: 'INSUFFICIENT_DATA', factors, missing, forecast: null }
  score = Math.min(100, score)
  // Prototype-only thresholds: Low 0–24, Moderate 25–49, High 50–74,
  // Critical 75–100. These are configurable product parameters, not
  // universal agricultural standards or a guaranteed spread time.
  return { score, level: score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MODERATE' : 'LOW', factors, missing, forecast: { windowHours: score >= 50 ? 72 : 120, statement: 'Predicted Pest Risk is an estimate, not a guaranteed spread time or diagnosis.' } }
}
