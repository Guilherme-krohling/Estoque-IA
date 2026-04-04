"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { lotesApi, materiaisApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function LotesPage() {
  const [lotes, setLotes] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ material_id: "", numero_lote: "", data_fabricacao: "", data_validade: "", quantidade_atual: "0" });

  const load = async () => {
    try { const [l, m] = await Promise.all([lotesApi.listar(), materiaisApi.listar()]); setLotes(l); setMateriais(m); }
    catch { showToast("Erro ao carregar lotes.", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm({ material_id: "", numero_lote: "", data_fabricacao: "", data_validade: "", quantidade_atual: "0" }); setEditing(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, material_id: parseInt(form.material_id), quantidade_atual: parseFloat(form.quantidade_atual), data_fabricacao: form.data_fabricacao || null };
    try {
      if (editing) { await lotesApi.atualizar(editing.id, payload); showToast("Lote atualizado!"); }
      else { await lotesApi.criar(payload); showToast("Lote criado!"); }
      resetForm(); setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEdit = (item: any) => {
    setForm({ material_id: item.material_id.toString(), numero_lote: item.numero_lote, data_fabricacao: item.data_fabricacao || "", data_validade: item.data_validade, quantidade_atual: item.quantidade_atual.toString() });
    setEditing(item); setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm("Excluir este lote?")) return;
    try { await lotesApi.deletar(item.id); showToast("Lote excluído."); load(); }
    catch (err: any) { showToast(err.message, "error"); }
  };

  const matMap = materiais.reduce((acc: any, m: any) => { acc[m.id] = m.nome; return acc; }, {});

  const daysTo = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const columns = [
    { key: "numero_lote", label: "Nº Lote" },
    { key: "material_id", label: "Material", render: (i: any) => matMap[i.material_id] || "-" },
    { key: "quantidade_atual", label: "Qtd. Atual" },
    { key: "data_validade", label: "Validade", render: (i: any) => {
      const days = daysTo(i.data_validade);
      const color = days < 0 ? "text-red-400" : days <= 30 ? "text-amber-400" : "text-emerald-400";
      const label = days < 0 ? `Vencido (${Math.abs(days)}d)` : days === 0 ? "Vence hoje" : `${i.data_validade} (${days}d)`;
      return <span className={color}>{label}</span>;
    }},
  ];

  return (
    <PageHeader title="Lotes" subtitle="Controle FEFO (First Expired, First Out)"
      actions={
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm rounded-xl hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20">
          {showForm ? "Fechar" : "+ Novo Lote"}
        </button>
      }
    >
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-6 mb-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Material *</label>
              <select value={form.material_id} onChange={(e) => setForm({ ...form, material_id: e.target.value })} required className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none">
                <option value="">Selecione</option>
                {materiais.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nº Lote *</label><input value={form.numero_lote} onChange={(e) => setForm({ ...form, numero_lote: e.target.value })} required className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Quantidade</label><input type="number" step="0.01" value={form.quantidade_atual} onChange={(e) => setForm({ ...form, quantidade_atual: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Fabricação</label><input type="date" value={form.data_fabricacao} onChange={(e) => setForm({ ...form, data_fabricacao: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Validade *</label><input type="date" value={form.data_validade} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} required className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
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
        <DataTable columns={columns} data={lotes} onEdit={handleEdit} onDelete={handleDelete} emptyLabel="Nenhum lote cadastrado." />
      )}
    </PageHeader>
  );
}
