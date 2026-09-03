"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { locaisApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

const TIPOS = ["AMBIENTE", "REFRIGERADO", "CONGELADO", "INFLAMAVEIS"];

const emptyForm = { nome: "", tipo: "AMBIENTE", temperatura_atual: "", descricao: "" };

export default function LocaisTab() {
  const [locais, setLocais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try { setLocais(await locaisApi.listar()); }
    catch { showToast("Erro ao carregar locais.", "error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: form.nome,
      tipo: form.tipo,
      temperatura_atual: form.temperatura_atual !== "" ? parseFloat(form.temperatura_atual.replace(",", ".")) : null,
      descricao: form.descricao || null,
    };
    try {
      if (editing) { await locaisApi.atualizar(editing.id, payload); showToast("Local atualizado!"); }
      else { await locaisApi.criar(payload); showToast("Local criado!"); }
      setForm({ ...emptyForm }); setEditing(null); setShowForm(false); load();
    } catch (err: any) { showToast(err.message, "error"); }
  };

  const handleEdit = (item: any) => {
    setForm({
      nome: item.nome,
      tipo: item.tipo || "AMBIENTE",
      temperatura_atual: item.temperatura_atual != null ? String(item.temperatura_atual) : "",
      descricao: item.descricao || "",
    });
    setEditing(item); setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Desativar o local "${item.nome}"?`)) return;
    try { await locaisApi.deletar(item.id); showToast("Local desativado."); load(); }
    catch (err: any) { showToast(err.message, "error"); }
  };

  const tipoColor: Record<string, string> = {
    AMBIENTE: "bg-slate-500/10 text-slate-300",
    REFRIGERADO: "bg-cyan-500/10 text-cyan-400",
    CONGELADO: "bg-blue-500/10 text-blue-400",
    INFLAMAVEIS: "bg-red-500/10 text-red-400",
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Locais de Armazenamento</h2>
          <p className="text-sm text-slate-400">Depósitos, geladeiras e freezers do laboratório</p>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setEditing(null); setShowForm(!showForm); }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors">
          {showForm ? "Fechar Form" : "+ Novo Local"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required placeholder="Ex: Geladeira 2 - Sala B" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Tipo *</label>
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none">
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Temperatura atual (°C)</label><input type="number" step="0.1" value={form.temperatura_atual} onChange={(e) => setForm({ ...form, temperatura_atual: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
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
        <DataTable
          columns={[
            { key: "nome", label: "Nome" },
            { key: "tipo", label: "Tipo", render: (i: any) => <span className={`px-2 py-1 text-xs rounded-lg font-medium ${tipoColor[i.tipo] || ""}`}>{i.tipo}</span> },
            { key: "temperatura_atual", label: "Temp. (°C)", render: (i: any) => i.temperatura_atual != null ? `${i.temperatura_atual}°` : "-" },
            { key: "descricao", label: "Descrição" },
          ]}
          data={locais} onEdit={handleEdit} onDelete={handleDelete} emptyLabel="Nenhum local cadastrado."
        />
      )}
    </div>
  );
}
