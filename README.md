# Join Network — Varejo

Piloto de indicadores de vendas da Aeropostale: Node.js, PostgreSQL 17 e Docker. Interface responsiva com autenticação Admin, vendas, PA, ticket médio, ranking, detalhes e conferência dos dados do ERP Millennium.

- [Comece aqui](COMECE_AQUI.md): estado atual e acesso.
- [Operação e implantação](docs/LOCAWEB.md).
- [Planejamento visual](docs/planejamento/index.html).
- [Desenho futuro do SaaS](docs/PLANEJAMENTO_SAAS.md).
- [API](apis/painel.md) e [banco/sincronização](database/README.md).

## Desenvolvimento

Use Node.js 22 ou superior e Docker Compose. Copie `.env.exemple` para `.env` e preencha os parâmetros locais. Nunca versione credenciais ou backups.

```sh
npm ci
docker compose up -d --wait postgres
npm run db:migrate
npm run admin:create
docker compose up -d --build --wait api
npm test
npm run test:integration
```

A sincronização exige credenciais do ERP e ativação explícita. O piloto está limitado a ITUPEVA até confirmar o agrupamento das demais filiais. Não habilitar simultaneamente workers locais e remotos com bancos independentes.

Os indicadores ainda dependem de homologação com o ERP. O cenário de dez clientes é planejamento futuro, não funcionalidade comercial já entregue.
