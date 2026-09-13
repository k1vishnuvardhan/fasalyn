import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import {useEffect,useMemo,useRef} from 'react'
import {toPolygon} from '../services/geo'

const fallbackConfig = {
  standardTiles: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satelliteTiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  attribution: { standard: '© OpenStreetMap contributors', satellite: 'Tiles © Esri' }
}

export default function FarmBoundaryMap({points,onPointsChange,confirmedPolygon,plots=[],selectedPlotId,onSelectPlot,mode='standard',drawing=true,config=fallbackConfig}) {
  const root = useRef(null), map = useRef(null), tile = useRef(null), boundary = useRef(null), markerLayer = useRef(null), plotLayer = useRef(null)
  const center = useMemo(() => centerFrom(points, confirmedPolygon, plots), [points, confirmedPolygon, plots])
  const onPointsChangeRef = useRef(onPointsChange), drawingRef = useRef(drawing)

  useEffect(() => {
    if (!root.current || map.current) return
    map.current = L.map(root.current, { zoomControl: true, tap: true }).setView(center, 16)
    markerLayer.current = L.layerGroup().addTo(map.current)
    plotLayer.current = L.layerGroup().addTo(map.current)
    map.current.on('click', event => {
      if (!drawingRef.current) return
      onPointsChangeRef.current([...pointsRef.current, [Number(event.latlng.lng.toFixed(7)), Number(event.latlng.lat.toFixed(7))]])
    })
    setTimeout(() => map.current?.invalidateSize(), 80)
    return () => { map.current?.remove(); map.current = null }
  }, [])

  const pointsRef = useRef(points)
  useEffect(() => { pointsRef.current = points }, [points])
  useEffect(() => { onPointsChangeRef.current = onPointsChange; drawingRef.current = drawing }, [onPointsChange, drawing])

  useEffect(() => {
    if (!map.current) return
    tile.current?.remove()
    const url = mode === 'satellite' ? config.satelliteTiles : config.standardTiles
    const attribution = mode === 'satellite' ? config.attribution?.satellite : config.attribution?.standard
    tile.current = L.tileLayer(url || fallbackConfig.standardTiles, { attribution: attribution || fallbackConfig.attribution.standard, maxZoom: 20 }).addTo(map.current)
  }, [mode, config])

  useEffect(() => {
    if (!map.current) return
    boundary.current?.remove()
    markerLayer.current.clearLayers()
    const activePolygon = points.length >= 3 ? toPolygon(points) : confirmedPolygon
    if (activePolygon) {
      const latLngs = activePolygon.coordinates[0].map(([lon, lat]) => [lat, lon])
      boundary.current = L.polygon(latLngs, { color: '#1f6a43', fillColor: '#68ad69', fillOpacity: .22, weight: 3 }).addTo(map.current)
      if (latLngs.length > 1) map.current.fitBounds(boundary.current.getBounds(), { padding: [22, 22], maxZoom: 18 })
    } else {
      map.current.setView(center, 16)
    }
    points.forEach((point, index) => {
      const marker = L.marker([point[1], point[0]], { draggable: drawing }).addTo(markerLayer.current)
      marker.bindTooltip(String(index + 1), { permanent: true, direction: 'center', className: 'vertex-label' })
      marker.on('dragend', event => {
        const next = [...pointsRef.current]
        const {lat, lng} = event.target.getLatLng()
        next[index] = [Number(lng.toFixed(7)), Number(lat.toFixed(7))]
        onPointsChange(next)
      })
      marker.on('contextmenu', () => onPointsChange(pointsRef.current.filter((_, itemIndex) => itemIndex !== index)))
    })
  }, [points, confirmedPolygon, drawing, center, onPointsChange])

  useEffect(() => {
    if (!map.current) return
    plotLayer.current.clearLayers()
    plots.filter(plot => plot.polygon).forEach(plot => {
      const level = plot.latestRisk?.level?.toLowerCase() || 'low'
      const color = level === 'critical' ? '#c44f45' : level === 'high' ? '#d57a38' : level === 'moderate' ? '#e1aa3a' : '#4f9a62'
      const layer = L.polygon(plot.polygon.coordinates[0].map(([lon, lat]) => [lat, lon]), { color, fillColor: color, fillOpacity: selectedPlotId === plot.id ? .42 : .24, weight: selectedPlotId === plot.id ? 4 : 2 }).addTo(plotLayer.current)
      layer.bindTooltip(`${plot.name} · ${plot.latestRisk?.level || 'No risk yet'}`)
      layer.on('click', () => onSelectPlot?.(plot.id))
    })
  }, [plots, selectedPlotId, onSelectPlot])

  return <div ref={root} className="leaflet-farm-map" aria-label="Interactive farm boundary map"/>
}

function centerFrom(points, polygon, plots) {
  const point = points[0] || polygon?.coordinates?.[0]?.[0] || plots.find(plot => plot.polygon)?.polygon?.coordinates?.[0]?.[0]
  return point ? [point[1], point[0]] : [17.385, 78.4867]
}
