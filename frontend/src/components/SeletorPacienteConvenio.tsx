"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";

export interface PacienteSelecionado {
  id: number;
  nome_completo: string;
  convenio_id?: number | null;
  convenio: string;
  numero_carteirinha: string;
  codigo_atendimento: string;
  cpf: string;
  rg?: string;
  telefone?: string;
}

interface Props {
  pacientes: PacienteSelecionado[];
  convenios: Array<{ id: number; nome: string; plano: string; carencia: string }>;
  pacienteSelecionado: PacienteSelecionado | null;
  convenioSelecionado: string;
  onSelectPaciente: (pac: PacienteSelecionado | null) => void;
  onChangeConvenio: (convenioRotulo: string) => void;
}

export default function SeletorPacienteConvenio({
  pacientes,
  convenios,
  pacienteSelecionado,
  convenioSelecionado,
  onSelectPaciente,
  onChangeConvenio,
}: Props) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, []);

  // Lista de pacientes ordenada alfabeticamente e filtrada conforme digita (suporta 1000+ registros com fluidez)
  const pacientesFiltrados = useMemo(() => {
    const ordenados = [...pacientes].sort((a, b) =>
      String(a.nome_completo || "").localeCompare(String(b.nome_completo || ""), "pt-BR", {
        sensitivity: "base",
      })
    );

    if (!busca.trim()) {
      return ordenados.slice(0, 30);
    }

    const termo = busca.toLowerCase().trim();
    return ordenados
      .filter((p) => {
        const texto = `${p.nome_completo || ""} ${p.cpf || ""} ${p.numero_carteirinha || ""} ${p.codigo_atendimento || ""} ${p.convenio || ""}`.toLowerCase();
        return texto.includes(termo);
      })
      .slice(0, 30);
  }, [pacientes, busca]);

  // Opções únicas de convênios cadastrados
  const opcoesConvenio = useMemo(() => {
    const lista = convenios.map((c) => `${c.nome} (${c.plano})`);
    if (convenioSelecionado && !lista.includes(convenioSelecionado)) {
      lista.unshift(convenioSelecionado);
    }
    return Array.from(new Set(lista));
  }, [convenios, convenioSelecionado]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Coluna 1: Combobox Pesquisável de Paciente Cadastrado */}
        <div className="relative" ref={containerRef}>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-300 font-medium">Nome do Paciente *</label>
            <Link
              href="/dashboard/configuracoes?tab=pacientes"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
            >
              + Cadastrar em Configurações
            </Link>
          </div>

          {pacienteSelecionado ? (
            <div className="w-full px-3 py-2 bg-emerald-500/10 border border-emerald-500/40 rounded-lg flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{pacienteSelecionado.nome_completo}</p>
                <p className="text-[11px] text-emerald-300 truncate">
                  CPF: {pacienteSelecionado.cpf} · Cart: {pacienteSelecionado.numero_carteirinha}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectPaciente(null);
                  setBusca("");
                  setAberto(true);
                }}
                className="px-2 py-1 text-[11px] font-bold rounded bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 shrink-0"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={busca}
                onFocus={() => setAberto(true)}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setAberto(true);
                }}
                placeholder="Digite ex: João, CPF ou carteirinha..."
                className="w-full pl-8 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none placeholder-slate-500"
              />
              <span className="absolute left-2.5 top-2.5 text-slate-500 text-xs">🔍</span>
              <button
                type="button"
                onClick={() => setAberto(!aberto)}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
              >
                ▼
              </button>
            </div>
          )}

          {/* Lista Suspensa Filtrada em Ordem Alfabética */}
          {aberto && !pacienteSelecionado && (
            <div className="absolute left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-800/80">
              {pacientesFiltrados.length === 0 ? (
                <div className="p-3.5 text-center space-y-2">
                  <p className="text-xs text-slate-300 font-medium">
                    Nenhum paciente cadastrado encontrado para &ldquo;{busca}&rdquo;.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Para usar este paciente, cadastre-o primeiro na tela de Configurações.
                  </p>
                  <Link
                    href="/dashboard/configuracoes?tab=pacientes"
                    className="inline-block px-3 py-1.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold hover:bg-cyan-500/30 transition-colors"
                  >
                    Ir para Configurações → Pacientes
                  </Link>
                </div>
              ) : (
                <>
                  <div className="px-3 py-1.5 bg-slate-950/80 text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex justify-between">
                    <span>Pacientes Cadastrados (A–Z)</span>
                    <span>{pacientesFiltrados.length} exibido(s)</span>
                  </div>
                  {pacientesFiltrados.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => {
                        onSelectPaciente(p);
                        if (p.convenio) {
                          onChangeConvenio(p.convenio);
                        }
                        setAberto(false);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-slate-800/90 transition-colors flex flex-col gap-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">{p.nome_completo}</span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-violet-500/15 text-violet-300 border border-violet-500/30 shrink-0">
                          {p.convenio}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        CPF: {p.cpf} · Cart: {p.numero_carteirinha} · Cód: {p.codigo_atendimento}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Coluna 2: Seletor de Convênio Cadastrado (Auto-preenchido ao escolher o paciente) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-300 font-medium">Convênio *</label>
            <Link
              href="/dashboard/configuracoes?tab=convenios"
              className="text-[11px] text-violet-400 hover:text-violet-300 font-medium"
            >
              + Cadastrar Convênio
            </Link>
          </div>
          <select
            required
            value={convenioSelecionado}
            onChange={(e) => onChangeConvenio(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none"
          >
            <option value="">Selecione um convênio cadastrado...</option>
            {opcoesConvenio.map((rotulo) => (
              <option key={rotulo} value={rotulo}>
                {rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resumo automático dos dados vinculados do paciente */}
      {pacienteSelecionado && (
        <div className="px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
          <span>
            <strong className="text-slate-400">Cód. Atendimento:</strong>{" "}
            <span className="font-mono text-emerald-400">{pacienteSelecionado.codigo_atendimento}</span>
          </span>
          <span>
            <strong className="text-slate-400">Carteirinha:</strong>{" "}
            <span className="font-mono text-cyan-300">{pacienteSelecionado.numero_carteirinha}</span>
          </span>
          <span>
            <strong className="text-slate-400">Telefone:</strong> {pacienteSelecionado.telefone || "—"}
          </span>
        </div>
      )}
    </div>
  );
}

