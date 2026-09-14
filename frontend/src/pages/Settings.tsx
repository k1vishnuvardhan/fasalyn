import React, { useState } from 'react';
import { useAuthStore } from '../store/auth';
import { useFarms } from '../hooks/queries';
import { createFarm } from '../services/api';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { LogOut, Map, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, logout } = useAuthStore();
  const { data: farms } = useFarms();
  const queryClient = useQueryClient();
  const nav = useNavigate();
  
  const [formData, setFormData] = useState({ name: '', crop: '', areaSquareMeters: 1000 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    logout();
    nav('/login');
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await createFarm({
        name: formData.name,
        crop: formData.crop,
        areaSquareMeters: formData.areaSquareMeters,
        areaUnit: 'sqm',
        monitoringMode: 'QUICK_DETECTION'
      });
      queryClient.invalidateQueries({ queryKey: ['farms'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setFormData({ name: '', crop: '', areaSquareMeters: 1000 });
      alert("Farm created successfully!");
    } catch (err: any) {
      alert(err.message || 'Failed to create farm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-textMain">Settings</h1>
        <p className="text-textSub mt-1">Manage your account and farm properties.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-textSub">Name</p>
              <p className="text-textMain font-medium">{user?.name || 'Demo Farmer'}</p>
            </div>
            <div>
              <p className="text-sm text-textSub">Email</p>
              <p className="text-textMain font-medium">{user?.email || 'demo@fasalyn.com'}</p>
            </div>
            <div>
              <p className="text-sm text-textSub">Role</p>
              <p className="text-textMain font-medium capitalize">{user?.role || 'Farmer'}</p>
            </div>
            
            <div className="pt-4 border-t border-subtle">
              <Button variant="danger" onClick={handleLogout} className="w-full">
                <LogOut size={16} className="mr-2" /> Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Register Farm</CardTitle>
          </CardHeader>
          <CardContent>
            {farms && farms.length > 0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-emeraldMain/10 border border-emeraldMain/30 rounded-lg text-emerald-400 flex items-center gap-3">
                  <Map size={24} />
                  <div>
                    <p className="font-medium">Farm Registered</p>
                    <p className="text-sm opacity-80">{farms[0].name}</p>
                  </div>
                </div>
                <p className="text-sm text-textSub">You already have a farm registered. Multi-farm support is coming soon.</p>
              </div>
            ) : (
              <form onSubmit={handleCreateFarm} className="space-y-4">
                <p className="text-sm text-textSub mb-4">You need to register a farm before creating plots.</p>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-textSub">Farm Name</label>
                  <Input 
                    placeholder="e.g. Green Valley Farm" 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-textSub">Primary Crop</label>
                  <Input 
                    placeholder="e.g. Cotton" 
                    value={formData.crop} 
                    onChange={e => setFormData({ ...formData, crop: e.target.value })}
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-textSub">Area (sq meters)</label>
                  <Input 
                    type="number"
                    value={formData.areaSquareMeters} 
                    onChange={e => setFormData({ ...formData, areaSquareMeters: parseInt(e.target.value) || 0 })}
                    required 
                  />
                </div>
                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  <Plus size={16} className="mr-2" /> Create Farm
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
