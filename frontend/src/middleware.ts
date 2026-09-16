/**
 * StockIA — Route Guard no Edge (Next.js Middleware)
 * ====================================================
 * Roda ANTES do React hidratar qualquer página.
 * Protege todas as rotas /dashboard/* contra acesso não autenticado.
 *
 * Lê o token do cookie "stockia_token" (definido no AuthContext ao fazer login).
 * Se ausente, redireciona para /login antes de qualquer HTML ser entregue ao browser.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Prefixos de rotas que exigem autenticação
const PROTECTED_PREFIXES = ["/dashboard"];

// Nome do cookie onde o token JWT é armazenado (deve coincidir com AuthContext.tsx)
const TOKEN_COOKIE = "stockia_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!isProtected) {
    return NextResponse.next(); // Rota pública — deixar passar sem verificação
  }

  // Verifica presença do token no cookie
  const token = request.cookies.get(TOKEN_COOKIE)?.value;

  if (!token) {
    // Sem token: redirecionar para login, preservando o destino original como parâmetro
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next(); // Token presente — permitir acesso
}

// Define em quais rotas o middleware executa
export const config = {
  matcher: [
    // Protege tudo dentro de /dashboard (incluindo sub-rotas)
    "/dashboard/:path*",
    // Garante que o middleware NÃO intercepte assets estáticos do Next.js
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
