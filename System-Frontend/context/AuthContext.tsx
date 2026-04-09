import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL } from '../constants/config';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const saved = await AsyncStorage.getItem('@bubble_session');
        if (saved) {
          const parsed = JSON.parse(saved);
          setUser(parsed);
          console.log('[Auth] Session restored:', parsed.username);
        }
      } catch (error) {
        console.error('[Auth] Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const signup = async (username: string, password: string) => {
    try {
      console.log('[Auth] Attempting signup for:', username);
      const res = await fetch(`${BACKEND_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        console.error('[Auth] Signup failed with status:', res.status);
        return { success: false, error: `Server error: ${res.status}` };
      }

      const data = await res.json();
      console.log('[Auth] Signup response:', data);

      if (data.success) {
        const u = { id: data.user_id, username: data.username };
        setUser(u);
        await AsyncStorage.setItem('@bubble_session', JSON.stringify(u));
        console.log('[Auth] Signup successful, session saved');
        return { success: true };
      }
      return { success: false, error: data.error || 'Sign up failed' };
    } catch (e: any) {
      console.error('[Auth] Signup error:', e.message);
      return { success: false, error: 'Network error: Unable to reach server' };
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('[Auth] Attempting login for:', username);
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        console.error('[Auth] Login failed with status:', res.status);
        return { success: false, error: `Server error: ${res.status}` };
      }

      const data = await res.json();
      console.log('[Auth] Login response:', data);

      if (data.success) {
        const u = { id: data.user_id, username: data.username };
        setUser(u);
        await AsyncStorage.setItem('@bubble_session', JSON.stringify(u));
        console.log('[Auth] Login successful, session saved');
        return { success: true };
      }
      return { success: false, error: data.error || 'Login failed' };
    } catch (e: any) {
      console.error('[Auth] Login error:', e.message);
      return { success: false, error: 'Network error: Unable to reach server' };
    }
  };

  const logout = async () => {
    try {
      console.log('[Auth] Starting logout process...');
      // Remove from storage first
      await AsyncStorage.removeItem('@bubble_session');
      console.log('[Auth] AsyncStorage cleared');
      // Then update state to trigger UI re-render
      setUser(null);
      console.log('[Auth] User state set to null');
      console.log('[Auth] Logout successful');
    } catch (error) {
      console.error('[Auth] Error during logout:', error);
      // Still set user to null even if AsyncStorage fails
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};