const API_URL = 'http://127.0.0.1:8000/api';

/**
 * Funções base de Fetch com tratamento de erros.
 */
async function fetchApi(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        });

        if (!response.ok) {
            let errorMsg = `Erro ${response.status}: ${response.statusText}`;
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            } catch (e) {}
            throw new Error(errorMsg);
        }

        return await response.json();
    } catch (error) {
        console.error(`Erro na requisição para ${endpoint}:`, error);
        UI.showToast(`Falha de comunicação: ${error.message}`, 'error');
        throw error;
    }
}

const API = {
    // Categorias
    getCategorias: () => fetchApi('/categorias/'),
    createCategoria: (data) => fetchApi('/categorias/', { method: 'POST', body: JSON.stringify(data) }),

    // Materiais
    getMateriais: () => fetchApi('/materiais/'),
    createMaterial: (data) => fetchApi('/materiais/', { method: 'POST', body: JSON.stringify(data) }),
    updateMaterial: (id, data) => fetchApi(`/materiais/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteMaterial: (id) => fetchApi(`/materiais/${id}`, { method: 'DELETE' }),

    // Lotes
    getLotes: () => fetchApi('/lotes/'),
    createLote: (data) => fetchApi('/lotes/', { method: 'POST', body: JSON.stringify(data) }),
    updateLote: (id, data) => fetchApi(`/lotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Movimentações (+1 / -1)
    createMovimentacao: (tipo, quantidade, motivo, lote_id) => {
        return fetchApi('/movimentacoes/', {
            method: 'POST',
            body: JSON.stringify({ tipo, quantidade, motivo, lote_id })
        });
    }
};
