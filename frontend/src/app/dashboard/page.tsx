"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { materiaisApi, lotesApi, categoriasApi, movimentacoesApi } from "@/lib/api";

interface Stats {
  totalMateriais: number;
  totalLotes: number;
  totalCategorias: number;
  totalMovimentacoes: number;
}

const statCards = [
  { key: "totalMateriais", label: "Materiais", icon: "🧪", color: "from-emerald-500 to-teal-600" },
  { key: "totalLotes", label: "Lotes Ativos", icon: "📦", color: "from-cyan-500 to-blue-600" },
  { key: "totalCategorias", label: "Categorias", icon: "🏷️", color: "from-violet-500 to-purple-600" },
  { key: "totalMovimentacoes", label: "Movimentações", icon: "🔄", color: "from-amber-500 to-orange-600" },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalMateriais: 0,
    totalLotes: 0,
    totalCategorias: 0,
    totalMovimentacoes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      materiaisApi.listar(),
      lotesApi.listar(),
      categoriasApi.listar(),
      movimentacoesApi.listar(),
    ])
      .then(([materiais, lotes, categorias, movimentacoes]) => {
        setStats({
          totalMateriais: materiais.length,
          totalLotes: lotes.length,
          totalCategorias: categorias.length,
          totalMovimentacoes: movimentacoes.length,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Bem-vindo, {user?.nome} 👋
        </h1>
        <p className="text-slate-400 mt-1">
          Painel de controle do seu laboratório.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {statCards.map((card) => (
          <div
            key={card.key}
            className="glass p-5 hover:scale-[1.02] transition-transform duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div
                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}
              >
                <span className="text-white text-lg font-bold">
                  {loading
                    ? "…"
                    : stats[card.key as keyof Stats]}
                </span>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-300">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>🧠</span> Módulo de IA
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            O módulo de Inteligência Artificial será ativado na Fase 3 do
            projeto. Ele permitirá previsão de demanda baseada no histórico de
            consumo, alertas inteligentes e análise de FISPQs via RAG.
          </p>
          <div className="mt-4 px-3 py-1.5 bg-amber-500/10 text-amber-400 text-xs font-medium rounded-lg inline-block">
            Em desenvolvimento
          </div>
        </div>

        <div className="glass p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>🔒</span> Segurança
          </h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Todas as rotas da API são protegidas por autenticação JWT. Cada
            movimentação de estoque registra automaticamente o usuário
            responsável para auditoria e compliance (ANVISA/ISO/GLP).
          </p>
          <div className="mt-4 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-lg inline-block">
            Ativo
          </div>
        </div>
      </div>
    </div>
  );
}
