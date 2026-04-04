"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import DataTable from "@/components/DataTable";
import { materiaisApi, categoriasApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

export default function MateriaisPage() {
  const [materiais, setMateriais] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    categoria_id: "",
    fabricante: "",
    codigo_catalogo: "",
    classe_risco: "",
    exige_refrigeracao: false,
    temperatura_min: "",
    temperatura_max: "",
  });

  const loadData = async () => {
    try {
      const [mats, cats] = await Promise.all([
        materiaisApi.listar(),
        categoriasApi.listar(),
      ]);
      setMateriais(mats);
      setCategorias(cats);
    } catch {
      showToast("Erro ao carregar materiais.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm({
      nome: "",
      descricao: "",
      categoria_id: "",
      fabricante: "",
      codigo_catalogo: "",
      classe_risco: "",
      exige_refrigeracao: false,
      temperatura_min: "",
      temperatura_max: "",
    });
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
      temperatura_min: form.temperatura_min ? parseFloat(form.temperatura_min) : null,
      temperatura_max: form.temperatura_max ? parseFloat(form.temperatura_max) : null,
    };

    try {
      if (editing) {
        await materiaisApi.atualizar(editing.id, payload);
        showToast("Material atualizado com sucesso!");
      } else {
        await materiaisApi.criar(payload);
        showToast("Material criado com sucesso!");
      }
      resetForm();
      setShowForm(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const handleEdit = (item: any) => {
    setForm({
      nome: item.nome,
      descricao: item.descricao || "",
      categoria_id: item.categoria_id?.toString() || "",
      fabricante: item.fabricante || "",
      codigo_catalogo: item.codigo_catalogo || "",
      classe_risco: item.classe_risco || "",
      exige_refrigeracao: item.exige_refrigeracao,
      temperatura_min: item.temperatura_min?.toString() || "",
      temperatura_max: item.temperatura_max?.toString() || "",
    });
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Desativar o material "${item.nome}"?`)) return;
    try {
      await materiaisApi.deletar(item.id);
      showToast("Material desativado.");
      loadData();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  const catMap = categorias.reduce((acc: any, c: any) => {
    acc[c.id] = c.nome;
    return acc;
  }, {});

  const columns = [
    { key: "nome", label: "Nome" },
    {
      key: "categoria_id",
      label: "Categoria",
      render: (item: any) => catMap[item.categoria_id] || "-",
    },
    { key: "fabricante", label: "Fabricante" },
    {
      key: "classe_risco",
      label: "Risco",
      render: (item: any) =>
        item.classe_risco ? (
          <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-lg">
            {item.classe_risco}
          </span>
        ) : (
          "-"
        ),
    },
    {
      key: "exige_refrigeracao",
      label: "Refrig.",
      render: (item: any) =>
        item.exige_refrigeracao ? (
          <span className="text-cyan-400">🧊 Sim</span>
        ) : (
          "Não"
        ),
    },
  ];

  return (
    <PageHeader
      title="Materiais"
      subtitle="Catálogo de materiais do laboratório"
      actions={
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-medium text-sm rounded-xl hover:from-emerald-400 hover:to-cyan-400 transition-all shadow-lg shadow-emerald-500/20"
        >
          {showForm ? "Fechar" : "+ Novo Material"}
        </button>
      }
    >
      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="glass p-6 mb-6 animate-fade-in"
        >
          <h3 className="font-semibold text-white mb-4">
            {editing ? "Editar Material" : "Novo Material"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Nome *
              </label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Categoria
              </label>
              <select
                value={form.categoria_id}
                onChange={(e) =>
                  setForm({ ...form, categoria_id: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              >
                <option value="">Selecione</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Fabricante
              </label>
              <input
                value={form.fabricante}
                onChange={(e) =>
                  setForm({ ...form, fabricante: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Código Catálogo
              </label>
              <input
                value={form.codigo_catalogo}
                onChange={(e) =>
                  setForm({ ...form, codigo_catalogo: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Classe de Risco
              </label>
              <select
                value={form.classe_risco}
                onChange={(e) =>
                  setForm({ ...form, classe_risco: e.target.value })
                }
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              >
                <option value="">Nenhum</option>
                <option value="Biológico">Biológico</option>
                <option value="Inflamável">Inflamável</option>
                <option value="Corrosivo">Corrosivo</option>
                <option value="Tóxico">Tóxico</option>
                <option value="Radioativo">Radioativo</option>
              </select>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.exige_refrigeracao}
                  onChange={(e) =>
                    setForm({ ...form, exige_refrigeracao: e.target.checked })
                  }
                  className="accent-emerald-500"
                />
                🧊 Exige Refrigeração
              </label>
            </div>
            {form.exige_refrigeracao && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Temp. Mín (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.temperatura_min}
                    onChange={(e) =>
                      setForm({ ...form, temperatura_min: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Temp. Máx (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.temperatura_max}
                    onChange={(e) =>
                      setForm({ ...form, temperatura_max: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2 lg:col-span-3">
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Descrição
              </label>
              <textarea
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                rows={2}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none resize-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-medium text-sm rounded-xl transition-colors"
            >
              {editing ? "Salvar Alterações" : "Cadastrar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium text-sm rounded-xl transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={materiais}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyLabel="Nenhum material cadastrado."
        />
      )}
    </PageHeader>
  );
}
