"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { authApi, usuariosApi } from "@/lib/api";
import { showToast } from "@/components/Toast";
import { useAuth } from "@/contexts/AuthContext";

export default function UsuariosTab() {
  const { user: currentUser } = useAuth();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", email: "", senha: "", perfil: "PESQUISADOR" });

  const load = async () => {
    try { setUsuarios(await usuariosApi.listar()); } 
    catch { showToast("Erro ao carregar usuários.", "error"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await authApi.registrar(form);
      showToast("Usuário cadastrado com sucesso!");
      setForm({ nome: "", email: "", senha: "", perfil: "PESQUISADOR" }); setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleToggleStatus = async (item: any) => {
    if (item.id === currentUser?.id) { showToast("Você não pode desativar o próprio usuário.", "error"); return; }
    try {
      if (item.ativo) {
        if (!confirm(`Desativar o acesso de "${item.nome}"?`)) return;
        await usuariosApi.desativar(item.id); showToast("Usuário desativado.");
      } else {
        await usuariosApi.ativar(item.id); showToast("Usuário reativado.");
      }
      load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const perfilColor: Record<string, string> = {
    ADMIN: "bg-purple-500/10 text-purple-400", GESTOR: "bg-blue-500/10 text-blue-400", PESQUISADOR: "bg-emerald-500/10 text-emerald-400",
  };

  if (currentUser?.perfil !== "ADMIN") {
    return <div className="py-10 text-center text-slate-400">Acesso negado. Apenas administradores podem gerenciar usuários.</div>;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Equipe e Acessos</h2>
          <p className="text-sm text-slate-400">Gerenciamento de contas e permissões</p>
        </div>
        <button onClick={() => { setForm({ nome: "", email: "", senha: "", perfil: "PESQUISADOR" }); setShowForm(!showForm); }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors">
          {showForm ? "Fechar Form" : "+ Novo Usuário"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Senha *</label><input type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} required minLength={8} placeholder="Mínimo 8 caracteres" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Perfil *</label>
              <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none">
                <option value="PESQUISADOR">Pesquisador</option><option value="GESTOR">Gestor</option><option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors">Cadastrar</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium text-sm rounded-xl transition-colors">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <DataTable 
          columns={[
            { key: "nome", label: "Nome" }, { key: "email", label: "Email" },
            { key: "perfil", label: "Perfil", render: (i: any) => <span className={`px-2 py-1 text-xs rounded-lg font-medium ${perfilColor[i.perfil] || ""}`}>{i.perfil}</span> },
            { key: "ativo", label: "Status", render: (i: any) => i.ativo ? <span className="text-emerald-400">Ativo</span> : <span className="text-red-400">Inativo</span> }
          ]} 
          data={usuarios} emptyLabel="Nenhum usuário cadastrado." onEdit={(item: any) => handleToggleStatus(item)} editLabel="Alternar Status"
        />
      )}
    </div>
  );
}
