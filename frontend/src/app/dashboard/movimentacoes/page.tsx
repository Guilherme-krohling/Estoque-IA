"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { movimentacoesApi, lotesApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function MovimentacoesPage() {
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [lotes, setLotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ lote_id: "", tipo: "ENTRADA", quantidade: "", unidade_medida: "", motivo: "", referencia: "" });

  const load = async () => {
    try { const [m, l] = await Promise.all([movimentacoesApi.listar(), lotesApi.listar()]); setMovimentacoes(m); setLotes(l); }
    catch { showToast("Erro ao carregar movimentações.", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await movimentacoesApi.criar({ ...form, lote_id: parseInt(form.lote_id), quantidade: parseFloat(form.quantidade) });
      showToast("Movimentação registrada!");
      setForm({ lote_id: "", tipo: "ENTRADA", quantidade: "", unidade_medida: "", motivo: "", referencia: "" });
      setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const tipoColor: Record<string, string> = {
    ENTRADA: "bg-emerald-500/10 text-emerald-400",
    USO: "bg-cyan-500/10 text-cyan-400",
    DESCARTE: "bg-red-500/10 text-red-400",
    AJUSTE: "bg-amber-500/10 text-amber-400",
  };

  const columns = [
    { key: "tipo", label: "Tipo", render: (i: any) => <span className={`px-2 py-1 text-xs rounded-lg font-medium ${tipoColor[i.tipo] || ""}`}>{i.tipo}</span> },
    { key: "quantidade", label: "Qtd." },
    { key: "unidade_medida", label: "Unidade" },
    { key: "motivo", label: "Motivo" },
    { key: "referencia", label: "Referência" },
    { key: "criado_em", label: "Data", render: (i: any) => new Date(i.criado_em).toLocaleString("pt-BR") },
  ];

  return (
    <PageHeader title="Movimentações" subtitle="Histórico de entradas, usos e descartes"
      actions={
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm rounded-xl hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20">
          {showForm ? "Fechar" : "+ Nova Movimentação"}
        </button>
      }
    >
      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-6 mb-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Lote *</label>
              <select value={form.lote_id} onChange={(e) => setForm({ ...form, lote_id: e.target.value })} required className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none">
                <option value="">Selecione</option>{lotes.map((l) => <option key={l.id} value={l.id}>{l.numero_lote} (ID: {l.id})</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none">
                <option value="ENTRADA">ENTRADA</option><option value="USO">USO</option><option value="DESCARTE">DESCARTE</option><option value="AJUSTE">AJUSTE</option>
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Quantidade *</label><input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} required className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Unidade</label><input value={form.unidade_medida} onChange={(e) => setForm({ ...form, unidade_medida: e.target.value })} placeholder="un, ml, caixa" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Motivo</label><input value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Referência</label><input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} placeholder="NF / Pedido" className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
          </div>
          <div className="flex gap-3 mt-4">
            <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors">Registrar</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm rounded-xl transition-colors">Cancelar</button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <DataTable columns={columns} data={movimentacoes} emptyLabel="Nenhuma movimentação registrada." />
      )}
    </PageHeader>
  );
}
