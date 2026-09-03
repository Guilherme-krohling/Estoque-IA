# StockIA — Status do Projeto e Roadmap

> Documento vivo. Atualize quando uma fase mudar de "em progresso" para "concluído", ou quando o escopo de uma fase futura for redefinido.

Última atualização: **2026-05-28**.

---

## Visão geral

O StockIA é desenvolvido em **3 grandes fases**, deliberadamente sequenciais:

1. **Fase 1 — Fundação (concluída):** stack, autenticação, CRUD básico de todas as entidades.
2. **Fase 2 — Controle de Estoque 100% (em progresso):** robustez do núcleo operacional. **Pré-requisito obrigatório** para a Fase 3.
3. **Fase 3 — Inteligência Artificial (planejada):** Prophet + LLM tradutor + RAG/FISPQ.

A regra fundamental é: **não começar a Fase 3 enquanto a Fase 2 não estiver completa**. Modelos preditivos precisam de dados confiáveis, e dados só são confiáveis com saldo atômico, estoque mínimo, rastreabilidade total e cadastro de doenças completo.

---

## ✅ Fase 1 — Fundação (concluída)

### Backend (FastAPI + SQLAlchemy + Alembic)
- [x] Stack base operando: FastAPI ([Backend/app/main.py](Backend/app/main.py)), Uvicorn, SQLAlchemy, Alembic.
- [x] Conexão configurável SQLite (dev) / PostgreSQL (produção) em [Backend/app/db/database.py](Backend/app/db/database.py).
- [x] Migration inicial aplicada: `257f2087c97b_initial_schema_7_tabelas` ([Backend/alembic/versions/](Backend/alembic/versions/)).
- [x] **Autenticação JWT completa** em [Backend/app/core/security.py](Backend/app/core/security.py):
  - Hash bcrypt de senhas (`hash_senha`, `verificar_senha`).
  - Geração e validação de tokens (`criar_token_acesso`, `get_current_user`).
  - Dependency `require_admin` para rotas restritas.
- [x] CORS liberado para o frontend (localhost:3000).

### Endpoints (todos com proteção JWT)
- [x] `/api/auth` — registro + login ([auth.py](Backend/app/api/endpoints/auth.py)).
- [x] `/api/usuarios` — CRUD ([usuarios.py](Backend/app/api/endpoints/usuarios.py)).
- [x] `/api/categorias` — CRUD ([categorias.py](Backend/app/api/endpoints/categorias.py)).
- [x] `/api/materiais` — CRUD com soft delete ([materiais.py](Backend/app/api/endpoints/materiais.py)).
- [x] `/api/lotes` — CRUD com ordenação FEFO no `listar` ([lotes.py](Backend/app/api/endpoints/lotes.py)).
- [x] `/api/movimentacoes` — POST com soma/subtração do saldo do lote + bloqueio de USO em lote vencido ([movimentacoes.py](Backend/app/api/endpoints/movimentacoes.py)).
- [x] `/api/fornecedores` — CRUD ([fornecedores.py](Backend/app/api/endpoints/fornecedores.py)).
- [x] `/api/doencas` — CRUD ([doencas.py](Backend/app/api/endpoints/doencas.py)).

### Frontend (Next.js + TypeScript + Tailwind)
- [x] Login JWT com persistência ([login/page.tsx](frontend/src/app/login/page.tsx), [AuthContext](frontend/src/contexts/AuthContext.tsx)).
- [x] Layout do dashboard com Sidebar e controle de acesso por perfil ([Sidebar.tsx](frontend/src/components/Sidebar.tsx)).
- [x] Estética *glassmorphism* aplicada e consistente.
- [x] Páginas funcionais:
  - **Dashboard** — cards de contadores ([dashboard/page.tsx](frontend/src/app/dashboard/page.tsx)).
  - **Estoque** — workspace unificado: cadastro de Material/Lote + grid operacional com botões + / − para entrada/uso direto ([estoque/page.tsx](frontend/src/app/dashboard/estoque/page.tsx)).
  - **Auditoria** — histórico de movimentações ([auditoria/page.tsx](frontend/src/app/dashboard/auditoria/page.tsx)).
  - **Configurações** — tabs de Categorias, Fornecedores, Doenças, e Equipe (ADMIN only) ([configuracoes/page.tsx](frontend/src/app/dashboard/configuracoes/page.tsx)).

