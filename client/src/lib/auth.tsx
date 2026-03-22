'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User { id: number; username: string; email: string; }

interface Ctx {
  user: User | null; token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void; loading: boolean;
}

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('nepse_token');
    const u = localStorage.getItem('nepse_user');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res  = await fetch('/nepse/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? 'Login failed');
    const u: User = { id: data.user_id, username: data.username, email: data.email };
    setToken(data.token); setUser(u);
    localStorage.setItem('nepse_token', data.token);
    localStorage.setItem('nepse_user',  JSON.stringify(u));
  };

  const register = async (username: string, email: string, password: string) => {
    const res  = await fetch('/nepse/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? 'Registration failed');
    await login(email, password);
  };

  const logout = () => {
    if (token) fetch('/nepse/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    setUser(null); setToken(null);
    localStorage.removeItem('nepse_token');
    localStorage.removeItem('nepse_user');
  };

  return <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
