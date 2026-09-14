import { request, authHeaders } from './client';
import type { OfficerCase, Farm } from '../../types';

export async function getOfficerCases(): Promise<OfficerCase[]> {
  return request<OfficerCase[]>('/officer/cases', { headers: authHeaders() });
}

export async function getOfficerFarms(): Promise<Farm[]> {
  return request<Farm[]>('/officer/farms', { headers: authHeaders() });
}

export async function getOfficerHotspots(): Promise<any> {
  return request<any>('/hotspots', { headers: authHeaders() });
}
