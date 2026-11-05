"use client";

import { useEffect, useState } from "react";
import DataTable from "@/components/DataTable";
import { conveniosApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

const emptyForm = { nome: "", plano: "", carencia: "" };

export default function ConveniosTab() {
  const [convenios, setConvenios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try {
      setConvenios(await conveniosApi.listar());
    } catch {
      showToast("Erro ao carregar convênios.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await conveniosApi.atualizar(editing.id, form);
        showToast("Convênio atualizado!");
      } else {
        await conveniosApi.criar(form);
        showToast("Convênio cadastrado!");
      }
      setForm({ ...emptyForm });
      setEditing(null);
      setShowForm(false);
      load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleEdit = (item: any) => {
    setForm({
      nome: item.nome || "",
      plano: item.plano || "",
      carencia: item.carencia || "",
    });
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Desativar o convênio "${item.nome} - ${item.plano}"?`)) return;
    try {
      await conveniosApi.deletar(item.id);
      showToast("Convênio desativado.");
      load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Convênios</h2>
          <p className="text-sm text-slate-400">Gestão de planos de saúde, categorias de atendimento e prazos de carência</p>
        </div>
        <button
          onClick={() => {
            setForm({ ...emptyForm });
            setEditing(null);
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors"
        >
          {showForm ? "Fechar Form" : "+ Novo Convênio"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome do Convênio *</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                placeholder="Ex: Unimed, Bradesco Saúde, SulAmérica"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Plano *</label>
              <input
                value={form.plano}
                onChange={(e) => setForm({ ...form, plano: e.target.value })}
                required
                placeholder="Ex: Nacional Flex, Apartamento, Enfermaria"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Carência *</label>
              <input
                value={form.carencia}
                onChange={(e) => setForm({ ...form, carencia: e.target.value })}
                required
                placeholder="Ex: Sem carência, 24 horas, 30 dias"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors"
            >
              {editing ? "Salvar" : "Cadastrar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-5 py-2 bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800 font-medium text-sm rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={[
            { key: "nome", label: "Nome do Convênio" },
            {
              key: "plano",
              label: "Plano",
              render: (item: any) => (
                <span className="px-2.5 py-1 text-xs rounded-lg font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  {item.plano}
                </span>
              ),
            },
            {
              key: "carencia",
              label: "Carência",
              render: (item: any) => (
                <span className="px-2.5 py-1 text-xs rounded-lg font-medium bg-cyan-500/10 text-cyan-300">
                  {item.carencia}
                </span>
              ),
            },
          ]}
          data={convenios}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyLabel="Nenhum convênio cadastrado."
        />
      )}
    </div>
  );
}

