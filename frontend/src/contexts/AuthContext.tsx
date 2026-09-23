"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { authApi, usuariosApi, setToken, clearToken } from "@/lib/api";

interface User {
  id: number;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

// =====================================================================
// Helpers de cookie — permitem que o middleware Edge (middleware.ts)
// verifique a autenticação antes do React hidratar a página
// =====================================================================
const TOKEN_COOKIE = "laurus_token";
const TOKEN_EXPIRE_SECONDS = 60 * 60; // 1 hora — mesmo valor do JWT

function setTokenCookie(token: string) {
  document.cookie = [
    `${TOKEN_COOKIE}=${token}`,
    "path=/",
    "SameSite=Strict",
    // Em produção HTTPS, adicionar: "Secure"
    `max-age=${TOKEN_EXPIRE_SECONDS}`,
  ].join("; ");
}

function clearTokenCookie() {
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0`;
}

// =====================================================================
// Provider
// =====================================================================
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("laurus_token");
    if (token) {
      usuariosApi
        .me()
        .then(setUser)
        .catch(() => {
          clearToken();
          clearTokenCookie();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, senha: string) => {
    const response = await authApi.login({ email, senha });

    // Persiste em localStorage (usado pelas chamadas de API)
    setToken(response.access_token);

    // Persiste também em cookie para que o middleware Edge possa verificar antes do React
    setTokenCookie(response.access_token);

    const me = await usuariosApi.me();
    setUser(me);
  };

  const logout = () => {
    clearToken();
    clearTokenCookie(); // Limpa o cookie do middleware junto com o localStorage
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
