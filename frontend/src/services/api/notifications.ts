import { request, authHeaders } from './client';
export async function getNotifications(): Promise<any[]> { return request<any[]>('/notifications', { headers: authHeaders() }); }
export async function markNotificationRead(notificationId: string): Promise<void> { await request<void>(`/notifications/${notificationId}/read`, { method:'PUT', headers:authHeaders() }); }
