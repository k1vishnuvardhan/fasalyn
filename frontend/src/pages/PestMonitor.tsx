import React, { useState } from 'react';
import { useDashboard, useTraps } from '../hooks/queries';
import { saveTrap } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { EmptyState } from '../components/ui/EmptyState';
import { Bug, Plus, Activity } from 'lucide-react';
import { Badge } from '../components/ui/Badge';

export default function PestMonitor() {
  const { data: dashboardData } = useDashboard();
  const [selectedPlot, setSelectedPlot] = useState<string>('');
  
  const { data: traps, isLoading } = useTraps(selectedPlot);
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ trapType: 'Yellow Sticky Trap', pest: '', count: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const plots = dashboardData?.plots || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlot) return;
    setIsSubmitting(true);
    try {
      await saveTrap({
        plotId: selectedPlot,
        trapType: formData.trapType,
        pest: formData.pest,
        count: formData.count,
        observedAt: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['traps', selectedPlot] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      setFormData({ trapType: 'Yellow Sticky Trap', pest: '', count: 0 });
    } catch (err: any) {
      alert(err.message || 'Failed to record trap observation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-textMain">Pest Monitor</h1>
          <p className="text-textSub mt-1">Track physical trap observations and pest pressure.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <select 
            className="w-full sm:w-64 h-10 px-3 bg-cardHover border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-emeraldMain text-textMain"
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
          >
            <option value="" disabled>-- Select a plot --</option>
            {plots.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.crop})</option>
            ))}
          </select>
          {selectedPlot && (
            <Button onClick={() => setShowForm(true)} className="whitespace-nowrap">
              <Plus size={16} className="mr-2" /> Record Trap
            </Button>
          )}
        </div>
      </div>

      {!selectedPlot ? (
        <EmptyState 
          icon={Bug}
          title="Select a Plot" 
          description="Choose a plot from the dropdown above to view its pest monitoring data and record trap observations." 
        />
      ) : isLoading ? (
        <Card className="p-12"><Loader size={32} /></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity size={18} className="text-emeraldMain" /> Trap Observations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!traps || traps.length === 0 ? (
                  <div className="text-center py-12 text-textSub border border-dashed border-subtle rounded-lg">
                    No trap data recorded for this plot yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {traps.map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-cardHover rounded-xl border border-subtle hover:border-emeraldMain/30 transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-textMain">{t.pest}</span>
                            <Badge variant={t.count > 50 ? 'danger' : t.count > 20 ? 'warning' : 'success'}>
                              {t.count} count
                            </Badge>
                          </div>
                          <p className="text-sm text-textSub mt-1">{t.trap_type} • {new Date(t.observed_at).toLocaleString()}</p>
                        </div>
                        <Bug className="text-subtle" size={24} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-1">
            {showForm && (
              <Card className="sticky top-20 border-emeraldMain/30 shadow-lg shadow-emeraldMain/5">
                <CardHeader>
                  <CardTitle>New Observation</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-textSub">Trap Type</label>
                      <select 
                        className="w-full h-10 px-3 bg-cardHover border border-subtle rounded-lg focus:outline-none focus:ring-2 focus:ring-emeraldMain text-textMain"
                        value={formData.trapType} 
                        onChange={e => setFormData({ ...formData, trapType: e.target.value })}
                        required
                      >
                        <option value="Yellow Sticky Trap">Yellow Sticky Trap</option>
                        <option value="Pheromone Trap">Pheromone Trap</option>
                        <option value="Light Trap">Light Trap</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-textSub">Pest Species (e.g. Aphids)</label>
                      <Input 
                        placeholder="e.g. Aphids, Whiteflies" 
                        value={formData.pest} 
                        onChange={e => setFormData({ ...formData, pest: e.target.value })}
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-textSub">Count</label>
                      <Input 
                        type="number"
                        min={0}
                        value={formData.count} 
                        onChange={e => setFormData({ ...formData, count: parseInt(e.target.value) || 0 })}
                        required 
                      />
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowForm(false)}>Cancel</Button>
                      <Button type="submit" className="flex-1" isLoading={isSubmitting}>Save</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
