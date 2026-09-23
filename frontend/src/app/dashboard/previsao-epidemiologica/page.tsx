"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { iaApi } from "@/lib/api";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

// 7 Localidades oficiais do projeto
const LOCALIDADES_DISPONIVEIS = [
  { id: "Estado de São Paulo", label: "Estado de São Paulo", grupo: "ABRANGÊNCIA ESTADUAL" },
  { id: "Baixada Santista", label: "Baixada Santista", grupo: "REGIÃO METROPOLITANA DA BAIXADA SANTISTA" },
  { id: "Santos", label: "Santos", grupo: "REGIÃO METROPOLITANA DA BAIXADA SANTISTA" },
  { id: "Cubatão", label: "Cubatão", grupo: "REGIÃO METROPOLITANA DA BAIXADA SANTISTA" },
  { id: "Guarujá", label: "Guarujá", grupo: "REGIÃO METROPOLITANA DA BAIXADA SANTISTA" },
  { id: "São Vicente", label: "São Vicente", grupo: "REGIÃO METROPOLITANA DA BAIXADA SANTISTA" },
  { id: "Praia Grande", label: "Praia Grande", grupo: "REGIÃO METROPOLITANA DA BAIXADA SANTISTA" },
];

// Cores do tema
const CORES = {
  dengue: "#06b6d4",
  influenza: "#a855f7",
  previsaoFill: "rgba(16, 185, 129, 0.04)",
  grid: "rgba(148, 163, 184, 0.08)",
  tooltipBg: "rgba(15, 23, 42, 0.97)",
  tooltipBorder: "#334155",
};

// Meses em português
const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// Formatação do eixo Y
const formatarEixoY = (valor: number) => {
  if (valor >= 1000) return `${(valor / 1000).toFixed(0)}k`;
  return valor.toString();
};

// Formata data ISO "2024-03-15" -> "15/03/2024"
const formatarDataBR = (dataISO: string) => {
  if (!dataISO) return "";
  const partes = dataISO.split("-");
  if (partes.length !== 3) return dataISO;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

// Formata data ISO "2024-03-15" -> "Mar/2024"
const formatarMesAno = (dataISO: string) => {
  if (!dataISO) return "";
  const partes = dataISO.split("-");
  if (partes.length < 2) return dataISO;
  const mesIdx = parseInt(partes[1], 10) - 1;
  return `${MESES_PT[mesIdx] ?? partes[1]}/${partes[0]}`;
};

// ===== Tooltip Customizado =====
function TooltipCustomizado({ active, payload }: any) {
  if (!active || !payload || payload.length === 0) return null;

  const ponto = payload[0]?.payload;
  if (!ponto) return null;

  const ehPrevisto = ponto.tipo === "previsto";
  const dataFormatada = formatarDataBR(ponto.data_inicio);

  return (
    <div
      className="rounded-xl border shadow-2xl px-4 py-3 text-xs backdrop-blur-sm"
      style={{
        backgroundColor: CORES.tooltipBg,
        borderColor: CORES.tooltipBorder,
        minWidth: 220,
      }}
    >
      <p className="font-bold text-white text-sm mb-0.5">{dataFormatada}</p>
      <p className="text-[10px] text-slate-400 mb-2">
        Semana Epidemiológica {ponto.semana_ano?.slice(-2) ?? ""}
      </p>

      <div className="space-y-1.5">
        {ponto.dengue_casos != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: CORES.dengue }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CORES.dengue }} />
              Dengue
            </span>
            <span className="font-bold text-white">
              {ehPrevisto ? "Previsto" : "Observado"}: {Math.round(ponto.dengue_casos).toLocaleString("pt-BR")}
            </span>
          </div>
        )}
        {ponto.influenza_casos != null && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: CORES.influenza }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: CORES.influenza }} />
              Influenza
            </span>
            <span className="font-bold text-white">
              {ehPrevisto ? "Previsto" : "Observado"}: {Math.round(ponto.influenza_casos).toLocaleString("pt-BR")}
            </span>
          </div>
        )}
      </div>

      <p className="text-[10px] mt-2 pt-1.5 border-t border-slate-700 text-slate-400">
        {ehPrevisto ? "Projeção do modelo preditivo" : "Dado histórico observado"}
      </p>
    </div>
  );
}

