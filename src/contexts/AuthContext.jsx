import { useCallback, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService";
import { AuthContext } from "./auth";
import { UNAUTHORIZED_EVENT } from "../services/api";
import { repository } from "../data";


export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("user"));
      return saved && typeof saved === "object" && typeof saved.name === "string" ? saved : null;
    } catch {
      return null;
    }
  });

  const signIn = useCallback(async (identifier, password) => {
    const { token, user } = await authService.login(identifier, password);
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  }, []);

  const signOut = useCallback(() => {
    // só as chaves do app (não apaga dados de outras origens/ferramentas)
    ["token", "user"].forEach((k) => localStorage.removeItem(k));
    repository.clear();
    setUser(null);
  }, []);

  // 401 vindo da API: encerra a sessão em qualquer tela
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const value = useMemo(() => ({ user, signIn, signOut }), [user, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
