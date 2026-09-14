import { request } from './client';
import type { User } from '../../types';

export async function registerAccount(data: any): Promise<{ user: User; token: string }> {
  return request<{ user: User; token: string }>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function loginAccount(data: any): Promise<{ user: User; token: string }> {
  return request<{ user: User; token: string }>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
