# Comece aqui — estado atual em 14/09/2026

## Backups: recuperação testada — 14/09/2026

- [x] Timer remoto ativo; última execução bem-sucedida. Na inspeção, backups ocupavam 11 MB e o servidor tinha 3,8 GB livres.
- [x] Backup `backup-20260914T115644Z-MXjfBi` copiado para `artifacts/deploy/backups/`, pasta privada fora do Git.
- [x] Checksums conferidos e ambos os dumps restaurados em PostgreSQL 17 descartável, sem rede. 26.062 operações, 60.731 itens, 895 cancelamentos, 14 filiais, 28 checkpoints, 1 Admin e 5 perfis recuperados. Sessões restauradas: zero, conforme política existente.
- [x] Container isolado removido após o teste; produção preservada. Cinco testes de validação de arquivos passaram.
- [ ] R14 em andamento: aguarda destino externo e definição da retenção. A cópia local realizada é manual, não uma rotina externa automática. Nenhum backup foi excluído.

Evidência: `docs/validacao-backup.json`. Teste reproduzível: `python3 scripts/verificar-backup.py CAMINHO_DO_BACKUP`. Requer Docker e imagem PostgreSQL 17. O teste não compara com os dados de produção que continuam mudando.

## Gestão de usuários publicada — 14/09/2026

- [x] Tela **Usuários**, exclusiva para Admin: criar, editar e desativar contas, alterar senha e atribuir cargo/filiais/vendedor.
- [x] Vendedores selecionados do histórico local de cada filial, sem consulta ao ERP. Vendas continua limitado às próprias operações.
- [x] Alterar usuário revoga suas sessões. Próprio Admin protegido contra alteração; isolamento entre empresas e validação dos vínculos no servidor.
- [x] 36 testes unitários e 31 de integração aprovados. Cadastro, login de vendedor, desativação e celular verificados com dados sintéticos; tela pública validada nas 14 filiais.
- [x] Backup concluído e API publicada saudável; worker permaneceu ativo. Nenhum usuário real foi criado automaticamente.
- [ ] R11 permanece aguardando os outros indicadores: Maylon informou que os dias consultados batem, mas ainda precisa conferir os totais do mês e do ano.

Kanban: **13 de 23 tarefas concluídas**. Evidências: `docs/validacao-usuarios-ui.json` e `docs/validacao-usuarios-producao.json`. Não há envio automático de convites ou senhas. Grupos personalizados e hierarquia continuam como evolução futura.

## Conferência parcial e sequência — 14/09/2026

Maylon informou que os dias consultados estão batendo; falta conferir os totais do mês e do ano. A conferência geral das filiais aguardará os outros indicadores, conforme solicitado. R11 permanece pendente, sem homologação mensal/anual. Seguimos com R13, cadastro de usuários e vínculos de acesso.

## Permissões publicadas e históricos atualizados — 14/09/2026

- [x] Gerenciador **Permissões** no painel: cargos à esquerda; abas Recursos e Acesso aos dados. Somente Admin pode editar, com configurações separadas por empresa.
- [x] Vendas limitado às próprias vendas por código de vendedor e filial; bloqueios verificados também em indicadores, ranking, detalhes, clientes e fotos.
- [x] Backup concluído, migration aplicada e API publicada saudável, mantendo a sincronização ativa.
- [x] 36 testes unitários e 30 de integração aprovados. Gravação/recarga, navegação de vendedor e celular validados em dados sintéticos; gerenciador e 14 filiais conferidos no domínio.
- [x] Os 28 checkpoints de vendas/cancelamentos alcançaram 14/09/2026. As 14 filiais estão com histórico atualizado até o dia corrente; a sincronização continua.
- [ ] Configurar os recursos de Diretoria, Supervisão e Gerentes na tela; esses cargos iniciam sem permissões para o Admin definir.
- [ ] Próximo passo R13: cadastro/desativação de usuários, cargo e vínculos de filial/vendedor. Grupos personalizados e hierarquia do exemplo permanecem evolução futura.
- [ ] R11: conferir com o ERP os totais das novas lojas. Carga concluída não representa homologação.

Evidências: `docs/validacao-permissoes-ui.json`, `docs/validacao-permissoes-producao.json` e `docs/validacao-producao.json`. O Kanban passou a 12 de 23 tarefas concluídas. Nenhum usuário real foi criado nesta entrega.

## Cadastro incremental e Kanban — 13/09/2026

- [x] Cadastro de filiais persistido no banco e sincronizado pelo worker usando `trans_id`; códigos do seletor lidos do banco.
- [x] Publicar migration e carregar os 14 cadastros; cursor inicial `58537686`. API pública e primeira rodada incremental automática validadas.
- [x] 35 testes unitários e 27 de integração aprovados: cursor atômico, falhas, retentativas e isolamento.
- [x] Adicionar quadro Kanban à central pessoal e ao roadmap, com progresso e lista de pendências. Notas preservadas e visual validado em desktop/celular.
- [ ] Concluir históricos das novas lojas. Na consulta de 13/09 às 21h30, checkpoints entre 18 e 25/08; ITUPEVA cobre 13/09.
- [ ] Conferir novos totais e implementar cargos/permissões por recurso e filial.

