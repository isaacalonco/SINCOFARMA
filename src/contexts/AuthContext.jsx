import { useCallback, useEffect, useMemo, useState } from "react";
import * as authService from "../services/authService";
import { AuthContext } from "./auth";
import { UNAUTHORIZED_EVENT } from "../services/api";
import { repository } from "../data";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authService.currentUser);

  const signIn = useCallback(async (identifier, password) => {
    setUser(await authService.login(identifier, password));
  }, []);

  /** Primeiro acesso (Cognito): define a nova senha a partir do desafio recebido no login. */
  const completeNewPassword = useCallback(async (challenge, newPassword) => {
    setUser(await authService.completeNewPassword(challenge, newPassword));
  }, []);

  const signOut = useCallback(() => {
    authService.logout();
    repository.clear();
    setUser(null);
  }, []);

  // 401 vindo da API: encerra a sessão em qualquer tela
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  const value = useMemo(
    () => ({ user, signIn, signOut, completeNewPassword, mode: authService.AUTH_MODE }),
    [user, signIn, signOut, completeNewPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
