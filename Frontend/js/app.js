const APP = {
    state: {
        categorias: [],
        categoriasMap: {},
        materiais: [],
        lotes: [],
        unifiedItems: [] // Combinação de Material + Lote pra simplificar a UI
    },

    init: async () => {
        APP.bindEvents();
        await APP.loadData();
    },

    bindEvents: () => {
        document.getElementById('itemForm').addEventListener('submit', APP.handleFormSubmit);
        document.getElementById('clearForm').addEventListener('click', APP.resetForm);
        document.getElementById('btnRefresh').addEventListener('click', APP.loadData);
        document.getElementById('seedDemo').addEventListener('click', APP.seedCategoriesMock);
        
        document.getElementById('searchInput').addEventListener('input', () => UI.renderTable(APP.state.unifiedItems, APP.state.categoriasMap));
        document.getElementById('statusFilter').addEventListener('change', () => UI.renderTable(APP.state.unifiedItems, APP.state.categoriasMap));
    },

    loadData: async () => {
        try {
            // Buscando todos os dados em paralelo
            const [categorias, materiais, lotes] = await Promise.all([
                API.getCategorias(),
                API.getMateriais(),
                API.getLotes()
            ]);

            APP.state.categorias = categorias;
            APP.state.categoriasMap = categorias.reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {});
            
            UI.renderCategorias(categorias);

            // Unificando Material e Lote para a tela
            // Pra cada material, buscamos se há um lote associado.
            APP.state.unifiedItems = materiais.map(mat => {
                const matLotes = lotes.filter(l => l.material_id === mat.id);
                // Pegar o primeiro lote por simplicidade no MVP.
                const lotePrincipal = matLotes.length > 0 ? matLotes[0] : null;

                return {
                    id: mat.id, // ID do Material
                    loteId: lotePrincipal ? lotePrincipal.id : null, 
                    nome: mat.nome,
                    categoria_id: mat.categoria_id,
                    quantidade: mat.quantidade_estoque, // backend field
                    minimo: mat.estoque_minimo, // backend field
                    validade: lotePrincipal ? lotePrincipal.data_validade : '',
                    localizacao: mat.localizacao,
                    observacoes: mat.observacoes
                };
            });

            UI.renderTable(APP.state.unifiedItems, APP.state.categoriasMap);
        } catch (e) {
            // Erro já tratado pelo toast dentro do api.js, podemos omitir ou deixar fallback.
            console.error("Falha ao carregar initial state:", e);
        }
    },

    handleFormSubmit: async (event) => {
        event.preventDefault();
        
        const itemId = document.getElementById('itemId').value; // Material ID
        const loteId = document.getElementById('loteId').value;
        const formPayload = {
            nome: document.getElementById('nome').value.trim(),
            categoria_id: parseInt(document.getElementById('categoria').value),
            quantidade_estoque: parseInt(document.getElementById('quantidade').value),
            estoque_minimo: parseInt(document.getElementById('minimo').value),
            localizacao: document.getElementById('localizacao').value.trim(),
            observacoes: document.getElementById('observacoes').value.trim()
        };
        const validadeV = document.getElementById('validade').value;

        try {
            let materialSalvo;

            if (itemId) {
                // Editando item existente
                materialSalvo = await API.updateMaterial(itemId, formPayload);
                
                if (loteId && loteId !== "null") { // Editando o lote tb
                    await API.updateLote(loteId, {
                        numero_lote: `LOTE-${materialSalvo.id}`,
                        data_validade: validadeV,
                        quantidade_atual: formPayload.quantidade_estoque,
                        material_id: materialSalvo.id
                    });
                } else {
                    // Item existia mas ñ tinha lote
                    await API.createLote({
                        numero_lote: `LOTE-${materialSalvo.id}`,
                        data_validade: validadeV,
                        quantidade_atual: formPayload.quantidade_estoque,
                        material_id: materialSalvo.id
                    });
                }
                UI.showToast('Item atualizado com sucesso!');
            } else {
                // Criando item novo
                materialSalvo = await API.createMaterial(formPayload);
                await API.createLote({
                    numero_lote: `LOTE-${materialSalvo.id}`,
                    data_validade: validadeV,
                    quantidade_atual: formPayload.quantidade_estoque,
                    material_id: materialSalvo.id
                });
                UI.showToast('Item cadastrado com sucesso!');
            }

            APP.resetForm();
            await APP.loadData();
        } catch (e) {
            // Falha mostrada no toast
        }
    },

    resetForm: () => {
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('loteId').value = '';
    },

    editItem: (rawItemStr) => {
        const item = JSON.parse(decodeURIComponent(rawItemStr));
        document.getElementById('itemId').value = item.id;
        document.getElementById('loteId').value = item.loteId;
        document.getElementById('nome').value = item.nome;
        document.getElementById('categoria').value = item.categoria_id;
        document.getElementById('quantidade').value = item.quantidade;
        document.getElementById('minimo').value = item.minimo;
        document.getElementById('validade').value = item.validade;
        document.getElementById('localizacao').value = item.localizacao || '';
        document.getElementById('observacoes').value = item.observacoes || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    deleteItem: async (id) => {
        if (!confirm('Deseja realmente excluir este item?')) return;
        try {
            await API.deleteMaterial(id);
            UI.showToast('Item excluído com sucesso');
            APP.loadData();
        } catch (e) { }
    },

    adjustStock: async (material_id, lote_id, amount, currentQuantity) => {
        if (!lote_id) {
            UI.showToast('Lote inexistente para este material. Edite manualmente.', 'error');
            return;
        }
        if (amount < 0 && currentQuantity < Math.abs(amount)) {
            UI.showToast('Estoque insuficiente para a baixa.', 'error');
            return;
        }

        const tipo = amount > 0 ? "Entrada" : "Saida";
        const qtde = Math.abs(amount);
        const motivo = tipo === "Entrada" ? "Ajuste Rápido (Entrada)" : "Ajuste Rápido (Consumo)";

        try {
            await API.createMovimentacao(tipo, qtde, motivo, lote_id);
            UI.showToast(`Movimentação de ${tipo} salva.`);
            APP.loadData();
        } catch (e) {}
    },

    seedCategoriesMock: async () => {
        try {
            await API.createCategoria({ nome: "Analgésico", descricao: "Mocks" });
            await API.createCategoria({ nome: "Antibiótico", descricao: "Mocks" });
            await API.createCategoria({ nome: "Insumo hospitalar", descricao: "Mocks" });
            UI.showToast('Categorias mock geradas com sucesso!');
            APP.loadData();
        } catch (e) {
            UI.showToast('Erro ao criar mocks (talvez já existam).', 'error');
        }
    }
};

window.onload = APP.init;
window.APP = APP; // Exportar pro escopo global p onclick do grid funcionarem
