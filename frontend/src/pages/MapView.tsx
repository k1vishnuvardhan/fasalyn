import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, Crosshair, MapPin, Plus, X } from 'lucide-react';
import { useFarms, usePlots } from '../hooks/queries';
import { createFarm, createPlot, saveFarmBoundary, saveFarmLocality } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';

type Mode = 'farm' | 'plot' | null;
const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9629];

export default function MapView() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const drawingLayer = useRef<L.Polygon | null>(null);
  const savedLayers = useRef<L.LayerGroup | null>(null);
  const farmsQuery = useFarms();
  const queryClient = useQueryClient();
  const farms = farmsQuery.data || [];
  const [farmId, setFarmId] = useState('');
  const [mode, setMode] = useState<Mode>(null);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const [farmForm, setFarmForm] = useState({ name: '', crop: '', latitude: '', longitude: '', state: '', district: '', mandal: '', pincode: '' });
  const [plotForm, setPlotForm] = useState({ name: '', crop: '' });
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [showPlotForm, setShowPlotForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [locationStatus, setLocationStatus] = useState('');
  const selectedFarm = farms.find((farm: any) => farm.id === farmId);
  const plotsQuery = usePlots(farmId);
  const plots = plotsQuery.data || [];
  const canDrawSubplots = Boolean(selectedFarm?.polygon);

  useEffect(() => { if (!farmId && farms[0]) setFarmId(farms[0].id); }, [farms, farmId]);
  useEffect(() => {
    if (!selectedFarm) return;
    setFarmForm((current) => ({ ...current, name: selectedFarm.name || current.name, crop: selectedFarm.crop || current.crop, latitude: selectedFarm.latitude != null ? String(selectedFarm.latitude) : current.latitude, longitude: selectedFarm.longitude != null ? String(selectedFarm.longitude) : current.longitude, state: selectedFarm.locality?.state || current.state, district: selectedFarm.locality?.district || current.district, mandal: selectedFarm.locality?.mandal || current.mandal, pincode: selectedFarm.locality?.pincode || current.pincode }));
  }, [selectedFarm?.id]);

  // The map div is absent while the initial farm query displays its loader.
  useLayoutEffect(() => {
    if (farmsQuery.isLoading || !container.current || map.current) return;
    const instance = L.map(container.current, { zoomControl: false }).setView(INDIA_CENTER, 5);
    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri' });
    street.addTo(instance);
    L.control.layers({ "Street Map": street, "Satellite Imagery": satellite }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    instance.whenReady(() => instance.invalidateSize());
    map.current = instance;
    return () => { instance.remove(); map.current = null; };
  }, [farmsQuery.isLoading]);
  useEffect(() => {
    const instance = map.current; if (!instance) return;
    const click = (event: L.LeafletMouseEvent) => { if (mode) setPoints((previous) => [...previous, event.latlng]); };
    instance.on('click', click); return () => { instance.off('click', click); };
  }, [mode]);
  useEffect(() => {
    if (!map.current || !farmForm.latitude || !farmForm.longitude) return;
    const latitude = Number(farmForm.latitude), longitude = Number(farmForm.longitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) map.current.setView([latitude, longitude], 17);
  }, [farmForm.latitude, farmForm.longitude]);
  useEffect(() => {
    if (!map.current) return; drawingLayer.current?.remove();
    drawingLayer.current = points.length ? L.polygon(points, { color: '#10b981', weight: 3, fillOpacity: 0.2, interactive: false }).addTo(map.current) : null;
  }, [points]);
  useEffect(() => {
    const instance = map.current; if (!instance) return;
    savedLayers.current?.remove(); const group = L.layerGroup().addTo(instance); savedLayers.current = group;
    const all = [{ ...selectedFarm, kind: 'Field boundary' }, ...plots.map((plot: any) => ({ ...plot, kind: 'Subplot' }))]; const bounds = L.latLngBounds([]);
    all.forEach((item: any) => { const polygon = item?.polygon; if (!polygon?.coordinates?.[0]) return; const latlngs = polygon.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]); L.polygon(latlngs, { color: item.kind === 'Field boundary' ? '#f59e0b' : '#3b82f6', weight: 2, fillOpacity: 0.12, interactive: false }).addTo(group); latlngs.forEach((point) => bounds.extend(point)); });
    if (bounds.isValid()) instance.fitBounds(bounds, { padding: [36, 36] }); return () => group.remove();
  }, [selectedFarm, plots]);

  const begin = (next: Mode) => { if (next === 'plot' && !canDrawSubplots) return setMessage('Save the field boundary first. Named subplots unlock after the field is confirmed.'); setMessage(''); setMode(next); setPoints([]); };
  const cancel = () => { setMode(null); setPoints([]); };
  const complete = () => { 
    if (points.length < 3) return setMessage('Add at least three points to form a boundary.'); 
    if (mode === 'plot') {
      const farmCoords = selectedFarm?.polygon?.coordinates?.[0];
      if (farmCoords) {
        const isInside = points.every(p => {
          let x = p.lng, y = p.lat, inside = false;
          for (let i = 0, j = farmCoords.length - 1; i < farmCoords.length; j = i++) {
            let xi = farmCoords[i][0], yi = farmCoords[i][1];
            let xj = farmCoords[j][0], yj = farmCoords[j][1];
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          return inside;
        });
        if (!isInside) return setMessage('Subplot must be drawn inside the farm boundary.');
      }
    }
    const completedMode = mode; setMode(null); 
    if (completedMode === 'farm') setShowFarmForm(true); 
    if (completedMode === 'plot') setShowPlotForm(true); 
  };
  const polygonGeometry = () => ({ type: 'Polygon', coordinates: [[...points.map((point) => [point.lng, point.lat]), [points[0].lng, points[0].lat]]] });
  const useMyLocation = () => {
    if (!navigator.geolocation) return setLocationStatus('Location is not supported by this browser. Enter coordinates manually.');
    setLocationStatus('Requesting your browser location…');
    navigator.geolocation.getCurrentPosition((position) => { const latitude = position.coords.latitude.toFixed(7), longitude = position.coords.longitude.toFixed(7); setFarmForm((current) => ({ ...current, latitude, longitude })); setLocationStatus(`Map centered at ${latitude}, ${longitude}. Review the position before drawing.`); }, () => setLocationStatus('Location permission was not granted. You can enter latitude and longitude manually.'), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };
  const locateMeOnMap = () => {
    if (!navigator.geolocation) return setMessage('Location is not supported by your browser.');
    setMessage('Finding your location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        map.current?.setView([position.coords.latitude, position.coords.longitude], 18);
        setMessage('');
      },
      () => setMessage('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  const saveFarm = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      let id = farmId;
      if (!id) { const farm: any = await createFarm({ name: farmForm.name, crop: farmForm.crop, latitude: farmForm.latitude === '' ? undefined : Number(farmForm.latitude), longitude: farmForm.longitude === '' ? undefined : Number(farmForm.longitude), locality: { state: farmForm.state, district: farmForm.district, mandal: farmForm.mandal || undefined, pincode: farmForm.pincode || undefined }, monitoringMode: 'SPATIAL' }); id = farm.id; setFarmId(id); }
      await saveFarmBoundary(id, polygonGeometry());
      await queryClient.invalidateQueries({ queryKey: ['farms'] }); await queryClient.invalidateQueries({ queryKey: ['plots', id] }); await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowFarmForm(false); setPoints([]); setMessage('Field boundary saved. Step 2 is now unlocked: draw each named subplot separately.');
    } catch (err: any) { setMessage(err.message || 'Unable to save the field boundary.'); } finally { setBusy(false); }
  };
  const savePlot = async (event: React.FormEvent) => {
    event.preventDefault(); if (!farmId) return; setBusy(true); setMessage('');
    try { await createPlot(farmId, { name: plotForm.name, crop: plotForm.crop || selectedFarm?.crop || 'Rice', polygonGeometry: polygonGeometry() }); await queryClient.invalidateQueries({ queryKey: ['plots', farmId] }); await queryClient.invalidateQueries({ queryKey: ['dashboard'] }); setShowPlotForm(false); setPoints([]); setPlotForm({ name: '', crop: selectedFarm?.crop || '' }); setMessage('Named subplot saved. You can draw another subplot when ready.'); } catch (err: any) { setMessage(err.message || 'Unable to save the subplot.'); } finally { setBusy(false); }
  };
  const saveLocality = async (event: React.FormEvent) => {
    event.preventDefault(); if (!farmId) return; setBusy(true); setMessage('');
    try { await saveFarmLocality(farmId, { state: farmForm.state, district: farmForm.district, mandal: farmForm.mandal || undefined, pincode: farmForm.pincode || undefined }); await queryClient.invalidateQueries({ queryKey: ['farms'] }); setMessage('Farm locality saved. Officer requests can now be matched to a service jurisdiction.'); } catch (err: any) { setMessage(err.message || 'Unable to save farm locality.'); } finally { setBusy(false); }
  };

  if (farmsQuery.isLoading) return <div className="h-full grid place-items-center"><Loader size={42} /></div>;
  return <div className="min-h-[calc(100vh-8rem)] space-y-4 pb-8">
    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4"><div><h1 className="text-2xl font-bold">Map my farm</h1><p className="text-textSub">Save the complete field first, then create only the named subplots you need.</p></div><div className="flex flex-wrap gap-2"><select aria-label="Select farm" className="rounded-lg border border-subtle bg-card p-2" value={farmId} onChange={(event) => setFarmId(event.target.value)}><option value="">Select farm</option>{farms.map((farm: any) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select><Button variant="secondary" onClick={locateMeOnMap}><Crosshair size={16} className="mr-1" />Locate Me</Button><Button variant="secondary" onClick={() => begin('farm')}><Plus size={16} className="mr-1" />{selectedFarm?.polygon ? 'Redraw field' : 'Draw field'}</Button><Button disabled={!canDrawSubplots} onClick={() => begin('plot')}><Plus size={16} className="mr-1" />Draw named subplot</Button></div></div>
    <div className="grid gap-3 md:grid-cols-2"><Card><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-emeraldMain">1. Field boundary</p><p className="mt-1 text-sm text-textSub">Draw at least three points and save the field. Its boundary is the valid area for all subplots.</p></CardContent></Card><Card className={canDrawSubplots ? '' : 'opacity-60'}><CardContent className="p-4"><p className="text-xs font-bold uppercase tracking-wide text-emeraldMain">2. Named subplots</p><p className="mt-1 text-sm text-textSub">{canDrawSubplots ? 'Draw, name, and save each plot inside the confirmed field.' : 'Available after the field boundary is saved.'}</p></CardContent></Card></div>
    {message && <p role="status" className="text-sm text-warning">{message}</p>}
    {selectedFarm && <Card><CardContent className="p-4"><form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto] md:items-end" onSubmit={saveLocality}><label className="text-sm">State<Input required value={farmForm.state} placeholder="State" onChange={(event) => setFarmForm({ ...farmForm, state: event.target.value })} /></label><label className="text-sm">District<Input required value={farmForm.district} placeholder="District" onChange={(event) => setFarmForm({ ...farmForm, district: event.target.value })} /></label><label className="text-sm">Mandal / block<Input value={farmForm.mandal} placeholder="Optional" onChange={(event) => setFarmForm({ ...farmForm, mandal: event.target.value })} /></label><label className="text-sm">Pincode<Input pattern="[0-9]{6}" value={farmForm.pincode} placeholder="Optional" onChange={(event) => setFarmForm({ ...farmForm, pincode: event.target.value })} /></label><Button type="submit" isLoading={busy}>Save locality</Button></form><p className="mt-2 text-xs text-textMuted">This locality is used only to match an officer when you request a review; it does not change the confirmed farm boundary.</p></CardContent></Card>}
    <div className="relative h-[58vh] min-h-[350px] rounded-xl overflow-hidden border border-subtle"><div ref={container} className="absolute inset-0 bg-sidebar" />{mode && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] max-w-[calc(100%-1rem)] w-max sm:w-auto sm:max-w-none bg-card border border-subtle p-2 sm:p-3 rounded-xl shadow-xl flex flex-wrap justify-center items-center gap-1 sm:gap-2"><span className="text-xs sm:text-sm flex items-center gap-1 sm:gap-2 whitespace-nowrap"><MapPin size={16} />{points.length} pts</span><Button size="sm" variant="ghost" className="px-2" disabled={!points.length} onClick={() => setPoints((current) => current.slice(0, -1))}>Undo</Button><Button size="sm" variant="ghost" className="px-2" disabled={!points.length} onClick={() => setPoints([])}>Clear</Button><Button size="sm" variant="ghost" className="px-2" onClick={cancel}><X size={16} className="sm:mr-1" /><span className="hidden sm:inline">Cancel</span></Button><Button size="sm" disabled={points.length < 3} className="px-2" onClick={complete}><Check size={16} className="sm:mr-1" /><span className="hidden sm:inline">Continue</span></Button></div>}</div>
    {showFarmForm && <div className="fixed inset-0 z-[700] overflow-y-auto bg-black/60 p-4"><div className="min-h-full grid place-items-center"><Card className="w-full max-w-lg my-6"><CardHeader><CardTitle>{farmId ? 'Save field boundary' : 'Save field details and boundary'}</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={saveFarm}>{!farmId && <><Input required placeholder="Field name" value={farmForm.name} onChange={(event) => setFarmForm({ ...farmForm, name: event.target.value })} /><Input required placeholder="Primary crop, e.g. Rice" value={farmForm.crop} onChange={(event) => setFarmForm({ ...farmForm, crop: event.target.value })} /></>}<div><p className="mb-2 text-sm font-medium">Precise field location</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Input type="number" step="any" min="-90" max="90" placeholder="Latitude, e.g. 16.5062" value={farmForm.latitude} onChange={(event) => setFarmForm({ ...farmForm, latitude: event.target.value })} /><Input type="number" step="any" min="-180" max="180" placeholder="Longitude, e.g. 80.6480" value={farmForm.longitude} onChange={(event) => setFarmForm({ ...farmForm, longitude: event.target.value })} /></div><Button type="button" className="mt-3" size="sm" variant="secondary" onClick={useMyLocation}><Crosshair size={16} className="mr-1" />Use my location</Button>{locationStatus && <p role="status" className="mt-2 text-xs text-textSub">{locationStatus}</p>}<p className="mt-2 text-xs text-textMuted">Location centers the map. The confirmed boundary’s centroid becomes the final field location.</p></div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowFarmForm(false)}>Cancel</Button><Button type="submit" isLoading={busy}>Save field boundary</Button></div></form></CardContent></Card></div></div>}
    {showPlotForm && <div className="fixed inset-0 z-[700] overflow-y-auto bg-black/60 p-4"><div className="min-h-full grid place-items-center"><Card className="w-full max-w-md my-6"><CardHeader><CardTitle>Save named subplot</CardTitle></CardHeader><CardContent><form className="space-y-3" onSubmit={savePlot}><Input required placeholder="Subplot name, e.g. North Block" value={plotForm.name} onChange={(event) => setPlotForm({ ...plotForm, name: event.target.value })} /><Input required placeholder="Crop, e.g. Rice" value={plotForm.crop} onChange={(event) => setPlotForm({ ...plotForm, crop: event.target.value })} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setShowPlotForm(false)}>Cancel</Button><Button type="submit" isLoading={busy}>Save named subplot</Button></div></form></CardContent></Card></div></div>}
  </div>;
}
