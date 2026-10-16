/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { fetchProfile, loginUser, registerUser, updateProfile } from '../api/authApi';

const AuthContext = createContext(null);

const STORAGE_KEY = 'careerconnect_auth';

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(loadStoredAuth);

  useEffect(() => {
    if (auth) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [auth]);

  // Refresh the cached user from the server so the profile is always current
  const token = auth?.token;
  useEffect(() => {
    if (!token) return;
    fetchProfile(token)
      .then((data) => setAuth((prev) => (prev ? { ...prev, user: data.user } : prev)))
      .catch(() => {});
  }, [token]);

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    setAuth({ token: data.token, user: data.user });
    return data;
  };

  const register = async (email, password, confirmPassword, role) => {
    return await registerUser(email, password, confirmPassword, role);
  };

  const saveProfile = async (profile) => {
    const data = await updateProfile(auth.token, profile);
    setAuth({ token: auth.token, user: data.user });
    return data;
  };

  const logout = () => {
    setAuth(null);
  };

  const value = {
    token: auth?.token ?? null,
    user: auth?.user ?? null,
    isAuthenticated: Boolean(auth?.token),
    login,
    register,
    saveProfile,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// The hook lives next to its provider on purpose. This only affects hot
// reloading during development, so the fast-refresh warning is silenced here.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
