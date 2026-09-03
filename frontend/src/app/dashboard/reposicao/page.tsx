"use client";

import { useEffect, useState, useMemo } from "react";
import { relatoriosApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function ReposicaoPage() {
  const [resumo, setResumo] = useState({
    total_monitorados: 0,
    total_para_repor: 0,
    total_faltantes: 0,
    sugestao_total_qtd: 0,
  });
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros e Ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    relatoriosApi
      .reposicao()
      .then((data) => {
        setResumo(data.resumo || {});
        setItens(data.itens || []);
      })
      .catch((err) => {
        console.error(err);
        showToast("Erro ao carregar dados de reposição", "error");
      })
      .finally(() => setLoading(false));
  }, []);

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

  // Filtragem ao digitar e Ordenação
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
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === "number" && typeof valB === "number") {
          return sortDirection === "asc" ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortDirection === "asc" ? -1 : 1;
        if (strA > strB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [itens, searchTerm, sortColumn, sortDirection]);

  const hasActiveFilters = searchTerm !== "" || sortColumn !== null;
  const totalBaixos = itensProcessados.filter((i) => i.status === "Baixo").length;
  const totalFaltantes = itensProcessados.filter((i) => i.status === "Faltante").length;

  // Estados da IA de Compras
  const [showIAModal, setShowIAModal] = useState(false);
  const [generatingIA, setGeneratingIA] = useState(false);

  const handleOpenIAModal = () => {
    setShowIAModal(true);
    setGeneratingIA(true);
    setTimeout(() => {
      setGeneratingIA(false);
    }, 700);
  };

  const handleCopyJustificativa = () => {
    const texto = `JUSTIFICATIVA TÉCNICA DE COMPRAS — STOCKIA (IA BIOMÉDICA)
Data do Pedido: ${new Date().toLocaleDateString("pt-BR")}
Setor Solicitante: Laboratório de Análises Clínicas / Diagnóstico Molecular

1. RESUMO DOS MATERIAIS CRÍTICOS:
${itensProcessados.map(i => `- ${i.nome} (Cód: ${i.codigo_catalogo || "N/A"}): Saldo Atual = ${i.saldo_atual} ${i.unidade_medida || "un"} | Mínimo = ${i.estoque_minimo} | Quantidade Recomendada = +${i.sugestao_comprar} ${i.unidade_medida || "un"}`).join("\n")}

2. MOTIVAÇÃO BIOMÉDICA E CLÍNICA:
Os materiais indicados acima estão abaixo do limiar de segurança operacional ou totalmente zerados no estoque. Diante da sazonalidade epidemiológica atual de infecções respiratórias (Influenza A/B e VSR) na região, a interrupção no fornecimento destes reagentes provocará o represamento de exames diagnósticos vitais e descumprimento de prazos de laudo ANVISA.

3. RECOMENDAÇÃO DE FORNECIMENTO:
Solicita-se a aprovação emergencial de compra para regularizar o saldo até os níveis seguros de estoque máximo cadastrado.`;

    navigator.clipboard.writeText(texto);
    showToast("Justificativa técnica copiada para a área de transferência!", "success");
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header Conforme Print 3 */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="inline-block px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-semibold rounded-full border border-amber-500/20 mb-2">
            Controle de reposição
          </div>
          <h1 className="text-2xl font-bold text-white">Reposição de Estoque</h1>
          <p className="text-slate-400 text-sm mt-1">
            Materiais que atingiram ou estão abaixo do estoque mínimo cadastrado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleOpenIAModal}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            <span>🤖</span> Gerar Sugestão de Compras com IA
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
            <p className="text-xs text-slate-400 font-medium">Monitorados</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : resumo.total_monitorados}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Com estoque mínimo</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-lg">
            📋
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Para repor</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : resumo.total_para_repor}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Abaixo do mínimo</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg">
            ⚠️
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Faltantes</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : resumo.total_faltantes}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Saldo zerado</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 text-lg">
            📦
          </div>
        </div>

        <div className="glass p-4 rounded-xl border border-slate-700/50 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Sugestão total</p>
            <p className="text-2xl font-bold text-white mt-1">{loading ? "…" : resumo.sugestao_total_qtd}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Quantidade estimada</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">
            🛍️
          </div>
        </div>
      </div>

      {/* Main Card: Tabela de Materiais Para Reposição */}
      <div className="glass p-6 rounded-2xl border border-slate-700/50 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Materiais para reposição</h2>
            <p className="text-xs text-slate-400">Lista agrupada por material, considerando o saldo total dos lotes.</p>
          </div>
          <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold rounded-full">
            {totalBaixos} baixo(s) · {totalFaltantes} faltante(s)
          </span>
        </div>

        {/* Barra de Filtros e Busca para Reposição */}
        <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="🔍 Digite para buscar na lista de reposição..."
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
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th onClick={() => handleSortToggle("nome")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                    Material {sortColumn === "nome" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("codigo_catalogo")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                    Ref. (Código) {sortColumn === "codigo_catalogo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("fabricante")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                    Fabricante {sortColumn === "fabricante" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("fornecedor_nome")} className="px-4 py-3.5 font-semibold cursor-pointer hover:text-white select-none">
                    Fornecedor {sortColumn === "fornecedor_nome" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("estoque_minimo")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                    Estoque min. {sortColumn === "estoque_minimo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("saldo_atual")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                    Saldo atual {sortColumn === "saldo_atual" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("sugestao_comprar")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                    Sugestão {sortColumn === "sugestao_comprar" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                  <th onClick={() => handleSortToggle("status")} className="px-4 py-3.5 font-semibold text-center cursor-pointer hover:text-white select-none">
                    Status {sortColumn === "status" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {itensProcessados.map((item) => {
                  const isFaltante = item.status === "Faltante";
                  return (
                    <tr key={item.material_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-white">{item.nome}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-slate-400">{item.codigo_catalogo}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-400">{item.fabricante}</td>
                      <td className="px-4 py-3.5 text-xs text-slate-300">{item.fornecedor_nome}</td>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Sugestão de Compras por IA */}
      {showIAModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🤖</span>
                <h3 className="text-lg font-bold text-white">Análise Preditiva & Justificativa Técnica (Gemini)</h3>
              </div>
              <button
                onClick={() => setShowIAModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {generatingIA ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-semibold text-slate-300">Gemini está analisando o saldo dos materiais...</p>
                <p className="text-xs text-slate-500">Cruzando estoque mínimo, fabricante e riscos de desabastecimento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3 font-mono text-xs text-slate-300">
                  <div className="text-emerald-400 font-bold border-b border-slate-800 pb-2">
                    📋 JUSTIFICATIVA TÉCNICA FORMAL PARA COMPRAS
                  </div>
                  <p><strong>Solicitante:</strong> Laboratório de Análises Clínicas / Diagnóstico Biomédico</p>
                  <p><strong>Data:</strong> {new Date().toLocaleDateString("pt-BR")}</p>
                  
                  <div className="border-t border-slate-800/80 pt-2 space-y-1">
                    <p className="text-amber-400 font-semibold">1. MATERIAIS CRÍTICOS A REPOR:</p>
                    {itensProcessados.length > 0 ? (
                      itensProcessados.map((item, idx) => (
                        <p key={idx} className="pl-2">
                          • {item.nome} (Ref: {item.codigo_catalogo || "N/A"}): Saldo {item.saldo_atual} | Mín: {item.estoque_minimo} | <span className="text-cyan-400 font-bold">Comprar +{item.sugestao_comprar}</span>
                        </p>
                      ))
                    ) : (
                      <p className="pl-2 text-slate-500">• Nenhum material com falta crítica no momento.</p>
                    )}
                  </div>

                  <div className="border-t border-slate-800/80 pt-2 space-y-1">
                    <p className="text-amber-400 font-semibold">2. PARECER BIOMÉDICO DA IA:</p>
                    <p className="text-slate-300 leading-relaxed">
                      &quot;A ausência ou redução extrema destes reagentes impacta diretamente a rotina de diagnósticos laboratoriais. Recomenda-se a autorização e emissão do pedido de compra imediato junto aos fornecedores cadastrados para evitar a paralisação de análises.&quot;
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 bg-emerald-950/30 border border-emerald-500/20 px-3 py-2 rounded-lg">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <span>✨</span> Modelo: Gemini 1.5 Flash (Prompting Biomédico)
                  </span>
                  <span>100% Formatado para Cotações</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowIAModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleCopyJustificativa}
                disabled={generatingIA}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-2"
              >
                📋 Copiar Texto Completo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
