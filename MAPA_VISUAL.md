> **Documento histórico — revisão de 09/09/2026:** propostas abaixo não representam decisões vigentes quando conflitam com [ROADMAP_MVP.md](ROADMAP_MVP.md) e [tarefas.md](tarefas.md). Valem banco por tenant, polling, piloto Admin com 14 filiais, billing apenas comercial e visual ainda a definir. Dashboards da pasta `teste` foram descartados por Maylon. Exemplos de código, métricas, preços e infraestrutura abaixo não comprovam implementação.

# 📊 MAPA VISUAL DO PROJETO

Este documento oferece uma visão gráfica e estruturada do projeto Aeropostale Varejo SaaS.

---

## 🎯 FLUXO: Do Dado Bruto ao Insight

```
┌──────────────────────────────────────────────────────────────────────┐
│                     MILLENNIIUM ERP (Aeropostale)                    │
│                   (Fonte de Verdade dos Dados)                       │
│                                                                      │
│  - 50+ Filiais com vendas, estoque, clientes                       │
│  - API REST: /listafiliais, /listavendas, /saldodeestoque          │
│  - Data atualiza em tempo real no ERP                              │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Basic Auth (Encriptado)
                         │ Pull 1x/dia (Cron Job)
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                       │
│                                                                      │
│  1. Validação: Os dados vieram corretos?                           │
│  2. Parsing: Converter JSON para Modelo interno                    │
│  3. Cálculo: Aplicar fórmulas dos indicadores                      │
│  4. Cache: Armazenar em Redis (TTL 24h)                            │
│  5. Persistência: Guardar em PostgreSQL                            │
│                                                                      │
│  Endpoints:                                                         │
│  - GET /api/indicadores?filial_id=X&date_range=Y                 │
│  - GET /api/vendas?filial_id=X&periodo=mes                        │
│  - GET /api/estoque?filial_id=X                                   │
│                                                                      │
│  Segurança:                                                         │
│  - JWT authentication                                              │
│  - Row-level filtering (Apenas dados da filial do usuário)        │
│  - Rate limiting (100 req/min por user)                           │
└────────────────────────┬────────────────────────────────────────────┘
                         │ JSON API
                         │ (HTTPS + JWT)
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  FRONTEND (React + TypeScript)                       │
│                                                                      │
│  Dashboard Principal:                                              │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ AEROPOSTALE VAREJO | Olá, João | ⚙️ Sair          │           │
│  ├─────────────────────────────────────────────────────┤           │
│  │ [Filial: ITUPEVA ▼] [Período: Ago 2026 ▼]          │           │
│  ├────────┬────────┬────────┬────────┬────────────────┤           │
│  │Fatur.  │Ticket  │Giro    │Margem  │Conversão       │           │
│  │R$ 45K  │R$ 145  │5.2x    │58%     │15%            │           │
│  │↑ 12%   │↑ 8%    │↑ 0.3%  │↓ 2%    │↓ 5%           │           │
│  └────────┴────────┴────────┴────────┴────────────────┘           │
│  │ Gráfico: Faturamento (Últimos 30 dias)             │           │
│  │ [Série Temporal com trend]                         │           │
│  │ Últimas Transações: [Tabela com 5 vendas]          │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                      │
│  Sub-páginas:                                                      │
│  - Estoque (SKU, saldo, giro)                                     │
│  - Vendas (Histórico detalhado)                                   │
│  - Clientes (CRM básico)                                          │
│  - Admin (Gerenciar filiais, usuários)                            │
│  - Billing (Plano, próxima cobrança, recibos)                     │
└────────────────────────┬────────────────────────────────────────────┘
                         │ Dados visuais
                         │ para decisão
                         ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      USER (Gerente de Loja)                          │
│                                                                      │
│  "Entendi! Venhas de terça caíram 15%, preciso              │
│   de mais promoções. Vejo quantos estoques temos de..."     │
│                                                              │
│  DECISÃO TOMADA COM DATA! 📊                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ ARQUITETURA TÉCNICA

```
                        ┌─────────────────┐
                        │  Stripe/Mercado │
                        │      Pago       │
                        └────────┬────────┘
                                 │
        ┌────────────────┐      │      ┌──────────────┐
        │   Sentry       │      │      │  CloudWatch  │
        │ (Error Track)  │      │      │   (Logs)     │
        └────────┬───────┘      │      └──────┬───────┘
                 │              │             │
    ┌────────────┴──────────────┼─────────────┴────────────┐
    │                           │                          │
    ▼                           ▼                          ▼
