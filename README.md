# 🧬 Laurus AI — Gestão Inteligente de Insumos Laboratoriais com IA Preditiva

O **Laurus AI** é uma plataforma full-stack de **gestão de estoque laboratorial** que integra **Inteligência Artificial preditiva** para antecipar surtos epidemiológicos de **Dengue** e **Influenza**, cruzar automaticamente a previsão de casos com o estoque físico do laboratório e alertar sobre risco de ruptura de insumos diagnósticos.

---

## 🎯 O que o sistema faz?

1. **Prevê surtos epidemiológicos** usando o modelo **Prophet** (Meta) treinado em dados reais do DATASUS/SINAN, com horizonte de 4 a 20 semanas.
2. **Cruza automaticamente** a previsão de casos com o estoque físico: `Demanda = Casos Previstos × quantidade_por_exame × 1.20 (margem 20%)`.
3. **Alerta sobre risco de ruptura**: identifica quais materiais terão déficit frente ao pico epidemiológico.
4. **Gera justificativas técnicas de compra** via Google Gemini, prontas para o setor de suprimentos.
5. **Gerencia o estoque laboratorial completo**: materiais, lotes (FEFO), movimentações rastreáveis e auditoria ANVISA.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: Next.js 16 + TailwindCSS + TypeScript + Recharts    │
│  (Dashboard interativo com gráficos preditivos)                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/JSON (JWT)
┌──────────────────────▼──────────────────────────────────────────┐
│  Backend: FastAPI + Python 3 + SQLAlchemy + Prophet             │
│  (Motor preditivo epidemiológico + Motor de estoque)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │ ORM
┌──────────────────────▼──────────────────────────────────────────┐
│  Banco de Dados: SQLite (dev) / PostgreSQL (prod)               │
│  + Tabela dados_epidemiologicos (15M+ registros processados)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Telas do Sistema

| Tela | Descrição | Usa IA? |
|------|-----------|---------|
| **Dashboard** | Visão geral com indicadores de estoque, alertas ativos e link rápido para previsão epidemiológica | ❌ Dados diretos do banco |
| **Estoque** | CRUD completo de materiais e lotes com controle FEFO, validade, classe de risco e cadeia de frio | ❌ Gestão operacional |
| **Reposição** | Sugestões de compra baseadas em estoque mínimo + geração de justificativa técnica via Gemini | ✅ **Gemini 1.5 Flash** |
| **Alertas** | Vencimentos, estoque crítico + previsão de surtos via Prophet com impacto por material | ✅ **Prophet** |
| **Previsão Epidemiológica** | Gráfico interativo de comportamento e previsão de casos, filtros por doença/localidade/período, cruzamento automático com estoque | ✅ **Prophet** |
| **Assistente IA** | Chatbot com respostas sobre estoque e biossegurança (simulado — fase futura: Gemini + RAG) | 🔜 Planejado |
| **Auditoria** | Rastreabilidade completa de movimentações (ANVISA RDC 302/2005) | ❌ Logs do banco |
| **Configurações** | Gestão de usuários, perfis e preferências | ❌ Administração |

---

## 🔬 A Regra de Ouro da IA

O coração do Laurus AI é a **separação entre previsão estatística e cálculo determinístico**:

```
1. Prophet prevê a curva de CASOS de doenças (Dengue A90 e Influenza J10)
   → Treinado em dados reais do DATASUS/SINAN (2021-2026)
   → Região: Estado de SP + Baixada Santista (7 localidades)

2. A demanda de materiais é derivada deterministicamente:
   Demanda = Casos Previstos × quantidade_por_exame × 1.20

3. O saldo físico atual é cruzado para classificar risco:
   CRÍTICO  → saldo < demanda projetada (ruptura iminente)
   ATENÇÃO  → saldo < demanda × 1.5
   SEGURO   → saldo plenamente dimensionado
```

O modelo de linguagem (Gemini) **nunca calcula saldos ou quantidades**. Ele apenas traduz os resultados do motor de estoque em justificativas técnicas formais.

---

## 📊 Fontes de Dados Epidemiológicos

