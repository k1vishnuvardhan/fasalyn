import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, Inbox, RefreshCw } from 'lucide-react';
import { getNotifications, markNotificationRead } from '../services/api';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Loader } from '../components/ui/Loader';
import { useNavigate } from 'react-router-dom';

export default function Alerts() {
  const navigate = useNavigate(); const [items, setItems] = useState<any[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const load = async () => { setLoading(true); setError(''); try { setItems(await getNotifications()); } catch (err: any) { setError(err.message || 'We could not load alerts right now.'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  async function open(item: any) { if (!item.read_at) { try { await markNotificationRead(item.id); setItems(current => current.map(x => x.id === item.id ? { ...x, read_at: new Date().toISOString() } : x)); } catch {} } if (item.link) navigate(item.link); }
  return <div className="app-page max-w-4xl"><header className="flex items-end justify-between gap-4"><div><p className="page-eyebrow">Attention</p><h1 className="page-title">Alerts and updates</h1><p className="page-subtitle">Important activity from crop assessments, follow-ups, and officer workflows.</p></div><Button variant="secondary" size="sm" onClick={load}><RefreshCw size={15} className="mr-1"/>Refresh</Button></header>{loading ? <Card><CardContent className="grid min-h-48 place-items-center"><Loader size={28}/></CardContent></Card> : error ? <Card><CardContent><p className="text-danger">{error}</p><Button className="mt-4" onClick={load}>Retry</Button></CardContent></Card> : !items.length ? <EmptyState icon={Inbox} title="No active alerts" description="Your assessment and follow-up updates will appear here."/> : <div className="surface divide-y divide-subtle">{items.map(item => <button key={item.id} onClick={() => open(item)} className={`flex w-full gap-4 px-5 py-4 text-left transition-colors hover:bg-cardHover ${item.read_at ? 'opacity-70' : ''}`}><div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full ${item.read_at ? 'bg-cardHover text-textMuted' : 'bg-emeraldMain/10 text-emeraldMain'}`}><Bell size={17}/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="font-medium">{item.title}</p>{item.read_at && <CheckCheck size={16} className="text-textMuted"/>}</div><p className="mt-1 text-sm leading-5 text-textSub">{item.body}</p><p className="mt-2 text-xs text-textMuted">{new Date(item.created_at).toLocaleString()}</p></div></button>)}</div>}</div>;
}