┌─────────────┐          ┌──────────────┐          ┌──────────────┐
│  Frontend   │◄────────►│   Backend    │◄────────►│     DB       │
│  (React)    │  HTTPS   │  (Node.js)   │  TCP     │ (PostgreSQL) │
│  :3000      │  JWT     │  :5000       │  5432    │              │
└─────────────┘          └──────┬───────┘          └──────────────┘
                                 │
                                 │ Cron Job
                                 │ 1x/dia
                                 ▼
                         ┌──────────────────┐
                         │  Redis Cache     │
                         │  (24h TTL)       │
                         │  (Millennium API) │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ Millennium API   │
                         │ app.aeropostale  │
                         │ :6017            │
                         └──────────────────┘
```

---

## 🔄 WORKFLOW DE INTEGRAÇÃO MILLENNIUM

```
Dia 1:
┌────────────────────────────────────────────────────────┐
│ 02:00 AM (Madrugada - Fora de pico)                   │
│ CRON JOB DISPARA                                       │
└────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Backend conecta ao Millennium API                     │
│ GET /listafiliais?trans_id=LAST_SYNC_ID               │
│ GET /listavendas?data_inicial=ONTEM&data_final=HOJE   │
│ GET /saldodeestoque?filial=TODAS&trans_id=LAST_ID    │
└────────────────────────────────────────────────────────┘
         │
         ├─ Se sucesso:
         │  └─ Armazena em Redis (cache 24h)
         │  └─ Processa dados (validação)
         │  └─ Calcula indicadores
         │  └─ Persiste em PostgreSQL
         │  └─ Marca como SYNCED
         │  └─ Slack: ✅ Sync completo
         │
         └─ Se erro (1ª vez):
            └─ Retry em 10 min
            └─ Se erro (2ª vez):
               └─ Retry em 1h
               └─ Se erro (3ª vez):
                  └─ Alerta Slack para Ops
                  └─ Dashboard mostra "Dados desatualizados"

Resultado:
├─ Dashboard sempre mostra dados de ontem
├─ Cache fallback se API cair hoje
├─ Histórico garantido para análise
└─ Zero impacto no ERP Millennium
```

---

## 👥 MULTI-TENANCY: Isolamento de Dados

```
CONCEITO:
- 1 banco de dados PostgreSQL
- N empresas/franquias (Tenants)
- Cada tenant vê APENAS seus dados

IMPLEMENTAÇÃO:

Usuario 1 (tenant_id: 123)
└─ Filial ITUPEVA
└─ Filial CAMPINAS
└─ Vê APENAS 2 filiais

Usuario 2 (tenant_id: 456)
└─ Filial SÃO PAULO
└─ Vê APENAS 1 filial

─────────────────────────────────

SQL (Database Schema):

CREATE TABLE filiais (
  id UUID,
  tenant_id UUID NOT NULL,  ◄── CHAVE!
  codigo VARCHAR(50),
  nome VARCHAR(255)
);

CREATE TABLE vendas (
  id UUID,
  tenant_id UUID NOT NULL,  ◄── CHAVE!
  filial_id UUID,
  valor DECIMAL(10,2),
  data TIMESTAMP
);

─────────────────────────────────

Middleware (Backend):

app.get('/api/indicadores', requireAuth, async (req, res) => {
  const tenantId = req.user.tenant_id;  ◄── Do JWT
  
  // NUNCA deixe escapar tenant_id do usuário!
  const indicadores = await db.query(
    'SELECT * FROM indicadores WHERE tenant_id = $1',
    [tenantId]  ◄── Filtro obrigatório
  );
  
  res.json(indicadores);
});

─────────────────────────────────

PROTEÇÃO:

✅ Middleware filtra por tenant_id
✅ Query sempre inclui WHERE tenant_id = X
✅ Seed de testes tem tenant_id
✅ Backup/restore isolado por tenant
❌ NUNCA confiar em URL param para tenant_id
❌ NUNCA fazer query sem filtro de tenant
```

---

## 🔐 FLUXO DE SEGURANÇA

```
USER ENTRA NO SITE
    │
    ▼
┌─────────────────────────────────┐
│ Página: Login (HTTPS)           │
│ Email: _____________            │
│ Senha: _____________            │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ POST /api/auth/login            │
│ • Validação de email/senha      │
│ • Hash verificado (bcrypt)      │
│ • Gera JWT + Refresh Token      │
│ • Return: { token, refreshToken}│
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Frontend Armazena JWT           │
│ (localStorage ou Memory)         │
│ Header: Authorization: Bearer X │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ GET /api/indicadores            │
│ Headers: Authorization: Bearer X│
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Backend Valida JWT:             │
│ • Signature válida?             │
│ • Expirou?                      │
│ • Extrai tenant_id              │
│ • Filtra query por tenant_id    │
└────────────┬────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
  VÁLIDO          INVÁLIDO
    │                 │
    ▼                 ▼
