> **Documento histórico — revisão de 09/09/2026:** propostas abaixo não representam decisões vigentes quando conflitam com [ROADMAP_MVP.md](ROADMAP_MVP.md) e [tarefas.md](tarefas.md). Valem banco por tenant, polling, piloto Admin com 14 filiais, billing apenas comercial e visual ainda a definir. Dashboards da pasta `teste` foram descartados por Maylon. Exemplos de código, métricas, preços e infraestrutura abaixo não comprovam implementação.

# 🔧 DECISÕES TÉCNICAS & NOTAS DE PROJETO

**Documento vivo** para manter coerência técnica e raciocínio do projeto  
*Última atualização: 2026-09-01*

---

## 🎯 DECISÕES ARQUITETURAIS

### 1. **Stack Recomendado para MVP**

```
Frontend: React 18 + TypeScript + Tailwind CSS + Recharts
Backend: Node.js (Express) + TypeScript
Database: PostgreSQL
Cache: Redis (para dados da Millennium API)
Auth: JWT + Refresh Token
Payments: Stripe (internacional) ou Mercado Pago (Brasil)
Hosting: AWS EC2 + RDS (ou Heroku para start simples)
Observability: Sentry + CloudWatch
```

**Justificativa:**
- React: Comunidade grande, componentes, documentação
- Node.js: Mesmo time pode fazer full-stack, TypeScript reduce bugs
- PostgreSQL: Confiável, multi-tenant pronto, JSON support
- Stripe: Melhor integração, webhook confiável
- AWS: Escalável, serverless options, Brasil com Mercado Pago

### 2. **Estratégia de Multi-Tenancy**

**Escolhido: Row-Level Tenancy (com separação de Schema como fallback)**

```sql
-- Todos os dados numa tabela, mas com tenant_id como chave
CREATE TABLE filiais (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,  -- Qual empresa/franquia?
  codigo VARCHAR(50),
  nome VARCHAR(255),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- No middleware, sempre filtrar por tenant_id
WHERE tenant_id = req.user.tenant_id
```

**Benefícios:**
- Compartilhamento de recursos (DB, índices, cache)
- Backup/restore rápido de um tenant
- Queries simples e performáticas

**Risco:**
- Vazamento de dados se bug no filtro (MITIGATION: Auditar queries, usar ORM typado)

---

### 3. **Integração com API Millennium**

**Modelo: Sync Job com Cache**

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│ Cron Job    │────▶│ Millennium   │────▶│ Cache Redis  │────▶│ Dashboard │
│ 1x por dia  │ +   │ API (Pull)   │     │ (24h TTL)    │     │           │
└─────────────┘     └──────────────┘     └──────────────┘     └───────────┘
  Roda à noite                            Fallback se API
  (fora de pico)                           cai
```

**Por que não Real-Time?**
- API Millennium não tem WebHook
- Real-time teria taxa de chamadas inviável
- Dados de varejo: vendas de hoje relevam amanhã

**Endpoints a Sincronizar:**
1. `GET /listafiliais` (Cache agressivo, muda 1x semana)
2. `GET /listavendas` (Incremental com trans_id, puxar últimas 24h)
3. `GET /saldodeestoque` (Incremental, puxar mudanças das últimas 24h)

**Retry Policy:**
- 1ª tentativa: 10min depois
- 2ª tentativa: 1h depois
- 3ª tentativa: 24h depois
- Se 3 falhas: Alerta para Ops

---

### 4. **Cálculo de Indicadores - Onde?**

**Escolhido: No Backend (Não no Dashboard)**

```
Razão: Lógica de negócio centralizada
- Validação de dados
- Auditoria
- Consistência multi-user
- Cache de resultados

Fluxo:
Millennium Data (JSON)
    ↓
Backend (Node) - Validação + Cálculo
    ↓
Cache Redis (1h TTL)
    ↓
Dashboard (GET /api/indicadores)
```

**Exemplo de Cálculo:**
```javascript
// GET /api/indicadores?filial_id=30098297&date_range=2026-08-01_2026-08-31

const vendas = await db.query(`
  SELECT SUM(valor_final) as faturamento, 
         COUNT(DISTINCT codigo) as qtde_cupons
  FROM vendas 
  WHERE filial_id = $1 AND data BETWEEN $2 AND $3
`, [filialId, dateStart, dateEnd]);

