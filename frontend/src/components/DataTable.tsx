"use client";

import { useState, useMemo } from "react";

export interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  emptyLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
}

export default function DataTable<T extends { id: number }>({
  columns,
  data,
  onEdit,
  onDelete,
  emptyLabel = "Nenhum registro encontrado.",
  editLabel = "Editar",
  deleteLabel = "Excluir",
}: Props<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortColumn === key) {
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(key);
      setSortDirection("asc");
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setSortColumn(null);
    setSortDirection("asc");
  };

  // Filtragem ao digitar e Ordenação
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Filtro de Busca (digitação)
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) => {
        return columns.some((col) => {
          const val = (item as any)[col.key];
          if (val != null) {
            return String(val).toLowerCase().includes(term);
          }
          return false;
        });
      });
    }

    // 2. Ordenação
    if (sortColumn) {
      result.sort((a, b) => {
        const valA = (a as any)[sortColumn];
        const valB = (b as any)[sortColumn];

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
  }, [data, searchTerm, sortColumn, sortDirection, columns]);

  const hasActiveFilters = searchTerm !== "" || sortColumn !== null;

  return (
    <div className="space-y-4">
      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 glass p-3 rounded-xl border border-slate-700/50">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="🔍 Digite para buscar..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none placeholder-slate-500"
          />
          <span className="absolute left-3 top-2.5 text-slate-500 text-xs">🔍</span>
        </div>

        {/* Ordenação por Coluna */}
        <div className="flex items-center gap-2">
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
            {columns.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>

          {sortColumn && (
            <button
              onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
              title={sortDirection === "asc" ? "Crescente (A-Z / 0-9)" : "Decrescente (Z-A / 9-0)"}
            >
              <span>{sortDirection === "asc" ? "↑ ASC" : "↓ DESC"}</span>
            </button>
          )}

          {/* Botão de Limpar Filtros */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
            >
              <span>🧹 Limpar Filtros</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Dados */}
      {processedData.length === 0 ? (
        <div className="text-center py-12 text-slate-400 glass rounded-xl border border-slate-700/50">
          <p className="text-4xl mb-3">📭</p>
          <p>{hasActiveFilters ? "Nenhum registro encontrado para estes filtros." : emptyLabel}</p>
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
              <tr className="border-b border-slate-700/50 bg-slate-800/50">
                {columns.map((col) => {
                  const isSorted = sortColumn === col.key;
                  return (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className="text-left px-4 py-3 font-medium text-slate-300 cursor-pointer select-none hover:text-white transition-colors"
                    >
                      <div className="flex items-center gap-1">
                        <span>{col.label}</span>
                        <span className="text-xs opacity-60">
                          {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                        </span>
                      </div>
                    </th>
                  );
                })}
                {(onEdit || onDelete) && (
                  <th className="text-right px-4 py-3 font-medium text-slate-300">
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {processedData.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`border-b border-slate-700/30 transition-colors hover:bg-slate-800/40 ${
                    idx % 2 === 0 ? "bg-slate-900/20" : ""
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-slate-200">
                      {col.render
                        ? col.render(item)
                        : String((item as any)[col.key] ?? "-")}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(item)}
                            className="px-3 py-1.5 text-xs font-medium bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors"
                          >
                            {editLabel}
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(item)}
                            className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                          >
                            {deleteLabel}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