Retorna Dados    Erro 401
(Filtrado)       Unauthorized

─────────────────────────────────

CREDENCIAIS MILLENNIUM:

Usuário salva: "SU5URUdSQUNBT..."
                      │
                      ▼
             Encriptado com KMS
                      │
                      ▼
          Armazenado em AWS Secrets
                      │
                      ▼
         Recuperado APENAS quando
         Cron Job roda (Backend)
                      │
                      ▼
           NUNCA vem para Frontend
           NUNCA aparece em logs
           NUNCA em email
```

---

## 💵 FLUXO DE PAGAMENTO (Stripe)

```
USUARIO ASSINA PLANO

    │
    ▼
┌─────────────────────────────────┐
│ Página: Billing                 │
│ Plan FREE: R$ 0                 │
│ Plan PRO: R$ 99/mês (com cupom) │
│ [Ir para Stripe] ◄── Botão      │
└────────────┬────────────────────┘
             │
             ▼
   ┌───────────────────────┐
   │   STRIPE.COM          │
   │ (Hosted Checkout)     │
   │ Email: _______        │
   │ Card: _______         │
   │ [Pagar] ◄── Seguro    │
   └────────────┬──────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
      PAGO          REJEITADO
        │               │
        └───┬───────────┘
            │
            ▼
┌─────────────────────────────────┐
│ Stripe WebHook:                 │
│ POST /webhook/stripe            │
│ event: checkout.session.completed
│                                 │
│ Backend recebe:                 │
│ - Subscription ID (stripe_id)  │
│ - Período de cobrança           │
│ - Status: active                │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Atualiza Banco de Dados:        │
│ UPDATE tenants                  │
│ SET plan_id = 'pro'             │
│     subscription_stripe_id = X  │
│     next_billing_date = +30d    │
│ WHERE id = Y                    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│ Email Confirmação:              │
│ "Bem-vindo ao PRO! ✅           │
│  Recibo em anexo                │
│  Próxima cobrança: 30 Oct"      │
└─────────────────────────────────┘

─────────────────────────────────

CANCELAMENTO:

Usuário clica [Cancelar Plano]
            │
            ▼
Backend chama Stripe.cancel()
            │
            ▼
Stripe envia webhook (subscription.deleted)
            │
            ▼
Backend atualiza: plan_id = 'free'
            │
            ▼
Email: "Lamentamos, acesso removido em 30 dias"
```

---

## 📈 FLUXO DE DADOS: Um Indicador Nasce

```
MILLISECOND-BY-MILLISECOND

T+0:00  Millennium DB tem venda de R$ 500 na filial 30098297
             │
T+0:00  (Espera Cron Job - próxima madrugada)
             │
T+0:02  02:00 AM: CRON DISPARA
             │
        Backend chama GET /listavendas
             │
T+0:05  Millennium responde com JSON (3888 vendas do dia)
             │
        Backend parseia:
        {
          filial: 30098297,
          tipo_operacao: "S",
          valor_final: 575.96,
          qtde: 3,
          clientes: [...],
          produtos: [...]
        }
             │
T+0:06  Validação:
        ✓ Tipo operação = "S" (venda)
        ✓ Cancelada = false
        ✓ Valor > 0
             │
T+0:07  Cálculo - Faturamento:
        faturamento = SUM(valor_final)
        = 45.000,00
             │
T+0:08  Cálculo - Ticket Médio:
        ticket_medio = faturamento / qtde_cupons
        = 45.000 / 300 = R$ 150
             │
T+0:09  Cálculo - Giro de Estoque:
        giro = vendas_qtde / estoque_medio
        = 5000 / 1000 = 5.0x
             │
T+0:10  Cálculo - Margem Bruta:
        margem = (venda - cmv) / venda
        = (150 - 60) / 150 = 60%
             │
T+0:11  Armazena em Redis (1h TTL):
        SET "indicadores:30098297:ago2026" -> JSON
             │
T+0:12  Persiste em PostgreSQL:
        INSERT INTO indicadores_cache (...)
        VALUES (filial_id, faturamento, ticket_medio, ...)
             │
T+0:13  Log de Sucesso:
        "Sync completed: 3888 vendas, 50 filiais"
             │
        Slack Notification ✅
             │
T+08:00 Usuário abre Dashboard de manhã
             │
        GET /api/indicadores?filial_id=30098297
             │
T+08:01 Backend retorna do Cache Redis:
        {
          faturamento: 45000,
          ticket_medio: 150,
          giro_estoque: 5.0,
          margem_bruta: 60,
          calculado_em: "2026-09-01 02:13:00"
        }
             │
