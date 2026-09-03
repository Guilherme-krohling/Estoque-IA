"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { doencasApi, materiaisApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function DoencasTab() {
  const [doencas, setDoencas] = useState<any[]>([]);
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ nome: "", descricao: "", cid_codigo: "", material_ids: [] as number[] });

  const load = async () => {
    try { 
      const [doencasList, materiaisList] = await Promise.all([doencasApi.listar(), materiaisApi.listar()]);
      setDoencas(doencasList);
      setMateriais(materiaisList);
    } catch { showToast("Erro ao carregar dados.", "error"); } 
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
    const linkedMaterialIds = item.materiais ? item.materiais.map((m: any) => m.id) : [];
    setForm({ nome: item.nome, descricao: item.descricao || "", cid_codigo: item.cid_codigo || "", material_ids: linkedMaterialIds });
    setEditing(item); setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Desativar "${item.nome}"?`)) return;
    try { await doencasApi.deletar(item.id); showToast("Doença desativada."); load(); } 
    catch (err: any) { showToast(err.message, "error"); }
  };

  const handleCheckboxChange = (materialId: number) => {
    setForm((prev) => {
      const isSelected = prev.material_ids.includes(materialId);
      if (isSelected) {
        return { ...prev, material_ids: prev.material_ids.filter((id) => id !== materialId) };
      } else {
        return { ...prev, material_ids: [...prev.material_ids, materialId] };
      }
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Doenças (CID-10)</h2>
          <p className="text-sm text-slate-400">Associação preditiva de patógenos e materiais</p>
        </div>
        <button onClick={() => { setForm({ nome: "", descricao: "", cid_codigo: "", material_ids: [] }); setEditing(null); setShowForm(!showForm); }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors">
          {showForm ? "Fechar Form" : "+ Nova Doença"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Nome *</label><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">CID-10</label><input value={form.cid_codigo} onChange={(e) => setForm({ ...form, cid_codigo: e.target.value })} placeholder="Ex: A90" className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
            <div><label className="block text-xs font-medium text-slate-400 mb-1">Descrição</label><input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none" /></div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700/50">
            <label className="block text-sm font-medium text-slate-300 mb-2">Vincular Materiais de Combate à Doença</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2">
              {materiais.length === 0 ? (
                <p className="text-xs text-slate-500 col-span-full">Nenhum material cadastrado.</p>
              ) : (
                materiais.map((mat) => (
                  <label key={mat.id} className="flex items-start gap-2 p-2 rounded-lg border border-slate-700/50 bg-slate-800/30 hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <input type="checkbox" className="mt-1 accent-emerald-500" checked={form.material_ids.includes(mat.id)} onChange={() => handleCheckboxChange(mat.id)} />
                    <div className="flex flex-col"><span className="text-sm text-slate-200 leading-tight">{mat.nome}</span>{mat.fabricante && <span className="text-xs text-slate-500">{mat.fabricante}</span>}</div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="submit" className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors">{editing ? "Salvar Vínculos" : "Cadastrar"}</button>
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
            { key: "cid_codigo", label: "CID-10" }, 
            { 
              key: "materiais", 
              label: "Materiais Vinculados", 
              render: (item: any) => (
                <span className="px-2 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded-lg font-medium">
                  {item.materiais ? item.materiais.length : 0} Insumos
                </span>
              ) 
            }
          ]} 
          data={doencas} onEdit={handleEdit} onDelete={handleDelete} emptyLabel="Nenhuma doença cadastrada." 
        />
      )}
    </div>
  );
}
