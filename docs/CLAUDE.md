# FitSync AI — Orquestração do Projeto

> Arquivo lido pelo Claude Code e por qualquer IA assistente que for contribuir com este repositório. Define o contexto, as regras de decisão e os limites do escopo.

**Última atualização:** 22/04/2026
**Versão do projeto:** MVP v2 (Cenário A — ferramenta pessoal)
**Desenvolvedor:** Rafael Coutinho Lima (solo, <5h/semana)

---

## 1. Visão em Uma Frase

Ferramenta pessoal de treinamento de corrida que gera planos adaptativos via IA e envia os treinos diretamente ao Garmin do usuário, construída para ser usada primeiro pelo próprio desenvolvedor (triatleta iniciante) durante 8 semanas de dogfooding.

## 2. Princípios de Decisão

Quando houver dúvida sobre incluir uma feature, ferramenta ou complexidade, aplicar os princípios abaixo **nesta ordem**:

1. **Tempo até rodar > elegância arquitetural.** Solução "feia que funciona hoje" vence "bonita que funciona em 3 semanas".
2. **Hospedado > self-hosted.** Supabase > rodar Postgres. Railway > configurar VPS. Claude API > Ollama local.
3. **Monolito > microserviços.** Um container, uma API, um banco. Sempre.
4. **Síncrono > assíncrono.** Sem filas, sem BullMQ, sem Redis. Requisição entra, resposta sai.
5. **Um usuário > escala.** O sistema precisa funcionar para UMA pessoa primeiro. Escala é problema da Fase 2.
6. **Prompt engineering > RAG.** Com Claude Opus 4.7, um system prompt bom resolve 80% dos casos de treino. RAG só se virar necessidade comprovada.

## 3. Escopo Inviolável

Estas coisas **NÃO ENTRAM** no MVP. Se aparecer a tentação, mover para `FUTURE.md`:

- ❌ Ciclismo, natação (só corrida no MVP)
- ❌ Web app (só mobile)
- ❌ Múltiplos perfis de atleta (só "iniciante")
- ❌ Ollama, LLM local, RAG, ChromaDB
- ❌ TimescaleDB, Redis, filas
- ❌ Docker, Portainer, containers
- ❌ Pagamentos, Stripe
- ❌ LGPD formal, CNPJ, termos de uso
- ❌ App Store, Play Store
- ❌ Coros, Apple Watch, Polar, Suunto

## 4. Arquitetura

```
┌────────────────────────────────────────────┐
│  App Mobile (React Native + Expo)          │
└──────────────┬─────────────────────────────┘
               │ HTTPS
               ▼
┌────────────────────────────────────────────┐
│  Supabase (Auth + Postgres)                │
└──────────────┬─────────────────────────────┘
               │
               ▼
┌────────────────────────────────────────────┐
│  API Python (FastAPI @ Railway)            │
│  ├─► Claude API (geração de plano)         │
│  └─► python-garminconnect (integração)     │
└────────────────────────────────────────────┘
```

## 5. Stack Oficial

| Camada | Tecnologia | Versão mínima |
|--------|-----------|---------------|
| Mobile | React Native + Expo | Expo SDK 52+ |
| Backend | Python + FastAPI | Python 3.11 |
| Banco + Auth | Supabase | free tier |
| LLM | Anthropic API (Claude Opus 4.7) | via `anthropic` SDK |
| Garmin | `python-garminconnect` | >= 0.2.x (abril/2026) |
| Hospedagem API | Railway | free tier |
| Distribuição app | Expo Go (QR code) | — |

## 6. Estrutura de Pastas (quando existir)

```
fitsync-ai/
├── CLAUDE.md              # este arquivo
├── README.md              # setup e como rodar
├── FUTURE.md              # escopo arquivado
├── .env.example           # vars de ambiente
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py        # FastAPI entrypoint
│   │   ├── garmin.py      # wrapper python-garminconnect
│   │   ├── ai.py          # wrapper Claude API
│   │   ├── models.py      # Pydantic models
│   │   └── routes/
│   │       ├── activities.py
│   │       ├── plans.py
│   │       └── feedback.py
│   └── prompts/
│       └── system_plan_generation.md
└── mobile/
    ├── package.json
    ├── app.json
    └── src/
        ├── App.tsx
        ├── screens/
        │   ├── Login.tsx
        │   ├── Activities.tsx
        │   ├── WeekPlan.tsx
        │   └── Feedback.tsx
        └── lib/
            ├── supabase.ts
            └── api.ts
```

## 7. Prompts de IA — Diretrizes

O prompt que gera os planos de treino fica em `backend/prompts/system_plan_generation.md` e deve conter:

- **Limites de segurança:** progressão máxima de 10% em volume semanal, no máximo 1 treino intervalado por semana para iniciante, dia de descanso obrigatório.
- **Output estruturado em JSON.** Nunca texto livre. Schema em `backend/app/models.py`.
- **Perfil único no MVP:** "iniciante". Outros perfis são fase 2.
- **Disclaimer implícito:** o prompt deve orientar a IA a ser conservadora, não agressiva.

## 8. Roadmap — 8 Semanas

| Semana | Entrega | Critério de Vitória |
|--------|---------|---------------------|
| 1 | Setup de contas e ambiente | `python -m garminconnect` retorna perfil |
| 2 | Login Garmin + import local | 20 atividades reais no terminal |
| 3 | API FastAPI + banco | `GET /activities` retorna JSON válido |
| 4 | App mobile com login e lista | Abrir app no celular e ver corridas |
| 5 | Claude API gera plano | JSON com 4 semanas coerentes |
| 6 | Tela de plano no app | Ver plano da semana no celular |
| 7 | Envio ao Garmin | Treino agendado aparece no relógio |
| 8 | Feedback + recalibração | Ciclo fecha uma vez inteiro |

## 9. Critérios de Kill (parar o projeto)

- Fim da **Semana 2** sem login Garmin funcionando → revisar escopo (virar "sem Garmin").
- Fim da **Semana 5** sem plano coerente da Claude API → virar calculadora de zonas clássica.
- Fim da **Semana 8** sem um ciclo fechado → pausar e documentar como aprendizado.

Qualquer um desses critérios dispara uma sessão de revisão com IA antes de qualquer novo commit.

## 10. Comandos de Setup (quando o repo existir)

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload

# Mobile
cd mobile
npm install
npx expo start  # scan QR code com Expo Go
```

## 11. Variáveis de Ambiente

```bash
# .env (nunca commitar)
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
ANTHROPIC_API_KEY=...
GARMIN_EMAIL=...
GARMIN_PASSWORD=...
```

## 12. Glossário Rápido

- **Teste de 3 km:** protocolo de avaliação onde o atleta corre 3 km no maior ritmo sustentável. Usado para estimar zonas de treino.
- **Zona de FC:** faixa de frequência cardíaca correspondente a uma intensidade de treino (Z1 a Z5).
- **Pace de limiar:** ritmo aproximado que o atleta consegue manter por 1 hora de esforço máximo contínuo.
- **Dogfooding:** usar o próprio produto como usuário real.
- **RunningWorkout:** objeto do `python-garminconnect` que representa um treino estruturado enviável ao relógio.

---

**Para o Claude lendo este arquivo:** quando receber uma solicitação de feature ou mudança que conflite com os princípios da seção 2 ou com o escopo inviolável da seção 3, **sempre conteste antes de implementar.** Pergunte explicitamente se é para mover ao MVP ou arquivar em `FUTURE.md`.