T+08:02 Frontend renderiza:
        ┌────────────────────┐
        │ Faturamento        │
        │ R$ 45.000          │
        │ ↑ 12% vs ontem     │
        └────────────────────┘
             │
T+08:03 USUÁRIO TOMA DECISÃO:
        "Vendas estão boas, vou aumentar o estoque"
```

---

## 🎨 DESIGN SYSTEM

```
PALETA DE CORES:

┌──────────────────────┐
│ #FF6B35 (Laranja)    │ Primária (Aeropostale brand)
│ Botões, Links, CTAs  │
└──────────────────────┘

┌──────────────────────┐
│ #004E89 (Azul)       │ Secundária (Confiança)
│ Headers, Sidebars    │
└──────────────────────┘

┌──────────────────────┐
│ #06D6A0 (Verde)      │ Sucesso (↑ crescimento)
│ KPIs em alta         │
└──────────────────────┘

┌──────────────────────┐
│ #EF476F (Vermelho)   │ Risco/Alerta (↓ queda)
│ KPIs em baixa        │
└──────────────────────┘

┌──────────────────────┐
│ #F7F7F7 (Branco)     │ Fundo
│ #2C3E50 (Cinza)      │ Texto
└──────────────────────┘

─────────────────────────────

TIPOGRAFIA:

Headline: Inter Bold 32px (#004E89)
  "Aeropostale Varejo"

Título: Inter SemiBold 24px (#2C3E50)
  "Indicadores do Mês"

Body: Inter Regular 14px (#2C3E50)
  "Faturamento total de vendas..."

Label: Inter Medium 12px (#666666)
  "R$ / dia"

─────────────────────────────

COMPONENTES:

▌ Card
  ┌─────────────────┐
  │ Indicador       │ (Header)
  │                 │
  │ R$ 45.000       │ (Value - Grande)
  │ ↑ 12% vs ontem  │ (Trend - Verde/Vermelho)
  └─────────────────┘

▌ Chart (Recharts)
  ┌─────────────────────────┐
  │     Faturamento         │
  │  ╱╲            ╱╲       │
  │╱   ╲        ╱    ╲     │
  │      ╲    ╱        ╲   │
  │       ╲╱            ╲  │
  └─────────────────────────┘

▌ Table
  ┌─────────┬──────┬───────┐
  │ Data    │Valor │Peças  │
  ├─────────┼──────┼───────┤
  │ 30 ago  │R$575 │3      │
  │ 29 ago  │R$280 │2      │
  └─────────┴──────┴───────┘

▌ Button (Primary)
  ┌───────────────┐
  │ [IR PARA PRO] │ (Orange #FF6B35)
  └───────────────┘

▌ Button (Secondary)
  ┌───────────────┐
  │ Cancelar      │ (Outline)
  └───────────────┘
```

---

## 📊 MÉTRICAS DE SUCESSO - PAINEL DE MONITORAMENTO

```
┌────────────────────────────────────────────────────────┐
│  MVP KPIs (Dashboard para Ops)                        │
├────────────────────────────────────────────────────────┤
│                                                        │
│ NEGÓCIO:                                             │
│ ├─ Signups: 10 (meta: 20 em 30 dias)               │
│ ├─ Conversion FREE→PRO: 30% (meta: 40%)            │
│ ├─ Churn (Cancelamentos): 0% (meta: < 5%)          │
│ ├─ MRR (Receita Recorrente Mensal): R$ 2,970      │
│ └─ NPS (Net Promoter Score): 45 (meta: > 40) ✅    │
│                                                        │
│ TÉCNICO:                                             │
│ ├─ Uptime: 99.6% (meta: > 99.5%) ✅                │
│ ├─ Avg Response Time: 850ms (meta: < 2s) ✅        │
│ ├─ Errors (Sentry): 12/mês (meta: < 20) ✅         │
│ ├─ Sync Success Rate: 98.5% (meta: > 95%) ✅       │
│ └─ DB Performance: p95=120ms (meta: < 500ms) ✅    │
│                                                        │
│ PRODUTO:                                             │
│ ├─ DAU (Daily Active Users): 8 (de 10 signups)    │
│ ├─ Feature Usage:                                   │
│ │  ├─ Dashboard: 100% usuários                     │
│ │  ├─ Estoque: 60%                                 │
│ │  ├─ Vendas: 40%                                  │
│ │  └─ Relatórios: 10%                              │
│ └─ Time to Value: 3.5min (meta: < 5min) ✅        │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

**Fim do Mapa Visual** 🗺️

Próximo passo? Abra **COMECE_AQUI.md** para começar a trabalhar!
