"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { fornecedoresApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function FornecedoresTab() {
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", cnpj: "", contato: "", email: "" });

  const load = async () => {
    try { setFornecedores(await fornecedoresApi.listar()); } 
    catch { showToast("Erro ao carregar fornecedores.", "error"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) { await fornecedoresApi.atualizar(editing.id, form); showToast("Fornecedor atualizado!"); } 
      else { await fornecedoresApi.criar(form); showToast("Fornecedor criado!"); }
      setForm({ nome: "", cnpj: "", contato: "", email: "" }); setEditing(null); setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEdit = (item: any) => {
    setForm({ nome: item.nome, cnpj: item.cnpj || "", contato: item.contato || "", email: item.email || "" }); setEditing(item); setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Desativar "${item.nome}"?`)) return;
    try { await fornecedoresApi.deletar(item.id); showToast("Fornecedor desativado."); load(); } 
    catch (err: any) { showToast(err.message, "error"); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Fornecedores</h2>
          <p className="text-sm text-slate-400">Gestão de parceiros e fábricas</p>
        </div>
        <button onClick={() => { setForm({ nome: "", cnpj: "", contato: "", email: "" }); setEditing(null); setShowForm(!showForm); }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors">
          {showForm ? "Fechar Form" : "+ Novo Fornecedor"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">CNPJ</label><input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Contato</label><input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
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
        <DataTable columns={[{ key: "nome", label: "Nome" }, { key: "cnpj", label: "CNPJ" }, { key: "contato", label: "Contato" }, { key: "email", label: "Email" }]} data={fornecedores} onEdit={handleEdit} onDelete={handleDelete} emptyLabel="Nenhum fornecedor cadastrado." />
      )}
    </div>
  );
}
