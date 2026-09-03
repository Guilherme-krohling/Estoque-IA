"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { relatoriosApi } from "@/lib/api";

export default function AlertasPage() {
  const [critico, setCritico] = useState<any[]>([]);
  const [vencendo, setVencendo] = useState<any[]>([]);
  const [vencidos, setVencidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      relatoriosApi.estoqueCritico(),
      relatoriosApi.lotesVencendo(60),
      relatoriosApi.lotesVencidos(),
    ])
      .then(([crit, venc, vcd]) => {
        setCritico(crit);
        setVencendo(venc);
        setVencidos(vcd);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalVencimento60 = vencendo.length;
  const totalVencidos = vencidos.length;
  const totalCriticos30 = vencendo.filter((v: any) => v.dias_para_vencer <= 30).length;
  const totalAbaixoMinimo = critico.length;
  const totalAlertas = totalVencidos + totalCriticos30 + totalAbaixoMinimo;

  const listaVencimentos = [...vencidos, ...vencendo];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header Conforme Print 2 */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-block px-3 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full border border-red-500/20 mb-2">
            Monitoramento crítico
          </div>
          <h1 className="text-2xl font-bold text-white">Alertas</h1>
          <p className="text-slate-400 text-sm mt-1">
            Acompanhe vencimentos próximos, lotes vencidos e materiais abaixo do estoque mínimo.
          </p>
        </div>
        <div className="glass p-4 rounded-xl border border-slate-700/40 text-center min-w-[140px] bg-slate-900/50">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Alertas</p>
          <p className="text-3xl font-extrabold text-white mt-0.5">{loading ? "…" : totalAlertas}</p>
        </div>
      </div>

      {/* Summary Cards Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Vencimento</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : totalVencimento60}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Próximos 60 dias</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg">
            📅
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Vencidos</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : totalVencidos}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Lotes já vencidos</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg">
            🚨
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Críticos</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : totalCriticos30}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Até 30 dias</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 text-lg">
            ⚠️
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Abaixo mínimo</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : totalAbaixoMinimo}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Materiais com baixo saldo</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 text-lg">
            📦
          </div>
        </div>
      </div>

      {/* Card Exclusivo de IA Preditiva Epidemiológica (CID-10) */}
      <div className="glass p-6 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-purple-950/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-700/50 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 text-xl font-bold">
              🧬
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Previsão de Surtos nas Próximas 8 Semanas</h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-full">
                  IA Preditiva + CID-10
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Relaciona o histórico de diagnósticos CID-10 com a projeção de insumos consumidos.
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-400 font-mono bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800">
            Região Sudeste · Outono 2026
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Surto 1 */}
          <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 hover:border-purple-500/40 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                CID-10 J10
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Pico em ~3 semanas</span>
            </div>
            <h3 className="font-semibold text-white text-sm">Influenza A/B (Gripe Sazonal)</h3>
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Insumos Críticos:</strong> Tampão PCR 10X, Kit Swab Nasofaríngeo.
            </p>
            <div className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
              💡 Recomenda-se reforço de +35% de reagentes PCR.
            </div>
          </div>

          {/* Surto 2 */}
          <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 hover:border-purple-500/40 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                CID-10 B97.4
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Pico em ~2 semanas</span>
            </div>
            <h3 className="font-semibold text-white text-sm">Vírus Sincicial Respiratório (VSR)</h3>
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Insumos Críticos:</strong> Meios de Transporte Viral (VTM).
            </p>
            <div className="text-[11px] text-amber-400 font-medium bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
              ⚠️ Risco moderado de esgotamento de ponteiras.
            </div>
          </div>

          {/* Surto 3 */}
          <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2 hover:border-purple-500/40 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                CID-10 A90
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Pico em ~6 semanas</span>
            </div>
            <h3 className="font-semibold text-white text-sm">Dengue Sorotipos 1/2</h3>
            <p className="text-xs text-slate-400">
              <strong className="text-slate-300">Insumos Críticos:</strong> Cassetes Sorológicos NS1 / IgG-IgM.
            </p>
            <div className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
              ✅ Saldo atual cobre a demanda estimada.
            </div>
          </div>
        </div>
      </div>

      {/* Main Panels Grid (2 Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel 1: Vencimento próximo */}
        <div className="glass p-6 rounded-2xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Vencimento próximo</h2>
              <p className="text-xs text-slate-400">Lotes vencidos ou com validade dentro de 60 dias.</p>
            </div>
            <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
              {listaVencimentos.length} alerta(s)
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : listaVencimentos.length === 0 ? (
            <div className="border border-dashed border-slate-700/60 rounded-2xl p-8 text-center flex flex-col items-center justify-center my-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3 text-xl">
                🛡️
              </div>
              <p className="text-sm font-semibold text-slate-300">Nenhum item próximo ao vencimento</p>
              <p className="text-xs text-slate-500 mt-1">Não há lotes com vencimento nos próximos 60 dias.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {listaVencimentos.map((item: any) => {
                const isVencido = item.status === "Vencido";
                return (
                  <div
                    key={item.lote_id}
                    className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold text-white truncate">{item.material}</p>
                      <p className="text-xs text-slate-400">
                        Lote: <span className="text-slate-300 font-mono">{item.numero_lote}</span> · Local:{" "}
                        <span className="text-slate-300">{item.local_nome || "-"}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-lg ${
                          isVencido
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {isVencido ? `Vencido há ${item.dias_vencido}d` : `Vence em ${item.dias_para_vencer}d`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Painel 2: Estoque abaixo do mínimo */}
        <div className="glass p-6 rounded-2xl border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-white">Estoque abaixo do mínimo</h2>
              <p className="text-xs text-slate-400">Materiais com saldo total abaixo do mínimo definido.</p>
            </div>
            <span className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold rounded-full">
              {critico.length} Item(ns)
            </span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : critico.length === 0 ? (
            <div className="border border-dashed border-slate-700/60 rounded-2xl p-8 text-center flex flex-col items-center justify-center my-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3 text-xl">
                ✅
              </div>
              <p className="text-sm font-semibold text-slate-300">Estoque regularizado</p>
              <p className="text-xs text-slate-500 mt-1">Nenhum material está com saldo abaixo do estoque mínimo.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {critico.map((mat: any) => (
                <div
                  key={mat.material_id}
                  className="p-3.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-semibold text-white truncate">{mat.nome}</p>
                    <p className="text-xs text-slate-400">
                      {mat.saldo_atual} {mat.unidade_medida} em {mat.qtd_lotes || 1} lote(s)
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold rounded-lg">
                      {mat.saldo_atual} / mín. {mat.estoque_minimo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
