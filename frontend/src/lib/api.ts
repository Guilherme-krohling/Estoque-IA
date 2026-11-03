const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

export interface LoginData {
  email: string;
  senha: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("laurus_token");
}

export function setToken(token: string) {
  localStorage.setItem("laurus_token", token);
}

export function clearToken() {
  localStorage.removeItem("laurus_token");
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error(
      "Servidor (Backend) offline ou inacessível. Certifique-se de que o Uvicorn está rodando em http://localhost:8000."
    );
  }

  if (!response.ok) {
    let errorMsg = `Erro ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.detail) {
        errorMsg =
          typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
      }
    } catch {
      /* ignore */
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

// =====================================================================
// AUTH
// =====================================================================
export const authApi = {
  login: (data: LoginData) =>
    fetchApi<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  registrar: (data: { nome: string; email: string; senha: string; perfil?: string }) =>
    fetchApi("/auth/registrar", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// =====================================================================
// CATEGORIAS
// =====================================================================
export const categoriasApi = {
  listar: () => fetchApi<any[]>("/categorias/"),
  buscar: (id: number) => fetchApi<any>(`/categorias/${id}`),
  criar: (data: any) =>
    fetchApi("/categorias/", { method: "POST", body: JSON.stringify(data) }),
  atualizar: (id: number, data: any) =>
    fetchApi(`/categorias/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletar: (id: number) =>
    fetchApi(`/categorias/${id}`, { method: "DELETE" }),
};

