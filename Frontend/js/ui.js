const UI = {
    toastContainer: document.getElementById('toast-container'),

    showToast: (message, type = 'success') => {
        if (!UI.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        UI.toastContainer.appendChild(toast);

        // Remover depois de 4 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    getStatus: (item) => {
        if (item.quantidade <= 0 || item.quantidade <= Math.floor(item.minimo * 0.5)) return 'critico';
        if (item.quantidade <= item.minimo) return 'baixo';
        return 'ok';
    },

    statusMeta: (status) => {
        if (status === 'critico') return { label: 'Crítico', className: 'status-critical' };
        if (status === 'baixo') return { label: 'Estoque baixo', className: 'status-low' };
        return { label: 'Normal', className: 'status-ok' };
    },

    daysToExpire: (dateString) => {
        const today = new Date();
        const target = new Date(dateString + 'T00:00:00');
        const diff = target - new Date(today.getFullYear(), today.getMonth(), today.getDate());
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    },

    formatExpiry: (dateString) => {
        if (!dateString) return '-';
        const days = UI.daysToExpire(dateString);
        if (days < 0) return `Vencido há ${Math.abs(days)} dia(s)`;
        if (days === 0) return 'Vence hoje';
        if (days <= 30) return `${dateString} • ${days} dia(s)`;
        return dateString;
    },

    renderStats: (items) => {
        const statsEl = document.getElementById('stats');
        const totalItens = items.length;
        const totalUnidades = items.reduce((acc, item) => acc + Number(item.quantidade), 0);
        const baixos = items.filter(item => UI.getStatus(item) === 'baixo').length;
        const criticos = items.filter(item => UI.getStatus(item) === 'critico').length;

        statsEl.innerHTML = `
            <div class="stat"><span>Total de itens</span><strong>${totalItens}</strong></div>
            <div class="stat"><span>Total de unidades</span><strong>${totalUnidades}</strong></div>
            <div class="stat"><span>Estoque baixo</span><strong>${baixos}</strong></div>
            <div class="stat"><span>Críticos</span><strong>${criticos}</strong></div>
        `;
    },

    renderCategorias: (categorias) => {
        const select = document.getElementById('categoria');
        select.innerHTML = '<option value="">Selecione</option>';
        categorias.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.id;
            opt.textContent = cat.nome;
            select.appendChild(opt);
        });
    },

    renderTable: (items, categoriasMap) => {
        const tableBody = document.getElementById('inventoryTableBody');
        const emptyState = document.getElementById('emptyState');
        const searchInput = document.getElementById('searchInput');
        const statusFilter = document.getElementById('statusFilter');

        const search = searchInput.value.trim().toLowerCase();
        const filter = statusFilter.value;

        const filtered = items.filter(item => {
            const catName = categoriasMap[item.categoria_id] ? categoriasMap[item.categoria_id].nome : 'Desconhecida';
            const combined = `${item.nome} ${catName} ${item.localizacao}`.toLowerCase();
            const status = UI.getStatus(item);
            
            const matchesSearch = !search || combined.includes(search);
            const matchesFilter = filter === 'todos' || filter === status;
            
            return matchesSearch && matchesFilter;
        }).sort((a, b) => {
            const priority = { critico: 0, baixo: 1, ok: 2 };
            return priority[UI.getStatus(a)] - priority[UI.getStatus(b)];
        });

        UI.renderStats(filtered);
        tableBody.innerHTML = '';

        if (!filtered.length) {
            emptyState.style.display = 'block';
            return;
        }
        emptyState.style.display = 'none';

        filtered.forEach(item => {
            const status = UI.getStatus(item);
            const meta = UI.statusMeta(status);
            const catName = categoriasMap[item.categoria_id] ? categoriasMap[item.categoria_id].nome : 'Desconhecida';

            // Como guardamos os dados no item pro JS facilitar
            const rawItem = encodeURIComponent(JSON.stringify(item));

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <strong>${item.nome}</strong><br>
                    <span class="hint">${item.observacoes || 'Sem observações'}</span>
                </td>
                <td>${catName}</td>
                <td>${item.quantidade}</td>
                <td>${item.minimo}</td>
                <td><span class="pill ${meta.className}">${meta.label}</span></td>
                <td>${UI.formatExpiry(item.validade)}</td>
                <td>${item.localizacao || '-'}</td>
                <td>
                    <div class="mini-actions">
                        <button class="btn-secondary" onclick="APP.adjustStock(${item.id}, ${item.loteId}, 1)">+1</button>
                        <button class="btn-secondary" onclick="APP.adjustStock(${item.id}, ${item.loteId}, -1, ${item.quantidade})">-1</button>
                        <button class="btn-primary" onclick="APP.editItem('${rawItem}')">Editar</button>
                        <button class="btn-danger" onclick="APP.deleteItem(${item.id})">Excluir</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }
};
