/**
 * AuthContext — uses backend /api/auth endpoints + localStorage for token persistence.
 * Avoids Supabase JS auth session management to keep flow predictable.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api from '../lib/api';

const AuthContext = createContext(null);
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const STORAGE_KEY = 'mfd_session';

function readSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeSession(s) {
  if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  else localStorage.removeItem(STORAGE_KEY);
}

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(readSession());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      setProfile(data);
    } catch (_) {
      setProfile(null);
      setSession(null);
      writeSession(null);
    }
  }, []);

  useEffect(() => {
    const initialSession = readSession();
    if (initialSession?.access_token) {
      loadProfile().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { data } = await axios.post(`${BACKEND_URL}/api/auth/login`, { email, password });
    writeSession(data.session);
    setSession(data.session);
    setProfile(data.user);
    return data;
  };

  const signUp = async (payload) => {
    const { data } = await axios.post(`${BACKEND_URL}/api/auth/signup`, payload);
    writeSession(data.session);
    setSession(data.session);
    setProfile(data.user);
    return data;
  };

  const signOut = async () => {
    try { await api.post('/api/auth/logout'); } catch (_) {}
    writeSession(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user: profile, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

export default AuthContext;