### Documentação
- [x] [README.md](README.md) atualizado com origem científica, arquitetura, modelo de dados melhorado (seção 4) e roadmap de IA com Prophet primeiro (seção 6).
- [x] [MIGRATIONS.md](MIGRATIONS.md) com DDL completo do estado final + 8 migrations Alembic ordenadas.

---

## 🔎 Diagnóstico de código — 2026-05-28

Auditoria do estado **real** do repositório (não dos docs), feita lendo backend, frontend e schema. Resumo: o banco ainda está na migration inicial de 7 tabelas; o frontend foi reorganizado em 3 telas (Estoque, Auditoria, Configurações). O hash de senha (bcrypt) e o JWT estão corretos. Os itens abaixo são o que falta para o estoque ser confiável.

### Segurança
- 🔴 **Escalonamento de privilégio:** `/api/auth/registrar` é público e aceita `perfil` no corpo ([auth.py:21](Backend/app/api/endpoints/auth.py#L21), [usuario_schema.py:6](Backend/app/schemas/usuario_schema.py#L6)) — qualquer um cria conta ADMIN pela API.
- 🔴 **SECRET_KEY com fallback inseguro** `"chave-padrao-insegura"` ([security.py:26](Backend/app/core/security.py#L26)) — tokens forjáveis se a env faltar.
- 🟡 Senha sem `min_length` no backend e email como `str` (não `EmailStr`) nos schemas.
- 🟡 Credencial padrão exposta na tela de login ([login/page.tsx:89](frontend/src/app/login/page.tsx#L89)).
- ⚪ Sem rate-limit no login; token em `localStorage`. Aceitável no escopo atual.
- ℹ️ "Criptografia no login" = responsabilidade do **HTTPS/TLS no deploy** (hoje dev é HTTP). Não se deve hashear senha no frontend — é antipadrão. Nenhum código a mudar aqui além de publicar sob TLS.

### Integridade do estoque
- 🔴 **Entrada inicial de lote não gera movimentação** ([estoque/page.tsx:46](frontend/src/app/dashboard/estoque/page.tsx#L46)) — saldo entra sem trilha de auditoria, fura o compliance.
- 🔴 **Sem fluxo de DESCARTE/AJUSTE na UI** — Estoque só tem `+`(ENTRADA) e `−`(USO); lote vencido bloqueia USO mas não há botão de descarte.
- 🟡 `AJUSTE` sempre subtrai ([movimentacoes.py:62](Backend/app/api/endpoints/movimentacoes.py#L62)); deveria somar ou subtrair.
- 🟡 `quantidade` aceita 0/negativo (sem `gt=0` no schema nem CHECK no banco).
- 🟡 FK inválida → 500 cru; falta tratamento e handler global de erros.
- 🟡 Contratos front↔back quebrados: `codigo_barras` enviado mas schema espera `codigo_catalogo` (campo nunca salvo); `classe_risco` número vs string; `temperatura_*` enviada como `""`; `estoque_minimo` lido no front mas inexistente no modelo (alerta crítico fixo em 5).

### Tabelas e telas
- Todas as 7 tabelas + associativa estão em uso (nenhuma morta). Falta criar `locais_armazenamento` e os campos novos (estoque_minimo, unidade_medida, local_id, estorno_de_id, sazonalidade).
- **Auditoria** não mostra **quem** fez a movimentação nem o material/lote — sendo o núcleo do compliance. Sem filtros, sem estornos.
- **Dashboard** só conta registros; faltam alertas (crítico, vencendo, vencidos com saldo).

### Arquitetura
- Backend bem separado; lógica de saldo no endpoint (extrair *service* ao chegar transferência/estorno). Front tipa tudo como `any`. Sem testes, sem `.env.example`.
- ⚠️ [frontend/AGENTS.md](frontend/AGENTS.md): esta versão do Next.js tem breaking changes — consultar `node_modules/next/dist/docs/` antes de implementar telas.

### Plano de ondas (sequência de execução para fechar o estoque) — ✅ IMPLEMENTADO em 2026-05-28

- [x] **Onda 0 — Segurança**: `/registrar` agora exige ADMIN; `SECRET_KEY` obrigatório (falha no boot se ausente) + `.env.example`; senha `min_length=8` e `EmailStr`; `perfil` restrito a Literal; credencial removida da tela de login.
- [x] **Onda 1 — Integridade do núcleo**: lote nasce com saldo 0 e a abertura vira movimentação `ENTRADA`; botões ENTRADA/USO/DESCARTE/AJUSTE/Transferência na tela; `AJUSTE` define o saldo (contagem); `quantidade > 0` (AJUSTE aceita 0); contratos front↔back corrigidos (`codigo_catalogo`, `classe_risco` texto, temperatura nula); validação de FK + handler global de `IntegrityError`.
- [x] **Onda 2 — Schema/Locais** (migration única `b2f1a9c4d7e3`, aplicada no Postgres): `unidade_medida`/`fator_conversao`/`estoque_minimo`/`estoque_maximo` no material; tabela `locais_armazenamento` (+ seed "Depósito Principal" + backfill); `lotes.local_id`; `/api/locais` CRUD; aba Locais; coluna Local na grid; transferência entre locais com validação de cadeia de frio; índices FEFO e tipo/data.
- [x] **Onda 3 — Auditoria/compliance**: auditoria mostra usuário, material/lote, filtro por tipo e estornos (com strike-through); `estorno_de_id` + endpoint `POST /movimentacoes/{id}/estornar` (cria o inverso, nunca DELETE); `/api/relatorios/estoque-critico|lotes-vencendo|lotes-vencidos`; dashboard com 3 cards de alerta reais.
- [x] **Onda 4 — Qualidade**: 8 testes pytest do núcleo (saldo, bloqueio de vencido, ajuste, estorno, registro fechado) passando com SQLite isolado; frontend com `tsc --noEmit` limpo; `.env.example` documentado.

**Decisões aplicadas nesta entrega:** `classe_risco` = texto (Comum/Biológico/Químico/Inflamável); criação de usuário só por ADMIN; campos epidemiológicos das doenças (sazonalidade/meses_pico/qtd_por_exame) **adiados para a Fase 3**; `AJUSTE` define o saldo (diverge do trigger somador do MIGRATIONS.md — documentado aqui).

**Ainda em aberto (opcional, fora do núcleo):** importação CSV/XLSX, relatório de consumo exportável, notificação por e-mail, testes e2e (Playwright), trigger de saldo no banco (hoje a consistência é garantida na camada de serviço dentro de transação).

> As subseções 2.1–2.5 abaixo são o detalhamento original do planejamento; o que foi entregue está resumido nas ondas acima.

---

## 🔄 Fase 2 — Controle de Estoque (núcleo concluído em 2026-05-28; extras opcionais pendentes)

**Objetivo:** transformar o sistema de "funciona pra cadastrar coisas" em "operacionalmente confiável para um laboratório real". Sem essa fase, o módulo de IA não tem onde se apoiar.

> Estado: o núcleo operacional (segurança, integridade do saldo, locais, transferência, auditoria com estorno, alertas) foi implementado e validado (8 testes + smoke contra Postgres). Falta validação manual do usuário rodando o app, e os extras opcionais listados nas ondas acima.

### 2.1. Evolução do schema (migrations pendentes)

Todas as migrations estão documentadas em [MIGRATIONS.md](MIGRATIONS.md). Aplicar **na ordem listada**:

- [ ] **Migration 1** — `add_unidade_medida_e_estoque_minimo_em_material`
  - Move `unidade_medida` para `materiais` (canônica).
  - Adiciona `fator_conversao`, `estoque_minimo`, `estoque_maximo`.
- [ ] **Migration 2** — `criar_tabela_locais_armazenamento` + seed de "Depósito Principal".
- [ ] **Migration 3** — `vincular_lote_ao_local_armazenamento` (FK `local_id` em `lotes`).
- [ ] **Migration 4** — `expandir_doencas_com_sazonalidade` (`sazonalidade`, `meses_pico`, `regiao_endemica`, `quantidade_media_por_exame` na associativa).
- [ ] **Migration 5** — `expandir_movimentacoes_com_transferencia_e_estorno` (tipo `TRANSFERENCIA`, `local_origem_id`, `local_destino_id`, `estorno_de_id`, `CHECK quantidade > 0`).
- [ ] **Migration 6** — `trigger_atualiza_saldo_lote` (consistência atômica do saldo; backup antes!).
- [ ] **Migration 7** — `indices_e_constraints_finais` (índice FEFO, CHECK temperatura/estoque, normalização CNPJ).
- [ ] **Migration 8** *(opcional)* — `auditoria_de_cadastro` (`atualizado_em`, `atualizado_por_id` em materiais/lotes/fornecedores).

### 2.2. Ajustes no backend (acompanhando as migrations)

- [ ] **Models** ([Backend/app/models/models.py](Backend/app/models/models.py)) atualizados com os novos campos.
- [ ] **Schemas Pydantic** ([Backend/app/schemas/](Backend/app/schemas/)) atualizados — `material_schema.py` ganha `unidade_medida`/`estoque_minimo`, `doenca_schema.py` ganha `sazonalidade`/`meses_pico`, `movimentacao_schema.py` ganha campos de transferência/estorno.
- [ ] **Endpoint `/api/movimentacoes`** ([movimentacoes.py:37](Backend/app/api/endpoints/movimentacoes.py#L37)) tratando:
  - Tipo `TRANSFERENCIA` (valida origem ≠ destino, não altera quantidade).
  - Estorno via `estorno_de_id` (cria movimentação inversa, nunca DELETE).
  - Remoção do parâmetro `unidade_medida` no request (passa a vir do material).
- [ ] **Novo endpoint `/api/locais`** — CRUD de locais de armazenamento.
- [ ] **Novo endpoint `/api/relatorios/estoque-critico`** — lista materiais com `quantidade_total < estoque_minimo` (alimenta o dashboard de alertas).
- [ ] **Novo endpoint `/api/relatorios/fefo`** — para um material, retorna lotes ordenados por validade com saldo > 0 (consumo em ordem correta).
- [ ] **Validação de cadeia de frio** — ao criar movimentação `ENTRADA` ou `TRANSFERENCIA`, se o material `exige_refrigeracao = true`, o `local_destino` precisa ser do tipo `REFRIGERADO` ou `CONGELADO`.

### 2.3. Ajustes no frontend

- [ ] **Página de Estoque** ([estoque/page.tsx](frontend/src/app/dashboard/estoque/page.tsx)):
  - Formulário de Material com novos campos (`unidade_medida`, `estoque_minimo`).
  - Coluna de "Local" na grid de lotes.
  - Indicador visual quando `quantidade_total < estoque_minimo` (já tem cor crítica, falta o valor real do limite).
  - Botão de **transferência** entre locais.
- [ ] **Configurações** ([configuracoes/page.tsx](frontend/src/app/dashboard/configuracoes/page.tsx)):
  - Nova tab **Locais de Armazenamento**.
  - Tab Doenças ampliada com `sazonalidade`, `meses_pico`, `regiao_endemica`.
  - Tab Materiais ↔ Doenças: vincular materiais a doenças e informar `quantidade_media_por_exame`.
- [ ] **Auditoria** ([auditoria/page.tsx](frontend/src/app/dashboard/auditoria/page.tsx)):
  - Filtros por tipo, data, usuário, material.
  - Visualização de estornos (mostrar lançamento anulado em strikethrough).
- [ ] **Dashboard** ([dashboard/page.tsx](frontend/src/app/dashboard/page.tsx)):
  - Card de **alertas críticos** (estoque baixo + lotes vencendo em ≤30 dias).
  - Card de **lotes vencidos** que ainda têm saldo (precisam descarte).

### 2.4. Funcionalidades operacionais ainda faltando

- [ ] **Importação em lote** (CSV ou XLSX) para cadastro inicial de materiais e lotes.
- [ ] **Inventário cíclico** — fluxo guiado para contagem física com geração automática de movimentações `AJUSTE`.
- [ ] **Relatório de consumo mensal por categoria/material** (exportável em PDF/Excel).
- [ ] **Notificação por e-mail** quando um material atinge estoque mínimo (usar fila simples ou cron).
- [ ] **Política de senhas** — força mínima no registro, troca obrigatória no primeiro login.

### 2.5. Qualidade técnica

- [ ] Testes automatizados do backend (pytest) — pelo menos:
  - Fluxo de entrada/uso/descarte atualizando saldo corretamente.
  - Bloqueio de USO em lote vencido.
  - Estorno funcionando (movimentação original permanece, saldo é revertido).
  - Validação de cadeia de frio em transferência.
- [ ] Testes do frontend (Playwright ou Cypress) — fluxo crítico: login → criar material → criar lote → registrar uso → ver na auditoria.
- [ ] Configuração de `.env.example` documentando todas as variáveis (SECRET_KEY, DATABASE_URL, etc).
- [ ] Hardening do `SECRET_KEY` — hoje cai em `"chave-padrao-insegura"` se a env não estiver definida ([security.py:26](Backend/app/core/security.py#L26)). Fazer falhar explicitamente em produção.

---

## 🔮 Fase 3 — Inteligência Artificial (planejada)

**Pré-requisitos antes de começar:**
- Fase 2 100% concluída.
- ≥6 meses de movimentações reais do tipo `USO` registradas no banco.
- Doenças cadastradas com `meses_pico` preenchidos.
- Associação `materiais_doencas.quantidade_media_por_exame` preenchida para os reagentes principais.

### 3.1. Prophet univariado (motor inicial)
- [ ] Adicionar dependência `prophet` no backend.
- [ ] Job noturno (rotina assíncrona ou cron externo) que, para cada material com histórico ≥6 meses:
  1. Lê movimentações `USO` agregadas por semana.
  2. Treina um Prophet com sazonalidade anual.
  3. Salva previsão das próximas 8-12 semanas em tabela `previsoes_demanda` (a criar).
  4. Calcula data estimada de zeragem do estoque considerando saldo atual + entradas previstas.
- [ ] Endpoint `/api/previsao/material/{id}` — retorna a previsão mais recente.
- [ ] Card no dashboard mostrando materiais com previsão de zeragem em ≤30 dias.

### 3.2. Prophet com regressores externos
- [ ] Integração com **InfoDengue** (API pública) — séries de casos por região.
- [ ] Integração com **SINAN** (boletim de notificação) — incidência histórica.
- [ ] Integração climática (**INMET** ou **CPTEC**) — temperatura, chuva, umidade.
- [ ] No treino, adicionar `model.add_regressor()` para cada série externa relevante à doença associada ao material.
- [ ] Backtest: comparar previsão com e sem regressores em amostra de validação.

### 3.3. LSTM (benchmark opcional)
- [ ] Apenas executar se houver ≥24 meses de dados densos.
- [ ] Critério de adoção: ganho de precisão (MAPE/RMSE) > 15% em backtest vs Prophet 3.2.
- [ ] Se adotado, manter Prophet como fallback para materiais com histórico curto.

### 3.4. Camada generativa (LLM tradutor)
- [ ] Adicionar SDK do **Gemini** (ou OpenAI, conforme decisão).
- [ ] Endpoint `/api/insights/{material_id}` que:
  1. Lê a previsão numérica do Prophet.
  2. Lê o cenário epidemiológico atual (InfoDengue da região).
  3. Monta prompt estruturado com contexto.
  4. Retorna recomendação em linguagem natural.
- [ ] **Importante:** o LLM nunca decide o que prever — só explica. A "decisão matemática" sempre vem do Prophet, para preservar auditabilidade.
- [ ] Card no dashboard exibindo o insight gerado, com botão "ver dados brutos da previsão".

### 3.5. RAG de FISPQ (componente paralelo)
- [ ] Upload de FISPQ (PDF) por material.
- [ ] Pipeline: extração de texto → chunking → embeddings → armazenamento em vector store (pgvector ou Chroma).
- [ ] Endpoint `/api/fispq/{material_id}/perguntar` recebendo a pergunta em texto.
- [ ] Resposta com citação obrigatória da seção da FISPQ que fundamenta — zero alucinação tolerada.

---

## Sequência sugerida para a Fase 2

Pra evitar trabalho duplicado e não destravar o frontend prematuramente:

1. **Migrations 1, 2, 3, 7** em sequência (são as menos invasivas, dão base para o resto).
2. **Models + Schemas + endpoints novos** acompanhando essas migrations.
3. **Frontend: campos novos no formulário de material** e tab de locais.
4. **Migrations 4 e 5** (doenças completas + transferência/estorno).
5. **Endpoint e UI de transferência e estorno** + filtros na auditoria.
6. **Migration 6** (trigger de saldo) — **só depois** do código estar todo migrado para o novo schema, porque exige backfill e validação cuidadosa.
7. **Funcionalidades operacionais** (2.4) conforme prioridade do laboratório.
8. **Testes** (2.5) — idealmente escrever conforme implementa, não no final.

Quando os 8 blocos acima estiverem fechados, a Fase 2 está completa e a Fase 3 pode começar.
