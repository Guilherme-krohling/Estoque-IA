"use client";

import { useEffect, useState, useMemo } from "react";
import {
  relatoriosApi,
  pedidosReposicaoApi,
  materiaisApi,
  fornecedoresApi,
} from "@/lib/api";
import { showToast } from "@/components/Toast";

function formatarDataBR(iso?: string | null) {
  if (!iso) return "-";
  const partes = iso.slice(0, 10).split("-");
  if (partes.length !== 3) return iso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export default function ReposicaoPage() {
  const [abaAtiva, setAbaAtiva] = useState<"MATERIAIS" | "PEDIDOS">("MATERIAIS");

  // Estado da Aba 1: Materiais abaixo do mínimo
  const [resumo, setResumo] = useState({
    total_monitorados: 0,
    total_para_repor: 0,
    total_faltantes: 0,
    sugestao_total_qtd: 0,
  });
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estado da Aba 2: Pedidos de Reposição, NFs e Entregas Parciais
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(true);
  const [filtroStatusPedido, setFiltroStatusPedido] = useState<string>("");
  const [buscaPedido, setBuscaPedido] = useState<string>("");

  // Catálogos auxiliares para criação de pedido
  const [catalogoMateriais, setCatalogoMateriais] = useState<any[]>([]);
  const [catalogoFornecedores, setCatalogoFornecedores] = useState<any[]>([]);

  // Modal: Novo Pedido de Reposição
  const [modalNovoPedido, setModalNovoPedido] = useState(false);
  const [salvandoPedido, setSalvandoPedido] = useState(false);
  const [formPedido, setFormPedido] = useState({
    material_id: "",
    empresa_fornecedora: "",
    data_pedido: new Date().toISOString().split("T")[0],
    quantidade_solicitada: "",
    observacoes: "",
  });

  // Modal: Registrar Entrega / Nota Fiscal (Total ou Parcial)
  const [pedidoSelecionadoEntrega, setPedidoSelecionadoEntrega] = useState<any | null>(null);
  const [salvandoEntrega, setSalvandoEntrega] = useState(false);
  const [formEntrega, setFormEntrega] = useState({
    numero_nf: "",
    data_recebimento: new Date().toISOString().split("T")[0],
    quantidade_entregue: "",
    abastecer_estoque: true,
    numero_lote_recebido: "",
    data_validade_lote: "",
    observacoes: "",
  });

  // Filtros e Ordenação da Aba 1
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const carregarDados = async () => {
    setLoading(true);
    setLoadingPedidos(true);
    try {
      const [repData, listaPedidos, mats, forns] = await Promise.all([
        relatoriosApi.reposicao(),
        pedidosReposicaoApi.listar(),
        materiaisApi.listar(),
        fornecedoresApi.listar().catch(() => []),
      ]);
      setResumo(repData.resumo || {});
      setItens(repData.itens || []);
      setPedidos(listaPedidos || []);
      setCatalogoMateriais(mats || []);
      setCatalogoFornecedores(forns || []);
    } catch (err) {
      console.error(err);
      showToast("Erro ao carregar dados de reposição", "error");
    } finally {
      setLoading(false);
      setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Abre modal de Novo Pedido já preenchido a partir de um material da tabela
  const handleAbrirPedidoDeItem = (item?: any) => {
    if (item) {
      setFormPedido({
        material_id: String(item.material_id),
        empresa_fornecedora:
          item.fornecedor_nome && item.fornecedor_nome !== "-"
            ? item.fornecedor_nome
            : item.fabricante && item.fabricante !== "-"
            ? item.fabricante
            : "",
        data_pedido: new Date().toISOString().split("T")[0],
        quantidade_solicitada: String(item.sugestao_comprar > 0 ? item.sugestao_comprar : 10),
        observacoes: "",
      });
    } else {
      setFormPedido({
        material_id: catalogoMateriais[0]?.id ? String(catalogoMateriais[0].id) : "",
        empresa_fornecedora: "",
        data_pedido: new Date().toISOString().split("T")[0],
        quantidade_solicitada: "",
        observacoes: "",
      });
    }
    setModalNovoPedido(true);
  };

  const handleSalvarNovoPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtd = parseFloat(String(formPedido.quantidade_solicitada).replace(",", "."));
    if (!formPedido.material_id || isNaN(qtd) || qtd <= 0) {
      showToast("Selecione o material e informe uma quantidade válida.", "error");
      return;
    }

    setSalvandoPedido(true);
    try {
      await pedidosReposicaoApi.criar({
        material_id: Number(formPedido.material_id),
        empresa_fornecedora: formPedido.empresa_fornecedora.trim() || "Fornecedor Padrão",
        data_pedido: formPedido.data_pedido,
        quantidade_solicitada: qtd,
        observacoes: formPedido.observacoes.trim() || undefined,
      });
      showToast("Pedido de reposição registrado com sucesso!", "success");
      setModalNovoPedido(false);
      setAbaAtiva("PEDIDOS");
      await carregarDados();
    } catch (err: any) {
      showToast(err.message || "Erro ao registrar pedido.", "error");
    } finally {
      setSalvandoPedido(false);
    }
  };

  // Abre modal para registrar Entrega (NF) total ou parcial de um pedido
  const handleAbrirModalEntrega = (pedido: any) => {
    const validadePadrao = new Date();
    validadePadrao.setFullYear(validadePadrao.getFullYear() + 1);

    setPedidoSelecionadoEntrega(pedido);
    setFormEntrega({
      numero_nf: "",
      data_recebimento: new Date().toISOString().split("T")[0],
      quantidade_entregue: String(pedido.quantidade_pendente > 0 ? pedido.quantidade_pendente : ""),
      abastecer_estoque: true,
      numero_lote_recebido: "",
      data_validade_lote: validadePadrao.toISOString().split("T")[0],
      observacoes: "",
    });
  };

  const handleConfirmarEntrega = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pedidoSelecionadoEntrega) return;

    const qtd = parseFloat(String(formEntrega.quantidade_entregue).replace(",", "."));
    if (!formEntrega.numero_nf.trim()) {
      showToast("Informe o número da Nota Fiscal (NF).", "error");
      return;
    }
    if (isNaN(qtd) || qtd <= 0) {
      showToast("Informe uma quantidade entregue maior que zero.", "error");
      return;
    }

    setSalvandoEntrega(true);
    try {
      await pedidosReposicaoApi.registrarEntrega(pedidoSelecionadoEntrega.id, {
        numero_nf: formEntrega.numero_nf.trim(),
        data_recebimento: formEntrega.data_recebimento,
        quantidade_entregue: qtd,
        abastecer_estoque: formEntrega.abastecer_estoque,
        numero_lote_recebido: formEntrega.numero_lote_recebido.trim() || undefined,
        data_validade_lote: formEntrega.data_validade_lote || undefined,
        observacoes: formEntrega.observacoes.trim() || undefined,
      });
      showToast("Recebimento e Nota Fiscal registrados com sucesso!", "success");
      setPedidoSelecionadoEntrega(null);
      await carregarDados();
    } catch (err: any) {
      showToast(err.message || "Erro ao registrar entrega.", "error");
    } finally {
      setSalvandoEntrega(false);
    }
  };

  const handleExportCSV = () => {
    if (itensProcessados.length === 0) {
      showToast("Nenhum item para exportar.", "info");
      return;
    }
    const headers = ["Material", "Codigo", "Fabricante", "Fornecedor", "Estoque_Minimo", "Saldo_Atual", "Sugestao_Comprar", "Status"];
    const rows = itensProcessados.map((item) => [
      `"${item.nome}"`,
      `"${item.codigo_catalogo || "-"}"`,
      `"${item.fabricante || "-"}"`,
      `"${item.fornecedor_nome || "-"}"`,
      item.estoque_minimo,
      item.saldo_atual,
      item.sugestao_comprar,
      `"${item.status}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `pedido_reposicao_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Pedido exportado com sucesso em CSV!");
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
    setSortColumn(null);
    setSortDirection("asc");
  };

  // Filtragem ao digitar e Ordenação (Aba 1)
  const itensProcessados = useMemo(() => {
    let result = [...itens];

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) => {
        const text = `${item.nome || ""} ${item.codigo_catalogo || ""} ${item.fabricante || ""} ${item.fornecedor_nome || ""} ${item.status || ""}`.toLowerCase();
        return text.includes(term);
      });
    }

    if (sortColumn) {
      result.sort((a, b) => {
        const valA = a[sortColumn];
        const valB = b[sortColumn];

        if (valA == null) return 1;
        if (valB == null) return -1;

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
  }, [itens, searchTerm, sortColumn, sortDirection]);

  // Filtragem de Pedidos (Aba 2)
  const pedidosFiltrados = useMemo(() => {
    let lista = [...pedidos];
    if (filtroStatusPedido) {
      lista = lista.filter((p) => p.status === filtroStatusPedido);
    }
    if (buscaPedido.trim() !== "") {
      const t = buscaPedido.toLowerCase();
      lista = lista.filter((p) => {
        const nfs = (p.entregas || []).map((e: any) => e.numero_nf).join(" ");
        const texto = `${p.material_nome || ""} ${p.empresa_fornecedora || ""} ${p.status || ""} ${nfs}`.toLowerCase();
        return texto.includes(t);
      });
    }
    return lista;
  }, [pedidos, filtroStatusPedido, buscaPedido]);

  const hasActiveFilters = searchTerm !== "" || sortColumn !== null;
  const totalBaixos = itensProcessados.filter((i) => i.status === "Baixo").length;
  const totalFaltantes = itensProcessados.filter((i) => i.status === "Faltante").length;

  const pedidosEmAberto = pedidos.filter((p) => p.status === "PENDENTE" || p.status === "PARCIAL").length;
  const pedidosParciais = pedidos.filter((p) => p.status === "PARCIAL").length;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-block px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-full border border-amber-500/20 mb-2">
            Controle de reposição & entregas
          </div>
          <h1 className="text-2xl font-bold text-white">Reposição de Estoque & Notas Fiscais</h1>
          <p className="text-slate-400 text-sm mt-1">
            Gerencie materiais abaixo do mínimo, pedidos aos fornecedores, Notas Fiscais e entregas parciais.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleAbrirPedidoDeItem()}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            <span>+</span> Registrar Pedido ao Fornecedor
          </button>
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl border border-slate-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <span>📥</span> Exportar Pedido (CSV)
          </button>
        </div>
      </div>

      {/* Summary Cards Row (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Para repor</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : resumo.total_para_repor}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Abaixo do estoque mínimo</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg">
            ⚠️
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Faltantes</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : resumo.total_faltantes}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Saldo zerado no estoque</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg">
            📦
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Pedidos em Aberto</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{loadingPedidos ? "…" : pedidosEmAberto}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Aguardando chegada total</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 text-lg">
            🚚
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Entregas Parciais</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">{loadingPedidos ? "…" : pedidosParciais}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Com saldo restante a chegar</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
            🧾
          </div>
        </div>
      </div>

      {/* Seletor de Abas */}
      <div className="flex flex-wrap gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 w-fit">
        <button
          onClick={() => setAbaAtiva("MATERIAIS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            abaAtiva === "MATERIAIS"
              ? "bg-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Materiais Abaixo do Mínimo ({itens.length})
        </button>
        <button
          onClick={() => setAbaAtiva("PEDIDOS")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            abaAtiva === "PEDIDOS"
              ? "bg-emerald-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>Pedidos, Notas Fiscais & Entregas Parciais</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              abaAtiva === "PEDIDOS"
                ? "bg-slate-950/20 text-slate-950"
                : "bg-cyan-500/20 text-cyan-300"
            }`}
          >
            {pedidos.length}
          </span>
        </button>
      </div>

      {/* =====================================================================
          ABA 1 — TABELA DE MATERIAIS ABAIXO DO MÍNIMO
      ===================================================================== */}
      {abaAtiva === "MATERIAIS" && (
        <div className="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Materiais para reposição</h2>
              <p className="text-xs text-slate-400">
                Lista agrupada por material, considerando o saldo total dos lotes. Clique em &quot;Pedir Reposição&quot; para registrar um pedido ao fornecedor.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
              {totalBaixos} baixo(s) · {totalFaltantes} faltante(s)
            </span>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Digite para buscar na lista de reposição..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none placeholder-slate-500"
              />
              <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                <option value="nome">Material</option>
                <option value="codigo_catalogo">Ref. (Código)</option>
                <option value="fabricante">Fabricante</option>
                <option value="fornecedor_nome">Fornecedor</option>
                <option value="estoque_minimo">Estoque min.</option>
                <option value="saldo_atual">Saldo atual</option>
                <option value="sugestao_comprar">Sugestão</option>
                <option value="status">Status</option>
              </select>

              {sortColumn && (
                <button
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-lg transition-colors"
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

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : itensProcessados.length === 0 ? (
            <div className="border border-dashed border-slate-700/60 rounded-2xl p-10 text-center flex flex-col items-center justify-center my-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-3 text-xl">
                {hasActiveFilters ? "🔍" : "✨"}
              </div>
              <p className="text-sm font-semibold text-slate-300">
                {hasActiveFilters ? "Nenhum material encontrado para estes filtros." : "Estoque 100% abastecido"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th onClick={() => handleSortToggle("nome")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                      Material {sortColumn === "nome" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th onClick={() => handleSortToggle("codigo_catalogo")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                      Ref. {sortColumn === "codigo_catalogo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </th>
                    <th onClick={() => handleSortToggle("fornecedor_nome")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                      Fornecedor / Empresa
                    </th>
                    <th onClick={() => handleSortToggle("estoque_minimo")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                      Estoque min.
                    </th>
                    <th onClick={() => handleSortToggle("saldo_atual")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                      Saldo atual
                    </th>
                    <th onClick={() => handleSortToggle("sugestao_comprar")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                      Sugestão
                    </th>
                    <th onClick={() => handleSortToggle("status")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                      Status
                    </th>
                    <th className="px-4 py-3.5 font-semibold text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {itensProcessados.map((item) => {
                    const isFaltante = item.status === "Faltante";
                    return (
                      <tr key={item.material_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5 font-semibold text-white">{item.nome}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{item.codigo_catalogo}</td>
                        <td className="px-4 py-3.5 text-xs text-slate-300">
                          {item.fornecedor_nome !== "-" ? item.fornecedor_nome : item.fabricante}
                        </td>
                        <td className="px-4 py-3.5 text-center font-medium text-slate-300">{item.estoque_minimo}</td>
                        <td className={`px-4 py-3.5 text-center font-bold ${isFaltante ? "text-red-400" : "text-amber-400"}`}>
                          {item.saldo_atual} {item.unidade_medida}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="inline-block px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-semibold rounded-lg">
                            Comprar {item.sugestao_comprar}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 text-xs font-bold rounded-lg ${
                              isFaltante
                                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => handleAbrirPedidoDeItem(item)}
                            className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
                          >
                            + Pedir Reposição
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA 2 — PEDIDOS DE REPOSIÇÃO, NOTAS FISCAIS E ENTREGAS PARCIAIS
      ===================================================================== */}
      {abaAtiva === "PEDIDOS" && (
        <div className="glass p-6 rounded-2xl border border-slate-700/50 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-white">
                Controle de Pedidos, Notas Fiscais (NF) e Entregas Parciais
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhe o que foi pedido a cada fornecedor, as entregas já recebidas por Nota Fiscal e o saldo restante a chegar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["", "PENDENTE", "PARCIAL", "CONCLUIDO"] as const).map((st) => (
                <button
                  key={st || "TODOS"}
                  onClick={() => setFiltroStatusPedido(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    filtroStatusPedido === st
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                  }`}
                >
                  {st === ""
                    ? "Todos"
                    : st === "PENDENTE"
                    ? "Pendentes"
                    : st === "PARCIAL"
                    ? "Entrega Parcial"
                    : "Concluídos"}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={buscaPedido}
              onChange={(e) => setBuscaPedido(e.target.value)}
              placeholder="Buscar por material, empresa fornecedora ou número da Nota Fiscal (NF)..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500 placeholder-slate-500"
            />
            <span className="absolute left-3 top-3 text-slate-500 text-xs">🔍</span>
          </div>

          {loadingPedidos ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="border border-dashed border-slate-700/60 rounded-2xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-300">Nenhum pedido de reposição encontrado.</p>
              <p className="text-xs text-slate-500">
                Clique em &quot;+ Registrar Pedido ao Fornecedor&quot; no topo para cadastrar um pedido.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pedidosFiltrados.map((ped) => {
                const isConcluido = ped.status === "CONCLUIDO";
                const isParcial = ped.status === "PARCIAL";
                const isPendente = ped.status === "PENDENTE";

                const statusBadge = isConcluido
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : isParcial
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : isPendente
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700";

                const statusLabel = isConcluido
                  ? "ENTREGUE COMPLETO"
                  : isParcial
                  ? "ENTREGA PARCIAL"
                  : isPendente
                  ? "AGUARDANDO ENTREGA"
                  : ped.status;

                return (
                  <div
                    key={ped.id}
                    className="p-5 bg-slate-900/75 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-4"
                  >
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            Pedido #{ped.id}
                          </span>
                          <h3 className="text-base font-bold text-white">{ped.material_nome}</h3>
                          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${statusBadge}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300">
                          <strong className="text-slate-400">Empresa / Fornecedor:</strong>{" "}
                          <span className="text-emerald-300 font-semibold">{ped.empresa_fornecedora}</span> ·{" "}
                          <strong className="text-slate-400">Pedido no dia:</strong>{" "}
                          <span className="text-white font-semibold">{formatarDataBR(ped.data_pedido)}</span>
                        </p>
                        {ped.observacoes && (
                          <p className="text-xs text-slate-400 italic">{ped.observacoes}</p>
                        )}
                      </div>

                      {/* Quadro de Quantidades: Solicitado vs Já Chegou vs Falta Chegar */}
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid grid-cols-3 gap-2 bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-center min-w-[270px]">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Qtd. Pedida</span>
                            <strong className="text-sm text-white">
                              {ped.quantidade_solicitada} {ped.unidade_medida}
                            </strong>
                          </div>
                          <div className="border-x border-slate-800 px-2">
                            <span className="text-[10px] text-slate-400 uppercase block">Já Chegou</span>
                            <strong className="text-sm text-emerald-400">
                              {ped.quantidade_recebida} {ped.unidade_medida}
                            </strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block">Falta Chegar</span>
                            <strong
                              className={`text-sm ${
                                ped.quantidade_pendente > 0 ? "text-amber-400" : "text-slate-500"
                              }`}
                            >
                              {ped.quantidade_pendente} {ped.unidade_medida}
                            </strong>
                          </div>
                        </div>

                        {(isPendente || isParcial) && (
                          <button
                            onClick={() => handleAbrirModalEntrega(ped)}
                            className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md transition-all whitespace-nowrap"
                          >
                            + Registrar Entrega / NF
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de progresso do pedido */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Progresso de recebimento do pedido</span>
                        <span className="font-bold text-slate-200">{ped.percentual_entregue}% recebido</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isConcluido ? "bg-emerald-500" : "bg-amber-400"
                          }`}
                          style={{ width: `${ped.percentual_entregue}%` }}
                        />
                      </div>
                    </div>

                    {/* Lista de Entregas (Notas Fiscais) deste Pedido */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Histórico de Recebimentos e Notas Fiscais ({ped.entregas?.length || 0})
                      </p>

                      {ped.entregas && ped.entregas.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {ped.entregas.map((ent: any, idx: number) => (
                            <div
                              key={ent.id}
                              className="p-3 bg-slate-950/70 rounded-xl border border-slate-800/90 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded font-bold text-[11px]">
                                    {idx + 1}ª Entrega · NF {ent.numero_nf}
                                  </span>
                                  <span className="text-slate-300 font-semibold">
                                    Dia {formatarDataBR(ent.data_recebimento)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  Lote: <span className="font-mono text-slate-300">{ent.numero_lote_recebido}</span>
                                  {ent.observacoes ? ` · ${ent.observacoes}` : ""}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-sm font-extrabold text-emerald-400">
                                  +{ent.quantidade_entregue} {ped.unidade_medida}
                                </span>
                                <span className="block text-[10px] text-slate-500">Recebido</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">
                          Nenhuma entrega recebida até o momento. Faltam chegar {ped.quantidade_pendente} {ped.unidade_medida}.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL 1 — REGISTRAR NOVO PEDIDO DE REPOSIÇÃO AO FORNECEDOR
      ===================================================================== */}
      {modalNovoPedido && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSalvarNovoPedido}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scale-in"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Registrar Pedido de Reposição</h3>
                <p className="text-xs text-slate-400">
                  Cadastre o pedido feito ao fornecedor para acompanhar entregas totais ou parciais por NF.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalNovoPedido(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Material / Kit *</label>
                <select
                  required
                  value={formPedido.material_id}
                  onChange={(e) => {
                    const matId = e.target.value;
                    const matObj = catalogoMateriais.find((m) => String(m.id) === matId);
                    const fornObj = catalogoFornecedores.find((f) => f.id === matObj?.fornecedor_id);
                    setFormPedido((prev) => ({
                      ...prev,
                      material_id: matId,
                      empresa_fornecedora:
                        fornObj?.nome || matObj?.fabricante || prev.empresa_fornecedora,
                    }));
                  }}
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Selecione o material...</option>
                  {catalogoMateriais.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.unidade_medida || "un"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Empresa Fornecedora *
                </label>
                <input
                  type="text"
                  required
                  value={formPedido.empresa_fornecedora}
                  onChange={(e) => setFormPedido({ ...formPedido, empresa_fornecedora: e.target.value })}
                  placeholder="Ex: Bioclin, Labtest, Qiagen..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Data do Pedido *</label>
                  <input
                    type="date"
                    required
                    value={formPedido.data_pedido}
                    onChange={(e) => setFormPedido({ ...formPedido, data_pedido: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Quantidade Solicitada *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formPedido.quantidade_solicitada}
                    onChange={(e) => setFormPedido({ ...formPedido, quantidade_solicitada: e.target.value })}
                    placeholder="Ex: 50"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observações</label>
                <input
                  type="text"
                  value={formPedido.observacoes}
                  onChange={(e) => setFormPedido({ ...formPedido, observacoes: e.target.value })}
                  placeholder="Opcional: número da cotação, prazo acordado..."
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setModalNovoPedido(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoPedido}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl"
              >
                {salvandoPedido ? "Salvando..." : "Salvar Pedido"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 2 — REGISTRAR ENTREGA (TOTAL OU PARCIAL) COM NOTA FISCAL (NF)
      ===================================================================== */}
      {pedidoSelecionadoEntrega && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmarEntrega}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-scale-in"
          >
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">
                  Registrar Recebimento / Nota Fiscal (NF)
                </h3>
                <p className="text-xs text-slate-400">
                  {pedidoSelecionadoEntrega.material_nome} · {pedidoSelecionadoEntrega.empresa_fornecedora}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPedidoSelecionadoEntrega(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Resumo do saldo do pedido */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs">
              <div>
                <span className="text-slate-500 block">Pedido Total</span>
                <strong className="text-white">
                  {pedidoSelecionadoEntrega.quantidade_solicitada} {pedidoSelecionadoEntrega.unidade_medida}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Já Recebido</span>
                <strong className="text-emerald-400">
                  {pedidoSelecionadoEntrega.quantidade_recebida} {pedidoSelecionadoEntrega.unidade_medida}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Falta Chegar</span>
                <strong className="text-amber-400">
                  {pedidoSelecionadoEntrega.quantidade_pendente} {pedidoSelecionadoEntrega.unidade_medida}
                </strong>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Número da Nota Fiscal (NF) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formEntrega.numero_nf}
                    onChange={(e) => setFormEntrega({ ...formEntrega, numero_nf: e.target.value })}
                    placeholder="Ex: 00000000"
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Data de Chegada *
                  </label>
                  <input
                    type="date"
                    required
                    value={formEntrega.data_recebimento}
                    onChange={(e) => setFormEntrega({ ...formEntrega, data_recebimento: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Quantidade que chegou nesta entrega *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formEntrega.quantidade_entregue}
                  onChange={(e) => setFormEntrega({ ...formEntrega, quantidade_entregue: e.target.value })}
                  placeholder="Se for entrega parcial, digite apenas quanto chegou hoje"
                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                />
                {Number(formEntrega.quantidade_entregue) > 0 &&
                  Number(formEntrega.quantidade_entregue) < pedidoSelecionadoEntrega.quantidade_pendente && (
                    <p className="text-[11px] text-amber-400 mt-1">
                      ⚠️ Entrega parcial: restarão{" "}
                      <strong>
                        {(
                          pedidoSelecionadoEntrega.quantidade_pendente -
                          Number(formEntrega.quantidade_entregue)
                        ).toFixed(1)}{" "}
                        {pedidoSelecionadoEntrega.unidade_medida}
                      </strong>{" "}
                      pendentes para próxima entrega.
                    </p>
                  )}
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={formEntrega.abastecer_estoque}
                  onChange={(e) => setFormEntrega({ ...formEntrega, abastecer_estoque: e.target.checked })}
                  className="rounded border-slate-600 text-emerald-500"
                />
                <span>Somar automaticamente esta quantidade ao saldo de lotes do estoque</span>
              </label>

              {formEntrega.abastecer_estoque && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">
                      Nº do Lote Recebido (opcional)
                    </label>
                    <input
                      type="text"
                      value={formEntrega.numero_lote_recebido}
                      onChange={(e) => setFormEntrega({ ...formEntrega, numero_lote_recebido: e.target.value })}
                      placeholder="Auto se vazio"
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-400 mb-1">
                      Validade do Lote
                    </label>
                    <input
                      type="date"
                      value={formEntrega.data_validade_lote}
                      onChange={(e) => setFormEntrega({ ...formEntrega, data_validade_lote: e.target.value })}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Observações da Entrega</label>
                <input
                  type="text"
                  value={formEntrega.observacoes}
                  onChange={(e) => setFormEntrega({ ...formEntrega, observacoes: e.target.value })}
                  placeholder="Ex: Entregue parte hoje, restante previsto para próxima semana..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setPedidoSelecionadoEntrega(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoEntrega}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-xl"
              >
                {salvandoEntrega ? "Registrando..." : "Confirmar Recebimento (NF)"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