// ===== Legenda Customizada =====
function LegendaCustomizada({ doenca }: { doenca: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-5 mt-3 text-xs">
      {doenca !== "Influenza" && (
        <>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" />
            <span>Dengue · observado</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-cyan-400 inline-block" />
            <span>Dengue · previsto</span>
          </div>
        </>
      )}
      {doenca !== "Dengue" && (
        <>
          <div className="flex items-center gap-1.5 text-purple-400">
            <span className="w-3 h-0.5 bg-purple-400 inline-block rounded" />
            <span>Influenza · observado</span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-400">
            <span className="w-3 h-0.5 border-b-2 border-dashed border-purple-400 inline-block" />
            <span>Influenza · previsto</span>
          </div>
        </>
      )}
    </div>
  );
}

// ===== Gerar opções de mês/ano de 2021 a 2026 =====
function gerarOpcoesMesAno(): { valor: string; label: string }[] {
  const opcoes: { valor: string; label: string }[] = [];
  for (let ano = 2021; ano <= 2026; ano++) {
    for (let mes = 1; mes <= 12; mes++) {
      const valor = `${ano}-${String(mes).padStart(2, "0")}`;
      opcoes.push({ valor, label: `${MESES_PT[mes - 1]}/${ano}` });
    }
  }
  return opcoes;
}

const OPCOES_MES_ANO = gerarOpcoesMesAno();