| Fonte | Dados | Cobertura |
|-------|-------|-----------|
| **DATASUS / SINAN** | Notificações de Dengue (CID A90) | 2021–2026, Estado de SP |
| **DATASUS / SIVEP-Gripe** | Notificações de Influenza (CID J10) | 2021–2026, Estado de SP |
| **InfoDengue (Fiocruz)** | Dados semanais complementares | Baixada Santista |

Os dados brutos foram processados via ETL (15M+ linhas) e armazenados na tabela `dados_epidemiologicos` do banco, agregados por semana epidemiológica, localidade, faixa etária e sexo.

---

## 🚀 Como Executar

### Backend (FastAPI)

```bash
cd Backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python criar_banco.py
python seed_categorias.py
python seed_demo_ia.py         # Popula dados epidemiológicos e vínculos
uvicorn app.main:app --reload
```

> API disponível em http://localhost:8000 | Docs em http://localhost:8000/docs

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

> Abra no navegador: http://localhost:3000

---

## 🧪 Modelo de Dados

O banco possui **10 tabelas principais**:

- **`usuarios`** — Profissionais do laboratório (Admin, Gestor, Técnico, Pesquisador)
- **`fornecedores`** — Cadastro com CNPJ
- **`categorias`** — Classificação de materiais (Reagentes PCR, Vidrarias, etc.)
- **`locais_armazenamento`** — Depósitos com tipo (refrigerado, congelado, ambiente, inflamáveis)
- **`materiais`** — Catálogo com classe de risco, cadeia de frio, estoque mínimo/máximo
- **`lotes`** — Estoque físico real com validade (FEFO), quantidade atualizada por trigger
- **`movimentacoes_estoque`** — Trilha de auditoria imutável (entrada, uso, descarte, ajuste, transferência)
- **`doencas`** — Dengue e Influenza com CID-10, sazonalidade e meses de pico
- **`materiais_doencas`** — Vínculo N:N com multiplicador `quantidade_por_exame`
- **`dados_epidemiologicos`** — Série temporal semanal por localidade, faixa etária e sexo

---

## 📚 Contexto Científico

Projeto fundamentado no estudo apresentado no **COBRIC 2025** (Congresso de Iniciação Científica — Unisanta):

> **"O USO DA INTELIGÊNCIA ARTIFICIAL NA GESTÃO DE INSUMOS LABORATORIAIS E PREVISIBILIDADE DE DOENÇAS EM PERÍODOS SAZONAIS"**
> Curso: Biomedicina

O estudo identificou uma **lacuna na literatura nacional**: modelos de IA para previsão de surtos existem, mas **não se integram aos sistemas de gestão de estoque**. O Laurus AI preenche essa lacuna.

---

## 📁 Estrutura do Projeto

```
Prj-Lab/
├── Backend/                  # API FastAPI + Motor preditivo Prophet
│   ├── app/
│   │   ├── api/endpoints/    # Rotas REST (ia.py, estoque, auth, etc.)
│   │   ├── core/             # previsao_epidemiologica.py (Prophet + cruzamento)
│   │   ├── models/           # SQLAlchemy models
│   │   └── services/         # Lógica de negócio
│   ├── alembic/              # Migrações do banco
│   └── requirements.txt
├── frontend/                 # Next.js 16 + TailwindCSS + Recharts
│   └── src/
│       ├── app/dashboard/    # Todas as telas do painel
│       ├── components/       # Sidebar, Toast, etc.
│       ├── contexts/         # AuthContext (JWT)
│       └── lib/api.ts        # Cliente HTTP com interceptors
└── .gitignore
```

---

## ⚙️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, TailwindCSS, Recharts |
| Backend | Python 3, FastAPI, Uvicorn, SQLAlchemy, Alembic |
| IA Preditiva | Prophet (Meta) — séries temporais com sazonalidade anual |
| IA Generativa | Google Gemini 1.5 Flash — justificativas técnicas |
| Banco de Dados | SQLite (dev) / PostgreSQL (prod) |
| Autenticação | JWT (JSON Web Tokens) |
