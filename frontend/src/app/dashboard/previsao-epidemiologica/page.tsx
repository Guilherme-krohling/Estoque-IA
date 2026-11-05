"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { iaApi } from "@/lib/api";
import { showToast } from "@/components/Toast";
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
  const [segundosDecorridos, setSegundosDecorridos] = useState(0);
  const [dados, setDados] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de Previsões Salvas (Snapshots)
  const [previsoesSalvas, setPrevisoesSalvas] = useState<any[]>([]);
  const [previsaoCarregadaId, setPrevisaoCarregadaId] = useState<string>("");
  const [modalSalvarAberto, setModalSalvarAberto] = useState(false);
  const [tituloPrevisao, setTituloPrevisao] = useState("");
  const [salvandoPrevisao, setSalvandoPrevisao] = useState(false);
  const carregandoSnapshotRef = useRef(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const carregarListaPrevisoes = async () => {
    try {
      const lista = await iaApi.listarPrevisoesSalvas();
      setPrevisoesSalvas(lista || []);
    } catch {
      /* silencioso se offline */
    }
  };

  useEffect(() => {
    carregarListaPrevisoes();
  }, []);

  // Estimativa de tempo do Prophet (Ambas treina 2 modelos; doença única treina 1)
  const tempoEstimadoSegundos = doenca === "Ambas" ? 4 : 2;

  // Cronômetro em tempo real enquanto o Prophet calcula a projeção
  useEffect(() => {
    if (!loading) {
      setSegundosDecorridos(0);
      return;
    }
    setSegundosDecorridos(0);
    const inicio = Date.now();
    const timer = setInterval(() => {
      const decorrido = (Date.now() - inicio) / 1000;
      setSegundosDecorridos(Number(decorrido.toFixed(1)));
    }, 100);
    return () => clearInterval(timer);
  }, [loading]);

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
    if (carregandoSnapshotRef.current) {
      carregandoSnapshotRef.current = false;
      return;
    }

    let cancelado = false;
    setLoading(true);
    setErro(null);

    const params = {
      doenca,
      localidades: localidades.join(","),
      horizonte_semanas: horizonteSemanas,
      periodo_historico_meses: periodoHistoricoMeses,
      data_inicio: periodoInicio,
      data_fim: periodoFim,
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
  }, [doenca, localidades, horizonteSemanas, periodoHistoricoMeses, periodoInicio, periodoFim, modo, faixaEtaria, sexo]);

  // Abre o modal de salvar previsão com sugestão automática de título
  const handleAbrirModalSalvar = () => {
    const locResumo = localidades.length > 2 ? `${localidades[0]} +${localidades.length - 1}` : localidades.join(", ");
    const sugestao = `${doenca} · ${locResumo} · ${horizonteSemanas} sem (${periodoInicio} a ${periodoFim})`;
    setTituloPrevisao(sugestao);
    setModalSalvarAberto(true);
  };

  // Salva o snapshot completo da previsão epidemiológica no banco
  const handleSalvarPrevisao = async () => {
    if (!dados) return;
    setSalvandoPrevisao(true);
    try {
      const ind = dados.indicadores || {};
      const resultado = await iaApi.salvarPrevisao({
        titulo: tituloPrevisao.trim() || `${doenca} · ${localidades.join(", ")} · ${horizonteSemanas} sem`,
        doenca,
        localidades,
        data_inicio: periodoInicio,
        data_fim: periodoFim,
        horizonte_semanas: horizonteSemanas,
        modo,
        faixa_etaria: faixaEtaria,
        sexo,
        casos_recentes: ind.casos_recentes ?? 0,
        casos_previstos: ind.casos_previstos ?? distribuicaoLocal.total_previsto,
        casos_dengue_previstos: distribuicaoLocal.dengue.casos,
        casos_influenza_previstos: distribuicaoLocal.influenza.casos,
        mudanca_esperada_pct: ind.mudanca_esperada_pct ?? 0,
        pico_data: ind.pico_data ?? null,
        pico_casos: ind.pico_casos ?? 0,
        tendencia: ind.tendencia ?? "Estável",
        grau_confianca: 0.80,
        dados_completos: dados,
      });
      await carregarListaPrevisoes();
      if (resultado?.id) {
        setPrevisaoCarregadaId(String(resultado.id));
      }
      setModalSalvarAberto(false);
      showToast("Previsão epidemiológica salva com sucesso!", "success");
    } catch (err: any) {
      showToast(err.message || "Erro ao salvar previsão epidemiológica.", "error");
    } finally {
      setSalvandoPrevisao(false);
    }
  };

  // Carrega uma previsão salva restaurando filtros e série do gráfico
  const handleSelecionarPrevisaoSalva = async (idStr: string) => {
    setPrevisaoCarregadaId(idStr);
    if (!idStr) return;
    try {
      const snap = await iaApi.obterPrevisaoSalva(Number(idStr));
      carregandoSnapshotRef.current = true;
      if (snap.doenca === "Dengue" || snap.doenca === "Influenza" || snap.doenca === "Ambas") {
        setDoenca(snap.doenca);
      }
      if (Array.isArray(snap.localidades) && snap.localidades.length > 0) {
        setLocalidades(snap.localidades);
      }
      if (snap.data_inicio) setPeriodoInicio(snap.data_inicio);
      if (snap.data_fim) setPeriodoFim(snap.data_fim);
      if (snap.horizonte_semanas) setHorizonteSemanas(Number(snap.horizonte_semanas));
      if (snap.modo === "ampliado" || snap.modo === "conservador") setModo(snap.modo);
      if (snap.faixa_etaria) setFaixaEtaria(snap.faixa_etaria);
      if (snap.sexo) setSexo(snap.sexo);
      if (snap.dados_completos) {
        setDados(snap.dados_completos);
        setLoading(false);
      }
      showToast(`Snapshot "${snap.titulo}" carregado!`, "info");
    } catch (err: any) {
      showToast(err.message || "Erro ao carregar previsão salva.", "error");
    }
  };

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

  // ===== Estados de Zoom (Scroll) e Pan (Arrastar com clique) — Fase 3 =====
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    initialStart: number;
    initialEnd: number;
  }>({ active: false, startX: 0, initialStart: 0, initialEnd: 0 });

  // Reseta o zoom sempre que uma nova série temporal for carregada
  useEffect(() => {
    setZoomRange(null);
  }, [dados]);

  // ===== Dados do Gráfico para Recharts =====
  const chartData = useMemo(() => {
    if (!dados?.serie_temporal || dados.serie_temporal.length === 0) return [];

    // O backend já recorta e aplica fallback seguro para o intervalo (data_inicio..data_fim)
    return dados.serie_temporal.map((p: any) => {
      const mesAnoLabel = formatarMesAno(p.data_inicio);
      const partes = (p.data_inicio || "").split("-");
      const diaMes = partes.length === 3 ? `${partes[2]}/${partes[1]}` : p.data_inicio;
      const numSemana = p.semana_ano ? String(p.semana_ano).slice(-2) : "";
      const semanaLabel = numSemana ? `${diaMes} · SE${numSemana}` : diaMes;

      return {
        ...p,
        mesAnoLabel,
        semanaLabel,
        dengue_observado: p.tipo === "observado" ? p.dengue_casos : null,
        dengue_previsto: p.tipo === "previsto" ? p.dengue_casos : null,
        influenza_observado: p.tipo === "observado" ? p.influenza_casos : null,
        influenza_previsto: p.tipo === "previsto" ? p.influenza_casos : null,
      };
    });
  }, [dados]);

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

  // Janela visível atual do gráfico (controlada por Zoom e Pan)
  const totalPontosSerie = chartDataConectado.length;
  const startIdx = zoomRange ? Math.max(0, Math.min(zoomRange.start, Math.max(0, totalPontosSerie - 1))) : 0;
  const endIdx = zoomRange
    ? Math.max(startIdx, Math.min(zoomRange.end, Math.max(0, totalPontosSerie - 1)))
    : Math.max(0, totalPontosSerie - 1);

  const visibleChartData = useMemo(() => {
    if (totalPontosSerie === 0) return [];
    return chartDataConectado.slice(startIdx, endIdx + 1);
  }, [chartDataConectado, totalPontosSerie, startIdx, endIdx]);

  const semanasVisiveis = visibleChartData.length;
  const estaComZoom = totalPontosSerie > 0 && (startIdx > 0 || endIdx < totalPontosSerie - 1);
  // Drill-down automático: quando o zoom foca em <= 24 semanas (~5-6 meses ou 1 mês), detalha por semana!
  const modoSemanal = semanasVisiveis > 0 && semanasVisiveis <= 24;

  // Mapa rápido data_inicio -> ponto para formatação instantânea dos ticks do eixo X
  const mapaPontosPorData = useMemo(() => {
    const mapa = new Map<string, any>();
    for (const p of chartDataConectado) {
      mapa.set(p.data_inicio, p);
    }
    return mapa;
  }, [chartDataConectado]);

  // Ticks dinâmicos do eixo X:
  // - Em modoSemanal (Zoom): exibe as semanas epidemiológicas
  // - Em visão macro (Mensal): exibe apenas o primeiro ponto de cada mês
  const ticksEixoX = useMemo(() => {
    if (!visibleChartData || visibleChartData.length === 0) return [];

    if (modoSemanal) {
      const step = visibleChartData.length <= 14 ? 1 : 2;
      return visibleChartData
        .filter((_, idx) => idx % step === 0 || idx === visibleChartData.length - 1)
        .map((p: any) => p.data_inicio);
    }

    const mesesVistos = new Set<string>();
    const ticksMensais: string[] = [];
    for (const ponto of visibleChartData) {
      if (!mesesVistos.has(ponto.mesAnoLabel)) {
        mesesVistos.add(ponto.mesAnoLabel);
        ticksMensais.push(ponto.data_inicio);
      }
    }
    if (ticksMensais.length > 16) {
      const step = Math.ceil(ticksMensais.length / 12);
      return ticksMensais.filter((_, i) => i % step === 0);
    }
    return ticksMensais;
  }, [visibleChartData, modoSemanal]);

  const formatarTickEixoX = (dataInicioVal: string) => {
    const p = mapaPontosPorData.get(dataInicioVal);
    if (!p) return formatarMesAno(dataInicioVal);
    return modoSemanal ? p.semanaLabel : p.mesAnoLabel;
  };

  // Ponto de início da previsão dentro da janela visível
  const { previsaoStartKey, mostrarLinhaDivisoriaPrevisao } = useMemo(() => {
    if (!visibleChartData || visibleChartData.length === 0) {
      return { previsaoStartKey: null, mostrarLinhaDivisoriaPrevisao: false };
    }
    const idx = visibleChartData.findIndex((p: any) => p.tipo === "previsto");
    if (idx < 0) return { previsaoStartKey: null, mostrarLinhaDivisoriaPrevisao: false };
    return {
      previsaoStartKey: visibleChartData[idx].data_inicio,
      mostrarLinhaDivisoriaPrevisao: idx > 0,
    };
  }, [visibleChartData]);

  // Função auxiliar para aplicar zoom via botões ou roda do mouse
  const aplicarZoom = (fator: number, centroRatio = 0.5) => {
    if (totalPontosSerie <= 4) return;
    const minJanela = Math.min(4, totalPontosSerie); // Permite zoom até 4 semanas (1 mês detalhado)
    const tamanhoAtual = endIdx - startIdx + 1;
    let novoTamanho = Math.round(tamanhoAtual * fator);

    if (fator < 1 && novoTamanho === tamanhoAtual) novoTamanho = tamanhoAtual - 2;
    if (fator > 1 && novoTamanho === tamanhoAtual) novoTamanho = tamanhoAtual + 2;

    novoTamanho = Math.max(minJanela, Math.min(totalPontosSerie, novoTamanho));

    if (novoTamanho >= totalPontosSerie) {
      setZoomRange(null);
      return;
    }

    const ancoragem = startIdx + Math.round((tamanhoAtual - 1) * centroRatio);
    let novoStart = Math.round(ancoragem - (novoTamanho - 1) * centroRatio);
    let novoEnd = novoStart + novoTamanho - 1;

    if (novoStart < 0) {
      novoStart = 0;
      novoEnd = novoTamanho - 1;
    }
    if (novoEnd >= totalPontosSerie) {
      novoEnd = totalPontosSerie - 1;
      novoStart = Math.max(0, novoEnd - novoTamanho + 1);
    }

    setZoomRange({ start: novoStart, end: novoEnd });
  };

  // Listener nativo de wheel (passive: false) para dar zoom no gráfico sem rolar a página
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el || totalPontosSerie <= 4) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) : 0.5;
      const fator = e.deltaY < 0 ? 0.8 : 1.25;
      aplicarZoom(fator, ratio);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [totalPontosSerie, startIdx, endIdx]);

  // Handlers de Pan (Arrastar com clique)
  const handleMouseDownChart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !estaComZoom) return;
    setIsDragging(true);
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      initialStart: startIdx,
      initialEnd: endIdx,
    };
  };

  const handleMouseMoveChart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active || !chartContainerRef.current) return;
    const largura = chartContainerRef.current.clientWidth || 600;
    const deltaX = dragStateRef.current.startX - e.clientX;
    const tamanhoJanela = dragStateRef.current.initialEnd - dragStateRef.current.initialStart + 1;
    const deltaPontos = Math.round((deltaX / largura) * tamanhoJanela);

    if (deltaPontos === 0) return;

    let novoStart = dragStateRef.current.initialStart + deltaPontos;
    let novoEnd = dragStateRef.current.initialEnd + deltaPontos;

    if (novoStart < 0) {
      novoStart = 0;
      novoEnd = tamanhoJanela - 1;
    }
    if (novoEnd >= totalPontosSerie) {
      novoEnd = totalPontosSerie - 1;
      novoStart = Math.max(0, novoEnd - tamanhoJanela + 1);
    }

    setZoomRange({ start: novoStart, end: novoEnd });
  };

  const handleMouseUpChart = () => {
    if (dragStateRef.current.active) {
      dragStateRef.current.active = false;
      setIsDragging(false);
    }
  };

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
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/20">
                Vigilância Preditiva
              </span>
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 text-xs font-medium rounded-full border border-cyan-500/20 flex items-center gap-1.5" title="Base oficial de vigilância epidemiológica">
                Base Histórica SINAN: consolidada até Setembro/2026 (Atualizações em ciclo contínuo)
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

          <div className="flex flex-wrap items-center gap-3">
            {previsoesSalvas.length > 0 && (
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Previsões Salvas
                </label>
                <select
                  value={previsaoCarregadaId}
                  onChange={(e) => handleSelecionarPrevisaoSalva(e.target.value)}
                  className="bg-slate-900/90 border border-slate-700/70 text-xs text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 max-w-[260px]"
                >
                  <option value="">Carregar previsão salva...</option>
                  {previsoesSalvas.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.titulo} ({Number(p.casos_previstos || 0).toLocaleString("pt-BR")} casos)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={handleAbrirModalSalvar}
              disabled={loading || !dados}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
            >
              Salvar Previsão
            </button>

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
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${ativo
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
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Período Histórico</p>
                <span className="text-[10px] text-cyan-300 font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                  Consolidado até Set/2026
                </span>
              </div>
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
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${mostrarAvancados
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
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium border ${modo === "ampliado"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    title="Inclui casos suspeitos notificados (mais realista para consumo de kits)"
                  >
                    Notificados (Ampliado)
                  </button>
                  <button
                    onClick={() => setModo("conservador")}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium border ${modo === "conservador"
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
                  className={`text-2xl font-extrabold ${(dados?.indicadores?.mudanca_esperada_pct ?? 0) > 0
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
                className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${dados?.indicadores?.tendencia?.includes("Crescente")
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
          SEÇÃO 3 — GRÁFICO RECHARTS (COM ZOOM, PAN E DRILL-DOWN SEMANAL)
      ===================================================================== */}
        <div className="glass p-6 rounded-2xl border border-slate-700/50 space-y-2.5">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-lg">📈</span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    Comportamento epidemiológico e previsão
                  </h2>
                  {!loading && totalPontosSerie > 0 && (
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition-colors ${modoSemanal
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                    >
                      {modoSemanal
                        ? `Escala Semanal (${semanasVisiveis} sem)`
                        : `Escala Mensal (${semanasVisiveis} sem)`}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {localidades.join(", ")} · {textoPeríodo} · próximas {horizonteSemanas} semanas
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Controles rápidos de Zoom */}
              {!loading && totalPontosSerie > 4 && (
                <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/70 rounded-xl p-1">
                  <button
                    onClick={() => aplicarZoom(0.75, 0.5)}
                    disabled={semanasVisiveis <= 4}
                    title="Aproximar zoom (detalhar semanas)"
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs transition-colors"
                  >
                    + Zoom
                  </button>
                  <button
                    onClick={() => aplicarZoom(1.35, 0.5)}
                    disabled={!estaComZoom}
                    title="Afastar zoom"
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-xs transition-colors"
                  >
                    − Zoom
                  </button>
                  {estaComZoom && (
                    <button
                      onClick={() => setZoomRange(null)}
                      title="Voltar ao período completo"
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 font-semibold text-xs transition-colors"
                    >
                      Resetar Zoom
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-4">
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
          </div>

          <div
            ref={chartContainerRef}
            onMouseDown={handleMouseDownChart}
            onMouseMove={handleMouseMoveChart}
            onMouseUp={handleMouseUpChart}
            onMouseLeave={handleMouseUpChart}
            className={`w-full bg-slate-950/40 rounded-xl border border-slate-800/80 p-3 pt-4 select-none ${estaComZoom
                ? isDragging
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : "cursor-crosshair"
              }`}
          >
            {loading ? (
              <div className="h-80 flex flex-col items-center justify-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-medium text-slate-300">
                  Calculando projeção Prophet com série temporal...
                </p>
                <div className="flex flex-col items-center gap-1.5">
                  <span className="px-3 py-1 rounded-full bg-slate-900/90 border border-emerald-500/30 text-[11px] font-semibold text-emerald-400 tabular-nums">
                    ⏱️ Tempo estimado: ~{Math.max(0.1, Number((tempoEstimadoSegundos - segundosDecorridos).toFixed(1)))}s restantes ({segundosDecorridos.toFixed(1)}s decorridos)
                  </span>
                  <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-100"
                      style={{
                        width: `${Math.min(95, Math.round((segundosDecorridos / tempoEstimadoSegundos) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : visibleChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={360}>
                  <ComposedChart
                    data={visibleChartData}
                    margin={{ top: 10, right: 20, left: 10, bottom: 15 }}
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
                      vertical={modoSemanal}
                    />

                    <XAxis
                      dataKey="data_inicio"
                      tickFormatter={formatarTickEixoX}
                      tick={{ fill: modoSemanal ? "#94a3b8" : "#64748b", fontSize: 10 }}
                      axisLine={{ stroke: CORES.grid }}
                      tickLine={modoSemanal}
                      ticks={ticksEixoX}
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={55}
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
                        stroke: "rgba(148, 163, 184, 0.35)",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                    />

                    {previsaoStartKey && (
                      <ReferenceArea
                        x1={previsaoStartKey}
                        fill={CORES.previsaoFill}
                        fillOpacity={1}
                      />
                    )}

                    {previsaoStartKey && mostrarLinhaDivisoriaPrevisao && (
                      <ReferenceLine
                        x={previsaoStartKey}
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
                          dot={
                            modoSemanal
                              ? { r: 3, fill: CORES.dengue, stroke: "#0f172a", strokeWidth: 1.5 }
                              : false
                          }
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
                          dot={
                            modoSemanal
                              ? { r: 3, fill: "#0f172a", stroke: CORES.dengue, strokeWidth: 2 }
                              : false
                          }
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
                          dot={
                            modoSemanal
                              ? { r: 3, fill: CORES.influenza, stroke: "#0f172a", strokeWidth: 1.5 }
                              : false
                          }
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
                          dot={
                            modoSemanal
                              ? { r: 3, fill: "#0f172a", stroke: CORES.influenza, strokeWidth: 2 }
                              : false
                          }
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

                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                  <LegendaCustomizada doenca={doenca} />
                  <span className="text-[11px] text-slate-400">
                    🖱️ Role o mouse sobre o gráfico para dar <strong>Zoom (detalhar semanas)</strong> ·{" "}
                    {estaComZoom ? (
                      <strong className="text-emerald-400">Clique e arraste para mover o período</strong>
                    ) : (
                      <span>Clique e arraste quando em zoom</span>
                    )}
                  </span>
                </div>
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
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${mat.doenca === "Dengue"
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
                        className={`py-2.5 px-3 font-bold ${mat.saldo_projetado < 0 ? "text-red-400" : "text-emerald-400"
                          }`}
                      >
                        {mat.saldo_projetado > 0 ? "+" : ""}
                        {mat.saldo_projetado.toLocaleString("pt-BR")} {mat.unidade}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${mat.status_risco === "CRITICO"
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
          <span>Fonte: bases epidemiológicas públicas · dados oficiais SINAN / DATASUS</span>
          <span>
            Cobertura: {textoPeríodo} · {localidades.join(", ")}
          </span>
        </div>

        {/* =====================================================================
          MODAL — SALVAR PREVISÃO (SNAPSHOT COMPLETO)
      ===================================================================== */}
        {modalSalvarAberto && (
          <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scale-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white">Salvar Previsão Epidemiológica</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Salva todos os filtros ativos e a série completa do gráfico para uso na análise algorítmica de alertas.
                  </p>
                </div>
                <button
                  onClick={() => setModalSalvarAberto(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Identificação da Previsão
                  </label>
                  <input
                    type="text"
                    value={tituloPrevisao}
                    onChange={(e) => setTituloPrevisao(e.target.value)}
                    placeholder="Ex: Dengue · Santos · Próximas 8 semanas"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <p className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">
                    Resumo do Snapshot a ser salvo
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">Doença:</span>{" "}
                      <strong className="text-white">{doenca}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Horizonte:</span>{" "}
                      <strong className="text-white">{horizonteSemanas} semanas</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Localidades:</span>{" "}
                      <strong className="text-white">{localidades.join(", ")}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Período:</span>{" "}
                      <strong className="text-white">{textoPeríodo}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Modo / Perfil:</span>{" "}
                      <strong className="text-white">
                        {modo} · {faixaEtaria} · {sexo}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Casos Previstos:</span>{" "}
                      <strong className="text-emerald-400">
                        {(dados?.indicadores?.casos_previstos ?? distribuicaoLocal.total_previsto).toLocaleString("pt-BR")}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Confiança Prophet:</span>{" "}
                      <strong className="text-cyan-400">80% (IC 80%)</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button
                  onClick={() => setModalSalvarAberto(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarPrevisao}
                  disabled={salvandoPrevisao}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  {salvandoPrevisao ? "Salvando..." : "Salvar Previsão"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      );
}
