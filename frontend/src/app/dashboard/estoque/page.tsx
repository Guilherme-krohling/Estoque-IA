"use client";

import { useEffect, useState, useMemo } from "react";
import { materiaisApi, lotesApi, categoriasApi, movimentacoesApi, locaisApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function EstoqueWorkspace() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [locais, setLocais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs do Painel Esquerdo
  const [activeSideTab, setActiveSideTab] = useState<"MATERIAL" | "LOTE">("LOTE");

  // Filtros e Ordenação da Tabela Operacional
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Forms
  const [formMaterial, setFormMaterial] = useState({ nome: "", categoria_id: "", fabricante: "", codigo_catalogo: "", classe_risco: "", unidade_medida: "un", estoque_minimo: "", estoque_maximo: "", exige_refrigeracao: false, temperatura_min: "", temperatura_max: "" });
  const [formLote, setFormLote] = useState({ material_id: "", local_id: "", numero_lote: "", quantidade_inicial: "", data_fabricacao: "", data_validade: "", certificado_analise: "" });

  const CLASSES_RISCO = ["Comum", "Biológico", "Químico", "Inflamável"];

  const load = async () => {
    try {
      const [m, l, c, loc] = await Promise.all([materiaisApi.listar(), lotesApi.listar(), categoriasApi.listar(), locaisApi.listar()]);
      setMateriais(m); setLotes(l); setCategorias(c); setLocais(loc);
    } catch {
      showToast("Erro ao carregar workspace.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await materiaisApi.criar({
        nome: formMaterial.nome,
        categoria_id: formMaterial.categoria_id ? parseInt(formMaterial.categoria_id) : null,
        fabricante: formMaterial.fabricante || null,
        codigo_catalogo: formMaterial.codigo_catalogo || null,
        classe_risco: formMaterial.classe_risco || null,
        unidade_medida: formMaterial.unidade_medida || "un",
        estoque_minimo: formMaterial.estoque_minimo !== "" ? parseFloat(formMaterial.estoque_minimo.replace(",", ".")) : 0,
        estoque_maximo: formMaterial.estoque_maximo !== "" ? parseFloat(formMaterial.estoque_maximo.replace(",", ".")) : null,
        exige_refrigeracao: formMaterial.exige_refrigeracao,
        temperatura_min: formMaterial.temperatura_min !== "" ? parseFloat(formMaterial.temperatura_min) : null,
        temperatura_max: formMaterial.temperatura_max !== "" ? parseFloat(formMaterial.temperatura_max) : null,
      });
      showToast("Material adicionado ao catálogo!");
      setFormMaterial({ nome: "", categoria_id: "", fabricante: "", codigo_catalogo: "", classe_risco: "", unidade_medida: "un", estoque_minimo: "", estoque_maximo: "", exige_refrigeracao: false, temperatura_min: "", temperatura_max: "" });
      load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleCreateLote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await lotesApi.criar({
        material_id: parseInt(formLote.material_id),
        local_id: formLote.local_id ? parseInt(formLote.local_id) : null,
        numero_lote: formLote.numero_lote,
        quantidade_inicial: formLote.quantidade_inicial ? parseFloat(formLote.quantidade_inicial.replace(",", ".")) : 0,
        data_validade: formLote.data_validade,
        data_fabricacao: formLote.data_fabricacao || null,
        certificado_analise: formLote.certificado_analise || null,
      });
      showToast("Lote inserido no estoque!");
      setFormLote({ material_id: "", local_id: "", numero_lote: "", quantidade_inicial: "", data_fabricacao: "", data_validade: "", certificado_analise: "" });
      load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleTransferencia = async (lote: any) => {
    if (locais.length < 2) { showToast("Cadastre ao menos 2 locais para transferir.", "error"); return; }
    const opcoes = locais.map((lo, i) => `${i + 1}) ${lo.nome} (${lo.tipo})`).join("\n");
    const escolha = window.prompt(`Transferir lote ${lote.numero_lote} para qual local?\n\n${opcoes}\n\nDigite o número:`);
    if (escolha === null) return;
    const idx = parseInt(escolha) - 1;
    if (isNaN(idx) || idx < 0 || idx >= locais.length) { showToast("Opção inválida.", "error"); return; }
    const destino = locais[idx];
    if (destino.id === lote.local_id) { showToast("O lote já está nesse local.", "error"); return; }
    try {
      await movimentacoesApi.criar({
        lote_id: lote.id,
        tipo: "TRANSFERENCIA",
        quantidade: 0,
        local_origem_id: lote.local_id ?? null,
        local_destino_id: destino.id,
        motivo: `Transferência para ${destino.nome}`,
      });
      showToast("Transferência registrada!");
      load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleMovimentacao = async (
    loteId: number,
    tipo: "ENTRADA" | "USO" | "DESCARTE" | "AJUSTE",
    loteValidade: string
  ) => {
    if (tipo === "USO" && new Date(loteValidade) < new Date()) {
      showToast("Bloqueado: lote vencido não pode ser usado. Apenas descarte é permitido.", "error");
      return;
    }

    const label =
      tipo === "AJUSTE"
        ? "Ajuste de inventário — digite o saldo REAL contado:"
        : `Registrar ${tipo} — digite a quantidade:`;
    const qtdStr = window.prompt(label);
    if (qtdStr === null) return;
    const qtd = parseFloat(qtdStr.replace(",", "."));

    if (isNaN(qtd) || qtd < 0 || (tipo !== "AJUSTE" && qtd === 0)) {
      showToast("Quantidade inválida.", "error");
      return;
    }

    const motivo =
      tipo === "AJUSTE" ? "Ajuste de inventário via Workspace" : `Movimentação via Workspace (${tipo})`;

    try {
      await movimentacoesApi.criar({ lote_id: loteId, tipo, quantidade: qtd, motivo });
      showToast(`${tipo} registrada com sucesso!`);
      load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleSortToggle = (field: string) => {
    if (sortField === field) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortField(null);
        setSortDirection("asc");
      }
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSortField(null);
    setSortDirection("asc");
  };

  // Processamento dos lotes (busca por digitação + ordenação)
  const lotesProcessados = useMemo(() => {
    let result = [...lotes];

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((l) => {
        const mat = materiais.find((m) => m.id === l.material_id);
        const local = locais.find((lo) => lo.id === l.local_id);
        const text = `${mat?.nome || ""} ${l.numero_lote || ""} ${local?.nome || ""} ${mat?.classe_risco || ""} ${l.data_validade || ""}`.toLowerCase();
        return text.includes(term);
      });
    }

    if (sortField) {
      result.sort((a, b) => {
        const matA = materiais.find((m) => m.id === a.material_id);
        const matB = materiais.find((m) => m.id === b.material_id);
        const localA = locais.find((lo) => lo.id === a.local_id);
        const localB = locais.find((lo) => lo.id === b.local_id);

        let valA: any = "";
        let valB: any = "";

        if (sortField === "material") {
          valA = matA?.nome || "";
          valB = matB?.nome || "";
        } else if (sortField === "local") {
          valA = localA?.nome || "";
          valB = localB?.nome || "";
        } else if (sortField === "validade") {
          valA = a.data_validade || "";
          valB = b.data_validade || "";
        } else if (sortField === "classe") {
          valA = matA?.classe_risco || "";
          valB = matB?.classe_risco || "";
        } else if (sortField === "estoque") {
          valA = Number(a.quantidade_atual || 0);
          valB = Number(b.quantidade_atual || 0);
        }

        // Valores já numéricos: comparação matemática direta
        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }

        // Strings: localeCompare com numeric:true garante ordem natural
        // (1, 2, 9, 10, 20) em vez de lexicográfica (1, 10, 2, 20, 9)
        const cmp = String(valA).localeCompare(String(valB), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
        return sortDirection === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [lotes, materiais, locais, searchTerm, sortField, sortDirection]);

  const hasActiveFilters = searchTerm !== "" || sortField !== null;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      {/* Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 shrink-0">
        <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
          <span className="text-slate-400 text-xs font-medium uppercase">Lotes Ativos</span>
          <span className="text-2xl font-bold text-white">{lotes.length}</span>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
          <span className="text-slate-400 text-xs font-medium uppercase">Tipos de Materiais</span>
          <span className="text-2xl font-bold text-emerald-400">{materiais.length}</span>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
          <span className="text-slate-400 text-xs font-medium uppercase">Categorias</span>
          <span className="text-2xl font-bold text-cyan-400">{categorias.length}</span>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
          <span className="text-slate-400 text-xs font-medium uppercase">Vencidos / Críticos</span>
          <span className="text-2xl font-bold text-red-400">
            {lotes.filter(l => new Date(l.data_validade) < new Date()).length}
          </span>
        </div>
      </div>

      <div className="flex gap-4 flex-1 overflow-hidden">
        {/* Left Panel - Formulário Fixo */}
        <div className="w-80 glass rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden shrink-0">
          <div className="flex border-b border-slate-700/50">
            <button onClick={() => setActiveSideTab("LOTE")} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeSideTab === "LOTE" ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-white"}`}>+ Novo Lote</button>
            <button onClick={() => setActiveSideTab("MATERIAL")} className={`flex-1 py-3 text-sm font-medium transition-colors ${activeSideTab === "MATERIAL" ? "bg-slate-800 text-cyan-400" : "text-slate-400 hover:text-white"}`}>+ Catálogo</button>
          </div>

          <div className="p-4 overflow-y-auto flex-1">
            {activeSideTab === "LOTE" ? (
              <form onSubmit={handleCreateLote} className="space-y-3">
                <div><label className="block text-xs text-slate-400 mb-1">Material Base</label>
                  <select value={formLote.material_id} onChange={e => setFormLote({ ...formLote, material_id: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-emerald-500/50">
                    <option value="">Selecione...</option>
                    {materiais.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-400 mb-1">Local de Armazenamento</label>
                  <select value={formLote.local_id} onChange={e => setFormLote({ ...formLote, local_id: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-emerald-500/50">
                    <option value="">Selecione...</option>
                    {locais.map(lo => <option key={lo.id} value={lo.id}>{lo.nome} ({lo.tipo})</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-400 mb-1">Lote (Cód/Ref)</label><input value={formLote.numero_lote} onChange={e => setFormLote({ ...formLote, numero_lote: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-emerald-500/50" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Qtd Inicial</label><input type="number" step="0.01" value={formLote.quantidade_inicial} onChange={e => setFormLote({ ...formLote, quantidade_inicial: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-emerald-500/50" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Validade</label><input type="date" value={formLote.data_validade} onChange={e => setFormLote({ ...formLote, data_validade: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-emerald-500/50" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Fabricação</label><input type="date" value={formLote.data_fabricacao} onChange={e => setFormLote({ ...formLote, data_fabricacao: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-emerald-500/50" /></div>
                <button type="submit" className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-lg text-sm font-medium mt-4">Adicionar Lote</button>
              </form>
            ) : (
              <form onSubmit={handleCreateMaterial} className="space-y-3">
                <div><label className="block text-xs text-slate-400 mb-1">Nome do Item</label><input value={formMaterial.nome} onChange={e => setFormMaterial({ ...formMaterial, nome: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Categoria</label>
                  <select value={formMaterial.categoria_id} onChange={e => setFormMaterial({ ...formMaterial, categoria_id: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50">
                    <option value="">Selecione...</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div><label className="block text-xs text-slate-400 mb-1">Fabricante</label><input value={formMaterial.fabricante} onChange={e => setFormMaterial({ ...formMaterial, fabricante: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Código de Catálogo</label><input value={formMaterial.codigo_catalogo} onChange={e => setFormMaterial({ ...formMaterial, codigo_catalogo: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50" /></div>
                <div><label className="block text-xs text-slate-400 mb-1">Classe de Risco</label>
                  <select value={formMaterial.classe_risco} onChange={e => setFormMaterial({ ...formMaterial, classe_risco: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50">
                    <option value="">Não classificado</option>
                    {CLASSES_RISCO.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="block text-xs text-slate-400 mb-1">Unidade</label><input value={formMaterial.unidade_medida} onChange={e => setFormMaterial({ ...formMaterial, unidade_medida: e.target.value })} placeholder="un, ml, g" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50" /></div>
                  <div><label className="block text-xs text-slate-400 mb-1">Estoque mín.</label><input type="number" step="0.01" value={formMaterial.estoque_minimo} onChange={e => setFormMaterial({ ...formMaterial, estoque_minimo: e.target.value })} placeholder="0" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-cyan-500/50" /></div>
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={formMaterial.exige_refrigeracao} onChange={e => setFormMaterial({ ...formMaterial, exige_refrigeracao: e.target.checked })} className="accent-cyan-500" /><label className="text-xs text-slate-300">Refrigeração Obrigatória?</label></div>
                <button type="submit" className="w-full py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-sm font-medium mt-4">Gravar Material Base</button>
              </form>
            )}
          </div>
        </div>

        {/* Center Panel - Tabela Unificada */}
        <div className="flex-1 glass rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-800/30">
            <div>
              <h2 className="font-bold text-lg text-white">Estoque Operacional</h2>
              <p className="text-xs text-slate-400">Lotes, classe de risco e controle de insumos laboratoriais</p>
            </div>
          </div>

          {/* Barra de Filtros e Busca para o Estoque Operacional */}
          <div className="p-4 border-b border-slate-700/40 bg-slate-900/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite para buscar no estoque..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none placeholder-slate-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={sortField || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setSortField(val);
                    setSortDirection("asc");
                  } else {
                    setSortField(null);
                  }
                }}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              >
                <option value="">Ordenar por...</option>
                <option value="material">Material</option>
                <option value="local">Local</option>
                <option value="validade">Validade</option>
                <option value="classe">Classe</option>
                <option value="estoque">Estoque</option>
              </select>

              {sortField && (
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
                  🧹 Limpar Filtros
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {loading ? (
              <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
            ) : lotesProcessados.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                {hasActiveFilters ? "Nenhum lote encontrado para esta busca." : "O estoque está completamente vazio. Cadastre um Material e dê entrada em um Lote."}
                {hasActiveFilters && (
                  <div className="mt-3">
                    <button onClick={handleResetFilters} className="px-4 py-1.5 bg-slate-800 text-emerald-400 text-xs font-semibold rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors">
                      Limpar busca
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Custom Data Grid Header */}
                <div className="grid grid-cols-[1fr_110px_100px_90px_80px_200px] gap-3 px-4 py-2 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700/50">
                  <div onClick={() => handleSortToggle("material")} className="cursor-pointer hover:text-white flex items-center gap-1 select-none">
                    Material / Lote <span>{sortField === "material" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}</span>
                  </div>
                  <div onClick={() => handleSortToggle("local")} className="cursor-pointer hover:text-white flex items-center gap-1 select-none">
                    Local <span>{sortField === "local" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}</span>
                  </div>
                  <div onClick={() => handleSortToggle("validade")} className="cursor-pointer hover:text-white flex items-center gap-1 select-none">
                    Validade <span>{sortField === "validade" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}</span>
                  </div>
                  <div onClick={() => handleSortToggle("classe")} className="cursor-pointer hover:text-white flex items-center gap-1 select-none justify-center">
                    Classe <span>{sortField === "classe" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}</span>
                  </div>
                  <div onClick={() => handleSortToggle("estoque")} className="cursor-pointer hover:text-white flex items-center gap-1 select-none justify-end">
                    Estoque <span>{sortField === "estoque" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}</span>
                  </div>
                  <div className="text-center">Ações Rápidas</div>
                </div>

                {lotesProcessados.map(l => {
                  const mat = materiais.find(m => m.id === l.material_id);
                  const local = locais.find(lo => lo.id === l.local_id);
                  const isVencido = new Date(l.data_validade) < new Date();
                  const limite = mat?.estoque_minimo != null ? Number(mat.estoque_minimo) : 0;
                  const isCritico = limite > 0 && Number(l.quantidade_atual) <= limite;

                  return (
                    <div key={l.id} className="grid grid-cols-[1fr_110px_100px_90px_80px_200px] gap-3 items-center px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-800 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{mat?.nome || "Desconhecido"}</p>
                        <p className="text-xs text-slate-400 truncate">Lote: {l.numero_lote}{mat?.unidade_medida ? ` · ${mat.unidade_medida}` : ""}</p>
                      </div>
                      <div className="min-w-0">
                        <span className="block text-xs text-slate-300 truncate" title={local?.tipo || ""}>{local?.nome || <span className="text-slate-600">—</span>}</span>
                      </div>
                      <div>
                        <span className={`text-xs px-2 py-1 rounded-md font-medium ${isVencido ? "bg-red-500/20 text-red-400" : "bg-emerald-500/10 text-emerald-400"}`}>
                          {new Date(l.data_validade).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <div className="text-center">
                        {mat?.classe_risco ? (
                          <span className="text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 font-medium" title="Classe de risco">{mat.classe_risco}</span>
                        ) : <span className="text-slate-600">-</span>}
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-bold ${isCritico ? "text-red-400" : "text-white"}`} title={isCritico ? `Abaixo do estoque mínimo (${limite})` : ""}>
                          {l.quantidade_atual}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleMovimentacao(l.id, "ENTRADA", l.data_validade)} className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 hover:scale-105 transition-all" title="Entrada (Soma)">+</button>
                        <button onClick={() => handleMovimentacao(l.id, "USO", l.data_validade)} className="w-7 h-7 flex items-center justify-center bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 hover:scale-105 transition-all" title="Uso (Baixa)">−</button>
                        <button onClick={() => handleMovimentacao(l.id, "DESCARTE", l.data_validade)} className="w-7 h-7 flex items-center justify-center bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 hover:scale-105 transition-all" title="Descarte (vencido/avaria)">🗑</button>
                        <button onClick={() => handleMovimentacao(l.id, "AJUSTE", l.data_validade)} className="w-7 h-7 flex items-center justify-center bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 hover:scale-105 transition-all" title="Ajuste de inventário">✎</button>
                        <button onClick={() => handleTransferencia(l)} className="w-7 h-7 flex items-center justify-center bg-violet-500/10 text-violet-400 rounded-lg hover:bg-violet-500/20 hover:scale-105 transition-all" title="Transferir de local">⇄</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
