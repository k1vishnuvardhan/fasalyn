import {LocateFixed,MapPinned,RotateCcw,Satellite,Undo2} from 'lucide-react'
import {useEffect,useMemo,useState} from 'react'
import {useOfflineQueue} from '../hooks/useOfflineQueue'
import FarmBoundaryMap from '../components/FarmBoundaryMap'
import {Empty,PageTitle,RiskBadge} from '../components/Shared'
import {createFarm,createPlot,getFarms,getMapConfig,getSpatialHealth,saveFarmBoundary} from '../services/api'
import {areaSquareMeters,formatArea,toPolygon} from '../services/geo'

const stages = ['seedling','vegetative','flowering','fruiting','harvest']

export default function Farm() {
  const {online, add} = useOfflineQueue()
  const [farms,setFarms]=useState([]),[selectedFarmId,setSelectedFarmId]=useState(''),[health,setHealth]=useState(null),[config,setConfig]=useState(null),[points,setPoints]=useState([]),[plotPoints,setPlotPoints]=useState([]),[mode,setMode]=useState('satellite'),[drawTarget,setDrawTarget]=useState('farm'),[selectedPlotId,setSelectedPlotId]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [farmForm,setFarmForm]=useState({name:'',crop:'Chilli',growthStage:'vegetative',latitude:'',longitude:''})
  const [plotForm,setPlotForm]=useState({name:'A1',crop:'Chilli',cropStage:'vegetative'})
  const selectedFarm = farms.find(farm => farm.id === selectedFarmId)
  const selectedPlot = health?.plots?.find(plot => plot.id === selectedPlotId)
  const activePoints = drawTarget === 'farm' ? points : plotPoints
  const area = useMemo(() => activePoints.length >= 3 ? areaSquareMeters(toPolygon(activePoints)) : 0, [activePoints])

  const load = async farmId => {
    const nextFarms = await getFarms()
    setFarms(nextFarms)
    const nextId = farmId || selectedFarmId || nextFarms[0]?.id || ''
    setSelectedFarmId(nextId)
    if (nextId) {
      const nextHealth = await getSpatialHealth(nextId)
      setHealth(nextHealth)
      setSelectedPlotId(nextHealth.plots[0]?.id || '')
    }
  }

  useEffect(() => { getMapConfig().then(setConfig).catch(() => setConfig(null)); load().catch(err => setError(err.message)) }, [])

  const createNewFarm = async event => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const payload = {id: crypto.randomUUID(), name:farmForm.name,crop:farmForm.crop,growthStage:farmForm.growthStage,monitoringMode:'SPATIAL',latitude:farmForm.latitude===''?undefined:Number(farmForm.latitude),longitude:farmForm.longitude===''?undefined:Number(farmForm.longitude)}
      if (!online) {
        await add('create_farm', payload)
        setFarms([{...payload, area_square_meters: 0}, ...farms])
        setSelectedFarmId(payload.id)
        setMessage('Farm created offline. Pending sync.')
      } else {
        const farm = await createFarm(payload)
        await load(farm.id)
        setMessage('Farm created. Draw and confirm the boundary when ready.')
      }
      setFarmForm({...farmForm,name:''})
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const useLocation = () => {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); return }
    navigator.geolocation.getCurrentPosition(position => {
      setFarmForm(form => ({...form,latitude:String(position.coords.latitude),longitude:String(position.coords.longitude)}))
      setMessage('Location added as the map starting point. The boundary still needs to be drawn and confirmed.')
    }, () => setError('Location permission was denied or unavailable. You can still draw the farm manually.'))
  }

  const saveBoundary = async () => {
    if (!selectedFarmId || points.length < 3) { setError('Draw at least three farm boundary points before confirming.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const polygonGeometry = toPolygon(points)
      if (!online) {
        await add('save_farm_boundary', { farmId: selectedFarmId, polygonGeometry })
        setPoints([])
        setMessage('Boundary saved offline. Pending sync.')
      } else {
        await saveFarmBoundary(selectedFarmId, polygonGeometry)
        setPoints([])
        await load(selectedFarmId)
        setMessage('Farm boundary saved with actual coordinates and calculated area.')
      }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const savePlot = async event => {
    event.preventDefault()
    if (!selectedFarmId) return
    if (plotPoints.length < 3 && health?.farm?.polygon) { setError('Draw the custom plot boundary inside the farm before saving.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const payload = {id: crypto.randomUUID(), ...plotForm, polygonGeometry: plotPoints.length>=3?toPolygon(plotPoints):undefined}
      if (!online) {
        await add('create_plot', { farmId: selectedFarmId, plotData: payload })
        localStorage.setItem('fasalyn-default-plot', payload.id)
        setPlotPoints([])
        setMessage('Plot saved offline. Pending sync.')
      } else {
        const plot = await createPlot(selectedFarmId, payload)
        localStorage.setItem('fasalyn-default-plot', plot.id)
        setPlotPoints([])
        await load(selectedFarmId)
        setSelectedPlotId(plot.id)
        setMessage('Plot saved. Scanner and pest observations can now attach to this plot.')
      }
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (error && !farms.length) return <><PageTitle eyebrow="MAP MY FARM" title="Spatial monitoring"/><Empty title="Sign in to map a farm" body={error}/></>

  return <><PageTitle eyebrow="MAP MY FARM" title="Spatial monitoring"><button className="secondary-action" onClick={()=>setMode(mode==='satellite'?'standard':'satellite')}><Satellite size={16}/>{mode==='satellite'?'Standard map':'Satellite view'}</button></PageTitle><p className="title-subtitle">Satellite imagery is a visual reference only. The saved boundary comes from farmer-confirmed map boundaries.</p>
    <section className="spatial-layout">
      <article className="card map-workspace">
        <div className="map-toolbar">
          <select value={selectedFarmId} onChange={event=>load(event.target.value).catch(err=>setError(err.message))} aria-label="Select farm"><option value="">Select farm</option>{farms.map(farm=><option key={farm.id} value={farm.id}>{farm.name}</option>)}</select>
          <button className={drawTarget==='farm'?'primary-action':'secondary-action'} onClick={()=>setDrawTarget('farm')}><MapPinned size={16}/>Draw farm</button>
          <button className={drawTarget==='plot'?'primary-action':'secondary-action'} onClick={()=>setDrawTarget('plot')} disabled={!selectedFarmId}>Draw plot</button>
          <button className="secondary-action" onClick={()=>drawTarget==='farm'?setPoints(points.slice(0,-1)):setPlotPoints(plotPoints.slice(0,-1))}><Undo2 size={16}/>Undo</button>
          <button className="secondary-action" onClick={()=>drawTarget==='farm'?setPoints([]):setPlotPoints([])}><RotateCcw size={16}/>Clear</button>
        </div>
        <FarmBoundaryMap points={activePoints} onPointsChange={drawTarget==='farm'?setPoints:setPlotPoints} confirmedPolygon={health?.farm?.polygon} plots={health?.plots||[]} selectedPlotId={selectedPlotId} onSelectPlot={setSelectedPlotId} mode={mode} config={config||undefined}/>
        <div className="map-status"><span>Drawing: <b>{drawTarget === 'farm' ? 'farm boundary' : 'custom plot'}</b></span><span>Area: <b>{formatArea(area || selectedFarm?.area_square_meters || 0)}</b></span><button disabled={busy||points.length<3} className="primary-action" onClick={saveBoundary}>Confirm farm boundary</button></div>
      </article>
      <aside className="spatial-side">
        <form className="card observation" onSubmit={createNewFarm}><p className="eyebrow">CREATE FARM</p><label>Farm name<input required value={farmForm.name} onChange={e=>setFarmForm({...farmForm,name:e.target.value})}/></label><label>Crop<input required value={farmForm.crop} onChange={e=>setFarmForm({...farmForm,crop:e.target.value})}/></label><label>Growth stage<select value={farmForm.growthStage} onChange={e=>setFarmForm({...farmForm,growthStage:e.target.value})}>{stages.map(stage=><option key={stage}>{stage}</option>)}</select></label><div className="coord-row"><label>Latitude<input type="number" step="any" value={farmForm.latitude} onChange={e=>setFarmForm({...farmForm,latitude:e.target.value})}/></label><label>Longitude<input type="number" step="any" value={farmForm.longitude} onChange={e=>setFarmForm({...farmForm,longitude:e.target.value})}/></label></div><button type="button" className="secondary-action" onClick={useLocation}><LocateFixed size={16}/>Use my location</button><button disabled={busy} className="primary-action">Create spatial farm</button></form>
        <form className="card observation" onSubmit={savePlot}><p className="eyebrow">CUSTOM PLOTS</p><label>Plot ID/name<input required value={plotForm.name} onChange={e=>setPlotForm({...plotForm,name:e.target.value})}/></label><label>Crop<input required value={plotForm.crop} onChange={e=>setPlotForm({...plotForm,crop:e.target.value})}/></label><label>Growth stage<select value={plotForm.cropStage} onChange={e=>setPlotForm({...plotForm,cropStage:e.target.value})}>{stages.map(stage=><option key={stage}>{stage}</option>)}</select></label><button disabled={busy||!selectedFarmId} className="primary-action">Save plot</button><small>When a farm boundary exists, the backend rejects plot polygons outside it.</small></form>
        <article className="card plot-detail"><p className="eyebrow">PLOT DETAILS</p>{selectedPlot?<><h2>{selectedPlot.name}</h2><RiskBadge risk={selectedPlot.latestRisk?.level || 'LOW'}/><p>{selectedPlot.crop} · {selectedPlot.crop_stage || 'stage not recorded'}</p><div className="inspect-facts"><span>Area <b>{formatArea(selectedPlot.area_square_meters)}</b></span><span>Trap records <b>{selectedPlot.trapObservations.length}</b></span><span>Nearby risk <b>{selectedPlot.nearbyRisk.length}</b></span></div>{selectedPlot.latestRisk?.factors?.factors?.map(factor=><span className="risk-reason" key={factor.signal}>{factor.detail}</span>)}{!selectedPlot.latestRisk&&<p>No risk calculation yet. Add a scan or trap observation.</p>}</>:<p>Select or create a plot to view its history.</p>}</article>
      </aside>
    </section>
    {(message||error)&&<p className={error?'form-error':'form-success'}>{error||message}</p>}
  </>
}
