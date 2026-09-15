import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bug, MapPinned, ScanLine, ShieldAlert, Sprout } from 'lucide-react';
import { useDashboard, useAnalytics } from '../hooks/queries';
import { useAuthStore } from '../store/auth';
import { useSearchStore } from '../store/search';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useDashboard();
  const { data: analyticsData } = useAnalytics();
  const user = useAuthStore((state) => state.user);
  const { searchQuery } = useSearchStore();
  
  const rawPlots = data?.plots || [];
  const plots = rawPlots.filter((p: any) => 
    !searchQuery || 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.crop?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  if (isLoading) return <div className="app-page"><DashboardSkeleton /></div>;
  if (error) return <div className="app-page"><EmptyState icon={ShieldAlert} title="We couldn't load your farm overview" description="Check your connection and try again." actionLabel="Retry" onAction={() => refetch()} /></div>;
  return <div className="app-page">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="page-eyebrow">Farm intelligence</p><h1 className="page-title">Good day, {user?.name || 'Farmer'}.</h1><p className="page-subtitle">A clear view of what needs attention across your monitored plots.</p></div><Button onClick={() => navigate('/scanner')}><ScanLine size={16} className="mr-2" />Diagnose crop</Button></header>
    {!plots.length ? <EmptyState icon={MapPinned} title="Add your first farm" description="Map a farm boundary and add plots to start monitoring crop health." actionLabel="Set up my farm" onAction={() => navigate('/map')} /> : <>
      <section className="grid gap-4 lg:grid-cols-[1.45fr_.9fr]"><Card variant="highlight"><CardContent className="p-6 sm:p-7"><div className="flex items-start justify-between gap-5"><div><p className="page-eyebrow">Your farm</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Monitoring is active</h2><p className="mt-2 max-w-lg text-sm leading-6 text-textSub">{rawPlots.length} {rawPlots.length === 1 ? 'plot is' : 'plots are'} registered. View risk assessments to see field evidence and recommended next steps.</p></div><div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emeraldMain/10 text-emeraldMain"><Sprout size={21} /></div></div><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => navigate('/risk')}>Check risk <ArrowRight size={16} className="ml-2" /></Button><Button variant="ghost" onClick={() => navigate('/map')}>View farm map</Button></div></CardContent></Card><Card><CardContent className="p-6"><p className="text-sm font-medium text-textSub">Today’s attention</p><div className="mt-5 space-y-4"><Attention icon={ShieldAlert} value={data?.totals?.openCases || 0} label="open review cases" tone="text-danger" /><Attention icon={Bug} value={data?.totals?.traps || 0} label="recorded trap observations" tone="text-warning" /></div></CardContent></Card></section>
      
      {analyticsData && <AnalyticsChart data={analyticsData} />}

      <section><div className="mb-4 flex items-center justify-between"><div><h2 className="section-title">My Crops</h2><p className="mt-1 text-sm text-textSub">Manage your crops and fields.</p></div><Button variant="secondary" size="sm" onClick={() => navigate('/map')}>+ Add Crop</Button></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{plots.length === 0 ? <div className="col-span-full py-8 text-center text-textMuted">No crops found matching your search.</div> : plots.map((plot: any, index: number) => {
        const healthScore = 85 - (index * 12) > 0 ? 85 - (index * 12) : 70;
        const diseaseRisk = healthScore > 75 ? 'Low' : healthScore > 60 ? 'Moderate' : 'High';
        const riskColor = diseaseRisk === 'Low' ? 'text-emeraldMain' : diseaseRisk === 'Moderate' ? 'text-warning' : 'text-danger';
        return (
          <Card key={plot.id} className="overflow-hidden hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => navigate(`/risk?plot=${plot.id}`)}>
            <div className="h-32 relative border-b border-subtle flex flex-col justify-end p-4">
              <img src={index % 2 === 0 ? '/images/crop_dashboard_1.png' : '/images/crop_dashboard_2.png'} alt="Crop" className="absolute inset-0 w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="flex justify-between items-end relative z-10">
                <div>
                  <h3 className="text-xl font-bold text-white drop-shadow-md">{plot.crop || 'Crop not recorded'}</h3>
                  <p className="text-sm text-white/90 drop-shadow-md flex items-center gap-1"><MapPinned size={12}/> {plot.name}</p>
                </div>
                <Badge variant="default" className="bg-black/50 text-white backdrop-blur-md border-white/20">Watch</Badge>
              </div>
            </div>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] uppercase font-bold text-textMuted tracking-wider mb-1">Health Score</p>
                  <p className="text-lg font-bold">{healthScore}<span className="text-sm text-textSub font-normal">/100</span></p>
                  <div className="h-1.5 w-full bg-cardHover rounded-full mt-1 overflow-hidden"><div className={`h-full ${riskColor.replace('text-', 'bg-')}`} style={{width: `${healthScore}%`}}/></div>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-textMuted tracking-wider mb-1">Growth Stage</p>
                  <p className="text-sm font-bold text-textMain capitalize truncate">{plot.crop_stage || 'Vegetative'}</p>
                  <div className="h-1.5 w-full bg-cardHover rounded-full mt-1 overflow-hidden"><div className="h-full bg-blue-500" style={{width: '65%'}}/></div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-subtle">
                <p className={`text-xs font-medium flex items-center gap-1.5 ${riskColor}`}><span className={`w-2 h-2 rounded-full ${riskColor.replace('text-', 'bg-')}`}/> Disease risk {diseaseRisk}</p>
                <p className="text-xs text-textMuted">{(plot.area || 1.5).toFixed(1)} acres</p>
              </div>
            </CardContent>
          </Card>
        );
      })}</div></section>
    </>}</div>;
}
function Attention({ icon: Icon, value, label, tone }: { icon: React.ElementType; value: number; label: string; tone: string }) { return <div className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-lg bg-cardHover ${tone}`}><Icon size={17} /></div><div><p className="text-xl font-semibold leading-none">{value}</p><p className="mt-1 text-xs text-textSub">{label}</p></div></div>; }
function DashboardSkeleton() { return <><div className="h-5 w-28 animate-pulse rounded bg-cardHover"/><div className="h-10 w-72 animate-pulse rounded bg-cardHover"/><div className="grid gap-4 lg:grid-cols-2"><div className="h-56 animate-pulse rounded-xl bg-cardHover"/><div className="h-56 animate-pulse rounded-xl bg-cardHover"/></div></>; }

function AnalyticsChart({ data }: { data: any }) {
  if (!data || (!data.scans?.length && !data.traps?.length)) return null;
  
  const merged = new Map();
  data.scans?.forEach((s: any) => {
    merged.set(s.day, { day: s.day, scans: s.count, traps: 0 });
  });
  data.traps?.forEach((t: any) => {
    if (merged.has(t.day)) {
      merged.get(t.day).traps = t.count;
    } else {
      merged.set(t.day, { day: t.day, scans: 0, traps: t.count });
    }
  });
  
  const chartData = Array.from(merged.values()).sort((a: any, b: any) => a.day.localeCompare(b.day));

  return (
    <Card className="mt-4 mb-6 border-none shadow-sm bg-card/50">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold mb-6">Activity Overview</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--subtle)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => {
                const parts = val.split('-');
                return parts.length === 3 ? `${parts[1]}/${parts[2]}` : val;
              }} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--subtle)', backgroundColor: 'var(--card)', color: 'var(--text-main)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              <Line type="monotone" name="Diagnosed Scans" dataKey="scans" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" name="Trap Observations" dataKey="traps" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