const indicadores = {
  faturamento: vendas.faturamento,
  ticket_medio: vendas.faturamento / vendas.qtde_cupons,
  // ... mais indicadores
};
```

---

### 5. **Segurança - Armazenamento de Credenciais Millennium**

**Escolhido: AWS Secrets Manager (ou Vault local)**

```
Usuário cria conta → Insere Basic Auth Millennium → 
Criptografado com KMS (AWS) ou aes-256 local → 
Armazenado em banco → 
Recuperado apenas quando sync job roda
```

**NUNCA** enviar credenciais:
- ❌ Para frontend
- ❌ Em logs
- ❌ Em URLs
- ❌ Em emails

---

### 6. **Modelo de Dados - 4 Tabelas Core**

```sql
-- 1. TENANTS (Franquias/Empresas)
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  plan_id VARCHAR(50), -- 'free', 'pro', 'enterprise'
  subscription_stripe_id VARCHAR(255),
  created_at TIMESTAMP
);

-- 2. USERS (Pessoas que usam)
CREATE TABLE users (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(50), -- 'admin', 'viewer'
  created_at TIMESTAMP
);

-- 3. FILIAIS (Lojas da Aeropostale)
CREATE TABLE filiais (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  codigo_millenium VARCHAR(50), -- Ex: "ITUPEVA"
  filial_millenium INTEGER, -- Ex: 30098297
  nome VARCHAR(255),
  metro_quadrado DECIMAL(10,2),
  uf VARCHAR(2),
  synced_at TIMESTAMP
);

-- 4. INDICADORES_CACHE (Cache dos indicadores calculados)
CREATE TABLE indicadores_cache (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  filial_id UUID NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  faturamento DECIMAL(15,2),
  ticket_medio DECIMAL(10,2),
  giro_estoque DECIMAL(5,2),
  margem_bruta DECIMAL(5,2),
  taxa_conversao DECIMAL(5,2),
  calculado_em TIMESTAMP,
  ttl TIMESTAMP -- Quando expirar cache
);
```

---

### 7. **Segurança - Rate Limiting**

```javascript
// Por usuário: 100 requests/min
// Por IP: 1000 requests/min
// Por API externa (Millennium): 10 requests/min

app.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100,
  keyGenerator: (req) => req.user.id, // Por usuário logado
}));
```

---

### 8. **Deployment - CI/CD Pipeline**

```
Git Push (main)
    ↓
GitHub Actions Trigger
    ↓
Tests (Unit + E2E)
    ↓
Build Docker Image
    ↓
Push to Registry (ECR/Docker Hub)
    ↓
Deploy to Staging (AWS)
    ↓
Smoke Tests
    ↓
Deploy to Production
    ↓
Notify Slack (Deploy concluído)
```

---

## 💡 DECISÕES DE PRODUTO

### 1. **MVP Scope: Top 5 Indicadores**

| Indicador | Dificuldade | Prioridade | Entrada MVP? |
|-----------|------------|-----------|-------------|
| **Faturamento** | Fácil | P0 | ✅ |
| **Ticket Médio** | Fácil | P0 | ✅ |
| **Giro de Estoque** | Média | P0 | ✅ |
| **CMV / Margem** | Média | P0 | ✅ |
| **Taxa de Conversão** | Difícil | P0 | ⚠️ Aproximada |
| Sell-Through | Difícil | P1 | ❌ v1.1 |
| Inadimplência | Fácil | P1 | ❌ v1.1 |
| UPC | Média | P2 | ❌ v1.2 |

**⚠️ Nota sobre Taxa de Conversão:** Millennium não rastreia visitantes (apenas vendas). MVP vai aproximar como:
```
Taxa Conversão ≈ (Qtde Cupons Únicos / Número de Clientes Potenciais)
Ou deixar como indicador futuro que precisa de câmera/WiFi na loja.
```

### 2. **Planos de Preço**

```
FREE (Para testar)
├─ 1 filial
├─ Dashboard básico
├─ Histórico 30 dias
└─ Sem suporte (apenas FAQ)

PRO (Para franquias)
├─ Até 5 filiais
├─ Todos os indicadores
├─ Histórico 12 meses
├─ Email prioritário
└─ R$ 199/mês (no lançamento: R$ 99/mês black friday)

