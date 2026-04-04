"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { doencasApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function DoencasPage() {
  const [doencas, setDoencas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", cid_codigo: "", material_ids: [] as number[] });

  const load = async () => {
    try { setDoencas(await doencasApi.listar()); }
    catch { showToast("Erro ao carregar doenças.", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await doencasApi.atualizar(editing.id, form); showToast("Doença atualizada!"); }
      else { await doencasApi.criar(form); showToast("Doença criada!"); }
      setForm({ nome: "", descricao: "", cid_codigo: "", material_ids: [] }); setEditing(null); setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEdit = (item: any) => {
    setForm({ nome: item.nome, descricao: item.descricao || "", cid_codigo: item.cid_codigo || "", material_ids: [] });
    setEditing(item); setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Desativar "${item.nome}"?`)) return;
    try { await doencasApi.deletar(item.id); showToast("Doença desativada."); load(); }
    catch (err: any) { showToast(err.message, "error"); }
  };

  return (
    <PageHeader title="Doenças" subtitle="Doenças monitoradas e materiais relacionados"
      actions={
        <button onClick={() => { setForm({ nome: "", descricao: "", cid_codigo: "", material_ids: [] }); setEditing(null); setShowForm(!showForm); }}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm rounded-xl hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20">
          {showForm ? "Fechar" : "+ Nova Doença"}
        </button>
      }
    >
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-6 mb-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">CID-10</label><input value={form.cid_codigo} onChange={(e) => setForm({ ...form, cid_codigo: e.target.value })} placeholder="Ex: A90" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors">{editing ? "Salvar" : "Cadastrar"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm rounded-xl transition-colors">Cancelar</button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <DataTable columns={[{ key: "nome", label: "Nome" }, { key: "cid_codigo", label: "CID-10" }, { key: "descricao", label: "Descrição" }]} data={doencas} onEdit={handleEdit} onDelete={handleDelete} emptyLabel="Nenhuma doença cadastrada." />
      )}
    </PageHeader>
  );
}
