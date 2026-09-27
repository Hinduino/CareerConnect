import { createContext, useContext, useEffect, useState } from 'react';
import { loginUser, registerUser } from '../api/authApi';

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

  const login = async (email, password) => {
    const data = await loginUser(email, password);
    setAuth({ token: data.token, user: data.user });
    return data;
  };

  const register = async (email, password) => {
    return registerUser(email, password);
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
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
