import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import { generateAndWrapUserKeyPair, importUserKeyPairFromJwk, unlockUserPrivateKey } from "../utils/e2ee";

const E2EE_SESSION_STORAGE_KEY = "medivault.e2ee.unlocked.v1";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);
  const [e2ee, setE2ee] = useState({ publicKey: null, privateKey: null, ready: false, error: "" });

  const clearE2eeSession = useCallback(() => {
    try {
      sessionStorage.removeItem(E2EE_SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const persistE2eeSession = useCallback(({ publicKeyJwk, privateKeyJwk }) => {
    try {
      if (!publicKeyJwk || !privateKeyJwk) return;
      sessionStorage.setItem(
        E2EE_SESSION_STORAGE_KEY,
        JSON.stringify({ publicKeyJwk, privateKeyJwk, ts: Date.now() })
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    // If the user is authed via persisted JWT (localStorage) but refreshed the page,
    // restore unlocked E2EE keys from sessionStorage so encrypted records can be opened.
    if (!token) {
      clearE2eeSession();
      setE2ee({ publicKey: null, privateKey: null, ready: false, error: "" });
      return;
    }

    if (e2ee?.privateKey) return;
    let cached = null;
    try {
      const raw = sessionStorage.getItem(E2EE_SESSION_STORAGE_KEY);
      cached = raw ? JSON.parse(raw) : null;
    } catch {
      cached = null;
    }

    if (!cached?.publicKeyJwk || !cached?.privateKeyJwk) return;
    (async () => {
      try {
        const imported = await importUserKeyPairFromJwk({
          publicKeyJwk: cached.publicKeyJwk,
          privateKeyJwk: cached.privateKeyJwk,
        });
        setE2ee({ publicKey: imported.publicKey, privateKey: imported.privateKey, ready: true, error: "" });
      } catch {
        clearE2eeSession();
      }
    })();
  }, [token, e2ee?.privateKey, clearE2eeSession]);

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
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // E2EE: unlock existing keys or generate+store new ones using the login password
      try {
        const u = data.user;
        if (u?.e2eePublicKeyJwk && u?.e2eeEncryptedPrivateKey && u?.e2eeKdfSalt && u?.e2eePrivateKeyIv) {
          const unlocked = await unlockUserPrivateKey({
            password,
            encryptedPrivateKey: u.e2eeEncryptedPrivateKey,
            kdfSalt: u.e2eeKdfSalt,
            kdfIterations: u.e2eeKdfIterations,
            privateKeyIv: u.e2eePrivateKeyIv,
            publicKeyJwk: u.e2eePublicKeyJwk,
          });
          persistE2eeSession({ publicKeyJwk: unlocked.publicKeyJwk, privateKeyJwk: unlocked.privateKeyJwk });
          setE2ee({ publicKey: unlocked.publicKey, privateKey: unlocked.privateKey, ready: true, error: "" });
        } else {
          const created = await generateAndWrapUserKeyPair({ password });
          const res = await api.put(
            "/api/auth/e2ee/keys",
            {
              publicKeyJwk: created.publicKeyJwk,
              encryptedPrivateKey: created.encryptedPrivateKey,
              kdfSalt: created.kdfSalt,
              kdfIterations: created.kdfIterations,
              privateKeyIv: created.privateKeyIv,
              version: created.version,
            },
            { headers: { Authorization: `Bearer ${data.token}` } }
          );
          setUser(res.data.user);
          localStorage.setItem("user", JSON.stringify(res.data.user));
          persistE2eeSession({ publicKeyJwk: created.publicKeyJwk, privateKeyJwk: created.privateKeyJwk });
          setE2ee({ publicKey: created.publicKey, privateKey: created.privateKey, ready: true, error: "" });
        }
      } catch {
        clearE2eeSession();
        setE2ee({ publicKey: null, privateKey: null, ready: false, error: "Encryption keys are locked. Please log in again." });
      }
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Login failed. Please try again." };
    } finally {
      setLoading(false);
    }
  }, [clearE2eeSession, persistE2eeSession]);

  const register = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/register", payload);
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // E2EE: new users get keys immediately using their chosen password
      try {
        const password = payload?.password;
        const created = await generateAndWrapUserKeyPair({ password });
        const res = await api.put(
          "/api/auth/e2ee/keys",
          {
            publicKeyJwk: created.publicKeyJwk,
            encryptedPrivateKey: created.encryptedPrivateKey,
            kdfSalt: created.kdfSalt,
            kdfIterations: created.kdfIterations,
            privateKeyIv: created.privateKeyIv,
            version: created.version,
          },
          { headers: { Authorization: `Bearer ${data.token}` } }
        );
        setUser(res.data.user);
        localStorage.setItem("user", JSON.stringify(res.data.user));
        persistE2eeSession({ publicKeyJwk: created.publicKeyJwk, privateKeyJwk: created.privateKeyJwk });
        setE2ee({ publicKey: created.publicKey, privateKey: created.privateKey, ready: true, error: "" });
      } catch {
        clearE2eeSession();
        setE2ee({ publicKey: null, privateKey: null, ready: false, error: "Encryption keys are locked. Please log in again." });
      }
      return { ok: true, user: data.user };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Registration failed. Please try again." };
    } finally {
      setLoading(false);
    }
  }, [clearE2eeSession, persistE2eeSession]);

  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    setE2ee({ publicKey: null, privateKey: null, ready: false, error: "" });
    clearE2eeSession();
    window.location.href = "/login";
  }, [clearE2eeSession]);

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
    () => ({ token, user, loading, isAuthed: Boolean(token), e2ee, login, register, logout, updateUser, refreshMe }),
    [token, user, loading, e2ee, login, register, logout, updateUser, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

