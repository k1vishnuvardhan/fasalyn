import { request, authHeaders } from './client';
import type { Scan } from '../../types';

export async function uploadScan({ plotId, file }: { plotId: string; file: File }): Promise<Scan> {
  const data = new FormData();
  data.append('plotId', plotId);
  data.append('image', file);
  
  return request<Scan>('/scans', {
    method: 'POST',
    headers: authHeaders(),
    body: data,
  });
}

export async function getScans(): Promise<Scan[]> {
  return request<Scan[]>('/scans', { headers: authHeaders() });
}
