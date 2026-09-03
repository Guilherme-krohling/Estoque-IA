"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import CategoriasTab from "@/components/tabs/CategoriasTab";
import FornecedoresTab from "@/components/tabs/FornecedoresTab";
import DoencasTab from "@/components/tabs/DoencasTab";
import LocaisTab from "@/components/tabs/LocaisTab";
import UsuariosTab from "@/components/tabs/UsuariosTab";
import { useAuth } from "@/contexts/AuthContext";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("categorias");

  if (user?.perfil === "PESQUISADOR") {
    return (
      <div className="flex items-center justify-center h-[70vh] text-slate-400">
        <p>Acesso negado. Apenas Gestores e Administradores têm acesso às configurações do sistema.</p>
      </div>
    );
  }

  return (
    <PageHeader title="Configurações Globais" subtitle="Parâmetros base do laboratório">
      <div className="mb-6 flex gap-2 border-b border-slate-700/50 pb-px overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("categorias")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "categorias"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🏷️ Categorias
        </button>
        <button
          onClick={() => setActiveTab("fornecedores")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "fornecedores"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🏭 Fornecedores
        </button>
        <button
          onClick={() => setActiveTab("locais")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "locais"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🧊 Locais
        </button>
        <button
          onClick={() => setActiveTab("doencas")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
            activeTab === "doencas"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          🦠 Doenças
        </button>
        {user?.perfil === "ADMIN" && (
          <button
            onClick={() => setActiveTab("equipe")}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
              activeTab === "equipe"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            👥 Equipe
          </button>
        )}
      </div>

      <div className="glass p-6 rounded-2xl min-h-[50vh]">
        {activeTab === "categorias" && <CategoriasTab />}
        {activeTab === "fornecedores" && <FornecedoresTab />}
        {activeTab === "locais" && <LocaisTab />}
        {activeTab === "doencas" && <DoencasTab />}
        {activeTab === "equipe" && user?.perfil === "ADMIN" && <UsuariosTab />}
      </div>
    </PageHeader>
  );
}
