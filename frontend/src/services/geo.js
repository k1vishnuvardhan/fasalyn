const EARTH_RADIUS_METERS = 6371008.8

export function closeRing(points) {
  if (points.length < 3) return points
  const first = points[0], last = points[points.length - 1]
  return first[0] === last[0] && first[1] === last[1] ? points : [...points, first]
}

export function toPolygon(points) {
  return { type: 'Polygon', coordinates: [closeRing(points)] }
}

export function areaSquareMeters(polygon) {
  const ring = polygon?.coordinates?.[0]
  if (!ring?.length) return 0
  const originLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
  const projected = ring.map(([lon, lat]) => [
    toRadians(lon) * EARTH_RADIUS_METERS * Math.cos(toRadians(originLat)),
    toRadians(lat) * EARTH_RADIUS_METERS
  ])
  let area = 0
  for (let index = 0; index < projected.length - 1; index += 1) area += projected[index][0] * projected[index + 1][1] - projected[index + 1][0] * projected[index][1]
  return Math.round(Math.abs(area) / 2)
}

export function formatArea(squareMeters) {
  if (!squareMeters) return 'Draw at least three points'
  if (squareMeters >= 10000) return `${(squareMeters / 10000).toFixed(2)} hectares`
  if (squareMeters >= 4046.856) return `${(squareMeters / 4046.856).toFixed(2)} acres`
  return `${squareMeters.toLocaleString()} square metres`
}

function toRadians(value) {
  return value * Math.PI / 180
}
