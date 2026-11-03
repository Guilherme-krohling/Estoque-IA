"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { movimentacoesApi, rastreabilidadeApi, lotesApi, materiaisApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

const TIPOS = ["", "ENTRADA", "USO", "DESCARTE", "AJUSTE", "TRANSFERENCIA"];
const SUGESTOES_CONVENIOS = ["Unimed", "Bradesco Saúde", "SulAmérica", "Amil", "NotreDame Intermédica", "SUS", "Particular"];
const SUGESTOES_EXAMES = [
  "Hemograma Completo",
  "Sorologia Dengue IgM/IgG",
  "Teste Rápido Dengue NS1",
  "RT-PCR Influenza A/B",
  "Glicemia de Jejum",
  "Proteína C Reativa (PCR)",
  "TGO / AST",
  "TGP / ALT",
  "Ureia",
  "Creatinina",
  "Coagulograma",
  "Ferritina",
];

export default function AuditoriaPage() {
  const [activeTab, setActiveTab] = useState<"RASTREABILIDADE" | "TRILHA">("RASTREABILIDADE");

  // Estado da Trilha Geral de Movimentações
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Estado da Rastreabilidade por Paciente, Convênio e Exames (Fase 4.2)
  const [rastreabilidadeData, setRastreabilidadeData] = useState<{ resumo: any; itens: any[] }>({
    resumo: {
      total_registros_uso: 0,
      total_pacientes_atendidos: 0,
      total_convenios: 0,
      total_exames_realizados: 0,
    },
    itens: [],
  });
  const [lotesAtivos, setLotesAtivos] = useState<any[]>([]);
  const [materiaisMap, setMateriaisMap] = useState<Record<number, any>>({});
  const [buscaRastreio, setBuscaRastreio] = useState("");
  const [filtroConvenio, setFiltroConvenio] = useState("");

  // Modal de Registro de Uso em Paciente
  const [modalPacienteOpen, setModalPacienteOpen] = useState(false);
  const [salvandoAtendimento, setSalvandoAtendimento] = useState(false);
  const [formAtendimento, setFormAtendimento] = useState({
    paciente_nome: "",
    paciente_documento: "",
    convenio: "Unimed",
    codigo_atendimento: "",
    exames_texto: "",
    observacoes: "",
  });
  const [itensConsumoForm, setItensConsumoForm] = useState<
    Array<{ lote_id: string; quantidade: string; exame_especifico: string }>
  >([{ lote_id: "", quantidade: "1", exame_especifico: "" }]);

  const load = async () => {
    setLoading(true);
    try {
      const [movs, rastreio, lotes, materiais] = await Promise.all([
        movimentacoesApi.listar(filtroTipo ? { tipo: filtroTipo } : undefined),
        rastreabilidadeApi.listar(),
        lotesApi.listar(),
        materiaisApi.listar(),
      ]);
      setMovimentacoes(movs);
      setRastreabilidadeData(rastreio);

      const mapaMat: Record<number, any> = {};
      for (const m of materiais) {
        mapaMat[m.id] = m;
      }
      setMateriaisMap(mapaMat);
      setLotesAtivos(lotes.filter((l: any) => Number(l.quantidade_atual) > 0));
    } catch {
      showToast("Erro ao carregar dados de auditoria e rastreabilidade.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [filtroTipo]);

  const estornadas = new Set(movimentacoes.filter((m) => m.estorno_de_id).map((m) => m.estorno_de_id));

  const tipoColor: Record<string, string> = {
    ENTRADA: "bg-emerald-500/10 text-emerald-400",
    USO: "bg-cyan-500/10 text-cyan-400",
    DESCARTE: "bg-red-500/10 text-red-400",
    AJUSTE: "bg-amber-500/10 text-amber-400",
    TRANSFERENCIA: "bg-violet-500/10 text-violet-400",
  };

  const handleEstornar = async (item: any) => {
    if (!confirm(`Estornar a movimentação #${item.id} (${item.tipo})? Isso cria o lançamento inverso.`)) return;
    try {
      await movimentacoesApi.estornar(item.id);
      showToast("Movimentação estornada.");
      load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleSortToggle = (colKey: string) => {
    if (sortColumn === colKey) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(colKey);
      setSortDirection("asc");
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFiltroTipo("");
    setSortColumn(null);
    setSortDirection("asc");
  };

  // Lista de exames parseada do formulário
  const examesListaForm = useMemo(() => {
    return formAtendimento.exames_texto
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [formAtendimento.exames_texto]);

  const adicionarExameSugerido = (exame: string) => {
    if (examesListaForm.includes(exame)) return;
    const novaLista = [...examesListaForm, exame];
    setFormAtendimento({ ...formAtendimento, exames_texto: novaLista.join(", ") });
  };

  const handleAdicionarItemConsumo = () => {
    setItensConsumoForm([...itensConsumoForm, { lote_id: "", quantidade: "1", exame_especifico: "" }]);
  };

  const handleRemoverItemConsumo = (idx: number) => {
    if (itensConsumoForm.length <= 1) return;
    setItensConsumoForm(itensConsumoForm.filter((_, i) => i !== idx));
  };

  const handleRegistrarUsoPaciente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAtendimento.paciente_nome.trim()) {
      showToast("Informe o nome do paciente.", "error");
      return;
    }
    if (examesListaForm.length === 0) {
      showToast("Informe ao menos 1 exame realizado pelo paciente.", "error");
      return;
    }

    const itensValidos = itensConsumoForm
      .map((it) => ({
        lote_id: parseInt(it.lote_id),
        quantidade: parseFloat(it.quantidade.replace(",", ".")),
        exame_especifico: it.exame_especifico.trim() || undefined,
      }))
      .filter((it) => !isNaN(it.lote_id) && !isNaN(it.quantidade) && it.quantidade > 0);

    if (itensValidos.length === 0) {
      showToast("Selecione ao menos um lote válido e informe a quantidade utilizada.", "error");
      return;
    }

    setSalvandoAtendimento(true);
    try {
      await rastreabilidadeApi.registrarAtendimento({
        paciente_nome: formAtendimento.paciente_nome.trim(),
        paciente_documento: formAtendimento.paciente_documento.trim() || undefined,
        convenio: formAtendimento.convenio.trim() || "Particular",
        codigo_atendimento: formAtendimento.codigo_atendimento.trim() || undefined,
        exames: examesListaForm,
        observacoes: formAtendimento.observacoes.trim() || undefined,
        itens_consumidos: itensValidos,
      });
      showToast("Uso de material vinculado ao paciente, convênio e exames com sucesso!");
      setModalPacienteOpen(false);
      setFormAtendimento({
        paciente_nome: "",
        paciente_documento: "",
        convenio: "Unimed",
        codigo_atendimento: "",
        exames_texto: "",
        observacoes: "",
      });
      setItensConsumoForm([{ lote_id: "", quantidade: "1", exame_especifico: "" }]);
      load();
    } catch (err: any) {
      showToast(err.message || "Erro ao registrar uso em paciente.", "error");
    } finally {
      setSalvandoAtendimento(false);
    }
  };

  // Convênios disponíveis para filtro rápido
  const conveniosUnicos = useMemo(() => {
    const set = new Set<string>();
    for (const item of rastreabilidadeData.itens) {
      if (item.convenio) set.add(item.convenio);
    }
    return Array.from(set).sort();
  }, [rastreabilidadeData.itens]);

  // Filtragem da Rastreabilidade por Paciente, Convênio, Exame e Material
  const itensRastreabilidadeFiltrados = useMemo(() => {
    let lista = [...rastreabilidadeData.itens];
    if (filtroConvenio) {
      lista = lista.filter((it) => it.convenio === filtroConvenio);
    }
    if (buscaRastreio.trim() !== "") {
      const term = buscaRastreio.toLowerCase();
      lista = lista.filter((it) => {
        const examesStr = (it.exames_realizados || []).join(" ");
        const texto = `${it.paciente_nome || ""} ${it.convenio || ""} ${it.material_nome || ""} ${it.numero_lote || ""} ${it.codigo_atendimento || ""} ${examesStr} ${it.descricao_rastreabilidade || ""}`.toLowerCase();
        return texto.includes(term);
      });
    }
    return lista;
  }, [rastreabilidadeData.itens, filtroConvenio, buscaRastreio]);

  // Filtragem por digitação e Ordenação da Trilha Geral
  const movimentacoesProcessadas = useMemo(() => {
    let result = [...movimentacoes];

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((m) => {
        const matNome = m.lote?.material?.nome || "";
        const numLote = m.lote?.numero_lote || "";
        const userNome = m.usuario?.nome || "";
        const motivo = m.motivo || "";
        const text = `${m.tipo || ""} ${matNome} ${numLote} ${userNome} ${motivo} ${m.quantidade || ""}`.toLowerCase();
        return text.includes(term);
      });
    }

    if (sortColumn) {
      result.sort((a, b) => {
        let valA: any = "";
        let valB: any = "";

        if (sortColumn === "tipo") {
          valA = a.tipo || "";
          valB = b.tipo || "";
        } else if (sortColumn === "material") {
          valA = a.lote?.material?.nome || "";
          valB = b.lote?.material?.nome || "";
        } else if (sortColumn === "quantidade") {
          valA = Number(a.quantidade || 0);
          valB = Number(b.quantidade || 0);
        } else if (sortColumn === "usuario") {
          valA = a.usuario?.nome || "";
          valB = b.usuario?.nome || "";
        } else if (sortColumn === "data") {
          valA = a.criado_em || "";
          valB = b.criado_em || "";
        }

        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }

        const cmp = String(valA).localeCompare(String(valB), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [movimentacoes, searchTerm, sortColumn, sortDirection]);

  const hasActiveFilters = searchTerm !== "" || filtroTipo !== "" || sortColumn !== null;

  return (
    <PageHeader
      title="Auditoria & Rastreabilidade Clínica"
      subtitle="Rastreabilidade de insumos por paciente, convênio e exames realizados + trilha imutável de movimentações"
      actions={
        <button
          onClick={() => setModalPacienteOpen(true)}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-all shadow-lg shadow-cyan-500/20"
        >
          + Registrar Uso em Paciente
        </button>
      }
    >
      {/* Abas de Navegação */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700/50 pb-3">
        <button
          onClick={() => setActiveTab("RASTREABILIDADE")}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "RASTREABILIDADE"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
              : "bg-slate-800/40 text-slate-400 hover:text-white border border-slate-700/40"
          }`}
        >
          <span>Rastreabilidade por Paciente, Convênio & Exames</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 font-bold">
            {rastreabilidadeData.itens.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("TRILHA")}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "TRILHA"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
              : "bg-slate-800/40 text-slate-400 hover:text-white border border-slate-700/40"
          }`}
        >
          <span>Trilha Geral de Movimentações</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
            {movimentacoes.length}
          </span>
        </button>
      </div>

      {activeTab === "RASTREABILIDADE" ? (
        <>
          {/* Cards de Resumo da Rastreabilidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="glass p-4 rounded-2xl border border-slate-700/50">
              <span className="text-xs font-medium uppercase text-slate-400">Insumos Rastreados</span>
              <p className="text-2xl font-bold text-cyan-400 mt-1">
                {rastreabilidadeData.resumo?.total_registros_uso ?? rastreabilidadeData.itens.length}
              </p>
              <span className="text-xs text-slate-500">Baixas vinculadas a atendimentos</span>
            </div>

            <div className="glass p-4 rounded-2xl border border-slate-700/50">
              <span className="text-xs font-medium uppercase text-slate-400">Pacientes Atendidos</span>
              <p className="text-2xl font-bold text-white mt-1">
                {rastreabilidadeData.resumo?.total_pacientes_atendidos ?? 0}
              </p>
              <span className="text-xs text-slate-500">Com histórico de lote auditável</span>
            </div>

            <div className="glass p-4 rounded-2xl border border-slate-700/50">
              <span className="text-xs font-medium uppercase text-slate-400">Convênios Ativos</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {rastreabilidadeData.resumo?.total_convenios ?? 0}
              </p>
              <span className="text-xs text-slate-500">Planos de saúde e particular</span>
            </div>

            <div className="glass p-4 rounded-2xl border border-slate-700/50">
              <span className="text-xs font-medium uppercase text-slate-400">Exames Realizados</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">
                {rastreabilidadeData.resumo?.total_exames_realizados ?? 0}
              </p>
              <span className="text-xs text-slate-500">Total de exames vinculados aos lotes</span>
            </div>
          </div>

          {/* Barra de Busca de Rastreabilidade */}
          <div className="mb-6 p-3 glass rounded-xl border border-slate-700/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={buscaRastreio}
                onChange={(e) => setBuscaRastreio(e.target.value)}
                placeholder="Buscar por Paciente (ex: Guilherme), Convênio (ex: Unimed), Exame, Material ou Lote..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none placeholder-slate-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={filtroConvenio}
                onChange={(e) => setFiltroConvenio(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
              >
                <option value="">Todos os Convênios</option>
                {conveniosUnicos.map((conv) => (
                  <option key={conv} value={conv}>
                    {conv}
                  </option>
                ))}
              </select>

              {(buscaRastreio || filtroConvenio) && (
                <button
                  onClick={() => {
                    setBuscaRastreio("");
                    setFiltroConvenio("");
                  }}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : itensRastreabilidadeFiltrados.length === 0 ? (
            <div className="text-center py-12 text-slate-400 glass rounded-xl border border-slate-700/50">
              <p className="text-lg font-medium text-white mb-1">Nenhum registro de rastreabilidade encontrado</p>
              <p className="text-sm text-slate-400 mb-4">
                Registre o uso de um material vinculando-o ao paciente, convênio e exames realizados.
              </p>
              <button
                onClick={() => setModalPacienteOpen(true)}
                className="px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-semibold hover:bg-cyan-500/30 transition-colors"
              >
                + Registrar Primeiro Uso Rastreável
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {itensRastreabilidadeFiltrados.map((item) => (
                <div
                  key={item.id}
                  className="glass p-5 rounded-2xl border border-slate-700/60 hover:border-cyan-500/40 transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-700/40">
                    {/* Coluna 1: Material e Lote Utilizado */}
                    <div className="flex items-start gap-3">
                      <div className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold uppercase tracking-wider shrink-0">
                        USO RASTREADO
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-white">{item.material_nome}</h3>
                          <span className="px-2 py-0.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                            Lote: {item.numero_lote}
                          </span>
                          <span className="px-2.5 py-0.5 text-xs rounded-md bg-emerald-500/15 text-emerald-300 font-bold">
                            Qtd usada: {item.quantidade_utilizada} {item.unidade_medida}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Atendimento <span className="text-slate-300 font-mono">{item.codigo_atendimento}</span>
                          {item.data_atendimento
                            ? ` · Realizado em ${new Date(item.data_atendimento).toLocaleString("pt-BR")}`
                            : ""}
                          {item.usuario_nome ? ` · Resp: ${item.usuario_nome}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Coluna 2: Paciente e Convênio */}
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700/70">
                        <span className="block text-[10px] uppercase tracking-wider text-slate-400">Paciente</span>
                        <span className="text-sm font-bold text-white">{item.paciente_nome}</span>
                        {item.paciente_documento && (
                          <span className="block text-[11px] text-slate-400">{item.paciente_documento}</span>
                        )}
                      </div>

                      <div className="px-3.5 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30">
                        <span className="block text-[10px] uppercase tracking-wider text-violet-300">Convênio</span>
                        <span className="text-sm font-bold text-violet-200">{item.convenio}</span>
                      </div>

                      <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center">
                        <span className="block text-[10px] uppercase tracking-wider text-amber-300">Exames</span>
                        <span className="text-sm font-bold text-amber-200">{item.qtd_exames} exame(s)</span>
                      </div>
                    </div>
                  </div>

                  {/* Frase Síntese Auditável (Padrão Fase 4.2) */}
                  <div className="mt-3 p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-slate-200 leading-relaxed">
                    <span className="font-semibold text-cyan-400 mr-1.5">Registro de Rastreabilidade:</span>
                    O material <strong className="text-white">{item.material_nome}</strong> (Lote{" "}
                    <strong className="text-white">{item.numero_lote}</strong>) foi usado no(a) paciente{" "}
                    <strong className="text-cyan-300">{item.paciente_nome}</strong> que tem o convênio{" "}
                    <strong className="text-violet-300">{item.convenio}</strong> e realizou{" "}
                    <strong className="text-amber-300">{item.qtd_exames} exame(s)</strong> conosco:
                  </div>

                  {/* Badges com Todos os Exames Realizados pelo Paciente */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {(item.exames_realizados || []).map((exame: string, idx: number) => {
                      const ehFoco = item.exame_especifico && item.exame_especifico.toLowerCase() === exame.toLowerCase();
                      return (
                        <span
                          key={idx}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                            ehFoco
                              ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-200 font-bold"
                              : "bg-slate-800/80 border-slate-700 text-slate-300"
                          }`}
                        >
                          {idx + 1}. {exame}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Barra de Filtros e Busca Completa da Trilha Geral */}
          <div className="mb-6 p-3 glass rounded-xl border border-slate-700/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite para buscar na auditoria (Material, Lote, Usuário, Paciente)..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none placeholder-slate-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t === "" ? "Todos os Tipos" : t}
                  </option>
                ))}
              </select>

              <select
                value={sortColumn || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSortColumn(val);
                    setSortDirection("asc");
                  } else {
                    setSortColumn(null);
                  }
                }}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              >
                <option value="">Ordenar por...</option>
                <option value="data">Data / Hora</option>
                <option value="tipo">Tipo</option>
                <option value="material">Material</option>
                <option value="quantidade">Quantidade</option>
                <option value="usuario">Responsável</option>
              </select>

              {sortColumn && (
                <button
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-lg transition-colors"
                  title={sortDirection === "asc" ? "Crescente (A-Z / 0-9)" : "Decrescente (Z-A / 9-0)"}
                >
                  {sortDirection === "asc" ? "↑ ASC" : "↓ DESC"}
                </button>
              )}

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : movimentacoesProcessadas.length === 0 ? (
            <div className="text-center py-12 text-slate-400 glass rounded-xl border border-slate-700/50">
              <p>{hasActiveFilters ? "Nenhuma movimentação encontrada para esta busca." : "Nenhuma movimentação registrada."}</p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="mt-3 px-4 py-1.5 bg-slate-800 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-700/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-800/50 text-left text-slate-300 select-none">
                    <th onClick={() => handleSortToggle("tipo")} className="px-4 py-3 font-medium cursor-pointer hover:text-white">
                      Tipo {sortColumn === "tipo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th onClick={() => handleSortToggle("material")} className="px-4 py-3 font-medium cursor-pointer hover:text-white">
                      Material / Lote {sortColumn === "material" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th onClick={() => handleSortToggle("quantidade")} className="px-4 py-3 font-medium cursor-pointer hover:text-white">
                      Qtd. {sortColumn === "quantidade" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th onClick={() => handleSortToggle("usuario")} className="px-4 py-3 font-medium cursor-pointer hover:text-white">
                      Responsável {sortColumn === "usuario" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 font-medium">Motivo / Rastreabilidade</th>
                    <th onClick={() => handleSortToggle("data")} className="px-4 py-3 font-medium cursor-pointer hover:text-white">
                      Data {sortColumn === "data" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th className="px-4 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoesProcessadas.map((m) => {
                    const foiEstornada = estornadas.has(m.id);
                    const ehEstorno = !!m.estorno_de_id;
                    return (
                      <tr
                        key={m.id}
                        className={`border-b border-slate-700/30 hover:bg-slate-800/40 ${
                          foiEstornada ? "opacity-50 line-through" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-lg font-medium ${tipoColor[m.tipo] || ""}`}>{m.tipo}</span>
                          {ehEstorno && <span className="ml-2 text-xs text-slate-400">(estorno de #{m.estorno_de_id})</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          <div className="font-medium">{m.lote?.material?.nome || "—"}</div>
                          <div className="text-xs text-slate-400">Lote: {m.lote?.numero_lote || "—"}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">
                          {m.quantidade}
                          {m.lote?.material?.unidade_medida ? ` ${m.lote.material.unidade_medida}` : ""}
                        </td>
                        <td className="px-4 py-3 text-slate-200">{m.usuario?.nome || `#${m.usuario_id}`}</td>
                        <td className="px-4 py-3 text-slate-300">
                          <div>{m.motivo || "-"}</div>
                          {m.referencia && (
                            <span className="inline-block mt-0.5 px-2 py-0.5 text-[11px] font-mono rounded bg-slate-800 text-cyan-400 border border-slate-700">
                              Ref: {m.referencia}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{new Date(m.criado_em).toLocaleString("pt-BR")}</td>
                        <td className="px-4 py-3 text-right">
                          {!foiEstornada && !ehEstorno && ["ENTRADA", "USO", "DESCARTE"].includes(m.tipo) && (
                            <button
                              onClick={() => handleEstornar(m)}
                              className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                            >
                              Estornar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal: Registrar Uso de Material Vinculado a Paciente, Convênio e Exames */}
      {modalPacienteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass max-w-2xl w-full rounded-2xl border border-slate-700 p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Registrar Uso de Material em Paciente</h2>
                <p className="text-xs text-slate-400">
                  Dá baixa automática no lote selecionado e registra o paciente, convênio e todos os exames realizados
                </p>
              </div>
              <button
                onClick={() => setModalPacienteOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegistrarUsoPaciente} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Nome do Paciente *</label>
                  <input
                    type="text"
                    required
                    value={formAtendimento.paciente_nome}
                    onChange={(e) => setFormAtendimento({ ...formAtendimento, paciente_nome: e.target.value })}
                    placeholder="Ex: Guilherme Silva"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 font-medium mb-1">Convênio *</label>
                  <input
                    type="text"
                    required
                    list="lista-convenios-sugeridos"
                    value={formAtendimento.convenio}
                    onChange={(e) => setFormAtendimento({ ...formAtendimento, convenio: e.target.value })}
                    placeholder="Ex: Unimed, Bradesco Saúde, Particular..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                  />
                  <datalist id="lista-convenios-sugeridos">
                    {SUGESTOES_CONVENIOS.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">CPF / Prontuário (Opcional)</label>
                  <input
                    type="text"
                    value={formAtendimento.paciente_documento}
                    onChange={(e) => setFormAtendimento({ ...formAtendimento, paciente_documento: e.target.value })}
                    placeholder="Ex: 123.456.789-00"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Código do Atendimento (Opcional)</label>
                  <input
                    type="text"
                    value={formAtendimento.codigo_atendimento}
                    onChange={(e) => setFormAtendimento({ ...formAtendimento, codigo_atendimento: e.target.value })}
                    placeholder="Gerado automaticamente se vazio"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
                  />
                </div>
              </div>

              {/* Lista de Exames Realizados pelo Paciente */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 font-medium">
                    Exames Realizados pelo Paciente (separe por vírgula) *
                  </label>
                  <span className="text-xs font-bold text-amber-400">
                    {examesListaForm.length} exame(s) informado(s)
                  </span>
                </div>
                <textarea
                  rows={2}
                  required
                  value={formAtendimento.exames_texto}
                  onChange={(e) => setFormAtendimento({ ...formAtendimento, exames_texto: e.target.value })}
                  placeholder="Ex: Hemograma Completo, Sorologia Dengue IgM/IgG, Proteína C Reativa (PCR), TGO, TGP..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-slate-400 self-center mr-1">Adicionar rápido:</span>
                  {SUGESTOES_EXAMES.map((ex) => (
                    <button
                      type="button"
                      key={ex}
                      onClick={() => adicionarExameSugerido(ex)}
                      className="px-2 py-0.5 text-[11px] rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                    >
                      + {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Materiais / Lotes Consumidos no Atendimento */}
              <div className="border-t border-slate-700/60 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Materiais / Lotes Utilizados neste Paciente
                  </label>
                  <button
                    type="button"
                    onClick={handleAdicionarItemConsumo}
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    + Adicionar outro material
                  </button>
                </div>

                <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                  {itensConsumoForm.map((itemForm, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_110px_160px_32px] gap-2 items-center bg-slate-900/70 p-2.5 rounded-xl border border-slate-800"
                    >
                      <select
                        required
                        value={itemForm.lote_id}
                        onChange={(e) => {
                          const novos = [...itensConsumoForm];
                          novos[idx].lote_id = e.target.value;
                          setItensConsumoForm(novos);
                        }}
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      >
                        <option value="">Selecione o Material / Lote...</option>
                        {lotesAtivos.map((l) => {
                          const mat = materiaisMap[l.material_id];
                          return (
                            <option key={l.id} value={l.id}>
                              {mat?.nome || `Material #${l.material_id}`} — Lote {l.numero_lote} (Saldo: {l.quantidade_atual}{" "}
                              {mat?.unidade_medida || "un"})
                            </option>
                          );
                        })}
                      </select>

                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={itemForm.quantidade}
                        onChange={(e) => {
                          const novos = [...itensConsumoForm];
                          novos[idx].quantidade = e.target.value;
                          setItensConsumoForm(novos);
                        }}
                        placeholder="Qtd"
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      />

                      <input
                        type="text"
                        value={itemForm.exame_especifico}
                        onChange={(e) => {
                          const novos = [...itensConsumoForm];
                          novos[idx].exame_especifico = e.target.value;
                          setItensConsumoForm(novos);
                        }}
                        placeholder="Exame alvo (opcional)"
                        className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                      />

                      {itensConsumoForm.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoverItemConsumo(idx)}
                          className="text-red-400 hover:text-red-300 text-xs font-bold text-center"
                          title="Remover item"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setModalPacienteOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvandoAtendimento}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-sm transition-all"
                >
                  {salvandoAtendimento ? "Registrando..." : "Confirmar Baixa & Rastreabilidade"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageHeader>
  );
}
