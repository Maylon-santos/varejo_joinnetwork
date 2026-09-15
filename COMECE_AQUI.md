# Comece aqui — estado atual em 15/09/2026

## Lista da Vez publicada — R16.1 — 15/09/2026

- [x] Jornada por empresa/filial/dia, seleção de presentes e ordem inicial manual.
- [x] Abordagem, não iniciado com motivo e preservação da vez, início e conclusão com/sem venda informada.
- [x] Pausa retorna ao final; reservado preserva prioridade; um atendimento aberto por vendedor. Presença, ausência e chegada tardia registradas.
- [x] Fechamento bloqueado com atendimentos abertos; continuidade após meia-noite sem apagar registros. A nova jornada exige encerramento da anterior.
- [x] Transações, versão da fila, requisições idempotentes e eventos de auditoria. Permissões de consulta/operação/gestão no gerenciador por empresa; apenas Admin recebe acesso automaticamente.
- [x] 48 testes unitários e 40 de integração aprovados. Fluxo real de interface com dados sintéticos em desktop/celular; recarga e restrições de vendedor verificadas.
- [x] Backup `backup-20260915T045251Z-YmDxjA`, migrations aplicadas, API saudável e worker ativo. Menu/consulta pública verificados nas 14 filiais; nenhuma jornada real aberta pelos testes.
- [ ] R16.2: relatórios consolidados, movimento intenso e exceções gerenciais.
- [ ] R16.3: vincular atendimento à operação ERP. Venda informada ainda não equivale a venda confirmada.

Como usar: **Lista da Vez → loja/dia → adicionar presentes → ajustar ordem → Abrir jornada**. Demais cargos precisam ser habilitados em Permissões e ter seus vínculos de filial/vendedor configurados. AERO-023 e AERO-MKTP ainda não têm vendedores no histórico local para montar a fila.

R16 permanece em andamento, com R16.1 concluída; Kanban mantém **16 de 26 tarefas completas**. Planejamento e manual: `docs/PLANEJAMENTO_FILA_ATENDIMENTO.md`. Evidências: `docs/validacao-fila.json`, `docs/validacao-fila-ui.json`, `docs/validacao-fila-producao.json`.


## Fila de atendimento: requisitos organizados — 15/09/2026

Maylon adicionou o fluxo da Lista da Vez ao arquivo pessoal de correções. Planejamento consolidado em `docs/PLANEJAMENTO_FILA_ATENDIMENTO.md`: abertura diária por filial, ordem dos vendedores, abordagem, resultados, pausas, reservado, movimento intenso e relatório.

R16 está **em andamento na especificação**, sem funcionalidade publicada. Maylon confirmou: retorno de pausa ao final da fila e movimento intenso apenas flexibiliza a ordem, sem atendimentos simultâneos por vendedor. A primeira etapa proposta é jornada/vez/atendimento; relatórios e integração com venda ERP vêm em etapas explícitas. Resultado informado pelo vendedor não equivale a venda confirmada no ERP.

Kanban permanece com **16 de 26 tarefas concluídas**. Nenhuma tarefa de implementação foi marcada como concluída. R25/R26 continuam com a última fotografia registrada, sem nova consulta ao servidor nesta atualização.


## Clientes e aniversariantes publicados — 14/09/2026

R15 entregue; Kanban com **16 de 26 tarefas concluídas**. R26 separa a carga histórica da funcionalidade publicada.

- [x] Menu **Clientes**: busca por nome/código, contatos e filtro de aniversariantes por mês.
- [x] Agrupar pelo `customers.cliente` do ERP, preservado como `cliente_codigo`. Nomes e telefones iguais não unem pessoas distintas.
- [x] Usar somente movimentações da filial/período selecionados e do vendedor autorizado. Os contatos vêm da movimentação mais recente dentro desse acesso; nenhuma consulta ao ERP ao abrir a tela.
- [x] Fonte de aniversário validada: 59 ocorrências preenchidas em 152 registros de clientes de ITUPEVA, de 01 a 07/09. Formato Millennium, convertido em São Paulo; persistir apenas mês/dia, sem ano de nascimento. Ausência permanece explícita.
- [x] Migration 008, backup `backup-20260915T021925Z-tVk6x2` e publicação concluídos. Amostra de 154 operações preenchida com hashes dos demais campos, itens e checkpoints preservados. API saudável e worker ativo.
- [x] 42 testes unitários e 35 de integração aprovados. Busca, aniversário bissexto, isolamento, paginação, backoff, desktop e celular verificados. Na amostra pública: **111 clientes identificados, 48 com aniversário**, filtros dos 12 meses aprovados.
- [ ] R26: em 14/09 às 23h20 de Brasília, 217 operações identificadas e 25.880 pendentes; primeira rodada das 14 filiais sem erros. Um dia por filial/rodada, cooldown de 360 segundos. As novas vendas já importam identidade/aniversário junto com os demais dados.

