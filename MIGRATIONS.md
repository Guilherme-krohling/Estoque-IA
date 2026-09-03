# StockIA — Plano de Migrations

Documento técnico que descreve as alterações de schema necessárias para evoluir o banco do estado atual (migration `257f2087c97b_initial_schema_7_tabelas`) para o modelo descrito na seção 4 do `README.md`.

---

## DDL completo (estado final desejado)

Este é o **alvo** depois que todas as 8 migrations rodarem. É escrito em PostgreSQL — em SQLite, alguns recursos (`SERIAL`, `CHECK` em ALTER, triggers PL/pgSQL) são adaptados pela camada Alembic ou trocados por lógica no service.

```sql
-- =====================================================================
-- 1. USUARIOS
-- =====================================================================
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    senha_hash      VARCHAR(255) NOT NULL,                  -- bcrypt
    perfil          VARCHAR(50) NOT NULL DEFAULT 'PESQUISADOR',
                                                            -- ADMIN | GESTOR | PESQUISADOR
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   TIMESTAMP NULL
);

-- =====================================================================
-- 2. FORNECEDORES
-- =====================================================================
CREATE TABLE fornecedores (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(150) NOT NULL,
    cnpj            VARCHAR(14) UNIQUE,                     -- só dígitos, sem máscara
    contato         VARCHAR(100),
    email           VARCHAR(150),
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em   TIMESTAMP NULL,
    atualizado_por_id INT REFERENCES usuarios(id)
);

-- =====================================================================
-- 3. CATEGORIAS
-- =====================================================================
CREATE TABLE categorias (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(100) NOT NULL UNIQUE,           -- 'Reagentes', 'Consumíveis'
    descricao       TEXT
);

-- =====================================================================
-- 4. LOCAIS DE ARMAZENAMENTO  (NOVO)
-- =====================================================================
CREATE TABLE locais_armazenamento (
    id                 SERIAL PRIMARY KEY,
    nome               VARCHAR(100) NOT NULL,               -- 'Geladeira 2 - Sala B'
    tipo               VARCHAR(50) NOT NULL,                -- REFRIGERADO | CONGELADO | AMBIENTE | INFLAMAVEIS
    temperatura_atual  NUMERIC(5,2) NULL,                   -- leitura sensor IoT (futuro)
    descricao          TEXT,
    ativo              BOOLEAN DEFAULT TRUE,
    criado_em          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 5. MATERIAIS (Catálogo)
-- =====================================================================
CREATE TABLE materiais (
    id                 SERIAL PRIMARY KEY,
    nome               VARCHAR(150) NOT NULL,
    descricao          TEXT,
    categoria_id       INT REFERENCES categorias(id),
    fabricante         VARCHAR(100),
    fornecedor_id      INT REFERENCES fornecedores(id),
    codigo_catalogo    VARCHAR(50),
    classe_risco       VARCHAR(50),                         -- 'Biológico', 'Inflamável', 'Químico'
    exige_refrigeracao BOOLEAN DEFAULT FALSE,
    temperatura_min    NUMERIC(5,2),
    temperatura_max    NUMERIC(5,2),
    unidade_medida     VARCHAR(20) NOT NULL DEFAULT 'un',   -- unidade canônica: 'ml', 'un', 'g'
    fator_conversao    NUMERIC(10,4) DEFAULT 1.0,           -- ex: 1 caixa = 50 un → fator = 50
    estoque_minimo     NUMERIC(10,2) DEFAULT 0,             -- gatilho de alerta de ressuprimento
    estoque_maximo     NUMERIC(10,2) NULL,                  -- teto opcional
    ativo              BOOLEAN DEFAULT TRUE,
    criado_em          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em      TIMESTAMP NULL,
    atualizado_por_id  INT REFERENCES usuarios(id),
    CHECK (temperatura_min IS NULL OR temperatura_max IS NULL OR temperatura_min <= temperatura_max),
    CHECK (estoque_minimo >= 0)
);

-- =====================================================================
-- 6. LOTES (Estoque Físico e Validade — FEFO)
-- =====================================================================
CREATE TABLE lotes (
    id                  SERIAL PRIMARY KEY,
    material_id         INT NOT NULL REFERENCES materiais(id),
    local_id            INT REFERENCES locais_armazenamento(id),
    numero_lote         VARCHAR(50) NOT NULL,
    data_fabricacao     DATE,
    data_validade       DATE NOT NULL,                      -- crucial para FEFO
    certificado_analise VARCHAR(255),                       -- link S3 ou hash
    fornecedor_id       INT REFERENCES fornecedores(id),
    quantidade_atual    NUMERIC(10,2) DEFAULT 0,            -- atualizado via trigger
    ativo               BOOLEAN DEFAULT TRUE,
    criado_em           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em       TIMESTAMP NULL,
    atualizado_por_id   INT REFERENCES usuarios(id),
    CHECK (quantidade_atual >= 0),
    CHECK (data_fabricacao IS NULL OR data_validade >= data_fabricacao)
);

CREATE INDEX idx_lotes_material_validade ON lotes(material_id, data_validade);

-- =====================================================================
-- 7. MOVIMENTACOES_ESTOQUE (Fonte da Verdade — Auditoria + IA)
-- =====================================================================
CREATE TABLE movimentacoes_estoque (
    id                SERIAL PRIMARY KEY,
    lote_id           INT NOT NULL REFERENCES lotes(id),
    usuario_id        INT NOT NULL REFERENCES usuarios(id),
    tipo              VARCHAR(20) NOT NULL,
                      -- ENTRADA | USO | DESCARTE | AJUSTE | TRANSFERENCIA
    quantidade        NUMERIC(10,2) NOT NULL,
    local_origem_id   INT REFERENCES locais_armazenamento(id),    -- usado em USO e TRANSFERENCIA
    local_destino_id  INT REFERENCES locais_armazenamento(id),    -- usado em ENTRADA e TRANSFERENCIA
    motivo            VARCHAR(255),                               -- 'Validade vencida', 'Uso diário'
    referencia        VARCHAR(100),                               -- NF ou número de pedido
    estorno_de_id     INT REFERENCES movimentacoes_estoque(id),   -- anula outro lançamento
    criado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantidade > 0),
    CHECK (tipo IN ('ENTRADA', 'USO', 'DESCARTE', 'AJUSTE', 'TRANSFERENCIA')),
    CHECK (
        tipo <> 'TRANSFERENCIA'
        OR (local_origem_id IS NOT NULL
            AND local_destino_id IS NOT NULL
            AND local_origem_id <> local_destino_id)
    )
);

CREATE INDEX idx_movimentacoes_lote_data ON movimentacoes_estoque(lote_id, criado_em);
CREATE INDEX idx_movimentacoes_tipo_data ON movimentacoes_estoque(tipo, criado_em);

-- =====================================================================
-- 8. DOENCAS
-- =====================================================================
CREATE TABLE doencas (
    id               SERIAL PRIMARY KEY,
    nome             VARCHAR(150) NOT NULL UNIQUE,
    cid_codigo       VARCHAR(10),                           -- CID-10, ex: 'A90' (Dengue)
    descricao        TEXT,
    sazonalidade     VARCHAR(50),                           -- VERAO_CHUVOSO | INVERNO | ANO_TODO
    meses_pico       VARCHAR(50),                           -- CSV: '1,2,3' (jan-fev-mar)
    regiao_endemica  VARCHAR(100),                          -- SUDESTE | NORDESTE | ...
    ativo            BOOLEAN DEFAULT TRUE,
    criado_em        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================================
-- 9. ASSOCIATIVA — Material <-> Doença (N:N enriquecida)
-- =====================================================================
CREATE TABLE materiais_doencas (
    material_id                INT NOT NULL REFERENCES materiais(id) ON DELETE CASCADE,
    doenca_id                  INT NOT NULL REFERENCES doencas(id)   ON DELETE CASCADE,
    quantidade_media_por_exame NUMERIC(10,2),                        -- multiplicador para previsão
    PRIMARY KEY (material_id, doenca_id)
);

-- =====================================================================
-- TRIGGER — Atualiza saldo do lote a cada movimentação (PostgreSQL)
-- =====================================================================
CREATE OR REPLACE FUNCTION atualiza_saldo_lote()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo IN ('ENTRADA', 'AJUSTE') THEN
        UPDATE lotes SET quantidade_atual = quantidade_atual + NEW.quantidade
        WHERE id = NEW.lote_id;
    ELSIF NEW.tipo IN ('USO', 'DESCARTE') THEN
        UPDATE lotes SET quantidade_atual = quantidade_atual - NEW.quantidade
        WHERE id = NEW.lote_id;
    END IF;
    -- TRANSFERENCIA não altera quantidade, só o local_id do lote (lógica no service).
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_saldo_lote
AFTER INSERT ON movimentacoes_estoque
FOR EACH ROW EXECUTE FUNCTION atualiza_saldo_lote();
```