// =====================================================================
// MATERIAIS
// =====================================================================
export const materiaisApi = {
  listar: () => fetchApi<any[]>("/materiais/"),
  buscar: (id: number) => fetchApi<any>(`/materiais/${id}`),
  criar: (data: any) =>
    fetchApi("/materiais/", { method: "POST", body: JSON.stringify(data) }),
  atualizar: (id: number, data: any) =>
    fetchApi(`/materiais/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletar: (id: number) =>
    fetchApi(`/materiais/${id}`, { method: "DELETE" }),
};

// =====================================================================
// LOTES
// =====================================================================
export const lotesApi = {
  listar: () => fetchApi<any[]>("/lotes/"),
  buscar: (id: number) => fetchApi<any>(`/lotes/${id}`),
  porMaterial: (materialId: number) =>
    fetchApi<any[]>(`/lotes/material/${materialId}`),
  criar: (data: any) =>
    fetchApi("/lotes/", { method: "POST", body: JSON.stringify(data) }),
  atualizar: (id: number, data: any) =>
    fetchApi(`/lotes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletar: (id: number) =>
    fetchApi(`/lotes/${id}`, { method: "DELETE" }),
};

// =====================================================================
// MOVIMENTAÇÕES
// =====================================================================
export const movimentacoesApi = {
  listar: (params?: { tipo?: string; lote_id?: number; usuario_id?: number; material_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.tipo) qs.set("tipo", params.tipo);
    if (params?.lote_id) qs.set("lote_id", String(params.lote_id));
    if (params?.usuario_id) qs.set("usuario_id", String(params.usuario_id));
    if (params?.material_id) qs.set("material_id", String(params.material_id));
    const q = qs.toString();
    return fetchApi<any[]>(`/movimentacoes/${q ? `?${q}` : ""}`);
  },
  buscar: (id: number) => fetchApi<any>(`/movimentacoes/${id}`),
  porLote: (loteId: number) =>
    fetchApi<any[]>(`/movimentacoes/lote/${loteId}`),
  criar: (data: any) =>
    fetchApi("/movimentacoes/", { method: "POST", body: JSON.stringify(data) }),
  estornar: (id: number) =>
    fetchApi(`/movimentacoes/${id}/estornar`, { method: "POST" }),
};

// =====================================================================
// RELATÓRIOS
// =====================================================================
export const relatoriosApi = {
  estoqueCritico: () => fetchApi<any[]>("/relatorios/estoque-critico"),
  reposicao: () => fetchApi<any>("/relatorios/reposicao"),
  lotesVencendo: (dias = 60) => fetchApi<any[]>(`/relatorios/lotes-vencendo?dias=${dias}`),
  lotesVencidos: () => fetchApi<any[]>("/relatorios/lotes-vencidos"),
};

// =====================================================================
// FORNECEDORES
// =====================================================================
export const fornecedoresApi = {
  listar: () => fetchApi<any[]>("/fornecedores/"),
  buscar: (id: number) => fetchApi<any>(`/fornecedores/${id}`),
  criar: (data: any) =>
    fetchApi("/fornecedores/", { method: "POST", body: JSON.stringify(data) }),
  atualizar: (id: number, data: any) =>
    fetchApi(`/fornecedores/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deletar: (id: number) =>
    fetchApi(`/fornecedores/${id}`, { method: "DELETE" }),
};

// =====================================================================
// LOCAIS DE ARMAZENAMENTO
// =====================================================================
export const locaisApi = {
  listar: () => fetchApi<any[]>("/locais/"),
  buscar: (id: number) => fetchApi<any>(`/locais/${id}`),
  criar: (data: any) =>
    fetchApi("/locais/", { method: "POST", body: JSON.stringify(data) }),
  atualizar: (id: number, data: any) =>
    fetchApi(`/locais/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletar: (id: number) =>
    fetchApi(`/locais/${id}`, { method: "DELETE" }),
};

// =====================================================================
// DOENÇAS
// =====================================================================
export const doencasApi = {
  listar: () => fetchApi<any[]>("/doencas/"),
  buscar: (id: number) => fetchApi<any>(`/doencas/${id}`),
  criar: (data: any) =>
    fetchApi("/doencas/", { method: "POST", body: JSON.stringify(data) }),
  atualizar: (id: number, data: any) =>
    fetchApi(`/doencas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletar: (id: number) =>
    fetchApi(`/doencas/${id}`, { method: "DELETE" }),
};

// =====================================================================
// USUÁRIOS
// =====================================================================
export const usuariosApi = {
  me: () => fetchApi<any>("/usuarios/me"),
  listar: () => fetchApi<any[]>("/usuarios/"),
  desativar: (id: number) =>
    fetchApi(`/usuarios/${id}/desativar`, { method: "PATCH" }),
  ativar: (id: number) =>
    fetchApi(`/usuarios/${id}/ativar`, { method: "PATCH" }),
};

// =====================================================================
// IA & ANÁLISE ALGORÍTMICA — Motor de Estoque + Prophet + Snapshots
// =====================================================================
export const iaApi = {
  /** GET /api/ia/cobertura/{material_id} — cobertura de um material */
  coberturaMaterial: (materialId: number) =>
    fetchApi<any>(`/ia/cobertura/${materialId}`),

  /** GET /api/ia/cobertura — cobertura de todos os materiais ativos */
  coberturaGeral: (apenasCriticos = false) =>
    fetchApi<any[]>(`/ia/cobertura?apenas_criticos=${apenasCriticos}`),

  /** GET /api/ia/previsao — previsão Prophet de todos os materiais com dados */
  previsaoGeral: () =>
    fetchApi<any[]>("/ia/previsao"),

  /** GET /api/ia/previsao/material/{id} — previsão Prophet de um material */
  previsaoMaterial: (materialId: number, horizonteDias = 56) =>
    fetchApi<any>(`/ia/previsao/material/${materialId}?horizonte_dias=${horizonteDias}`),

  /** POST /api/ia/justificativa — justificativa tecnica via Gemini */
  gerarJustificativa: (body: {
    material_ids: number[];
    doenca_nome?: string;
    contexto_epidemiologico?: string;
  }) =>
    fetchApi<any>("/ia/justificativa", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** GET /api/ia/previsao-epidemiologica — previsão semanal Prophet por doença e localidade */
  previsaoEpidemiologica: (params: {
    doenca?: string;
    localidades?: string;
    horizonte_semanas?: number;
    periodo_historico_meses?: number;
    data_inicio?: string;
    data_fim?: string;
    modo?: string;
    faixa_etaria?: string;
    sexo?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.doenca) query.set("doenca", params.doenca);
    if (params.localidades) query.set("localidades", params.localidades);
    if (params.horizonte_semanas) query.set("horizonte_semanas", String(params.horizonte_semanas));
    if (params.periodo_historico_meses) query.set("periodo_historico_meses", String(params.periodo_historico_meses));
    if (params.data_inicio) query.set("data_inicio", params.data_inicio);
    if (params.data_fim) query.set("data_fim", params.data_fim);
    if (params.modo) query.set("modo", params.modo);
    if (params.faixa_etaria) query.set("faixa_etaria", params.faixa_etaria);
    if (params.sexo) query.set("sexo", params.sexo);
    return fetchApi<any>(`/ia/previsao-epidemiologica?${query.toString()}`);
  },

  /** POST /api/ia/previsoes-salvas — salva um snapshot completo da previsão epidemiológica */
  salvarPrevisao: (body: {
    titulo: string;
    doenca: string;
    localidades: string[];
    data_inicio: string;
    data_fim: string;
    horizonte_semanas: number;
    modo: string;
    faixa_etaria: string;
    sexo: string;
    casos_recentes: number;
    casos_previstos: number;
    casos_dengue_previstos: number;
    casos_influenza_previstos: number;
    mudanca_esperada_pct: number;
    pico_data?: string | null;
    pico_casos: number;
    tendencia: string;
    grau_confianca: number;
    dados_completos: any;
  }) =>
    fetchApi<any>("/ia/previsoes-salvas", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** GET /api/ia/previsoes-salvas — lista as previsões epidemiológicas salvas */
  listarPrevisoesSalvas: () => fetchApi<any[]>("/ia/previsoes-salvas"),

  /** GET /api/ia/previsoes-salvas/{id} — retorna o snapshot completo de uma previsão salva */
  obterPrevisaoSalva: (id: number) => fetchApi<any>(`/ia/previsoes-salvas/${id}`),

  /** DELETE /api/ia/previsoes-salvas/{id} — remove uma previsão salva */
  excluirPrevisaoSalva: (id: number) =>
    fetchApi<any>(`/ia/previsoes-salvas/${id}`, { method: "DELETE" }),

  /** GET /api/ia/analise-estoque — análise matemática determinística (MMP + Regressão + Previsão Salva) */
  analiseEstoqueAlgoritmica: (previsaoId?: number | null) =>
    fetchApi<any>(
      `/ia/analise-estoque${previsaoId ? `?previsao_id=${previsaoId}` : ""}`
    ),

  /** GET /api/ia/cruzamento — cruzamento direto de casos com estoque */
  cruzamentoEstoque: (params: {
    doenca?: string;
    localidades?: string;
    horizonte_semanas?: number;
    modo?: string;
  } = {}) => {
    const query = new URLSearchParams();
    if (params.doenca) query.set("doenca", params.doenca);
    if (params.localidades) query.set("localidades", params.localidades);
    if (params.horizonte_semanas) query.set("horizonte_semanas", String(params.horizonte_semanas));
    if (params.modo) query.set("modo", params.modo);
    return fetchApi<any>(`/ia/cruzamento?${query.toString()}`);
  },

  /** POST /api/ia/assistente/consulta — consulta guiada sem LLM */
  assistenteConsulta: (data: { mensagem: string }) =>
    fetchApi<any>("/ia/assistente/consulta", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// =====================================================================
// PEDIDOS DE REPOSIÇÃO E ENTREGAS PARCIAIS / NF (FASE 4.1)
// =====================================================================
export const pedidosReposicaoApi = {
  listar: (params?: { status?: string; material_id?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.material_id) qs.set("material_id", String(params.material_id));
    const q = qs.toString();
    return fetchApi<any[]>(`/pedidos-reposicao/${q ? `?${q}` : ""}`);
  },
  criar: (data: {
    material_id: number;
    fornecedor_id?: number | null;
    empresa_fornecedora?: string;
    data_pedido?: string;
    quantidade_solicitada: number;
    observacoes?: string;
  }) =>
    fetchApi<any>("/pedidos-reposicao/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  registrarEntrega: (
    pedidoId: number,
    data: {
      numero_nf: string;
      data_recebimento?: string;
      quantidade_entregue: number;
      abastecer_estoque?: boolean;
      lote_id?: number | null;
      numero_lote_recebido?: string;
      data_validade_lote?: string;
      local_id?: number | null;
      observacoes?: string;
    }
  ) =>
    fetchApi<any>(`/pedidos-reposicao/${pedidoId}/entregas`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  cancelar: (pedidoId: number) =>
    fetchApi<any>(`/pedidos-reposicao/${pedidoId}/cancelar`, {
      method: "PATCH",
    }),
};

// =====================================================================
// RASTREABILIDADE POR PACIENTE, CONVÊNIO E EXAMES (FASE 4.2)
// =====================================================================
export const rastreabilidadeApi = {
  listar: (params?: {
    material_id?: number;
    lote_id?: number;
    paciente?: string;
    convenio?: string;
    exame?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.material_id) qs.set("material_id", String(params.material_id));
    if (params?.lote_id) qs.set("lote_id", String(params.lote_id));
    if (params?.paciente) qs.set("paciente", params.paciente);
    if (params?.convenio) qs.set("convenio", params.convenio);
    if (params?.exame) qs.set("exame", params.exame);
    const q = qs.toString();
    return fetchApi<any>(`/rastreabilidade/${q ? `?${q}` : ""}`);
  },
  registrarAtendimento: (data: {
    paciente_nome: string;
    paciente_documento?: string;
    convenio: string;
    codigo_atendimento?: string;
    exames: string[];
    observacoes?: string;
    itens_consumidos: {
      lote_id: number;
      quantidade: number;
      exame_especifico?: string;
    }[];
  }) =>
    fetchApi<any>("/rastreabilidade/atendimentos", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

