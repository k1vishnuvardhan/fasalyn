import { request, authHeaders } from './client';
import type { Farm, Plot, RiskAssessment, TrapObservation } from '../../types';

export async function getFarms(): Promise<Farm[]> {
  return request<Farm[]>('/farms', { headers: authHeaders() });
}

export async function createFarm(data: Partial<Farm>): Promise<Farm> {
  return request<Farm>('/farms', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getPlots(farmId: string): Promise<Plot[]> {
  return request<Plot[]>(`/farms/${farmId}/plots`, { headers: authHeaders() });
}

export async function createPlot(farmId: string, data: Partial<Plot>): Promise<Plot> {
  return request<Plot>(`/farms/${farmId}/plots`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getMapConfig(): Promise<any> {
  return request<any>('/map/config', { headers: authHeaders() });
}

export async function saveFarmBoundary(farmId: string, polygonGeometry: any): Promise<Farm> {
  return request<Farm>(`/farms/${farmId}/boundary`, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ polygonGeometry }),
  });
}

export async function getSpatialHealth(farmId: string): Promise<any> {
  return request<any>(`/farms/${farmId}/spatial-health`, { headers: authHeaders() });
}

export async function getRisk(plotId: string): Promise<RiskAssessment> {
  return request<RiskAssessment>(`/plots/${plotId}/risk`, { headers: authHeaders() });
}

export async function getTraps(plotId: string): Promise<TrapObservation[]> {
  return request<TrapObservation[]>(`/plots/${plotId}/traps`, { headers: authHeaders() });
}

export async function saveTrap(data: Partial<TrapObservation>): Promise<TrapObservation> {
  return request<TrapObservation>('/traps/observations', {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function getAdvisories(plotId: string): Promise<any[]> { return request<any[]>(`/plots/${plotId}/advisories`, { headers: authHeaders() }); }
export async function getFollowUps(plotId: string): Promise<any[]> { return request<any[]>(`/plots/${plotId}/follow-ups`, { headers: authHeaders() }); }
export async function createFollowUp(plotId: string, data: { scanId?: string; pestCount?: number; severity?: 'LOW'|'MODERATE'|'HIGH'|'CRITICAL'; notes: string }): Promise<any> { return request<any>(`/plots/${plotId}/follow-ups`, { method:'POST', headers:{...authHeaders(),'Content-Type':'application/json'}, body:JSON.stringify(data) }); }
