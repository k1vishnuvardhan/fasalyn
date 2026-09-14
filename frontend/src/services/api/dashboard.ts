import { request, authHeaders } from './client';

export async function getAnalytics(): Promise<any> {
  return request<any>('/analytics/farmer', { headers: authHeaders() });
}

export async function getDashboard(): Promise<any> {
  return request<any>('/dashboard/farmer', { headers: authHeaders() });
}
