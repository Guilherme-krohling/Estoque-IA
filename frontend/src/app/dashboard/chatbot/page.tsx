"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";

interface MensagemDemo {
  id: string;
  autor: "usuario" | "assistente";
  horario: string;
  texto: string;
  toolAcionada?: string;
  sqlExecutado?: string;
  tabelaDados?: {
    colunas: string[];
    linhas: string[][];
  };
  destaqueNota?: string;
}

const CENARIOS_EXEMPLO: Array<{
  id: string;
  tituloCurto: string;
  categoria: string;
  pergunta: string;
  resposta: Omit<MensagemDemo, "id" | "autor" | "horario">;
}> = [
  {
    id: "compras-dengue",
    tituloCurto: "O que comprar esta semana? (Previsão + Estoque)",
    categoria: "Fase 2 + Fase 4.1",
    pergunta: "O que preciso comprar esta semana considerando a previsão salva de Dengue em Santos (8 semanas)?",
    resposta: {
      toolAcionada: "obter_alertas_estoque(previsao_id=1) + obter_pedidos_pendentes()",
      sqlExecutado:
        "SELECT m.nome, l.quantidade_atual, p.quantidade_pendente FROM materiais m JOIN pedidos_reposicao p ...",
      texto:
        "Com base no snapshot salvo **\"Dengue · Santos · 8 sem\"** (140 casos previstos pelo Prophet) e descontando os pedidos que já estão em trânsito, identifiquei **2 insumos com necessidade de compra imediata**:",
      tabelaDados: {
        colunas: ["Material / Insumo", "Estoque Atual", "Falta Chegar (NF Parcial)", "Demanda Projetada (8 sem)", "Sugestão Líquida de Compra"],
        linhas: [
          ["Kit Teste Rápido Dengue NS1", "12 cx", "20 cx (NF 00048291 - Parcial)", "65 cx", "Comprar 33 cx"],
          ["Tubo Coleta EDTA K3 4mL", "45 un", "0 un", "180 un", "Comprar 135 un"],
          ["Reagente Sorologia Dengue IgM/IgG", "80 ml", "50 ml (Pedido #3 Pendente)", "95 ml", "0 ml (Coberto)"],
        ],
      },
      destaqueNota:
        "Nota determinística: O Kit Teste Rápido Dengue NS1 teve 20 caixas abatidas da recomendação porque já constam como saldo pendente do Pedido #2 (BioTech Diagnósticos).",
    },
  },
  {
    id: "entregas-parciais",
    tituloCurto: "Quais fornecedores têm entregas parciais pendentes?",
    categoria: "Fase 4.1 (NFs & Pedidos)",
    pergunta: "Quais fornecedores estão com entregas parciais ou pendentes e quais Notas Fiscais já chegaram?",
    resposta: {
      toolAcionada: "obter_pedidos_reposicao(status=['PARCIAL', 'PENDENTE'])",
      sqlExecutado:
        "SELECT p.id, m.nome, p.empresa_fornecedora, p.quantidade_solicitada, p.quantidade_recebida, e.numero_nf FROM pedidos_reposicao p ...",
      texto:
        "Atualmente existem **2 pedidos em aberto** aguardando entrega total ou complementar dos fornecedores:",
      tabelaDados: {
        colunas: ["Pedido", "Material", "Empresa Fornecedora", "Solicitado", "Já Entregue (NF)", "Falta Chegar"],
        linhas: [
          [
            "Pedido #2 (PARCIAL)",
            "Kit Teste Rápido Dengue NS1",
            "BioTech Diagnósticos Ltda",
            "50 cx",
            "30 cx (NF 00048291 em 10/10/2026)",
            "Faltam 20 cx",
          ],
          [
            "Pedido #3 (PENDENTE)",
            "Reagente Sorologia IgM/IgG",
            "LabSupply Brasil S.A.",
            "50 un",
            "0 un (Aguardando 1ª NF)",
            "Faltam 50 un",
          ],
        ],
      },
      destaqueNota:
        "O Pedido #1 (100 un — Diagnóstica São Paulo) já foi 100% concluído através da NF 00000000.",
    },
  },
  {
    id: "rastreabilidade-fernando",
    tituloCurto: "Rastrear insumos usados no paciente Fernando (Unimed)",
    categoria: "Fase 4.2 (Rastreabilidade)",
    pergunta: "Quais materiais e lotes foram usados no paciente Fernando (convênio Unimed) e quais exames ele realizou?",
    resposta: {
      toolAcionada: "consultar_rastreabilidade_paciente(paciente='Fernando', convenio='Unimed')",
      sqlExecutado:
        "SELECT a.paciente_nome, a.convenio, a.exames_json, m.nome, l.numero_lote, c.quantidade_utilizada FROM consumos_materiais_pacientes c ...",
      texto:
        "Localizei o atendimento auditável do paciente **Fernando** pelo convênio **Unimed**, no qual foram realizados **8 exames laboratoriais**:",
      tabelaDados: {
        colunas: ["Paciente / Convênio", "Material Utilizado", "Lote Rastreado", "Qtd. Baixada", "Exames Realizados no Atendimento (8)"],
        linhas: [
          [
            "Fernando (Unimed)",
            "Reagente Bioquímico / Kit Laboratorial",
            "LOTE-RAST-001",
            "2 un",
            "1. Hemograma Completo, 2. Sorologia Dengue IgM/IgG, 3. Glicemia de Jejum, 4. Colesterol Total, 5. Triglicerídeos, 6. TGO (AST), 7. TGP (ALT), 8. Creatinina",
          ],
        ],
      },
      destaqueNota:
        "Trilha de auditoria: Baixa vinculada automaticamente à Movimentação de Estoque tipo USO, sem pendências de estorno.",
    },
  },
  {
    id: "justificativa-compra",
    tituloCurto: "Gerar Justificativa Técnica de Compra",
    categoria: "Substituto Inteligente da Fase 2",
    pergunta: "Gere uma justificativa formal de compra para as 33 caixas do Kit Teste Rápido Dengue NS1.",
    resposta: {
      toolAcionada: "gerar_minuta_justificativa_compra(material='Kit Teste Rápido Dengue NS1')",
      sqlExecutado:
        "SELECT * FROM previsoes_salvas WHERE id = 1; SELECT * FROM materiais WHERE nome LIKE '%Dengue%';",
      texto:
        "**MINUTA DE JUSTIFICATIVA TÉCNICA DE AQUISIÇÃO — LAURUS AI**\n\n" +
        "• **Item Solicitado:** Kit Teste Rápido Dengue NS1 (33 caixas)\n" +
        "• **Base Epidemiológica (SINAN + Prophet):** Projeção salva aponta tendência crescente em Santos com estimativa de 140 casos nas próximas 8 semanas.\n" +
        "• **Memória de Cálculo Determinística:** Demanda total projetada de 65 cx (consumo médio histórico + impacto epidemiológico + estoque de segurança de 20%), descontando 12 cx em estoque físico e 20 cx pendentes de entrega parcial da NF 00048291.\n" +
        "• **Parecer:** Aquisição recomendada para evitar ruptura de bancada antes do pico previsto.",
      destaqueNota:
        "Na Fase 5 finalizada, você poderá copiar ou exportar esta justificativa em PDF com 1 clique.",
    },
  },
];