---

Cada item abaixo deve virar uma migration Alembic separada, na ordem listada. As migrations são incrementais e **devem rodar em ambiente de dev primeiro** com o SQLite local (`stockai.db`) antes de qualquer ambiente compartilhado.

---

## Convenções

- Nomeação: `NNN_descricao_curta.py` (Alembic gera prefixo automático).
- Geração: `alembic revision -m "descrição" --autogenerate` após alterar os models, depois revisar o `upgrade()` antes de aplicar.
- Aplicação: `alembic upgrade head`.
- Reversão: cada `upgrade()` deve ter um `downgrade()` funcional.
- Em PostgreSQL, usar `op.execute()` para CHECK constraints e triggers; em SQLite essas DDLs precisam ser emitidas com cuidado (ALTER TABLE limitado — usar `batch_alter_table`).

---

## Migration 1 — `add_unidade_medida_e_estoque_minimo_em_material`

**Objetivo:** mover `unidade_medida` da movimentação para o cadastro do material e adicionar limites de estoque.

**Alterações em `materiais`:**
- `unidade_medida VARCHAR(20) NOT NULL DEFAULT 'un'` — unidade canônica do material (ml, un, g, caixa).
- `fator_conversao NUMERIC(10,4) DEFAULT 1.0` — converte unidade de compra para unidade canônica (ex: 1 caixa = 50 un → `fator = 50`).
- `estoque_minimo NUMERIC(10,2) DEFAULT 0` — gatilho de alerta de ressuprimento.
- `estoque_maximo NUMERIC(10,2) NULL` — teto opcional.

