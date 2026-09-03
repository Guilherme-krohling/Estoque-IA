"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { categoriasApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function CategoriasTab() {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });

  const load = async () => {
    try { setCategorias(await categoriasApi.listar()); } 
    catch { showToast("Erro ao carregar categorias.", "error"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await categoriasApi.atualizar(editing.id, form); showToast("Categoria atualizada!"); } 
      else { await categoriasApi.criar(form); showToast("Categoria criada!"); }
      setForm({ nome: "", descricao: "" }); setEditing(null); setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEdit = (item: any) => {
    setForm({ nome: item.nome, descricao: item.descricao || "" }); setEditing(item); setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Excluir a categoria "${item.nome}"?`)) return;
    try { await categoriasApi.deletar(item.id); showToast("Categoria excluída."); load(); } 
    catch (err: any) { showToast(err.message, "error"); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Categorias</h2>
          <p className="text-sm text-slate-400">Organização dos materiais por tipo</p>
        </div>
        <button onClick={() => { setForm({ nome: "", descricao: "" }); setEditing(null); setShowForm(!showForm); }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors">
          {showForm ? "Fechar Form" : "+ Nova Categoria"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors">{editing ? "Salvar" : "Cadastrar"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium text-sm rounded-xl transition-colors">Cancelar</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <DataTable columns={[{ key: "nome", label: "Nome" }, { key: "descricao", label: "Descrição" }]} data={categorias} onEdit={handleEdit} onDelete={handleDelete} emptyLabel="Nenhuma categoria cadastrada." />
      )}
    </div>
  );
}
