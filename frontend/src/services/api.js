const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
export async function getDemoFarm() {
  const response = await fetch(`${API}/farms/demo`)
  if (!response.ok) throw new Error('Farm data is temporarily unavailable')
  const farm = await response.json()
  return farm.plots.map(({ id, status, risk }) => [id, status, risk])
}
