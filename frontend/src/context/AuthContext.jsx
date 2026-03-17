import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Login failed. Please try again." };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", payload);
      setToken(data.token);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Registration failed. Please try again." };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    window.location.href = "/login";
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get("/api/auth/me");
      setUser(data.user);
    } catch {
      // handled by axios 401 interceptor
    }
  }, [token]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const updateUser = useCallback(async (updates) => {
    setLoading(true);
    try {
      const { data } = await api.put("/api/auth/profile", updates);
      setUser(data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Update failed. Please try again." };
    } finally {
      setLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, isAuthed: Boolean(token), login, register, logout, updateUser, refreshMe }),
    [token, user, loading, login, register, logout, updateUser, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

