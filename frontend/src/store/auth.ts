import { create } from 'zustand';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: (() => { try { return JSON.parse(localStorage.getItem('fasalyn-user') || 'null'); } catch { return null; } })(),
  token: localStorage.getItem('token') || localStorage.getItem('fasalyn-token'),
  isAuthenticated: !!(localStorage.getItem('token') || localStorage.getItem('fasalyn-token')),
  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('fasalyn-token', token);
    localStorage.setItem('fasalyn-user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('fasalyn-token');
    localStorage.removeItem('fasalyn-user');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