ENTERPRISE
├─ Ilimitadas filiais
├─ Alertas automáticos
├─ Integração API
├─ Suporte dedicado
└─ Customizado (contato sales)
```

### 3. **Onboarding: Time to Value (TTV)**

**Meta: Usuário vê dashboard em < 5 minutos**

```
1. Sign up (Email + Senha) - 30s
2. Conectar Millennium API (Copiar Basic Auth) - 1min
3. Selecionar filiais - 1min
4. Dashboard auto-popula - 2min (while sync job roda)
5. Vê gráfico e 5 indicadores - ~5min
```

**Tour guiado:** Se primeira vez, mostrar tooltips nos gráficos

---

## 🔍 DECISÕES DE UX

### 1. **Dashboard Principal**

```
┌─────────────────────────────────────────────────────┐
│ Aeropostale Varejo | Olá, João                      │
├─────────────────────────────────────────────────────┤
│ Filtro: [Filial: ITUPEVA ▼] [Período: Ago 2026 ▼] │
├────────┬────────┬────────┬────────┬─────────────────┤
│Fatur.  │Ticket  │Giro    │Margem  │Taxa Conversão   │
│R$ 45K  │R$ 145  │5.2x    │58%     │15%             │
│↑ 12%   │↑ 8%    │↑ 0.3%  │↓ 2%    │↓ 5%            │
└────────┴────────┴────────┴────────┴─────────────────┘
│                                                      │
│ Gráfico: Faturamento (últimos 30 dias)             │
│ ┌────────────────────────────────────────────────┐ │
│ │                              ╱╲              ╱ │ │
│ │                    ╱╲      ╱  ╲           ╱   │ │
│ │      ╱╲           ╱  ╲   ╱    ╲       ╱       │ │
│ │    ╱   ╲    ╱╲   ╱    ╲╱      ╲   ╱          │ │
│ │  ╱      ╲╱   ╲╱                ╲╱           │ │
│ └────────────────────────────────────────────────┘ │
│                                                      │
│ Últimas Vendas                                     │
│ ┌─────────────┬──────────┬──────┬──────┐           │
│ │Data         │Cliente   │Total │Peças │           │
│ ├─────────────┼──────────┼──────┼──────┤           │
│ │30 ago 14:30 │TIAGO     │R$575 │3     │           │
│ │30 ago 10:15 │MARIANA   │R$280 │2     │           │
│ └─────────────┴──────────┴──────┴──────┘           │
└─────────────────────────────────────────────────────┘
```

### 2. **Cores e Design System**

```
Primária: #FF6B35 (Laranja - Identidade Aeropostale)
Secundária: #004E89 (Azul escuro - Confiança)
Sucesso: #06D6A0 (Verde)
Risco: #EF476F (Vermelho)
Neutro: #F7F7F7 (Fundo)

Tipografia: Inter (Google Fonts) - Limpo, moderno
```

---

## 📋 CHECKLIST ANTES DE LANÇAR (MVP)

- [ ] Testes: 100 vendas fictícias, validar fórmulas de indicadores
- [ ] Segurança: Penetration test básico (OWASP Top 10)
- [ ] Performance: Dashboard carrega em < 2s com 50K registros
- [ ] LGPD: Privacy policy + Terms revisados por jurista
- [ ] Backup: Primeiro backup manual + automático rodando
- [ ] Monitoring: Sentry capturando erros, Slack alertas ativas
- [ ] Suporte: Email de suporte respondendo (setup de templates)
- [ ] Docs: Help center com 10+ artigos principais
- [ ] Demo: Video de 2min mostrando how-to

---

## ⚠️ DÍVIDAS TÉCNICAS ACEITAS NO MVP

Coisas que faremos **depois** (v1.1+):

- ❌ Testes de performance avançados
- ❌ Replicação de DB (hot standby)
- ❌ CDN para assets estáticos
- ❌ GraphQL (REST é suficiente)
- ❌ Mobile app
- ❌ Dark mode
- ❌ Integração com BI tools
- ❌ Webhook customizado para clientes

---

## 📞 CONTATOS E RECURSOS

**API Millennium:**
- Endpoint Base: http://app.aeropostale.com.br:6017/api
- Credenciais: Armazenadas em AWS Secrets (Produção)
- Rate Limit: Respeitar 10 req/min

**Referências para Copiar:**
- Dashboard: Notion (onboarding), Stripe (design clean)
- Billing: Stripe docs + Paddle flow
- Monitoring: Sentry + DataDog

---

## 🎯 PRÓXIMAS DECISÕES NECESSÁRIAS

1. Confirmar se MVP é 1 filial ou todas?
2. Quem é o usuário principal? (Gerente? CFO? Franqueado?)
3. Dado bruto ou processado? (Mostrar raw data Millennium ou interpretado?)
4. Alertas desde o MVP ou v1.1?
5. Budget aprovado? (Server + Stripe fees + time)