export default function PrevisaoEpidemiologicaPage() {
  // Filtros Primários
  const [doenca, setDoenca] = useState<"Dengue" | "Influenza" | "Ambas">("Dengue");
  const [localidades, setLocalidades] = useState<string[]>(["Santos"]);
  const [dropdownLocalAberto, setDropdownLocalAberto] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState<string>("2024-01");
  const [periodoFim, setPeriodoFim] = useState<string>("2026-09");
  const [horizonteSemanas, setHorizonteSemanas] = useState<number>(8);

  // Filtros Avançados
  const [mostrarAvancados, setMostrarAvancados] = useState(false);
  const [modo, setModo] = useState<"ampliado" | "conservador">("ampliado");
  const [faixaEtaria, setFaixaEtaria] = useState<string>("todas");
  const [sexo, setSexo] = useState<string>("todos");

  // Estado dos Dados
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calcula meses de histórico a partir do intervalo selecionado
  const periodoHistoricoMeses = useMemo(() => {
    const [anoI, mesI] = periodoInicio.split("-").map(Number);
    const [anoF, mesF] = periodoFim.split("-").map(Number);
    return Math.max(1, (anoF - anoI) * 12 + (mesF - mesI) + 1);
  }, [periodoInicio, periodoFim]);

  // Fecha dropdown de localidade ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownLocalAberto(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Busca dados na API ao alterar qualquer filtro
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setErro(null);

    const params = {
      doenca,
      localidades: localidades.join(","),
      horizonte_semanas: horizonteSemanas,
      periodo_historico_meses: periodoHistoricoMeses,
      modo,
      faixa_etaria: faixaEtaria,
      sexo,
    };

    iaApi
      .previsaoEpidemiologica(params)
      .then((res) => {
        if (!cancelado) {
          setDados(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelado) {
          console.error("Erro ao carregar previsão epidemiológica:", err);
          setErro("Não foi possível conectar ao motor preditivo.");
          setLoading(false);
        }
      });

    return () => {
      cancelado = true;
    };
  }, [doenca, localidades, horizonteSemanas, periodoHistoricoMeses, modo, faixaEtaria, sexo]);

  // Manipulação de seleção múltipla no dropdown
  const toggleLocalidade = (locId: string) => {
    setLocalidades((prev) => {
      if (prev.includes(locId)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== locId);
      } else {
        return [...prev, locId];
      }
    });
  };

  // ===== Dados do Gráfico para Recharts =====
  const chartData = useMemo(() => {
    if (!dados?.serie_temporal || dados.serie_temporal.length === 0) return [];

    // Filtra por intervalo de datas selecionado
    const dataInicio = `${periodoInicio}-01`;

    return dados.serie_temporal
      .filter((p: any) => {
        // Só filtra observados pelo período. Previstos sempre inclusos.
        if (p.tipo === "previsto") return true;
        return p.data_inicio >= dataInicio;
      })
      .map((p: any) => {
        // Eixo X: Mês/Ano
        const mesAnoLabel = formatarMesAno(p.data_inicio);

        return {
          ...p,
          mesAnoLabel,
          dengue_observado: p.tipo === "observado" ? p.dengue_casos : null,
          dengue_previsto: p.tipo === "previsto" ? p.dengue_casos : null,
          influenza_observado: p.tipo === "observado" ? p.influenza_casos : null,
          influenza_previsto: p.tipo === "previsto" ? p.influenza_casos : null,
        };
      });
  }, [dados, periodoInicio]);

  // Label do ponto de início da previsão
  const previsaoStartLabel = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    const idx = chartData.findIndex((p: any) => p.tipo === "previsto");
    return idx >= 0 ? chartData[idx].mesAnoLabel : null;
  }, [chartData]);

  // Conectar observado ao previsto
  const chartDataConectado = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    const result = [...chartData];
    const idxPrimeiroPrevisto = result.findIndex((p: any) => p.tipo === "previsto");

    if (idxPrimeiroPrevisto > 0) {
      const ultimoObservado = result[idxPrimeiroPrevisto - 1];
      result[idxPrimeiroPrevisto - 1] = {
        ...ultimoObservado,
        dengue_previsto: ultimoObservado.dengue_observado,
        influenza_previsto: ultimoObservado.influenza_observado,
      };
    }

    return result;
  }, [chartData]);

  // Gerar ticks para o eixo X: apenas 1 tick por mês
  const ticksMesAno = useMemo(() => {
    if (!chartDataConectado || chartDataConectado.length === 0) return [];
    const vistos = new Set<string>();
    const ticks: string[] = [];
    for (const ponto of chartDataConectado) {
      if (!vistos.has(ponto.mesAnoLabel)) {
        vistos.add(ponto.mesAnoLabel);
        ticks.push(ponto.mesAnoLabel);
      }
    }
    // Se tiver muitos ticks, filtrar para mostrar a cada N
    if (ticks.length > 18) {
      const step = Math.ceil(ticks.length / 12);
      return ticks.filter((_, i) => i % step === 0);
    }
    return ticks;
  }, [chartDataConectado]);

  // Texto formatado do seletor de localização
  const textoBotaoLocalizacao = useMemo(() => {
    if (localidades.length === 0) return "Selecione uma localização";
    if (localidades.length === 1) return localidades[0];
    return `${localidades.length} áreas selecionadas`;
  }, [localidades]);

  // Opções filtradas de mês/ano (fim >= início)
  const opcoesFimFiltradas = useMemo(
    () => OPCOES_MES_ANO.filter((o) => o.valor >= periodoInicio),
    [periodoInicio]
  );

  // ===== Distribuição calculada no frontend para garantir que funcione =====
  const distribuicaoLocal = useMemo(() => {
    if (!dados?.serie_temporal) {
      return { dengue: { casos: 0, percentual: 0 }, influenza: { casos: 0, percentual: 0 }, total_previsto: 0 };
    }

    let denguePrev = 0;
    let influenzaPrev = 0;

    for (const ponto of dados.serie_temporal) {
      if (ponto.tipo === "previsto") {
        if (ponto.dengue_casos != null) denguePrev += ponto.dengue_casos;
        if (ponto.influenza_casos != null) influenzaPrev += ponto.influenza_casos;
      }
    }

    const total = denguePrev + influenzaPrev;
    return {
      dengue: {
        casos: Math.round(denguePrev),
        percentual: total > 0 ? Math.round((denguePrev / total) * 100) : 0,
      },
      influenza: {
        casos: Math.round(influenzaPrev),
        percentual: total > 0 ? Math.round((influenzaPrev / total) * 100) : 0,
      },
      total_previsto: Math.round(total),
    };
  }, [dados]);

  // Texto do período formatado
  const textoPeríodo = useMemo(() => {
    const inicioLabel = OPCOES_MES_ANO.find((o) => o.valor === periodoInicio)?.label ?? periodoInicio;
    const fimLabel = OPCOES_MES_ANO.find((o) => o.valor === periodoFim)?.label ?? periodoFim;
    return `${inicioLabel} a ${fimLabel}`;
  }, [periodoInicio, periodoFim]);

  return (
    <div className="space-y-6 pb-12">
      {/* =====================================================================
          CABEÇALHO DA PÁGINA
      ===================================================================== */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
              Vigilância Preditiva
            </span>
            {loading && (
              <span className="text-xs text-slate-400 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                Atualizando análise…
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Previsão Epidemiológica</h1>
          <p className="text-slate-400 text-sm mt-1">
            Tendências históricas e projeções para Dengue e Influenza na Baixada Santista e Estado de SP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass p-3 px-4 rounded-xl border border-slate-700/40 bg-slate-900/50 text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Última Atualização</p>
            <p className="text-xs font-semibold text-slate-200 mt-0.5">
              {dados?.rodape?.atualizado_em || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SEÇÃO 1 — PAINEL DE FILTROS COMPACTO
      ===================================================================== */}
      <div className="glass p-5 rounded-2xl border border-slate-700/50 space-y-4 relative z-30">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          {/* 1.1 DOENÇA */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Doença</p>
            <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/60">
              {(["Dengue", "Influenza", "Ambas"] as const).map((opcao) => {
                const ativo = doenca === opcao;
                return (
                  <button
                    key={opcao}
                    onClick={() => setDoenca(opcao)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                      ativo
                        ? opcao === "Dengue"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                          : opcao === "Influenza"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "text-slate-400 hover:text-white border border-transparent"
                    }`}
                  >
                    {opcao}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1.2 LOCALIZAÇÃO — z-index alto para ficar acima de tudo */}
          <div className="relative z-50" ref={dropdownRef}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Localização</p>
            <button
              onClick={() => setDropdownLocalAberto(!dropdownLocalAberto)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-xs font-medium text-white transition-colors min-w-[220px]"
            >
              <span className="text-slate-400">📍</span>
              <span className="flex-1 text-left">{textoBotaoLocalizacao}</span>
              <span className="text-[10px] text-slate-400 ml-1">▼</span>
            </button>

            {dropdownLocalAberto && (
              <div className="absolute left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-[100] animate-fade-in space-y-3"
                style={{ position: "absolute", zIndex: 100 }}
              >
                <p className="text-xs text-slate-300 font-medium">Selecione uma ou mais áreas</p>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Abrangência Estadual
                  </p>
                  <label className="flex items-center gap-2 text-xs text-slate-200 hover:text-white p-1 rounded hover:bg-slate-800/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localidades.includes("Estado de São Paulo")}
                      onChange={() => toggleLocalidade("Estado de São Paulo")}
                      className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                    />
                    <span>Estado de São Paulo</span>
                  </label>
                </div>

                <div className="border-t border-slate-800 pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Região Metropolitana da Baixada Santista
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                    {LOCALIDADES_DISPONIVEIS.filter((l) => l.grupo.includes("BAIXADA")).map((item) => (
                      <label
                        key={item.id}
                        className="flex items-center gap-2 text-xs text-slate-200 hover:text-white p-1 rounded hover:bg-slate-800/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={localidades.includes(item.id)}
                          onChange={() => toggleLocalidade(item.id)}
                          className="rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                        />
                        <span className={item.id === "Baixada Santista" ? "font-semibold text-emerald-400" : ""}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-2 text-[10px] text-emerald-400/70 text-center">
                  7 localidades com dados disponíveis
                </div>
              </div>
            )}
          </div>

          {/* 1.3 PERÍODO (Mês/Ano de início e fim) */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Período Histórico</p>
            <div className="flex items-center gap-2">
              <select
                value={periodoInicio}
                onChange={(e) => {
                  setPeriodoInicio(e.target.value);
                  // Garante que o fim não fique antes do início
                  if (e.target.value > periodoFim) {
                    setPeriodoFim(e.target.value);
                  }
                }}
                className="bg-slate-900/80 border border-slate-700/60 text-xs text-white rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500"
              >
                {OPCOES_MES_ANO.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-slate-400">até</span>
              <select
                value={periodoFim}
                onChange={(e) => setPeriodoFim(e.target.value)}
                className="bg-slate-900/80 border border-slate-700/60 text-xs text-white rounded-xl px-2.5 py-2 focus:outline-none focus:border-emerald-500"
              >
                {opcoesFimFiltradas.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 1.4 HORIZONTE (Slider de Semanas) */}
          <div className="min-w-[220px]">
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Horizonte:</span>
              <span className="text-emerald-400 font-bold text-xs">próximas {horizonteSemanas} semanas</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400">4</span>
              <input
                type="range"
                min={4}
                max={20}
                step={1}
                value={horizonteSemanas}
                onChange={(e) => setHorizonteSemanas(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="text-[10px] text-slate-400">20</span>
            </div>
          </div>

          {/* 1.5 BOTÃO AVANÇADOS */}
          <button
            onClick={() => setMostrarAvancados(!mostrarAvancados)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
              mostrarAvancados
                ? "bg-slate-800 text-white border-slate-600"
                : "bg-slate-900/80 text-slate-400 border-slate-700/60 hover:text-white"
            }`}
          >
            <span>⚙️</span>
            <span>Avançados</span>
            <span className="text-[10px]">{mostrarAvancados ? "▲" : "▼"}</span>
          </button>
        </div>

        {/* ÁREA EXPANSÍVEL DE AVANÇADOS */}
        {mostrarAvancados && (
          <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in bg-slate-950/30 p-3 rounded-xl">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Modo de Previsão
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setModo("ampliado")}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium border ${
                    modo === "ampliado"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  title="Inclui casos suspeitos notificados (mais realista para consumo de kits)"
                >
                  Notificados (Ampliado)
                </button>
                <button
                  onClick={() => setModo("conservador")}
                  className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium border ${
                    modo === "conservador"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                  title="Apenas casos confirmados laboratorialmente"
                >
                  Confirmados
                </button>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Faixa Etária
              </p>
              <select
                value={faixaEtaria}
                onChange={(e) => setFaixaEtaria(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
              >
                <option value="todas">Todas as idades</option>
                <option value="0-19">0 a 19 anos</option>
                <option value="20-59">20 a 59 anos</option>
                <option value="60+">60 anos ou mais</option>
              </select>
            </div>

            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Sexo
              </p>
              <select
                value={sexo}
                onChange={(e) => setSexo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg p-1.5 focus:outline-none"
              >
                <option value="todos">Todos</option>
                <option value="F">Feminino</option>
                <option value="M">Masculino</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          SEÇÃO 2 — 5 CARTÕES DE INDICADORES
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Casos Recentes</p>
          <div className="my-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">
              {loading ? "…" : dados?.indicadores?.casos_recentes ?? "0"}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">última semana observada</p>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Casos Previstos</p>
          <div className="my-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">
              {loading ? "…" : (dados?.indicadores?.casos_previstos ?? 0).toLocaleString("pt-BR")}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">acumulado em {horizonteSemanas} semanas</p>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mudança esperada nos casos</p>
          <div className="my-2 flex items-baseline gap-1">
            {loading ? (
              <p className="text-2xl font-extrabold text-white">…</p>
            ) : (
              <p
                className={`text-2xl font-extrabold ${
                  (dados?.indicadores?.mudanca_esperada_pct ?? 0) > 0
                    ? "text-amber-400"
                    : (dados?.indicadores?.mudanca_esperada_pct ?? 0) < 0
                    ? "text-emerald-400"
                    : "text-slate-300"
                }`}
              >
                {(dados?.indicadores?.mudanca_esperada_pct ?? 0) > 0 ? "+" : ""}
                {dados?.indicadores?.mudanca_esperada_pct ?? 0}%
              </p>
            )}
          </div>
          <p className="text-[11px] text-slate-400">vs. média das últimas 8 semanas</p>
        </div>

        {/* Pico Esperado — mostra data exata */}
        <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pico Esperado</p>
          <div className="my-2">
            <p className="text-2xl font-extrabold text-white tracking-tight">
              {loading
                ? "…"
                : dados?.indicadores?.pico_data
                ? formatarDataBR(dados.indicadores.pico_data)
                : "—"}
            </p>
          </div>
          <p className="text-[11px] text-slate-400">
            {loading
              ? "…"
              : `${(dados?.indicadores?.pico_casos ?? 0).toLocaleString("pt-BR")} casos estimados`}
          </p>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex flex-col justify-between">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tendência</p>
          <div className="my-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                dados?.indicadores?.tendencia?.includes("Crescente")
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : dados?.indicadores?.tendencia?.includes("Decrescente")
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {loading ? "…" : dados?.indicadores?.tendencia ?? "Estável"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">durante as próximas {horizonteSemanas} semanas</p>
        </div>
      </div>

      {/* =====================================================================
          SEÇÃO 3 — GRÁFICO RECHARTS
      ===================================================================== */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 space-y-2">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">📈</span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Comportamento epidemiológico e previsão</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {localidades.join(", ")} · {textoPeríodo} · próximas {horizonteSemanas} semanas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-0.5 bg-current inline-block rounded" />
              <span>Observado</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-3 h-0.5 border-b-2 border-dashed border-current inline-block" />
              <span>Previsto</span>
            </div>
          </div>
        </div>

        <div className="w-full bg-slate-950/40 rounded-xl border border-slate-800/80 p-3 pt-4">
          {loading ? (
            <div className="h-80 flex flex-col items-center justify-center gap-2 text-slate-400">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-medium">Calculando projeção Prophet com série temporal...</p>
            </div>
          ) : chartDataConectado.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart
                  data={chartDataConectado}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <defs>
                    <linearGradient id="gradientDengue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CORES.dengue} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={CORES.dengue} stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gradientInfluenza" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CORES.influenza} stopOpacity={0.15} />
                      <stop offset="100%" stopColor={CORES.influenza} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke={CORES.grid}
                    vertical={false}
                  />

                  <XAxis
                    dataKey="mesAnoLabel"
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={{ stroke: CORES.grid }}
                    tickLine={false}
                    ticks={ticksMesAno}
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={50}
                  />

                  <YAxis
                    tickFormatter={formatarEixoY}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={45}
                  />

                  <Tooltip
                    content={<TooltipCustomizado />}
                    cursor={{
                      stroke: "rgba(148, 163, 184, 0.3)",
                      strokeWidth: 1,
                      strokeDasharray: "4 4",
                    }}
                  />

                  {previsaoStartLabel && (
                    <ReferenceArea
                      x1={previsaoStartLabel}
                      fill={CORES.previsaoFill}
                      fillOpacity={1}
                    />
                  )}

                  {previsaoStartLabel && (
                    <ReferenceLine
                      x={previsaoStartLabel}
                      stroke="#10b981"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={{
                        value: "Início da previsão",
                        position: "insideTopRight",
                        fill: "#34d399",
                        fontSize: 10,
                        fontWeight: "bold",
                        offset: 8,
                      }}
                    />
                  )}

                  {/* === DENGUE === */}
                  {doenca !== "Influenza" && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="dengue_observado"
                        stroke="none"
                        fill="url(#gradientDengue)"
                        fillOpacity={1}
                        connectNulls={false}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="dengue_observado"
                        stroke={CORES.dengue}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: CORES.dengue,
                          stroke: "#0f172a",
                          strokeWidth: 2,
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="dengue_previsto"
                        stroke={CORES.dengue}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: CORES.dengue,
                          stroke: "#0f172a",
                          strokeWidth: 2,
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </>
                  )}

                  {/* === INFLUENZA === */}
                  {doenca !== "Dengue" && (
                    <>
                      <Area
                        type="monotone"
                        dataKey="influenza_observado"
                        stroke="none"
                        fill="url(#gradientInfluenza)"
                        fillOpacity={1}
                        connectNulls={false}
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="influenza_observado"
                        stroke={CORES.influenza}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: CORES.influenza,
                          stroke: "#0f172a",
                          strokeWidth: 2,
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="influenza_previsto"
                        stroke={CORES.influenza}
                        strokeWidth={2.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={{
                          r: 5,
                          fill: CORES.influenza,
                          stroke: "#0f172a",
                          strokeWidth: 2,
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>

              <LegendaCustomizada doenca={doenca} />
            </>
          ) : (
            <div className="h-80 flex flex-col items-center justify-center text-slate-400 text-xs">
              <span>Nenhum dado epidemiológico para a combinação selecionada.</span>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          SEÇÃO 4 — PANORAMA EPIDEMIOLÓGICO E DISTRIBUIÇÃO
      ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-2xl border border-slate-700/50 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📋</span>
              <h3 className="text-base font-bold text-white tracking-tight">Panorama epidemiológico</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {loading
                ? "Calculando panorama preditivo..."
                : dados?.panorama_texto ||
                  "A atividade viral está sendo monitorada com base nos dados de vigilância epidemiológica regional."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Região: {localidades.join(", ")}</span>
            <span>Horizonte: {horizonteSemanas} semanas</span>
          </div>
        </div>

        {/* Distribuição — Usa cálculo local para garantir valores corretos */}
        <div className="glass p-6 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight mb-4">Distribuição da previsão</h3>

            <div className="space-y-4">
              <div className="w-full h-3.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${distribuicaoLocal.total_previsto > 0 ? distribuicaoLocal.dengue.percentual : 50}%` }}
                  className="bg-cyan-500 transition-all duration-500"
                />
                <div
                  style={{ width: `${distribuicaoLocal.total_previsto > 0 ? distribuicaoLocal.influenza.percentual : 50}%` }}
                  className="bg-purple-500 transition-all duration-500"
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="flex items-center gap-2 text-cyan-400 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    Dengue
                  </span>
                  <span className="text-white font-bold">
                    {distribuicaoLocal.dengue.casos.toLocaleString("pt-BR")} ({distribuicaoLocal.dengue.percentual}%)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                  <span className="flex items-center gap-2 text-purple-400 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                    Influenza
                  </span>
                  <span className="text-white font-bold">
                    {distribuicaoLocal.influenza.casos.toLocaleString("pt-BR")} ({distribuicaoLocal.influenza.percentual}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <span className="text-xs text-slate-400">
              Total Projetado: <strong className="text-white">{distribuicaoLocal.total_previsto.toLocaleString("pt-BR")} casos</strong>
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SEÇÃO 5 — POTENCIAL IMPACTO NA DEMANDA LABORATORIAL
      ===================================================================== */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              🧪
            </span>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Potencial impacto na demanda laboratorial
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {dados?.impacto_demanda?.mensagem ||
                  "Cruzamento automático da curva de casos com o saldo dos lotes válidos no laboratório."}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/reposicao"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all whitespace-nowrap"
          >
            <span>Ver impacto projetado no estoque</span>
            <span>→</span>
          </Link>
        </div>

        {dados?.impacto_demanda?.materiais && dados.impacto_demanda.materiais.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[16%]" />
                <col className="w-[13%]" />
                <col className="w-[13%]" />
                <col className="w-[14%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                  <th className="py-2.5 px-3">Material Laboratorial</th>
                  <th className="py-2.5 px-3">Doença</th>
                  <th className="py-2.5 px-3">Multiplicador</th>
                  <th className="py-2.5 px-3">Demanda Prevista (+20%)</th>
                  <th className="py-2.5 px-3">Estoque Atual</th>
                  <th className="py-2.5 px-3">Saldo Projetado</th>
                  <th className="py-2.5 px-3 text-right">Diagnóstico</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {dados.impacto_demanda.materiais.map((mat: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-white">
                      <span className="block truncate" title={mat.nome}>
                        {mat.nome}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          mat.doenca === "Dengue"
                            ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                            : "bg-purple-500/15 text-purple-300 border border-purple-500/30"
                        }`}
                      >
                        {mat.doenca}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      <span className="block truncate" title={`${mat.quantidade_por_exame} ${mat.unidade}/exame`}>
                        {mat.quantidade_por_exame} {mat.unidade}/exame
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {mat.demanda_projetada.toLocaleString("pt-BR")} {mat.unidade}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {mat.saldo_atual.toLocaleString("pt-BR")} {mat.unidade}
                    </td>
                    <td
                      className={`py-2.5 px-3 font-bold ${
                        mat.saldo_projetado < 0 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {mat.saldo_projetado > 0 ? "+" : ""}
                      {mat.saldo_projetado.toLocaleString("pt-BR")} {mat.unidade}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
                          mat.status_risco === "CRITICO"
                            ? "bg-red-500/20 text-red-300 border-red-500/40 animate-pulse"
                            : mat.status_risco === "ATENCAO"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        }`}
                      >
                        {mat.status_risco === "CRITICO"
                          ? "RUPTURA IMINENTE"
                          : mat.status_risco === "ATENCAO"
                          ? "ATENÇÃO"
                          : "ESTOQUE SEGURO"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
            Nenhum insumo crítico demandado para a combinação epidemiológica selecionada.
          </div>
        )}
      </div>

      {/* =====================================================================
          SEÇÃO 6 — RODAPÉ
      ===================================================================== */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-400 px-2">
        <span>Fonte: bases epidemiológicas públicas · dados oficiais DATASUS / SINAN / SIVEP-Gripe</span>
        <span>
          Cobertura: {textoPeríodo} · {localidades.join(", ")}
        </span>
      </div>
    </div>
  );
}
