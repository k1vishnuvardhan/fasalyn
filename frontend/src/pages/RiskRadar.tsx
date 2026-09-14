import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChartNoAxesCombined, Droplets, ShieldAlert, ThermometerSun } from 'lucide-react';
import { useDashboard, useRiskAssessment } from '../hooks/queries';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';

const riskVariant = (level?: string) => level === 'HIGH' || level === 'CRITICAL' ? 'danger' : level === 'MODERATE' ? 'warning' : 'success';
export default function RiskRadar() {
  const { data: dashboard } = useDashboard(); const [params] = useSearchParams();
  const [selectedPlot, setSelectedPlot] = useState(params.get('plot') || '');
  const { data: risk, isLoading, error } = useRiskAssessment(selectedPlot); const plots = dashboard?.plots || [];
  const detail = risk?.factors_json ? JSON.parse(risk.factors_json) : []; const weather = risk?.weather;
  return <div className="app-page"><header><p className="page-eyebrow">Crop intelligence</p><h1 className="page-title">Risk assessment</h1><p className="page-subtitle">Understand the evidence behind each plot’s current risk. Assessments update when you check a plot.</p></header>
    <label className="block max-w-md"><span className="mb-2 block text-sm font-medium">Choose a plot</span><select className="h-11 w-full rounded-lg border border-subtle bg-card px-3 text-textMain" value={selectedPlot} onChange={(e) => setSelectedPlot(e.target.value)}><option value="">Select a plot</option>{plots.map((plot: any) => <option key={plot.id} value={plot.id}>{plot.name} · {plot.crop}</option>)}</select></label>
    {!selectedPlot ? <EmptyState icon={ChartNoAxesCombined} title="Select a plot to assess risk" description="Fasalyn will use the available evidence for the selected plot." /> : isLoading ? <Card><CardContent className="flex min-h-52 items-center justify-center"><Loader size={28} /></CardContent></Card> : error || !risk ? <EmptyState icon={ShieldAlert} title="Risk assessment unavailable" description="We couldn't calculate risk for this plot right now. Try again shortly." /> : <>
      <section className="grid gap-4 lg:grid-cols-[.72fr_1.28fr]"><Card><CardContent className="p-7"><p className="text-sm font-medium text-textSub">Current risk</p><div className="mt-5 flex items-end gap-3"><span className="text-5xl font-semibold tracking-[-.06em]">{risk.score}</span><span className="mb-1 text-sm text-textMuted">out of 100</span></div><Badge variant={riskVariant(risk.level)} className="mt-5">{risk.level} RISK</Badge><p className="mt-5 text-sm leading-6 text-textSub">This score reflects the evidence currently available for this plot, not a guarantee of crop outcome.</p></CardContent></Card>
        <Card><CardContent className="p-6"><div className="flex items-center gap-2"><AlertTriangle className="text-warning" size={18}/><h2 className="section-title">Why this risk level?</h2></div><div className="mt-5 divide-y divide-subtle">{detail.length ? detail.map((factor: any, index: number) => <div key={index} className="flex items-start justify-between gap-4 py-4 first:pt-0"><div><p className="font-medium">{factor.name || factor.signal || 'Risk signal'}</p><p className="mt-1 text-sm leading-5 text-textSub">{factor.description || factor.detail}</p></div>{factor.impact && <Badge variant={factor.impact === 'High' ? 'danger' : 'warning'}>{factor.impact}</Badge>}</div>) : <p className="py-3 text-sm text-textSub">No contributing evidence is available yet.</p>}</div></CardContent></Card></section>
      <Card><CardContent className="p-6"><h2 className="section-title">Weather context</h2>{weather ? <div className="mt-5 grid gap-4 sm:grid-cols-3"><WeatherItem icon={ThermometerSun} label="Temperature" value={`${weather.temperature}°C`} /><WeatherItem icon={Droplets} label="Humidity" value={`${weather.humidity}%`} /><WeatherItem icon={Droplets} label="Rainfall" value={`${weather.rainfall} mm`} /></div> : <p className="mt-3 text-sm leading-6 text-textSub">Weather data was unavailable when this assessment ran, so it was not included in the risk calculation.</p>}</CardContent></Card>
    </>}</div>;
}
function WeatherItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-lg bg-cardHover p-4"><Icon className="text-emeraldMain" size={20}/><div><p className="text-xs text-textMuted">{label}</p><p className="mt-0.5 font-semibold">{value}</p></div></div>; }