O quadro usa `config/roadmap.json`; `python3 scripts/gerar-central.py` atualiza o Markdown e o HTML pessoal. O Kanban mostra o estado registrado, sem consultar o servidor automaticamente. Evidências: `docs/validacao-trans-filiais.json`, `docs/validacao-producao.json` e `docs/validacao-kanban.json`.

## Seletor de filiais corrigido — 13/09/2026

- [x] Exibir `COD_FILIAL` do ERP nas 14 opções: ITUPEVA, AERO-009, AERO-010 e demais códigos conferidos na origem.
- [x] Preservar os IDs internos nos filtros e relacionamentos; códigos carregados da configuração local.
- [x] Publicação e troca de filial verificadas no celular; 24 testes de integração aprovados. Evidência: `docs/validacao-codigos-filiais.json`.

## Expansão iniciada — 13/09/2026

- [x] Cadastros das 14 filiais verificados no ERP após retentativas de consultas que expiraram.
- [x] Admin com 14 filiais no seletor; ITUPEVA continua como opção inicial.
- [x] Worker remoto publicado com limite de sete dias por recurso/filial em cada rodada, sem consultas paralelas ao ERP.
- [x] 32 testes unitários e 23 de integração aprovados, incluindo isolamento entre filiais autorizadas. API pública e troca de filial no celular verificadas.
- [ ] Histórico das 13 novas filiais em carga; a interface sinaliza cobertura parcial. A conclusão será verificada por checkpoints.
- [ ] Próxima entrega: cargos e permissões por recurso/filial; somente Admin está ativo.

Evidências: `docs/validacao-filiais.json`, `docs/validacao-producao.json` e `docs/validacao-expansao-ui.json`. A confirmação de ITUPEVA não homologa automaticamente os números das outras filiais.

## Homologação confirmada — 13/09/2026

- [x] Maylon confirmou a conferência dos indicadores de ITUPEVA após a pergunta sobre o período de 01/01 a 09/09/2026.
- [x] Referência do painel extraída e soma diária conferida contra os totais, sem nova consulta ao ERP. Relatório e ficha de aceite disponíveis na central pessoal.
- [x] Confirmação registrada em [validacao-homologacao.json](docs/validacao-homologacao.json). O relatório externo do ERP não foi anexado; não se trata de uma comparação automatizada com a origem.
- [x] Maylon confirmou as 14 filiais no mesmo ambiente Aeropostale.
- [x] Publicar acesso Admin às 14 filiais e iniciar carga gradual; novas lojas ainda com histórico parcial.
- [ ] Concluir históricos e implementar permissões para usuários restritos.

Esta confirmação encerra a homologação do piloto no escopo apresentado. Regras adicionais de bruto/líquido, devoluções e novas filiais continuam separadas. As 14 filiais autorizadas foram ativadas para Admin; o histórico das novas lojas está em carga.

## Clientes armazenados — 13/09/2026

- [x] Cliente gravado na mesma transação da venda, com atualização na reimportação.
- [x] Histórico preenchido: 4.031 operações em 253 dias, sem falhas ou pendências.
- [x] Valores, 9.660 itens, 75 cancelamentos e checkpoints preservados por comparação antes/depois.
- [x] Publicação validada em celular e desktop: cliente e telefone disponíveis sem consulta separada; worker remoto retomado.
- [x] 31 testes unitários e 22 de integração aprovados. Evidência: [validacao-clientes.json](docs/validacao-clientes.json).

Esta atualização substitui a consulta de clientes sob demanda publicada anteriormente. Os snapshots de clientes entram nos backups do tenant. O fluxo de mensagens será implementado futuramente sobre os contatos locais.

## Correções publicadas — 13/09/2026

- [x] Login e movimentações ajustados para celular, sem largura excedente da página.
- [x] Imagens entregues pela API autenticada em HTTPS e ampliação validada; URLs 404 na origem continuam com marcador de indisponibilidade.
- [x] Nome, DDD e telefones do cliente importados junto com a venda e armazenados no banco. Abrir detalhes consulta somente o painel, sem chamada ao ERP.
- [x] Mapa de progresso no início do roadmap; etapa atual: homologação dos números com Maylon.
- [x] GitHub configurado em `Maylon-santos/varejo_joinnetwork`; central pessoal e capturas permanecem ignoradas.

Validação: 32 testes unitários e 20 de integração aprovados. Verificação no domínio publicado com viewport mobile: login, cliente, telefone, foto, ampliação e logout. Evidência: [validacao-correcoes.json](docs/validacao-correcoes.json).

A central pessoal é atualizada com `python3 scripts/gerar-central.py`. O gerador preserva edições incorporadas ao HTML e guarda a versão anterior em `artifacts/central/`. Notas no armazenamento do navegador continuam nesse navegador; use o botão de exportação para levá-las a outro computador.

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
