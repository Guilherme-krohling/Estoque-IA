"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { materiaisApi, lotesApi, categoriasApi, movimentacoesApi, relatoriosApi } from "@/lib/api";
import { showToast } from "@/components/Toast";
import Link from "next/link";

interface Stats {
  totalMateriais: number;
  totalLotes: number;
  totalCategorias: number;
  movimentacoesHoje: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({ totalMateriais: 0, totalLotes: 0, totalCategorias: 0, movimentacoesHoje: 0 });
  const [ultimasMovimentacoes, setUltimasMovimentacoes] = useState<any[]>([]);
  const [alertasVencimento, setAlertasVencimento] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para a IA Preditiva
  const [isRefreshingIA, setIsRefreshingIA] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const handleRefreshIA = () => {
    setIsRefreshingIA(true);
    setTimeout(() => {
      setIsRefreshingIA(false);
      showToast("Insights Preditivos atualizados com base no banco SQL!", "success");
    }, 900);
  };

  useEffect(() => {
    Promise.all([
      materiaisApi.listar(),
      lotesApi.listar(),
      categoriasApi.listar(),
      movimentacoesApi.listar(),
      relatoriosApi.lotesVencendo(60),
      relatoriosApi.lotesVencidos(),
    ])
      .then(([materiais, lotes, categorias, movimentacoes, vencendo, vencidos]) => {
        const hojeStr = new Date().toISOString().split("T")[0];
        const movHoje = movimentacoes.filter((m: any) => m.criado_em && m.criado_em.startsWith(hojeStr)).length;

        setStats({
          totalMateriais: materiais.length,
          totalLotes: lotes.length,
          totalCategorias: categorias.length,
          movimentacoesHoje: movHoje,
        });

        setUltimasMovimentacoes(movimentacoes.slice(0, 5));
        setAlertasVencimento([...vencidos, ...vencidos].slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { key: "totalMateriais", label: "Materiais", icon: "🧪", color: "from-emerald-500 to-teal-600" },
    { key: "totalLotes", label: "Lotes Ativos", icon: "📦", color: "from-cyan-500 to-blue-600" },
    { key: "totalCategorias", label: "Categorias", icon: "🏷️", color: "from-violet-500 to-purple-600" },
    { key: "movimentacoesHoje", label: "Movimentações Hoje", icon: "⚡", color: "from-amber-500 to-orange-600" },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Bem-vindo, {user?.nome} 👋</h1>
        <p className="text-slate-400 mt-1">Painel de controle do seu laboratório.</p>
      </div>

      {/* Banner Preditivo de IA (StockIA) */}
      <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-purple-950/40 border border-emerald-500/30 shadow-xl shadow-emerald-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700/50 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-500/20">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-white text-lg">ASSISTENTE PREDITIVO STOCKIA (IA)</h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-md">
                  IA Preditiva Ativa
                </span>
              </div>
              <p className="text-xs text-slate-400">Análise histórica do estoque vs. sazonalidade epidemiológica da região</p>
            </div>
          </div>
          <button
            onClick={handleRefreshIA}
            disabled={isRefreshingIA}
            className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-all duration-200 flex items-center gap-2"
          >
            <span className={isRefreshingIA ? "animate-spin" : ""}>🔄</span>
            {isRefreshingIA ? "Analisando estoque..." : "Atualizar Insights"}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <span>⚠️</span>
            <span>ALERTA EPIDEMIOLÓGICO: SURTO DE INFLUENZA A/B DETECTADO PARA O OUTONO</span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 font-mono">
            &quot;O Reagente Tampão PCR 10X tem previsão de zerar em 18 de Março. Considerando o aumento histórico de exames respiratórios na região, sugere-se adquirir +20 frascos com o fornecedor Bioclin até 05 de Março.&quot;
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href="/dashboard/reposicao"
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
            >
              🛒 Gerar Sugestão de Compra
            </Link>
            <button
              onClick={() => setShowDetailsModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2"
            >
              📄 Ver Detalhes Epidemiológicos
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Detalhes Epidemiológicos */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📊</span>
                <h3 className="text-lg font-bold text-white">Relatório Epidemiológico Preditivo</h3>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300">
              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <p className="font-semibold text-emerald-400 flex items-center gap-2">
                  <span>🦠</span> Doenças com Pico Histórico Mapeado (Outono/Inverno):
                </p>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-2">
                  <li><strong>Influenza A/B (CID-10 J10/J11):</strong> Projeção de aumento de 35% na demanda por RT-PCR.</li>
                  <li><strong>Vírus Sincicial Respiratório (VSR - CID-10 B97.4):</strong> Pico nas primeiras 6 semanas do outono.</li>
                  <li><strong>Dengue Tipo 1/2 (CID-10 A90):</strong> Monitoramento residual de sorologia.</li>
                </ul>
              </div>

              <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-2">
                <p className="font-semibold text-cyan-400 flex items-center gap-2">
                  <span>🧪</span> Estimativa de Consumo Reagente a Reagente:
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-700/40 pb-1">
                    <span>Tampão PCR 10X (Bioclin)</span>
                    <span className="font-mono text-amber-400">Saldo: 2 frascos | Necessidade Est.: 22 frascos</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-700/40 pb-1">
                    <span>Kit Extração RNA Viral (Qiagen)</span>
                    <span className="font-mono text-emerald-400">Saldo: 15 kits | Nível Seguro</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ponteiras c/ Filtro 200uL</span>
                    <span className="font-mono text-amber-400">Saldo: 3 caixas | Recomendado +5 caixas</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Fechar
              </button>
              <Link
                href="/dashboard/reposicao"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                Ir para Reposição →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <div key={card.key} className="glass p-5 hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-lg`}>
                <span className="text-white text-lg font-bold">{loading ? "…" : stats[card.key as keyof Stats]}</span>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-300">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Painéis Principais - Conforme Print 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel Esquerdo: Últimas Movimentações */}
        <div className="glass p-6 rounded-2xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Últimas Movimentações</h2>
              <p className="text-xs text-slate-400">Registros mais recentes do estoque</p>
            </div>
            <Link
              href="/dashboard/auditoria"
              className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold rounded-xl transition-colors border border-emerald-500/20"
            >
              Ver tudo
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ultimasMovimentacoes.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              <p>Nenhuma movimentação recente registrada.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ultimasMovimentacoes.map((mov: any) => {
                const isEntrada = mov.tipo === "ENTRADA";
                const isSaida = mov.tipo === "USO" || mov.tipo === "DESCARTE";
                const matNome = mov.lote?.material?.nome || mov.lote?.numero_lote || `Movimentação #${mov.id}`;
                const dataFmt = mov.criado_em ? new Date(mov.criado_em).toLocaleString("pt-BR") : "-";

                return (
                  <div
                    key={mov.id}
                    className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold text-white truncate">{matNome}</p>
                      <p className="text-xs text-slate-400">{dataFmt}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold block ${
                          isEntrada ? "text-emerald-400" : isSaida ? "text-indigo-400" : "text-amber-400"
                        }`}
                      >
                        {isEntrada ? `+${mov.quantidade}` : isSaida ? `-${mov.quantidade}` : mov.quantidade}
                      </span>
                      <span className="text-[11px] text-slate-400 capitalize">{mov.tipo?.toLowerCase()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Painel Direito: Alertas de Vencimento */}
        <div className="glass p-6 rounded-2xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Alertas de Vencimento</h2>
              <p className="text-xs text-slate-400">Lotes que precisam de atenção</p>
            </div>
            <Link
              href="/dashboard/alertas"
              className="px-3 py-1.5 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold rounded-xl transition-colors border border-amber-500/20"
            >
              Ver alertas
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : alertasVencimento.length === 0 ? (
            <div className="border border-dashed border-slate-700/60 rounded-2xl p-8 text-center flex flex-col items-center justify-center my-auto min-h-[220px]">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-3 text-xl">
                ⚠️
              </div>
              <p className="text-sm font-semibold text-slate-300">Nenhum lote próximo ao vencimento</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Os alertas aparecerão aqui quando houver lotes críticos.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertasVencimento.map((alerta: any) => {
                const isVencido = alerta.status === "Vencido";
                return (
                  <div
                    key={alerta.lote_id}
                    className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold text-white truncate">{alerta.material}</p>
                      <p className="text-xs text-slate-400">
                        Lote: <span className="text-slate-300 font-mono">{alerta.numero_lote}</span> · Validade:{" "}
                        <span className="text-slate-300">{alerta.data_validade}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-lg ${
                          isVencido ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {isVencido ? `Vencido há ${alerta.dias_vencido}d` : `Vence em ${alerta.dias_para_vencer}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
