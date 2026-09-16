import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Desabilita Source Maps no build de produção (evita engenharia reversa do bundle).
  // Em desenvolvimento (next dev) os maps continuam ativos normalmente.
  productionBrowserSourceMaps: false,

  // Ativa compressão Gzip nos assets estáticos
  compress: true,

  // Headers de segurança HTTP para o frontend
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            // Content Security Policy — restringe origens de scripts, estilos e conexões
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // unsafe-eval e unsafe-inline são necessários para Next.js em dev;
              // em produção com output: 'standalone', remover unsafe-eval
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              // Permite conexão com a API (dev e prod)
              "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000",
              "frame-ancestors 'none'", // Equivalente a X-Frame-Options: DENY via CSP
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), microphone=(), camera=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
