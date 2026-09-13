# Comece aqui — estado atual em 11/09/2026

## Publicação — 12/09/2026

- Piloto publicado em **https://aeropostale.joinnetwork.com.br** na Locaweb.
- Banco restaurado e conferido: 3.991 operações, 9.541 itens e 75 cancelamentos; hashes, totais e checkpoints iguais à origem antes de ativar o worker.
- HTTPS, login, indicadores, detalhes, logout e restrições de acesso verificados. Evidência: `docs/validacao-producao.json`.
- Worker remoto ativo; worker local parado e desabilitado no `.env`.
- Backup diário configurado; cópia inicial também preservada localmente. Retenção e cópia externa recorrente pendentes.
- Operação: [guia de implantação](deploy/README.md). Homologação dos números permanece pendente.

Esta publicação prevalece sobre referências históricas a implantação ou HTTPS pendentes abaixo.

O painel de vendas da filial piloto ITUPEVA está disponível em **http://127.0.0.1:3100/**. Entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env` local.

A interface inclui indicadores, evolução das vendas, ranking por vendedor, filtros por período, movimentações e detalhes de cada operação. A aba Conferência lista as diferenças encontradas nos dados. Selecione **01/01 a 09/09/2026** para revisar o histórico inicial completo e as cinco operações já confirmadas por Maylon como erros do ERP. Os cabeçalhos foram preservados; essas operações são identificadas como `erro_erp_confirmado`. Os totais ainda aguardam homologação com o ERP.

PostgreSQL 17, API e worker executam no Docker. O banco usa a porta local `55432`; a aplicação, `3100`. O worker consulta vendas e cancelamentos separadamente, com intervalo base de seis minutos. O erro do ERP de 11/04 foi corrigido e o histórico inicial foi concluído. As outras filiais aguardam confirmação de agrupamento por tenant.

Para iniciar os serviços existentes:

```sh
docker compose up -d --build --wait
```

A sessão fica somente na memória do navegador: recarregar a página exige novo login. As credenciais não são incorporadas aos arquivos da interface.

- [Roadmap vigente](ROADMAP_MVP.md) e [tarefas de Maylon](tarefas.md).
- [Interface e verificação no navegador](frontend/README.md).
- [API e autenticação](apis/painel.md).
- [Banco e sincronização](database/README.md).
- [Conferência das cinco operações](docs/CONFERENCIA_HISTORICO.md).
- [Evidência da interface](docs/validacao-interface.json).

Validação: 26 testes unitários e 19 de integração PostgreSQL aprovados na retomada de 11/09. A validação anterior da interface registrou 13 cenários de navegador aprovados. Layout revisado em desktop, tablet e celular. Os dashboards antigos da pasta `teste` foram desconsiderados. A implantação na Locaweb ainda não foi realizada.

Acesso SSH `localweb` verificado em 11/09. Limpeza autorizada concluída em 12/09: painel antigo removido, journals/cache limpos e 4,8 GB livres (73% ocupado). Implantação aguarda definição do domínio e preparação de backup/restauração e produção. Consulte [preparação Locaweb](docs/LOCAWEB.md).

Padrão de acesso aprovado: `cliente.joinnetwork.tech`. Desenho futuro e automação documentados em [PLANEJAMENTO_SAAS.md](docs/PLANEJAMENTO_SAAS.md).

Endereço definitivo informado por Maylon para o piloto: `aeropostale.joinnetwork.com.br`. Apontamento A para a Locaweb confirmado em 1.1.1.1; propagação ainda não uniforme. Publicação e HTTPS pendentes. O padrão `.tech` anterior permanece apenas referência da discussão SaaS futura.
