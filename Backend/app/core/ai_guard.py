"""
Laurus AI — Guarda de Segurança da IA (Circuit Breaker + Sanitização)
====================================================================
Protege contra:
  - Estouro de cota/custo da API do Gemini (circuit breaker global)
  - Prompt injection (sanitização de entrada)
  - Payloads gigantes que explodem o contexto da IA (limite de tokens)
"""

import os
import re
import time

from fastapi import HTTPException

# =====================================================================
# CIRCUIT BREAKER — Limite Global de Chamadas de IA
# =====================================================================
_call_window_seconds = int(os.getenv("AI_RATE_WINDOW_SECONDS", "3600"))  # janela de 1h
_call_limit = int(os.getenv("AI_CALL_LIMIT_PER_WINDOW", "50"))           # 50 chamadas/hora global
_call_count = 0
_window_start = time.time()


def check_ai_quota() -> None:
    """
    Trava global que impede estouro de cota da API de IA.
    Lança HTTP 429 se o limite de chamadas da janela for atingido.

    Uso: chamar como PRIMEIRA linha de todo endpoint que aciona a IA.
    """
    global _call_count, _window_start
    now = time.time()

    # Reset da janela se já expirou
    if now - _window_start > _call_window_seconds:
        _call_count = 0
        _window_start = now

    _call_count += 1

    if _call_count > _call_limit:
        raise HTTPException(
            status_code=429,
            detail=(
                f"Limite de chamadas à IA atingido ({_call_limit} por hora). "
                "Tente novamente mais tarde para evitar custos excessivos."
            ),
        )


# =====================================================================
# SANITIZAÇÃO DE PROMPT — Anti-Prompt Injection
# =====================================================================
# Padrões que indicam tentativa de prompt injection ou jailbreak
_FORBIDDEN_PATTERNS = [
    r"ignore\s+(all\s+)?previous\s+instructions",
    r"você\s+é\s+agora",
    r"act\s+as",
    r"jailbreak",
    r"\bDAN\b",
    r"system\s+prompt",
    r"pretend\s+(you\s+are|to\s+be)",
    r"forget\s+(your|all)\s+(previous\s+)?(instructions|training)",
]

# Tamanho máximo permitido de input do usuário para chamadas de IA (~1000 tokens)
MAX_PROMPT_CHARS = 4000


def sanitize_prompt(user_input: str) -> str:
    """
    Valida e sanitiza o input do usuário antes de enviar para a IA.

    - Rejeita entradas muito longas
    - Bloqueia padrões conhecidos de prompt injection
    - Remove caracteres de controle perigosos

    Retorna o input sanitizado ou lança HTTPException.
    """
    if not user_input or not user_input.strip():
        raise HTTPException(status_code=400, detail="A mensagem não pode estar vazia.")

    if len(user_input) > MAX_PROMPT_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Entrada muito longa. Limite de {MAX_PROMPT_CHARS} caracteres.",
        )

    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, user_input, re.IGNORECASE):
            raise HTTPException(
                status_code=400,
                detail="Entrada inválida detectada. Evite instruções que tentem alterar o comportamento do assistente.",
            )

    # Remover caracteres de controle (exceto newline \n e tab \t, que são legítimos)
    user_input = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", user_input)

    return user_input.strip()
