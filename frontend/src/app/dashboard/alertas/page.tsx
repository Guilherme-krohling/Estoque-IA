"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { relatoriosApi, iaApi } from "@/lib/api";

export default function AlertasPage() {
  const [critico, setCritico] = useState<any[]>([]);
  const [vencendo, setVencendo] = useState<any[]>([]);
  const [vencidos, setVencidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Motor Algorítmico e Previsões Epidemiológicas Salvas
  const [previsoesSalvas, setPrevisoesSalvas] = useState<any[]>([]);
  const [previsaoSelecionadaId, setPrevisaoSelecionadaId] = useState<number | null>(null);
  const [analiseAlgoritmica, setAnaliseAlgoritmica] = useState<any>(null);
  const [loadingAlgoritmo, setLoadingAlgoritmo] = useState(true);
  const [mostrarTodosMateriais, setMostrarTodosMateriais] = useState(false);

  // Carrega relatórios de vencimento/estoque crítico + lista de previsões salvas
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

    iaApi
      .listarPrevisoesSalvas()
      .then((lista) => {
        const arr = lista || [];
        setPrevisoesSalvas(arr);
        if (arr.length > 0) {
          setPrevisaoSelecionadaId(arr[0].id);
        } else {
          setPrevisaoSelecionadaId(null);
        }
      })
      .catch(() => {
        setPrevisoesSalvas([]);
        setPrevisaoSelecionadaId(null);
      });
  }, []);

  // Recalcula a análise matemática determinística sempre que a previsão selecionada mudar
  useEffect(() => {
    let cancelado = false;
    setLoadingAlgoritmo(true);

    iaApi
      .analiseEstoqueAlgoritmica(previsaoSelecionadaId)
      .then((res) => {
        if (!cancelado) {
          setAnaliseAlgoritmica(res);
        }
      })
      .catch((err) => {
        console.error("Erro na análise algorítmica de estoque:", err);
        if (!cancelado) {
          setAnaliseAlgoritmica(null);
        }
      })
      .finally(() => {
        if (!cancelado) {
          setLoadingAlgoritmo(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [previsaoSelecionadaId]);

  const totalVencimento60 = vencendo.length;
  const totalVencidos = vencidos.length;
  const totalCriticos30 = vencendo.filter((v: any) => v.dias_para_vencer <= 30).length;
  const totalAbaixoMinimo = critico.length;
  const totalAlertas = totalVencidos + totalCriticos30 + totalAbaixoMinimo;

  const listaVencimentos = [...vencidos, ...vencendo];

  const materiaisAnalisados: any[] = analiseAlgoritmica?.materiais || [];
  const materiaisEmAlerta = materiaisAnalisados.filter(
    (m) => m.risco === "ALTO" || m.risco === "MODERADO" || m.quantidade_recomendada_comprar > 0
  );
  const materiaisExibidos = mostrarTodosMateriais ? materiaisAnalisados : materiaisEmAlerta;
  const snapshotAtivo = analiseAlgoritmica?.previsao_aplicada || null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-block px-3 py-1 bg-red-500/10 text-red-400 text-xs font-semibold rounded-full border border-red-500/20 mb-2">
            Monitoramento crítico
          </div>
          <h1 className="text-2xl font-bold text-white">Alertas e Análise Algorítmica de Estoque</h1>
          <p className="text-slate-400 text-sm mt-1">
            Acompanhe vencimentos próximos, lotes vencidos e o dimensionamento matemático de materiais por previsão epidemiológica.
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

      {/* Card de Análise Algorítmica e Matemática de Estoque + Dropdown de Previsão Salva */}
      <div className="glass p-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950/25 space-y-5 shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-700/50 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-bold shrink-0">
              📐
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  Análise Algorítmica de Estoque & Demanda Epidemiológica
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                  MMP + Ponto de Reposição + Estoque de Segurança (20%)
                </span>
                {!loadingAlgoritmo && materiaisEmAlerta.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 rounded-full">
                    {materiaisEmAlerta.length} insumo(s) requerem atenção
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cálculo 100% determinístico e auditável cruzando consumo histórico (30/60/90 dias), lead time de fornecedores e a previsão epidemiológica selecionada.
              </p>
            </div>
          </div>

          {/* Dropdown de escolha da Previsão Salva */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Previsão Epidemiológica Aplicada
              </label>
              <select
                value={previsaoSelecionadaId ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrevisaoSelecionadaId(val ? Number(val) : null);
                }}
                className="bg-slate-950 border border-emerald-500/40 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-400 min-w-[280px]"
              >
                <option value="">Apenas Consumo Histórico (Média Móvel Ponderada)</option>
                {previsoesSalvas.map((prev) => (
                  <option key={prev.id} value={prev.id}>
                    {prev.titulo} ({Number(prev.casos_previstos || 0).toLocaleString("pt-BR")} casos · {prev.horizonte_semanas} sem)
                  </option>
                ))}
              </select>
            </div>

            <Link
              href="/dashboard/previsao-epidemiologica"
              className="self-end px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap text-center"
            >
              + Nova Previsão
            </Link>
          </div>
        </div>

        {/* Barra de Metadados da Previsão Selecionada */}
        {snapshotAtivo && (
          <div className="p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                Doença: {snapshotAtivo.doenca}
              </span>
              <span className="text-slate-300">
                <strong className="text-slate-400">Região:</strong>{" "}
                {Array.isArray(snapshotAtivo.localidades)
                  ? snapshotAtivo.localidades.join(", ")
                  : snapshotAtivo.localidades}
              </span>
              <span className="text-slate-300">
                <strong className="text-slate-400">Horizonte:</strong> {snapshotAtivo.horizonte_semanas} semanas ({snapshotAtivo.horizonte_dias} dias)
              </span>
              <span className="text-slate-300">
                <strong className="text-slate-400">Casos Previstos:</strong>{" "}
                <span className="text-emerald-400 font-bold">
                  {Number(snapshotAtivo.casos_previstos || 0).toLocaleString("pt-BR")}
                </span>
              </span>
              <span className="text-slate-300">
                <strong className="text-slate-400">Tendência:</strong> {snapshotAtivo.tendencia}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-semibold">
                Confiança: {Math.round((snapshotAtivo.grau_confianca || 0.8) * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Corpo da Análise Algorítmica */}
        {loadingAlgoritmo ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : materiaisExibidos.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {materiaisExibidos.map((item: any) => {
                const isAlto = item.risco === "ALTO";
                const isModerado = item.risco === "MODERADO";
                const badgeStyle = isAlto
                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                  : isModerado
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
                const tendenciaIcon =
                  item.tendencia_consumo === "crescente"
                    ? "📈"
                    : item.tendencia_consumo === "decrescente"
                    ? "📉"
                    : "→";

                return (
                  <div
                    key={item.material_id}
                    className="p-4 bg-slate-900/85 rounded-xl border border-slate-800 space-y-2.5 hover:border-emerald-500/40 transition-colors flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${badgeStyle}`}>
                          Risco {item.risco}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {tendenciaIcon} Consumo {item.tendencia_consumo}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-sm truncate" title={item.nome}>
                        {item.nome}
                      </h3>

                      <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/80">
                        <div>
                          <span className="text-slate-500 block">Saldo Válido</span>
                          <strong className="text-white">
                            {item.saldo_atual} {item.unidade_medida}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Ponto Reposição (ROP)</span>
                          <strong className="text-cyan-300">
                            {item.ponto_reposicao} {item.unidade_medida}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Consumo MMP</span>
                          <strong className="text-slate-200">
                            {item.consumo_diario_mmp}/dia
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Demanda Surto</span>
                          <strong className="text-purple-300">
                            +{item.demanda_epidemiologica_horizonte} ({item.horizonte_dias}d)
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Estoque Segurança</span>
                          <strong className="text-slate-300">
                            {item.estoque_seguranca} {item.unidade_medida}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cobertura / Lead Time</span>
                          <strong className={isAlto ? "text-red-400" : "text-emerald-400"}>
                            {item.cobertura_dias !== null ? `${item.cobertura_dias}d` : "∞"} / {item.lead_time_dias}d
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between border-t border-slate-800/80 text-xs">
                      <span className="text-slate-400 text-[11px]">Sugestão Algorítmica:</span>
                      {item.quantidade_recomendada_comprar > 0 ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold">
                          Comprar +{item.quantidade_recomendada_comprar} {item.unidade_medida}
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold text-[11px]">
                          Estoque suficiente
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2 text-xs text-slate-400">
              <span>
                Exibindo {materiaisExibidos.length} de {materiaisAnalisados.length} materiais analisados pelo motor matemático.
              </span>
              <button
                onClick={() => setMostrarTodosMateriais(!mostrarTodosMateriais)}
                className="text-emerald-400 hover:text-emerald-300 font-semibold underline"
              >
                {mostrarTodosMateriais ? "Mostrar apenas insumos em alerta" : "Ver todos os materiais analisados"}
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center space-y-2">
            <p className="text-emerald-400 font-semibold text-sm">
              ✅ Nenhum material com risco de ruptura ou abaixo do Ponto de Reposição para este cenário.
            </p>
            {materiaisAnalisados.length > 0 && (
              <button
                onClick={() => setMostrarTodosMateriais(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline"
              >
                Ver métricas matemáticas de todos os {materiaisAnalisados.length} materiais →
              </button>
            )}
          </div>
        )}
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
