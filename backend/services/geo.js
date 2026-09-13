const EARTH_RADIUS_METERS = 6371008.8

export function normalizePolygon(input) {
  if (!input) return null
  const polygon = typeof input === 'string' ? JSON.parse(input) : input
  if (polygon?.type !== 'Polygon' || !Array.isArray(polygon.coordinates)) throw new Error('Boundary must be a GeoJSON Polygon.')
  const ring = polygon.coordinates[0]
  if (!Array.isArray(ring) || ring.length < 4) throw new Error('Boundary needs at least three points and a closing point.')
  const points = ring.map(point => {
    if (!Array.isArray(point) || point.length < 2) throw new Error('Each boundary point needs longitude and latitude.')
    const lon = Number(point[0]), lat = Number(point[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error('Boundary contains invalid coordinates.')
    return [lon, lat]
  })
  const first = points[0], last = points[points.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first])
  const unique = new Set(points.slice(0, -1).map(point => point.join(',')))
  if (unique.size < 3) throw new Error('Boundary needs at least three unique points.')
  if (hasSelfIntersection(points)) throw new Error('Boundary lines cannot cross each other.')
  return { type: 'Polygon', coordinates: [points] }
}

export function areaSquareMeters(polygon) {
  if (!polygon) return null
  const ring = polygon.coordinates[0]
  const originLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
  const projected = ring.map(([lon, lat]) => [
    toRadians(lon) * EARTH_RADIUS_METERS * Math.cos(toRadians(originLat)),
    toRadians(lat) * EARTH_RADIUS_METERS
  ])
  let area = 0
  for (let index = 0; index < projected.length - 1; index += 1) {
    area += projected[index][0] * projected[index + 1][1] - projected[index + 1][0] * projected[index][1]
  }
  return Math.round(Math.abs(area) / 2)
}

export function centroid(polygon) {
  if (!polygon) return null
  const ring = polygon.coordinates[0].slice(0, -1)
  return {
    longitude: ring.reduce((sum, point) => sum + point[0], 0) / ring.length,
    latitude: ring.reduce((sum, point) => sum + point[1], 0) / ring.length
  }
}

export function polygonWithin(inner, outer) {
  if (!inner || !outer) return true
  return inner.coordinates[0].slice(0, -1).every(point => pointInPolygon(point, outer))
}

export function centroidDistanceMeters(a, b) {
  const ca = centroid(a), cb = centroid(b)
  if (!ca || !cb) return null
  const lat1 = toRadians(ca.latitude), lat2 = toRadians(cb.latitude)
  const dlat = toRadians(cb.latitude - ca.latitude), dlon = toRadians(cb.longitude - ca.longitude)
  const value = Math.sin(dlat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function pointInPolygon(point, polygon) {
  const [x, y] = point
  const ring = polygon.coordinates[0]
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

function hasSelfIntersection(points) {
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length - 1; j += 1) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === points.length - 2)) continue
      if (segmentsIntersect(points[i], points[i + 1], points[j], points[j + 1])) return true
    }
  }
  return false
}

function segmentsIntersect(a, b, c, d) {
  const direction = (p, q, r) => (r[0] - p[0]) * (q[1] - p[1]) - (q[0] - p[0]) * (r[1] - p[1])
  const d1 = direction(c, d, a), d2 = direction(c, d, b), d3 = direction(a, b, c), d4 = direction(a, b, d)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

function toRadians(value) {
  return value * Math.PI / 180
}
