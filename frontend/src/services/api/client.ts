const API = import.meta.env.VITE_API_URL || 'https://fasalyn-api.onrender.com/api';

function extractError(payload: any, fallback: string): string {
  return payload?.error?.message || payload?.detail?.message || payload?.detail || fallback;
}

export function authHeaders(): HeadersInit {
  // Older builds stored the same JWT under `fasalyn-token`.  Keep those
  // sessions valid and migrate them the first time a request is made.
  const token = localStorage.getItem('token') || localStorage.getItem('fasalyn-token');
  if (token && !localStorage.getItem('token')) {
    localStorage.setItem('token', token);
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, options);
  const payload = await response.json().catch(() => null);
  
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) {
      localStorage.removeItem('token');
      localStorage.removeItem('fasalyn-token');
      localStorage.removeItem('fasalyn-user');
      window.location.assign('/login');
    }
    throw new Error(extractError(payload, 'The request could not be completed.'));
  }
  
  return payload as T;
}
