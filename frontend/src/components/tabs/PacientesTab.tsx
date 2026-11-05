"use client";

import { useEffect, useState, useMemo } from "react";
import DataTable from "@/components/DataTable";
import { pacientesApi, conveniosApi } from "@/lib/api";
import { showToast } from "@/components/Toast";

const emptyForm = {
  nome_completo: "",
  convenio_id: "",
  convenio: "",
  numero_carteirinha: "",
  data_nascimento: "",
  codigo_atendimento: "",
  cpf: "",
  rg: "",
  telefone: "",
  endereco: "",
};

export default function PacientesTab() {
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [convenios, setConvenios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    try {
      const [pacsList, convsList] = await Promise.all([
        pacientesApi.listar(),
        conveniosApi.listar(),
      ]);
      setPacientes(pacsList);
      setConvenios(convsList);
    } catch {
      showToast("Erro ao carregar pacientes e convênios.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Garante organização sempre em ordem alfabética (A-Z) por nome_completo
  const pacientesOrdenados = useMemo(() => {
    return [...pacientes].sort((a, b) =>
      String(a.nome_completo || "").localeCompare(String(b.nome_completo || ""), "pt-BR", {
        sensitivity: "base",
      })
    );
  }, [pacientes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const convSelecionado = convenios.find((c) => String(c.id) === String(form.convenio_id));
    const payload = {
      nome_completo: form.nome_completo.trim(),
      convenio_id: form.convenio_id ? parseInt(String(form.convenio_id), 10) : null,
      convenio: convSelecionado
        ? `${convSelecionado.nome} (${convSelecionado.plano})`
        : form.convenio.trim(),
      numero_carteirinha: form.numero_carteirinha.trim(),
      data_nascimento: form.data_nascimento,
      codigo_atendimento: form.codigo_atendimento.trim(),
      cpf: form.cpf.trim(),
      rg: form.rg.trim(),
      telefone: form.telefone.trim(),
      endereco: form.endereco.trim() || null,
    };

    try {
      if (editing) {
        await pacientesApi.atualizar(editing.id, payload);
        showToast("Paciente atualizado com sucesso!");
      } else {
        await pacientesApi.criar(payload);
        showToast("Paciente cadastrado com sucesso!");
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
      nome_completo: item.nome_completo || "",
      convenio_id: item.convenio_id ? String(item.convenio_id) : "",
      convenio: item.convenio || "",
      numero_carteirinha: item.numero_carteirinha || "",
      data_nascimento: item.data_nascimento ? String(item.data_nascimento).slice(0, 10) : "",
      codigo_atendimento: item.codigo_atendimento || "",
      cpf: item.cpf || "",
      rg: item.rg || "",
      telefone: item.telefone || "",
      endereco: item.endereco || "",
    });
    setEditing(item);
    setShowForm(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Excluir o cadastro do paciente "${item.nome_completo}"?`)) return;
    try {
      await pacientesApi.deletar(item.id);
      showToast("Paciente removido.");
      load();
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-white">Pacientes</h2>
          <p className="text-sm text-slate-400">
            Cadastro central de pacientes vinculados a convênios (organizados em ordem alfabética A–Z)
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ ...emptyForm });
            setEditing(null);
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-slate-800 text-white font-medium text-sm rounded-xl hover:bg-slate-700 transition-colors"
        >
          {showForm ? "Fechar Form" : "+ Novo Paciente"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="glass p-5 mb-6 border border-slate-700/50 rounded-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-400 mb-1">Nome Completo *</label>
              <input
                value={form.nome_completo}
                onChange={(e) => setForm({ ...form, nome_completo: e.target.value })}
                required
                placeholder="Ex: João Carlos da Silva"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Convênio *</label>
              <select
                value={form.convenio_id}
                onChange={(e) => {
                  const idVal = e.target.value;
                  const convObj = convenios.find((c) => String(c.id) === idVal);
                  setForm({
                    ...form,
                    convenio_id: idVal,
                    convenio: convObj ? `${convObj.nome} (${convObj.plano})` : "",
                  });
                }}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              >
                <option value="">Selecione um convênio cadastrado...</option>
                {convenios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {c.plano} (Carência: {c.carencia})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Número da Carteirinha *</label>
              <input
                value={form.numero_carteirinha}
                onChange={(e) => setForm({ ...form, numero_carteirinha: e.target.value })}
                required
                placeholder="Ex: 009821445"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Data de Nascimento *</label>
              <input
                type="date"
                value={form.data_nascimento}
                onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Código de Atendimento *</label>
              <input
                value={form.codigo_atendimento}
                onChange={(e) => setForm({ ...form, codigo_atendimento: e.target.value })}
                required
                placeholder="Ex: ATD-2026-001"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">CPF *</label>
              <input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                required
                placeholder="000.000.000-00"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">RG *</label>
              <input
                value={form.rg}
                onChange={(e) => setForm({ ...form, rg: e.target.value })}
                required
                placeholder="00.000.000-0"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Telefone *</label>
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                required
                placeholder="(13) 99999-0000"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-400 mb-1">Endereço (Opcional)</label>
              <input
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                placeholder="Rua, número, bairro, cidade/UF (Opcional)"
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
            {
              key: "nome_completo",
              label: "Nome Completo",
              render: (item: any) => (
                <span className="font-semibold text-white whitespace-nowrap block">{item.nome_completo}</span>
              ),
            },
            {
              key: "convenio",
              label: "Convênio",
              render: (item: any) => (
                <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 text-xs rounded-lg font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  {item.convenio}
                </span>
              ),
            },
            {
              key: "numero_carteirinha",
              label: "Nº Carteirinha",
              render: (item: any) => (
                <span className="inline-block whitespace-nowrap font-mono text-xs text-cyan-300">
                  {item.numero_carteirinha}
                </span>
              ),
            },
            {
              key: "data_nascimento",
              label: "Nascimento",
              render: (item: any) => (
                <span className="inline-block whitespace-nowrap text-xs text-slate-200">
                  {item.data_nascimento
                    ? new Date(`${String(item.data_nascimento).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
                    : "-"}
                </span>
              ),
            },
            {
              key: "codigo_atendimento",
              label: "Cód. Atendimento",
              render: (item: any) => (
                <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  {item.codigo_atendimento}
                </span>
              ),
            },
            {
              key: "cpf",
              label: "CPF",
              render: (item: any) => <span className="inline-block whitespace-nowrap text-xs">{item.cpf}</span>,
            },
            {
              key: "rg",
              label: "RG",
              render: (item: any) => <span className="inline-block whitespace-nowrap text-xs">{item.rg}</span>,
            },
            {
              key: "telefone",
              label: "Telefone",
              render: (item: any) => <span className="inline-block whitespace-nowrap text-xs">{item.telefone}</span>,
            },
            {
              key: "endereco",
              label: "Endereço",
              render: (item: any) => (
                <span className="inline-block whitespace-nowrap text-xs text-slate-400">
                  {item.endereco || "—"}
                </span>
              ),
            },
          ]}
          data={pacientesOrdenados}
          onEdit={handleEdit}
          onDelete={handleDelete}
          emptyLabel="Nenhum paciente cadastrado."
        />
      )}
    </div>
  );
}

