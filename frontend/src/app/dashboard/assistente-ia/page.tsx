"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { showToast } from "@/components/Toast";
import { iaApi } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp: string;
  badge?: string;
}

export default function AssistenteIAPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: `Olá, ${user?.nome || "Biomédico(a)"}! 👋 Sou o Assistente de Estoque da Laurus AI.\n\nEstou conectado ao banco de dados do laboratório e aos modelos preditivos em tempo real para te dar respostas imediatas sobre validades, reposição e surtos epidemiológicos.\n\nComo posso ajudar hoje?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      badge: "Dados em Tempo Real",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const quickPrompts = [
    "Quais produtos estão para vencer nos próximos 30 dias?",
    "Quais doenças estão com pico previsto para o outono na minha região?",
    "Qual o procedimento de biossegurança do Brometo de Etídio?",
    "Gerar um resumo executivo do estoque para a diretoria.",
  ];

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setIsTyping(true);

    // Chamada real para a API do Assistente (Ajuste 1)
    iaApi.assistenteConsulta({ mensagem: query })
      .then((res) => {
        const aiMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: res.resposta,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          badge: "Laurus AI Core",
        };
        setMessages((prev) => [...prev, aiMsg]);
      })
      .catch((err) => {
        const errMsg: Message = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "Desculpe, não consegui me conectar ao banco de dados no momento. Tente novamente mais tarde.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          badge: "Erro de Conexão",
        };
        setMessages((prev) => [...prev, errMsg]);
        showToast(err.message || "Erro de conexão", "error");
      })
      .finally(() => {
        setIsTyping(false);
      });
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: Date.now().toString(),
        sender: "ai",
        text: "Conversa reiniciada. Como posso auxiliar com o estoque biomédico agora?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        badge: "Dados em Tempo Real",
      },
    ]);
    showToast("Histórico do chat limpo.");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-5xl mx-auto animate-fade-in space-y-4">
      {/* Header da Tela */}
      <div className="glass p-5 rounded-2xl border border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-emerald-500/20">
            🤖
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">Assistente Biomédico Laurus AI</h1>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full">
                Dados em Tempo Real
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Perguntas rápidas sobre validades, estoques e previsões epidemiológicas.
            </p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
        >
          <span>🧹</span> Limpar Chat
        </button>
      </div>

      {/* Prompts Rápidos Sugeridos */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap pl-1">💡 Sugestões:</span>
        {quickPrompts.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(prompt)}
            className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl text-xs whitespace-nowrap transition-all shadow-sm"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 glass rounded-2xl border border-slate-700/50 p-4 overflow-y-auto space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400 font-semibold">
                {msg.sender === "user" ? user?.nome || "Você" : "Laurus AI Assistente"}
              </span>
              {msg.badge && (
                <span className="text-[9px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md font-mono">
                  {msg.badge}
                </span>
              )}
              <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
            </div>

            <div
              className={`max-w-2xl p-4 rounded-2xl text-sm leading-relaxed ${
                msg.sender === "user"
                  ? "bg-emerald-600 text-white rounded-br-none shadow-md shadow-emerald-950/20"
                  : "bg-slate-900/90 border border-slate-800 text-slate-200 rounded-bl-none shadow-md"
              }`}
            >
              {msg.text.split("\n").map((line, index) => (
                <p key={index} className={line === "" ? "h-2" : "min-h-[1rem]"}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-slate-400 font-semibold">Laurus AI Assistente</span>
              <span className="text-[10px] text-emerald-400 font-mono animate-pulse">Consultando Banco SQL + RAG...</span>
            </div>
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl rounded-bl-none flex items-center gap-2 text-slate-400 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.2s]" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce [animation-delay:0.4s]" />
              <span className="ml-2 font-mono">Processando resposta biomédica...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="glass p-3 rounded-2xl border border-slate-700/50 flex items-center gap-3 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="💬 Digite sua dúvida biomédica sobre estoque, surtos ou FISPQ..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <span>Enviar</span>
          <span>➔</span>
        </button>
      </form>
    </div>
  );
}
