"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/dashboard/estoque", label: "Estoque", icon: "📦" },
  { href: "/dashboard/reposicao", label: "Reposição", icon: "📋" },
  { href: "/dashboard/alertas", label: "Alertas", icon: "⚠️" },
  { href: "/dashboard/assistente-ia", label: "Assistente IA", icon: "🤖" },
  { href: "/dashboard/auditoria", label: "Auditoria", icon: "📜" },
  { href: "/dashboard/configuracoes", label: "Configurações", icon: "⚙️", adminOnly: true },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-slate-900 border-r border-slate-700/50 flex flex-col transition-all duration-300 z-50 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700/50">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md">
          S
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-bold text-white text-lg leading-tight">
              StockIA
            </h1>
            <p className="text-xs text-slate-400">Gestão Laboratorial</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.adminOnly && user?.perfil !== "ADMIN") return null;

          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.2)]"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mx-2 mb-2 p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-sm"
      >
        {collapsed ? "→" : "← Recolher"}
      </button>

      {/* User Footer */}
      <div className="border-t border-slate-700/50 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.nome?.charAt(0) || "U"}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {user?.nome}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.perfil}</p>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={logout}
              className="text-slate-400 hover:text-red-400 transition-colors text-sm"
              title="Sair"
            >
              🚪
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
