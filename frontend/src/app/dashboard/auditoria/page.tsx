"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { movimentacoesApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

const TIPOS = ["", "ENTRADA", "USO", "DESCARTE", "AJUSTE", "TRANSFERENCIA"];

export default function AuditoriaPage() {
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState("");

  // Filtro de Texto e Ordenação
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const load = async () => {
    setLoading(true);
    try {
      setMovimentacoes(await movimentacoesApi.listar(filtroTipo ? { tipo: filtroTipo } : undefined));
    } catch {
      showToast("Erro ao carregar movimentações.", "error");
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

  // Filtragem por digitação e Ordenação
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

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();

        if (strA < strB) return sortDirection === "asc" ? -1 : 1;
        if (strA > strB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [movimentacoes, searchTerm, sortColumn, sortDirection]);

  const hasActiveFilters = searchTerm !== "" || filtroTipo !== "" || sortColumn !== null;

  return (
    <PageHeader title="Auditoria" subtitle="Trilha imutável de entradas, usos, descartes, ajustes e transferências">
      {/* Barra de Filtros e Busca Completa */}
      <div className="mb-6 p-3 glass rounded-xl border border-slate-700/50 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Digite para buscar na auditoria (Material, Lote, Usuário)..."
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
              🧹 Limpar Filtros
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
          <p className="text-4xl mb-3">📭</p>
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
                <th className="px-4 py-3 font-medium">Motivo</th>
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
                    <td className="px-4 py-3 text-slate-400">{m.motivo || "-"}</td>
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
    </PageHeader>
  );
}
