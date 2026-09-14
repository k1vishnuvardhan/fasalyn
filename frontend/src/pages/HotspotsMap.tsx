import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useQuery } from '@tanstack/react-query';
import { getOfficerHotspots as getHotspots } from '../services/api';
import { Loader } from '../components/ui/Loader';
import { Card, CardContent } from '../components/ui/Card';
import { AlertTriangle, Bug, Activity, Map as MapIcon, X, Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const formatDistanceToNow = (dateStr: string) => {
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const INDIA_CENTER: L.LatLngExpression = [20.5937, 78.9629];

// CSS for the pulsating map markers
const mapStyles = `
  .hotspot-marker {
    background: transparent;
    border: none;
  }
  .marker-pulse-disease {
    width: 24px;
    height: 24px;
    background: rgba(239, 68, 68, 0.85); /* Red for disease */
    border-radius: 50%;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.8);
    animation: pulse-disease 2s infinite;
    border: 2px solid white;
  }
  .marker-pulse-pest {
    width: 24px;
    height: 24px;
    background: rgba(245, 158, 11, 0.85); /* Amber/Orange for pest */
    border-radius: 50%;
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.8);
    animation: pulse-pest 2s infinite;
    border: 2px solid white;
  }
  @keyframes pulse-disease {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
  }
  @keyframes pulse-pest {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7); }
    70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(245, 158, 11, 0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
  }
  .dark-map-tiles {
    filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
  }
`;

export default function HotspotsMap() {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch hotspots (combines scans and trap observations)
  const { data, isLoading, error } = useQuery({
    queryKey: ['hotspots'],
    queryFn: getHotspots,
    refetchInterval: 60000 // Refresh every minute
  });

  // Inject styles for markers
  useLayoutEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = mapStyles;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  useLayoutEffect(() => {
    if (isLoading || !container.current || map.current) return;
    
    // Initialize map with a stunning dark theme via CSS inversion on OSM
    const instance = L.map(container.current, { zoomControl: false, maxZoom: 18 }).setView(INDIA_CENTER, 5);
    
    const darkLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      className: 'dark-map-tiles'
    });
    
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    });

    darkLayer.addTo(instance);
    L.control.layers({ "Tactical Dark": darkLayer, "Satellite": satelliteLayer }).addTo(instance);
    L.control.zoom({ position: 'bottomright' }).addTo(instance);
    
    instance.whenReady(() => instance.invalidateSize());
    map.current = instance;
    layerGroup.current = L.layerGroup().addTo(instance);

    return () => { instance.remove(); map.current = null; };
  }, [isLoading]);

  useEffect(() => {
    if (!map.current || !layerGroup.current || !data?.hotspots) return;
    
    const group = layerGroup.current;
    group.clearLayers();
    
    const bounds = L.latLngBounds([]);

    data.hotspots.forEach((spot: any) => {
      const latLng = [Number(spot.latitude), Number(spot.longitude)] as [number, number];
      bounds.extend(latLng);

      const isDisease = spot.type === 'DISEASE';
      
      const icon = L.divIcon({
        className: 'hotspot-marker',
        html: `<div class="${isDisease ? 'marker-pulse-disease' : 'marker-pulse-pest'}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker(latLng, { icon }).addTo(group);
      
      marker.on('click', () => {
        setSelectedHotspot(spot);
        map.current?.setView(latLng, 14, { animate: true, duration: 1 });
      });
    });

    if (data.userLocation) {
      map.current.setView([data.userLocation.latitude, data.userLocation.longitude], 13);
    } else if (bounds.isValid() && data.hotspots.length > 0) {
      map.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [data]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      container.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const diseaseCount = data?.hotspots?.filter((h: any) => h.type === 'DISEASE').length || 0;
  const pestCount = data?.hotspots?.filter((h: any) => h.type === 'PEST').length || 0;

  if (isLoading) return <div className="h-full grid place-items-center"><Loader size={42} /></div>;
  if (error) return <div className="p-8 text-center text-danger">Failed to load hotspots. Please try again.</div>;

  return (
    <div className={clsx("relative flex flex-col transition-all duration-300", isFullscreen ? "h-screen w-screen fixed inset-0 z-[9999]" : "h-[calc(100vh-8rem)] min-h-[400px]")}>
      
      {/* Background Map Container */}
      <div ref={container} className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl border border-subtle" />

      {/* Floating Header Panel (Glassmorphism) */}
      <div className="absolute top-4 left-4 right-4 sm:top-6 sm:left-6 sm:right-auto z-[500] pointer-events-none">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto backdrop-blur-xl bg-background/70 border border-white/10 p-4 sm:p-5 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] w-full sm:max-w-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-emeraldMain/20 rounded-xl text-emeraldMain">
              <MapIcon size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emeraldMain to-teal-400">Regional Hotspots</h1>
              <p className="text-sm text-textSub">Live surveillance map</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div>
                <p className="text-xs text-textSub uppercase tracking-wider font-semibold">Diseases</p>
                <p className="text-lg font-bold">{diseaseCount}</p>
              </div>
            </div>
            <div className="bg-card/40 border border-white/5 rounded-xl p-3 flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
              <div>
                <p className="text-xs text-textSub uppercase tracking-wider font-semibold">Pests</p>
                <p className="text-lg font-bold">{pestCount}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Fullscreen Toggle */}
      <button 
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[500] p-3 backdrop-blur-xl bg-background/70 border border-white/10 rounded-xl shadow-lg hover:bg-background/90 transition-colors text-textSub hover:text-textMain"
      >
        <Maximize2 size={20} />
      </button>

      {/* Selected Hotspot Details Panel */}
      <AnimatePresence>
        {selectedHotspot && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 z-[500] sm:w-[400px]"
          >
            <div className="backdrop-blur-xl bg-background/85 border border-white/10 p-5 rounded-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
              <button 
                onClick={() => setSelectedHotspot(null)}
                className="absolute top-4 right-4 text-textSub hover:text-textMain bg-card/50 rounded-full p-1 transition-colors"
              >
                <X size={16} />
              </button>
              
              <div className="flex items-start gap-4 mb-4">
                <div className={clsx(
                  "p-3 rounded-xl shadow-inner",
                  selectedHotspot.type === 'DISEASE' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                )}>
                  {selectedHotspot.type === 'DISEASE' ? <Activity size={24} /> : <Bug size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx(
                      "text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md",
                      selectedHotspot.type === 'DISEASE' ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                    )}>
                      {selectedHotspot.type}
                    </span>
                    <span className="text-xs text-textMuted">{formatDistanceToNow(new Date(selectedHotspot.date))} ago</span>
                  </div>
                  <h3 className="text-lg font-bold capitalize">{selectedHotspot.name.replace(/_/g, ' ')}</h3>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-textSub">Affected Area</span>
                  <span className="text-sm font-medium">{selectedHotspot.farm_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-textSub">Coordinates</span>
                  <span className="text-sm font-mono bg-card/50 px-2 py-1 rounded text-textMuted">
                    {Number(selectedHotspot.latitude).toFixed(4)}, {Number(selectedHotspot.longitude).toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-textSub">
                    {selectedHotspot.type === 'DISEASE' ? 'AI Confidence' : 'Trap Count'}
                  </span>
                  <span className="text-sm font-bold">
                    {selectedHotspot.type === 'DISEASE' 
                      ? `${Number(selectedHotspot.intensity).toFixed(1)}%` 
                      : `${selectedHotspot.intensity} insects`
                    }
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