A consulta é um cadastro de leitura derivado dos snapshots locais, agrupado por código dentro dos filtros autorizados. Ainda não é um cadastro editável independente nem uma lista irrestrita de todos os clientes do ERP. Essas evoluções pertencem aos próximos fluxos de atendimento. R16 é a próxima tarefa funcional; R22/R19 seguem com os novos indicadores, e R11 aguarda sua inclusão para conferência mensal/anual.

Evidências: `docs/validacao-fonte-clientes.json`, `docs/validacao-clientes-ui.json`, `docs/validacao-clientes-producao.json` e `docs/validacao-identidade-clientes.json`.


## Ajustes de preços e pagamento publicados — 14/09/2026

Os novos pedidos do `correcao.md` foram encaixados antes de R15, pois complementam a importação atual e fornecem dados para R19. R24 cobre importação/interface; R25 acompanha o preenchimento do histórico. A inclusão dessas duas tarefas levou o quadro a 25 tarefas, com **15 concluídas**.

- [x] Exibir código do produto e SKU, preço de tabela, desconto informado, preço e preço aplicado.
- [x] Mostrar ⚠️ quando o desconto recebido é zero e o aplicado fica abaixo da tabela. Ausência não equivale a zero; aviso não altera indicadores.
- [x] Importar condição e lançamentos junto com a venda; mostrar condição e detalhes amigáveis das parcelas a partir do banco.
- [x] Respeitar filial/vendedor e remover histórico/gerador das parcelas quando o usuário não tem acesso a clientes.
- [x] Backup, migration e publicação concluídos. Amostra de 53 operações de ITUPEVA em 13/09 preenchida com hashes dos dados comerciais, itens e checkpoints preservados.
- [x] 39 testes unitários, 33 de integração e navegador desktop/celular aprovados. API saudável e worker remoto ativo.
- [ ] R25: concluir histórico. Na consulta às 21h08 UTC: 731 preenchidas, 25.359 pendentes. Quatro filiais tinham divergências registradas aguardando retentativa/revisão; não foram sobrescritas para forçar preenchimento.
- [ ] Confirmar unidade do desconto em R22; por enquanto exibir o valor original com rótulo neutro, sem presumir percentual ou reais.

Sequência: **R24 publicado → R25 cobertura histórica → R15 cadastro unificado/fonte de aniversário → R22/R19 indicadores → R11 conferência mensal/anual**. R15 pode avançar enquanto R25 executa. Evidências: `docs/validacao-complementos.json`, `docs/validacao-complementos-ui.json` e `docs/validacao-complementos-producao.json`.

## Backups externos e retenção ativados — 14/09/2026

- [x] Destino confirmado: **mabookhome**, pasta `/Users/maylonsantos/Backups/JoinNetwork/Aeropostale`. Dez backups completos recebidos e verificados por checksum.
- [x] Coleta automática a cada hora, no minuto 17, via crontab do usuário; execuções reais em segundo plano confirmadas. Não depende de sessão gráfica. O Mac precisa estar ligado, acordado e conectado.
- [x] Chave SSH exclusiva no Mac; o servidor aceita somente exportação e confirmação de backups, sem shell ou encaminhamento de portas. Nenhuma instalação de Tailscale foi necessária.
- [x] Política final de Maylon: **5 dias na Locaweb e 90 dias no Mac**. Limpeza remota somente após confirmação dos hashes externos; sem cópia confirmada, preserva os arquivos mesmo além do prazo. A última cópia completa é preservada.
- [x] Recuperação isolada previamente aprovada; 14 testes de integridade, transferência e retenção aprovados. Nenhuma exclusão necessária na primeira execução porque todos os backups estão dentro do prazo.

R14 concluída; Kanban em **14 de 23 tarefas**. Evidências: `docs/validacao-backup-externo.json` e `docs/validacao-backup.json`. Próxima tarefa: R15, cadastro unificado de clientes e validação da fonte de aniversário. Conferência mensal/anual continua aguardando os novos indicadores.

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