**Alterações em `movimentacoes_estoque`:**
- Manter `unidade_medida` por enquanto (deprecated). Remoção fica para a migration 6, depois que todo o código backend tiver migrado para ler do `Material`.

**Models a alterar:** `Material` em `app/models/models.py`.

**Risco:** baixo. Defaults garantem compatibilidade com dados existentes.

---

## Migration 2 — `criar_tabela_locais_armazenamento`

**Objetivo:** suportar múltiplos depósitos/geladeiras/freezers.

**Nova tabela:**
```sql
CREATE TABLE locais_armazenamento (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,              -- REFRIGERADO | CONGELADO | AMBIENTE | INFLAMAVEIS
    temperatura_atual NUMERIC(5,2) NULL,    -- leitura opcional (sensor IoT futuro)
    descricao TEXT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Models:** criar classe `LocalArmazenamento` em `app/models/models.py`.

**Seed inicial:** após aplicar, inserir um local default (`"Depósito Principal"`, tipo `AMBIENTE`) para os lotes existentes apontarem.

**Risco:** nenhum (tabela nova).

---

## Migration 3 — `vincular_lote_ao_local_armazenamento`

**Objetivo:** cada lote físico fica em um local.

**Alteração em `lotes`:**
- `local_id INT REFERENCES locais_armazenamento(id) NULL` — nullable inicialmente para não quebrar lotes existentes.
- Após backfill (todos lotes existentes apontam para o "Depósito Principal" da migration 2), alterar para `NOT NULL` em migration separada se desejado.

**Models:** adicionar `local_id` e relationship em `Lote`.

**Risco:** baixo, desde que o seed da migration 2 rode antes.

---

## Migration 4 — `expandir_doencas_com_sazonalidade`

**Objetivo:** completar o cadastro de doenças para alimentar o Prophet.

**Alterações em `doencas`:**
- `sazonalidade VARCHAR(50) NULL` — `VERAO_CHUVOSO`, `INVERNO`, `ANO_TODO`.
- `meses_pico VARCHAR(50) NULL` — lista CSV de meses (ex: `"1,2,3"`).
- `regiao_endemica VARCHAR(100) NULL`.

**Alteração na tabela associativa `materiais_doencas`:**
- `quantidade_media_por_exame NUMERIC(10,2) NULL` — multiplicador para previsão de demanda.

⚠️ **Atenção:** alterar tabela com primary key composta em Alembic requer `batch_alter_table`. Revisar o autogenerate antes de aplicar.

**Models:** adicionar campos em `Doenca`. A tabela associativa `materiais_doencas` é hoje um `Table()` puro — precisa virar uma classe `MaterialDoenca` se quisermos expor o `quantidade_media_por_exame` no ORM (relationship via `association_object` do SQLAlchemy).

**Schemas:** atualizar `app/schemas/doenca_schema.py`.

**Risco:** médio. Mexer na PK composta exige cuidado.

---

## Migration 5 — `expandir_movimentacoes_com_transferencia_e_estorno`

**Objetivo:** suportar transferências entre locais e estorno de lançamentos errados.

**Alterações em `movimentacoes_estoque`:**
- `local_origem_id INT REFERENCES locais_armazenamento(id) NULL` — preenchido em `TRANSFERENCIA` e `USO`.
- `local_destino_id INT REFERENCES locais_armazenamento(id) NULL` — preenchido em `TRANSFERENCIA` e `ENTRADA`.
- `estorno_de_id INT REFERENCES movimentacoes_estoque(id) NULL` — referência para o lançamento sendo anulado.
- CHECK constraint: `CHECK (quantidade > 0)` — o sinal vem do `tipo`, nunca um negativo na coluna.
- Atualizar o enum implícito do `tipo` para aceitar `TRANSFERENCIA`.

**Models:** ampliar `MovimentacaoEstoque`.

**Endpoints:** ajustar `app/api/endpoints/movimentacoes.py` para:
- validar que `TRANSFERENCIA` exige origem e destino diferentes.
- validar que `estorno_de_id` aponta para movimentação do mesmo lote com `tipo` compatível.
- nunca permitir `DELETE` em movimentação — apenas estorno.

**Risco:** médio. Tocar em endpoints existentes pode quebrar fluxos do frontend — testar manualmente o cadastro de entrada/saída antes de merge.

---

## Migration 6 — `trigger_atualiza_saldo_lote`

**Objetivo:** garantir consistência atômica entre `movimentacoes_estoque` e `lotes.quantidade_atual`.

**Em PostgreSQL:** criar função PL/pgSQL + trigger AFTER INSERT em `movimentacoes_estoque`:
```sql
CREATE OR REPLACE FUNCTION atualiza_saldo_lote()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.tipo IN ('ENTRADA', 'AJUSTE') THEN
        UPDATE lotes SET quantidade_atual = quantidade_atual + NEW.quantidade
        WHERE id = NEW.lote_id;
    ELSIF NEW.tipo IN ('USO', 'DESCARTE') THEN
        UPDATE lotes SET quantidade_atual = quantidade_atual - NEW.quantidade
        WHERE id = NEW.lote_id;
    END IF;
    -- TRANSFERENCIA não altera quantidade do lote, só o local.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_atualiza_saldo_lote
