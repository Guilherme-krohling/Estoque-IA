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
  return localStorage.getItem("stockia_token");
}

export function setToken(token: string) {
  localStorage.setItem("stockia_token", token);
}

export function clearToken() {
  localStorage.removeItem("stockia_token");
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
