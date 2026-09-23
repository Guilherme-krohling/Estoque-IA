"""
Laurus AI — Instância Compartilhada do Rate Limiter
===================================================
Centraliza o objeto `limiter` em um módulo sem dependências dos endpoints,
evitando imports circulares entre main.py e os módulos de endpoints.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Limiter baseado no IP do cliente — compartilhado por todos os endpoints
limiter = Limiter(key_func=get_remote_address)