AFTER INSERT ON movimentacoes_estoque
FOR EACH ROW EXECUTE FUNCTION atualiza_saldo_lote();
```

**Em SQLite (dev):** triggers funcionam mas não suportam PL/pgSQL. Manter a lógica de atualização na camada de serviço (transação) e usar `op.execute()` condicional ao dialeto:
```python
if op.get_context().dialect.name == 'postgresql':
    op.execute(""" ... PL/pgSQL ... """)
```

**Risco:** alto. Inconsistência aqui corrompe estoque. Antes de aplicar:
1. Backup do banco.
2. Reset de `lotes.quantidade_atual` recalculando do zero a partir do histórico de `movimentacoes_estoque`.
3. Aplicar trigger.
4. Validar com query: para todo lote, soma de entradas - soma de saídas = `quantidade_atual`.

---

## Migration 7 — `indices_e_constraints_finais`

**Objetivo:** performance e integridade.

**Índices:**
- `CREATE INDEX idx_lotes_material_validade ON lotes(material_id, data_validade);` — acelera consulta FEFO.
- `CREATE INDEX idx_movimentacoes_lote_data ON movimentacoes_estoque(lote_id, criado_em);` — histórico por lote.
- `CREATE INDEX idx_movimentacoes_tipo_data ON movimentacoes_estoque(tipo, criado_em);` — alimenta o Prophet (filtrar por `tipo='USO'`).

**Constraints adicionais:**
- `materiais.temperatura_min <= materiais.temperatura_max` (CHECK).
- `materiais.estoque_minimo >= 0` (CHECK).
- `lotes.quantidade_atual >= 0` (CHECK) — proteção contra estoque negativo.
- `lotes.data_validade >= lotes.data_fabricacao` (CHECK, quando ambas preenchidas).

**Migração de dados — CNPJ:**
- Normalizar `fornecedores.cnpj` removendo máscara (`00.000.000/0000-00` → `00000000000000`).
- Reduzir coluna para `VARCHAR(14)`.
- Validação de máscara passa a ser responsabilidade do frontend / Pydantic schema.

**Risco:** baixo. Índices podem ser criados `CONCURRENTLY` em produção PostgreSQL para não bloquear.

---

## Migration 8 — `auditoria_de_cadastro` (opcional, pode ficar para fase 2.1)

**Objetivo:** atender exigência ANVISA de rastrear alterações no cadastro (não só nas movimentações).

**Alterações em `materiais`, `lotes`, `fornecedores`:**
- `atualizado_em TIMESTAMP NULL` — atualizado por trigger ou pelo ORM.
- `atualizado_por_id INT REFERENCES usuarios(id) NULL`.

**Models:** adicionar campos e configurar `onupdate=func.now()` no SQLAlchemy.

**Risco:** baixo.

---

## Ordem de execução recomendada

```
1. add_unidade_medida_e_estoque_minimo_em_material      (baixo risco)
2. criar_tabela_locais_armazenamento                    (baixo risco)
3. vincular_lote_ao_local_armazenamento                 (depende de #2)
4. expandir_doencas_com_sazonalidade                    (médio — PK composta)
5. expandir_movimentacoes_com_transferencia_e_estorno   (médio — toca endpoints)
6. trigger_atualiza_saldo_lote                          (ALTO — backup antes)
7. indices_e_constraints_finais                         (baixo risco)
8. auditoria_de_cadastro                                (opcional, fase 2.1)
```

## Checklist por migration

Antes de aplicar cada migration em qualquer ambiente além do dev local:

- [ ] `alembic upgrade head` roda sem erro no SQLite local.
- [ ] `alembic downgrade -1` funciona (reversão validada).
- [ ] Models do SQLAlchemy refletem o novo schema.
- [ ] Schemas Pydantic em `app/schemas/` atualizados.
- [ ] Endpoints em `app/api/endpoints/` ajustados para os novos campos.
- [ ] Frontend (`frontend/src/components/tabs/`) tem o formulário/exibição atualizado.
- [ ] Teste manual do fluxo afetado (entrada → uso → consulta de saldo).
- [ ] Commit com mensagem no padrão do repo.