export default function ChatbotPreviewPage() {
  const [mensagens, setMensagens] = useState<MensagemDemo[]>([
    {
      id: "msg-inicial-user",
      autor: "usuario",
      horario: "14:30",
      texto: CENARIOS_EXEMPLO[0].pergunta,
    },
    {
      id: "msg-inicial-bot",
      autor: "assistente",
      horario: "14:30",
      ...CENARIOS_EXEMPLO[0].resposta,
    },
    {
      id: "msg-fernando-user",
      autor: "usuario",
      horario: "14:32",
      texto: CENARIOS_EXEMPLO[2].pergunta,
    },
    {
      id: "msg-fernando-bot",
      autor: "assistente",
      horario: "14:32",
      ...CENARIOS_EXEMPLO[2].resposta,
    },
  ]);

  const [inputTexto, setInputTexto] = useState("");
  const [mostrarSql, setMostrarSql] = useState(true);

  const dispararCenario = (cenario: (typeof CENARIOS_EXEMPLO)[0]) => {
    const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const msgUser: MensagemDemo = {
      id: `user-${Date.now()}`,
      autor: "usuario",
      horario: agora,
      texto: cenario.pergunta,
    };
    const msgBot: MensagemDemo = {
      id: `bot-${Date.now() + 1}`,
      autor: "assistente",
      horario: agora,
      ...cenario.resposta,
    };
    setMensagens((prev) => [...prev, msgUser, msgBot]);
  };

  const handleEnviarLivre = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTexto.trim()) return;
    const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const perguntaUsuario = inputTexto.trim();
    setInputTexto("");

    setMensagens((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        autor: "usuario",
        horario: agora,
        texto: perguntaUsuario,
      },
      {
        id: `bot-${Date.now() + 1}`,
        autor: "assistente",
        horario: agora,
        toolAcionada: "MODO_DEMONSTRACAO_VISUAL (Fase 5 em planejamento)",
        texto:
          "🚧 **Módulo em Desenvolvimento (Preview Visual da Fase 5):** No momento esta interface funciona como **protótipo conceitual** para demonstrar como o Chatbot funcionará. Clique em qualquer um dos **4 exemplos interativos ao lado** para visualizar como o agente consultará o banco SQL real (Estoque, Previsões Salvas, Notas Fiscais Parciais e Rastreabilidade por Paciente).",
        destaqueNota:
          "Quando o backend da Fase 5 for ativado, sua pergunta será convertida em consultas estruturadas no SQLite via Function Calling, sem inventar dados.",
      },
    ]);
  };

  return (
    <PageHeader
      title="Assistente Laurus AI (RAG & Agente SQL)"
      subtitle="Interface conversacional conectada aos dados determinísticos de estoque, previsões salvas, NFs e rastreabilidade"
      actions={
        <span className="px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Fase 5 · Protótipo Visual (Em Desenvolvimento)
        </span>
      }
    >
      {/* Banner Explicativo de Protótipo / Fase 5 */}
      <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-violet-500/10 border border-amber-500/30 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              Preview Conceitual
            </span>
            <h3 className="text-sm font-bold text-white">
              Demonstração Visual da Fase 5 — Integração com LLM ainda será desenvolvida
            </h3>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-4xl">
            Esta tela apresenta como funcionará o **Chatbot com RAG Estruturado / Agente SQL**. Diferente de um chat genérico, ele usará{" "}
            <strong className="text-cyan-300">Function Calling + SQL Retriever</strong> para responder{" "}
            <strong className="text-white">estritamente com base nos dados reais salvos no sistema</strong> (Fases 1 a 4), garantindo{" "}
            <strong className="text-emerald-300">zero alucinação</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMostrarSql(!mostrarSql)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              mostrarSql
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            {mostrarSql ? "Ocultar Rastreio SQL / Tools" : "Mostrar Rastreio SQL / Tools"}
          </button>
          <button
            type="button"
            onClick={() =>
              setMensagens([
                {
                  id: "msg-inicial-user",
                  autor: "usuario",
                  horario: "14:30",
                  texto: CENARIOS_EXEMPLO[0].pergunta,
                },
                {
                  id: "msg-inicial-bot",
                  autor: "assistente",
                  horario: "14:30",
                  ...CENARIOS_EXEMPLO[0].resposta,
                },
              ])
            }
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            Reiniciar Demo
          </button>
        </div>
      </div>

      {/* Grid Principal: Simulador de Chat (Esquerda) + Exemplos e Arquitetura (Direita) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Coluna Esquerda: Janela de Conversa Demonstrativa */}
        <div className="glass rounded-2xl border border-slate-700/60 flex flex-col h-[680px] overflow-hidden">
          {/* Topo do Chat */}
          <div className="px-5 py-3.5 border-b border-slate-700/50 bg-slate-900/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 font-extrabold text-sm shadow-md">
                IA
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white">Agente SQL Laurus AI</h4>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                     Modo Somente-Leitura no Banco
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Conectado a: Estoque · Previsões Salvas (Prophet) · Pedidos & NFs · Rastreabilidade de Pacientes
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Mensagens */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {mensagens.map((msg) =>
              msg.autor === "usuario" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-xl bg-emerald-500/15 border border-emerald-500/30 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="text-[11px] font-bold text-emerald-300">Você (Gestor do Laboratório)</span>
                      <span className="text-[10px] text-slate-400">{msg.horario}</span>
                    </div>
                    <p className="text-sm text-slate-100">{msg.texto}</p>
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-3xl w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl rounded-tl-sm p-4 shadow-md space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-cyan-400">Assistente Laurus AI</span>
                        <span className="px-2 py-0.5 text-[10px] rounded bg-slate-800 text-slate-300 border border-slate-700">
                          Resposta Baseada em Dados Reais
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500">{msg.horario}</span>
                    </div>

                    {/* Badge da Tool / SQL Executado */}
                    {mostrarSql && msg.toolAcionada && (
                      <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] space-y-1">
                        <div className="flex items-center gap-2 text-cyan-400">
                          <span className="font-bold">⚙ Tool Acionada:</span>
                          <span>{msg.toolAcionada}</span>
                        </div>
                        {msg.sqlExecutado && (
                          <div className="text-slate-400 truncate" title={msg.sqlExecutado}>
                            <span className="text-violet-400 font-bold">SQL:</span> {msg.sqlExecutado}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Texto Principal */}
                    <div className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">{msg.texto}</div>

                    {/* Tabela Estruturada de Dados (quando presente) */}
                    {msg.tabelaDados && (
                      <div className="overflow-x-auto rounded-xl border border-slate-700/70 bg-slate-950/60">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 bg-slate-900/90 text-left text-slate-300">
                              {msg.tabelaDados.colunas.map((col, idx) => (
                                <th key={idx} className="px-3 py-2 font-semibold">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.tabelaDados.linhas.map((linha, rIdx) => (
                              <tr key={rIdx} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                                {linha.map((celula, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className={`px-3 py-2.5 ${
                                      cIdx === 0
                                        ? "font-semibold text-white"
                                        : cIdx === linha.length - 1
                                        ? "font-bold text-cyan-300"
                                        : "text-slate-300"
                                    }`}
                                  >
                                    {celula}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Nota de Auditoria */}
                    {msg.destaqueNota && (
                      <div className="px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200">
                        {msg.destaqueNota}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {/* Rodapé de Input do Chat */}
          <form onSubmit={handleEnviarLivre} className="p-3.5 border-t border-slate-700/60 bg-slate-900/80 flex gap-2">
            <input
              type="text"
              value={inputTexto}
              onChange={(e) => setInputTexto(e.target.value)}
              placeholder="Simule uma pergunta ou clique em um dos exemplos prontos ao lado..."
              className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:ring-2 focus:ring-cyan-500/50 focus:outline-none placeholder-slate-500"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-colors shrink-0"
            >
              Testar Envio
            </button>
          </form>
        </div>

        {/* Coluna Direita: Exemplos Clicáveis e Arquitetura Planejada */}
        <div className="space-y-5">
          {/* Card 1: Prompts de Exemplo Interativos */}
          <div className="glass p-5 rounded-2xl border border-slate-700/60">
            <h3 className="text-sm font-bold text-white mb-1">Exemplos de Como Será na Prática</h3>
            <p className="text-xs text-slate-400 mb-3">
              Clique em qualquer pergunta abaixo para simular a resposta do Chatbot no painel ao lado:
            </p>

            <div className="space-y-2.5">
              {CENARIOS_EXEMPLO.map((cenario) => (
                <button
                  key={cenario.id}
                  type="button"
                  onClick={() => dispararCenario(cenario)}
                  className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/70 hover:border-cyan-500/50 transition-all group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                      {cenario.categoria}
                    </span>
                    <span className="text-xs text-slate-500 group-hover:text-cyan-400 transition-colors">
                      Simular →
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-white group-hover:text-cyan-200 transition-colors">
                    {cenario.tituloCurto}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">&ldquo;{cenario.pergunta}&rdquo;</p>
                </button>
              ))}
            </div>
          </div>

          {/* Card 2: Arquitetura Planejada para a Fase 5 */}
          <div className="glass p-5 rounded-2xl border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Arquitetura Planejada (Fase 5)</h3>
              <span className="px-2 py-0.5 text-[10px] rounded bg-violet-500/20 text-violet-300 font-bold">
                Roadmap
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="font-bold text-emerald-400 block">1. Zero Alucinação (Grounded SQL)</span>
                <span className="text-slate-400">
                  O LLM não inventa números: ele chama funções Python validadas que consultam o SQLite em tempo real.
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="font-bold text-cyan-400 block">2. Integração Total (Fases 1 a 4)</span>
                <span className="text-slate-400">
                  Lê snapshots salvos do Prophet (Fase 2), entregas parciais com NF (Fase 4.1) e consumo por paciente, convênio e exames (Fase 4.2).
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                <span className="font-bold text-amber-400 block">3. Justificativa de Compra sob Demanda</span>
                <span className="text-slate-400">
                  Substitui o antigo botão estático por minutas técnicas completas baseadas no cálculo algorítmico.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageHeader>
  );
}

