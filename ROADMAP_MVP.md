# Roadmap — Aeropostale Varejo

## Mapa de progresso — 13/09/2026

**Estamos na etapa 5: homologação dos indicadores com Maylon. As correções do piloto foram publicadas e verificadas.**

| Etapa | Situação | Entrega / próximo passo |
| --- | --- | --- |
| 1. Importação e banco | Concluída | Histórico de ITUPEVA, cancelamentos e checkpoints |
| 2. Painel e Admin | Concluída | Vendas, PA, ticket, ranking e conferência |
| 3. Publicação Locaweb | Concluída | Domínio .com.br, HTTPS e backup diário |
| 4. Correções do piloto | Concluída | Login e movimentações mobile, fotos via API, cliente nos detalhes |
| 5. Homologação ERP | Pendente de Maylon | Conferir os indicadores com relatório da origem |
| 6. Outras filiais e cargos | Pendente | Confirmar agrupamento e implementar permissões |
| 7. SaaS comercial | Planejamento futuro | Provisionamento, planos e cobrança |

Fluxo: importação → painel → publicação → correções → **homologação (agora)** → expansão → SaaS.

Retomada: confira esta tabela, as evidências de validação e a última seção de tarefas. Não usar checklists históricos como status vigente.


## Publicação — 12/09/2026

- Piloto publicado em **https://aeropostale.joinnetwork.com.br** na Locaweb.
- Banco restaurado e conferido: 3.991 operações, 9.541 itens e 75 cancelamentos; hashes, totais e checkpoints iguais à origem antes de ativar o worker.
- HTTPS, login, indicadores, detalhes, logout e restrições de acesso verificados. Evidência: `docs/validacao-producao.json`.
- Worker remoto ativo; worker local parado e desabilitado no `.env`.
- Backup diário configurado; cópia inicial também preservada localmente. Retenção e cópia externa recorrente pendentes.
- Operação: [guia de implantação](deploy/README.md). Homologação dos números permanece pendente.

Esta publicação prevalece sobre referências históricas a implantação ou HTTPS pendentes abaixo.

## Decisão SaaS — 12/09/2026

- [x] Padrão aprovado: `cliente.joinnetwork.tech`, com identidade por cliente desde o login.
- [x] Desenho salvo para implementação futura: [planejamento SaaS](docs/PLANEJAMENTO_SAAS.md).
- [ ] Confirmar provedor DNS e preparar apontamento/HTTPS do piloto. Automação SaaS, planos e cobrança continuam futuros.

## Retomada — 11/09/2026

- [x] SSH `localweb` validado por consulta de leitura; Docker e Compose presentes.
- [x] Piloto local ativo: API e PostgreSQL saudáveis, worker em execução.
- [x] Revalidação: 26 testes unitários e 19 de integração aprovados.
- [x] Corrigir o resumo das cinco divergências conforme confirmação já registrada por Maylon.
- [x] Liberar capacidade no servidor em 12/09: painel antigo removido e limpeza autorizada de journals/cache concluída; 4,8 GB livres e 73% ocupado. Os 12 containers existentes permaneceram ativos.
- [ ] Definir domínio do piloto e concluir preparação de backup, restauração e implantação após resolver espaço.

Diagnóstico e sequência de implantação: [LOCAWEB.md](docs/LOCAWEB.md). Esta atualização prevalece sobre os registros históricos abaixo.


## Refinamentos solicitados por Maylon — 10/09/2026

- [x] Adicionar **PA (peças por atendimento)** ao ranking: peças do cabeçalho divididas pela quantidade de vendas elegíveis, exibidas com duas casas decimais.
- [x] Salvar as URLs de imagem dos itens e exibir miniatura de 40 × 40 px com botão discreto “+” para ampliar nos detalhes das movimentações. Imagens indisponíveis não impedem a consulta dos itens.
- [x] Preencher as imagens do histórico por correspondência de operação/item, sem alterar valores, quantidades, cancelamentos ou checkpoints. Nova passagem concluída sem pendências; evidência em `docs/validacao-imagens.json`.
- [ ] **Maylon:** definir em uma próxima rodada o cadastro das fotos de vendedores (upload manual ou aproveitamento do campo `foto` do ERP). Objetivo: exibir a foto ao lado do nome. Até lá, manter as iniciais.


## Estado atual — 10/09/2026

- [x] Login e painel visual disponíveis em **http://127.0.0.1:3100/**, conectados à API e ao PostgreSQL da filial piloto ITUPEVA.
- [x] Indicadores, gráfico, ranking paginado, filtros de datas, movimentações e detalhes dos itens; tela de conferência das divergências.
- [x] Estados de carregamento, vazio, erro com retentativa e dados parciais; sessão em memória, logout e retorno ao login quando revogada/expirada.
- [x] Layout próprio para desktop, tablet e celular, sem reutilizar os dashboards descartados. Maylon autorizou a criação da interface.
- [x] 25 testes unitários e 18 de integração aprovados. Verificação no Chrome: 13 cenários aprovados, sem erros JavaScript. Evidência: [validacao-interface.json](docs/validacao-interface.json).
- [x] **Maylon:** confirmar as cinco operações como erros do ERP. O painel usa os cabeçalhos preservados e identifica `erro_erp_confirmado`; evidência em [validacao-erros-erp.json](docs/validacao-erros-erp.json).
- [ ] **Maylon:** homologar os totais gerais com o relatório ERP; a confirmação dos cinco erros não substitui essa validação.
- [ ] **Maylon:** confirmar o agrupamento das demais filiais por empresa/tenant para liberar a expansão.
- [ ] **Responsável técnico:** reconsultar as datas das operações antigas após a correção no ERP; expandir a sincronização após a confirmação das filiais e preparar a implantação na Locaweb.

A homologação dos totais permanece pendente; os indicadores usam os cabeçalhos originais das vendas não canceladas. A entrega está disponível localmente. As seções abaixo preservam o histórico; este estado atual prevalece sobre pendências técnicas já resolvidas nas etapas posteriores.

Atualizado em 09/09/2026 após incorporar as respostas de Maylon e desconsiderar a pasta de ideias.

## Direção e decisões já registradas

Objetivo: disponibilizar rapidamente uma aplicação de indicadores de lojas e equipes, acessível por celular, tablet e desktop, preparada para evoluir para SaaS.

As respostas de Maylon prevalecem sobre sugestões anteriores:

- **Usuário inicial:** Admin; hierarquia e nomes de cargos configuráveis por empresa, com permissões por recurso e filial.
- **Escala desejada:** 1 a 100 filiais, conforme `COMECE_AQUI.md`. O diagnóstico anterior menciona 5 lojas atuais; a composição do piloto ainda precisa ser informada.
- **Base técnica definida:** Node.js, PostgreSQL e Docker, conforme `levantamento`.
- **Isolamento:** database por tenant (empresa), conforme resposta no diagnóstico. Filiais da mesma empresa não são tenants independentes por padrão.
- **Sincronização:** polling, buscando atualização próxima do tempo real e usando `trans_id` onde o contrato permitir. Millennium sem webhook, conforme levantamento.
- **Falhas:** preservar cursor; após três erros consecutivos, aumentar intervalo e alertar o administrador pela Talk.
- **Histórico:** retenção por tempo indeterminado solicitada; dimensionar armazenamento, backup e tratamento dos dados pessoais separadamente.
- **Credenciais:** Maylon informou que foram testadas. Não houve consulta ao ERP nesta revisão.
- **Prazo:** o mais breve possível. Datas antigas de dezembro e estimativas de equipe não são compromissos aprovados.

Pendências que exigem resposta estão centralizadas em [tarefas.md](tarefas.md). Este roadmap substitui as propostas conflitantes de sincronização diária, row-level tenancy e cinco indicadores obrigatórios presentes nos documentos antigos.

## Estado comprovado do projeto

Atualização de 09/09/2026: por orientação de Maylon, a pasta `teste` e seus dashboards são ideias inseridas por engano, fora do escopo e sem valor de implementação ou referência visual aprovada. Sua remoção será feita por Maylon. Não há aplicação, backend, banco ou autenticação implementados nesta pasta.

A preparação agora inclui [configuração do piloto](config/piloto.json), [modelo de ambiente](.env.exemple), [contrato em levantamento](docs/CONTRATO_MILLENNIUM.md) e [operações para conferência](docs/DIVERGENCIAS_VENDAS.md). O contrato ainda depende de validação com ERP; não houve chamada externa. As duas divergências anteriores foram preservadas apenas para a análise solicitada por Maylon, sem transformar a amostra descartada em fonte oficial.

## Decisões incorporadas em 09/09/2026

- Piloto interno de vendas aprovado, somente Admin, com acesso a todos os dados das filiais autorizadas. Cobrança apenas na abertura comercial.
- **14 filiais:** 30098400, 30098401, 30098409, 30098495, 30098696, 30098697, 30098704, 30098702, 30098708, 30098795, 30098802, 30098797, 30098699 e 30098297. Agrupamento por tenant ainda a confirmar.
- Carga inicial de **01/01/2026 a 09/09/2026**, seguida de sincronização contínua; intervalo pendente.
- Cada venda tem um vendedor. Operações S são vendas; evento identifica sua natureza. Exibir bruto e líquido após fechar suas definições.
- Hierarquia futura: Admin, Diretoria, Supervisão, Gerentes e Vendas, mantendo nomes configuráveis.
- Hospedagem no servidor existente da **Locaweb**, com capacidade/acesso ainda a levantar.
- SaaS **Join Network**, marca por cliente; piloto **Aeropostale**. Maylon descreverá o visual nas próximas entregas.
- Próximos módulos: **1. Aniversariantes/clientes; 2. Fila de atendimento; 3. Notificações internas; 4. Campanhas Talk**.
- Maylon providenciará fonte de custos. Não há contagem de visitantes; proposta de medição futura no contrato técnico.
- Maylon é responsável pela conferência e operação. A abrangência da retenção de dados pessoais continua pendente.

## Escopo proposto para a primeira entrega

Priorizar vendas, autenticação Admin, filtros por filial/período e consulta de produtos/estoque. Piloto de vendas aprovado em M01; produtos/estoque permanecem na sequência de expansão operacional.

| Indicador/recurso | Regra prevista | Dependência |
|---|---|---|
| Valor de vendas | Somar `valor_final` de operações elegíveis, com cancelamentos e devoluções tratados explicitamente | M04 e reconciliação dos totais |
| Quantidade de vendas | Contar operações distintas pela chave validada | Contrato ERP |
| Ticket médio | Valor de vendas / quantidade de vendas elegíveis | Mesma população no numerador e denominador |
| Peças vendidas | Somar quantidades elegíveis | Conferir cabeçalho versus itens |
| Peças por venda (PA) | Peças / quantidade de vendas elegíveis | Não dividir por clientes únicos |
| Ranking de vendedores | Valor, peças e ticket por identificador do vendedor | Regra para múltiplos vendedores, M04 |
| Produtos e estoque atual | Cadastro enriquecido e saldo por filial/SKU | Validar endpoints e significado de saldo disponível |

Divisão por zero deve produzir estado sem dados, sem inventar valor. Totais por período devem usar a data da operação, não a data atual do navegador.

**Dependentes de dados adicionais:** margem/CMV exigem custo confiável (o exemplo de saldo tem `preco_custo: null`); giro exige estoque médio histórico; sell-through exige entradas/compras; conversão exige visitantes e será compradores ÷ visitantes × 100, nunca uma estimativa baseada só em vendas. Ticket por vendedor é o valor das vendas daquele vendedor dividido pelos seus cupons, não faturamento da loja dividido por vendedores.

## Fase 0 — Fechar contrato de dados e preparar execução

Estado: em andamento documental; implementação ainda não iniciada.

- [x] Inventariar os arquivos e incorporar respostas existentes.
- [x] Registrar as operações divergentes solicitadas por Maylon, sem depender da pasta descartada.
- [x] Incorporar as respostas recebidas de M01–M10.
- [ ] Resolver somente as lacunas registradas como PEND01–PEND07 em `tarefas.md`.
- [ ] Documentar schema de respostas, tipos, campos opcionais, chaves, paginação, cancelamentos, devoluções e datas Millennium.
- [ ] Validar incremental por endpoint, limites de consulta e transporte seguro da conexão atualmente documentada em HTTP.
- [ ] Definir critérios de reconciliação usando relatório do ERP do mesmo período/filial.
- [ ] Preparar fixtures anonimizadas e registrar divergências encontradas.

**Saída:** contrato de dados utilizável, indicadores selecionados e piloto identificado. Ausência de resposta sobre uma funcionalidade bloqueia essa funcionalidade, não as tarefas independentes.

## Fase 1 — Fundação e primeira venda no dashboard

Dependência: contrato mínimo de vendas e filiais da fase 0.

- [ ] Criar repositório e estrutura de backend, frontend, banco e ambiente Docker.
- [ ] Registrar escolhas complementares de framework, fila, cache e hospedagem sem confundi-las com decisões já aprovadas.
- [ ] Modelar cadastro central de empresas e acesso ao banco de cada tenant; migrations, usuários, permissões, filiais, produtos, movimentos, itens, estoque, histórico e cursores.
- [ ] Implementar login Admin e autorização no servidor, com escopo de tenant e filial.
- [ ] Construir conector Millennium no backend, com segredos fora do frontend e dos logs.
- [ ] Importar filiais e vendas, persistir com idempotência e calcular indicadores no backend usando precisão monetária.
- [ ] Entregar dashboard com filtros reais, data da última sincronização, carregamento, vazio e erro.

**Saída:** uma filial reconciliada com ERP; reprocessar a mesma carga não duplica operações; usuário sem permissão não acessa outra empresa ou filial.

## Fase 2 — Atualização contínua e operação das lojas

Dependência: persistência e autorização da fase 1; frequência definida em M03.

- [ ] Implementar polling por tenant/filial/recurso, paginação e concorrência limitada.
- [ ] Avançar cursor apenas após persistir o lote completo com sucesso; retomar sem perda após falhas.
- [ ] Para vendas sem incremental confirmado, avaliar reconsulta de janela com deduplicação e reconciliação, incluindo cancelamentos tardios.
- [ ] Aplicar backoff após três erros consecutivos e integrar alerta Talk conforme M07, com controle de repetição.
- [ ] Incluir vendas resumidas/detalhadas, ranking, produtos e estoque por SKU.
- [ ] Implementar hierarquia configurável e permissões dos demais usuários conforme M05; vendedor limitado às próprias vendas e atendimentos, quando o módulo existir.
- [ ] Criar snapshots de estoque para possibilitar indicadores históricos futuros.

**Saída:** atualização dentro do intervalo acordado, recuperação de falha testada e totais consistentes por filial/período. Capacidade para 100 filiais depende de medição; o piloto terá 14 filiais.

## Fase 3 — Homologação e piloto

- [ ] Testar cálculos com descontos, devoluções, cancelamentos, duplicação, período vazio e mudança de data/fuso.
- [ ] Testar isolamento entre bancos/tenants, permissões, recuperação de sincronização e jornada de login/filtros.
- [ ] Medir carga de sincronização e dashboard para 14 e 100 filiais com dados representativos; registrar limites e latência observada.
- [ ] Preparar ambiente de homologação/produção, HTTPS, logs, healthcheck, backup e restauração verificada.
- [ ] Definir tratamento de dados pessoais, acessos, suporte e responsável operacional.
- [ ] Maylon validar os totais e a experiência nas lojas escolhidas (M10).
- [ ] Liberar o piloto após os critérios acima e registrar feedback.

**Saída:** piloto operacional com números homologados, falhas visíveis e recuperação comprovada.

## Fase 4 — Expansão operacional e SaaS

Prioridade a confirmar em M09; manter estes requisitos do levantamento no backlog:

- [ ] Fila de atendimento e vínculo entre atendimento, vendedor e venda.
- [ ] Clientes novos e aniversariantes por dia, semana e mês; definir novo cliente e disponibilidade dos dados.
- [ ] Notificações da hierarquia para equipes.
- [ ] Campanhas e WhatsApp via Talk, com público, permissões e regras de envio definidos.
- [ ] Comparativos históricos e entre filiais; vendas por canal quando houver origem confiável.
- [ ] Margem, giro, sell-through e conversão após obter os dados necessários.
- [ ] Billing, planos, preços, gateway, portal e onboarding comercial conforme M08.
- [ ] Exportações, BI, outros ERPs, app nativo e recursos de IA após validar a operação principal.

**Sequência aprovada:** piloto interno antes da cobrança SaaS, conforme M01/M08; a necessidade de billing no lançamento comercial permanece. Os preços e limites Free/Pro conflitantes dos documentos anteriores são sugestões não aprovadas.

## Sequência, prazo e recursos

Caminho crítico: **contrato ERP → persistência e acesso → indicadores reconciliados → polling → homologação → piloto**.

Não há data de lançamento ou orçamento fechado. Planejar datas após conhecer equipe/disponibilidade e respostas M01–M06. O orçamento deve separar desenvolvimento (pessoas/horas), hospedagem da aplicação, PostgreSQL, armazenamento/backups, monitoramento, domínio e Talk. Não reutilizar cotações antigas como valores atuais.

O refinamento do backlog podem avançar enquanto o contrato de dados é validado. Campanhas, billing e integrações futuras não devem bloquear o piloto conforme a sequência aprovada.

## Progresso em 09/09/2026 — descontos esclarecidos

Maylon confirmou as duas diferenças como descontos no cabeçalho e forneceu respostas completas com novos campos. As operações 30835456 e 30835576 conciliam com `subtotal dos itens + v_acerto = valor_final`; `acerto` é percentual informativo, sem nova aplicação do desconto.

Foi iniciado o backend com um módulo isolado de reconciliação em centavos e fixtures sem cadastros pessoais. **7 testes aprovados**. Isso atualiza o estado anterior de ausência total de código: servidor, banco, autenticação, integração e dashboard continuam pendentes. Não há dependência dos dashboards descartados.

A causa das duas diferenças está resolvida. Permanecem as regras gerais de bruto/líquido, frete/cortesia e devoluções, além de paginação/incremental e infraestrutura, conforme a seção mais recente de `tarefas.md`.

## Integração de vendas validada — 09/09/2026

Próximo marco concluído: leitura autenticada de 80 vendas de ITUPEVA, de 06 a 07/09/2026, com 100% de conciliação exata entre itens, ajuste monetário e total do ERP. Evidência em [validacao-vendas.json](docs/validacao-vendas.json). Não houve duplicidade na chave candidata neste lote.

O retorno não inclui `trans_id`. Antes da importação histórica, validar limites/paginação e mecanismo de atualização; preparar persistência por tenant e reprocessamento idempotente. A validação de dois dias não equivale à carga de janeiro em diante nem à homologação das 14 filiais.

## Chave e sequência confirmadas na análise — 09/09/2026

Maylon definiu a chave da operação como **(cod_operacao, tipo_operacao, filial)**, dentro do banco do tenant. Os scripts passam a usar essa combinação para detectar duplicidades.

Consulta de ITUPEVA de 01 a 08/09/2026: 159 operações, sendo **154 vendas S e 5 entradas E**; nenhuma chave composta repetida. Separando por tipo e filial, não houve ID de uma data posterior menor que ID de data anterior. As inversões observadas ao misturar tipos eram entre sequências S e E. A resposta da API não está ordenada por código e há saltos na numeração do conjunto.

Isso indica crescimento por data nessa amostra, mas não prova sequência global, ordem de criação nem suporte a filtro “maior que”. A chave composta identifica a operação; não substitui cursor de atualização. Alterações e cancelamentos antigos ainda exigem reconsulta/reconciliação.

- [ ] **Maylon / ERP:** confirmar se `cod_operacao` é sempre crescente dentro de tipo e filial e se existe filtro para códigos maiores que o último importado. O filtro documentado de código exato não comprova essa capacidade.

Evidência: `docs/sequencia-cod-operacao.json` (na raiz do projeto).

## Atualização — cancelamentos em fluxo separado (09/09/2026)

- [x] **Maylon:** confirmar código crescente por tipo + filial. Essa confirmação está encerrada.
- [x] **Responsável técnico:** validar `LISTAVENDASCANCELADAS` com filial e datas: HTTP 200, operação 30836007/S retornada. Filial obtida do contexto da consulta, pois não vem no corpo.
- [x] **Responsável técnico:** preparar processamento idempotente de cancelamentos e testar repetição, isolamento de chaves, cancelamento antes da venda e rejeição de lote inválido. Total: 11 testes aprovados incluindo reconciliação.
- [ ] **Maylon:** confirmar se as datas do endpoint filtram `data_cancelou`. Pergunta apresentada durante a validação.
- [ ] **Responsável técnico:** integrar jobs independentes de novas operações e cancelamentos, com checkpoint persistente, sobreposição de datas, atualização dos indicadores e recuperação após falhas. Ainda não implementados o banco e o agendador.
- [ ] **Maylon / ERP:** informar suporte/parâmetro de filtro de código maior que o último e paginação/limites. Código crescente já confirmado não precisa ser validado novamente.

Plano detalhado: `docs/SINCRONIZACAO_VENDAS.md` na raiz do projeto. A solução está adequada para o fluxo de cancelamentos, condicionada à semântica do filtro pela data do cancelamento.

## Filtros de cancelamento confirmados — 09/09/2026

- [x] **Maylon:** disponibilizar `data_caninicial` e `data_canfinal`, específicos da data de cancelamento. Esta pendência está encerrada; não usar os filtros de data da venda para o job de cancelamentos.
- [x] **Responsável técnico:** validar consulta real com ambos os filtros em 09/09/2026: HTTP 200, cancelamento 30836007/S retornado. O endpoint agora também retorna `filial = 30098297`; validar contra a filial solicitada. Evidência atualizada em `docs/validacao-cancelamentos.json`.
- [x] **Responsável técnico:** implementar conector e ciclo em `backend/src/sincronizar-cancelamentos.mjs`, com validação de período/filial, recusa de resposta explicitamente incompleta, retomada com sobreposição e checkpoint solicitado apenas depois da gravação dos eventos.
- [x] **Responsável técnico:** executar 15 testes, todos aprovados. Incluem filtros novos, retorno fora do período, paginação indicada, retomada após intervalo e ordem de gravação.
- [ ] **Responsável técnico:** implementar adaptador PostgreSQL com transação real, isolamento por tenant, bloqueio de ciclos concorrentes e agendador. O ciclo atual depende de um repositório injetado; os testes não comprovam rollback de um banco real. Nenhum polling contínuo foi ativado.
- [ ] **Maylon:** preencher `CONTROL_DATABASE_URL` e `TENANT_DATABASE_URL` no `.env` para a conexão persistente, ou indicar que o PostgreSQL deve ser provisionado localmente. As duas variáveis ainda estão vazias.

As observações anteriores sobre filtros de datas ainda indefinidos e ausência de filial no retorno foram superadas por esta validação. Limites/paginação geral e busca de novas operações por código maior continuam em aberto; uma resposta completa de um evento não comprova limites gerais.

## PostgreSQL local pronto

- [x] Criar `compose.yaml`, iniciar Docker Desktop e subir PostgreSQL 17 com volume persistente e healthcheck saudável.
- [x] Criar bancos `varejo_control` e `varejo_aeropostale`, com usuários/senhas distintos e bloqueio de conexão cruzada.
- [x] Preencher `CONTROL_DATABASE_URL` e `TENANT_DATABASE_URL` no `.env`, preservando tokens existentes. Pendência anterior de banco local encerrada.
- [x] Validar autenticação, criação/escrita/leitura em transação revertida e recusa de acesso cruzado. Serviço disponível em `127.0.0.1:55432`.
- [ ] Próxima etapa: migrations das operações/cancelamentos/checkpoints e adaptador transacional PostgreSQL. Não há carga ERP nem agendador persistente ativado nesta entrega.

Instruções de operação: `database/README.md`. Banco instalado localmente; servidor Locaweb ainda não alterado.

## Persistência PostgreSQL implementada — 09/09/2026

- [x] **Responsável técnico:** aplicar migrations versionadas no banco central e no tenant, com tabelas de operações, cancelamentos e checkpoints, identidade do tenant e view de operações ativas.
- [x] **Responsável técnico:** implementar repositório com transação real, consultas parametrizadas, bloqueio por filial e verificação da identidade do tenant. Cancelamentos e checkpoint são confirmados juntos; falha reverte ambos.
- [x] **Responsável técnico:** testar cancelamento antes/depois da venda, reimportação sem reativar cancelada, chave composta, concorrência, isolamento e rollback. **15 testes unitários + 8 testes de integração PostgreSQL aprovados**. Schemas temporários removidos ao final.
- [x] **Responsável técnico:** consultar e gravar duas vezes o cancelamento real 30836007/S de ITUPEVA em 09/09/2026. Conferência final: **1 registro**, sem duplicação; checkpoint nulo porque a execução foi uma amostra. Evidência: `docs/validacao-persistencia.json`.
- [x] **Responsável técnico:** disponibilizar `npm run db:migrate`, `npm run test:integration` e `npm run sync:cancelamentos`. Instruções em `database/README.md`.
- [ ] **Responsável técnico:** implementar importação completa de vendas/itens e carga histórica em janelas, confirmar paginação e então ativar agendamento e recuperação periódica. Não houve importação do histórico nem polling contínuo nesta entrega.
- [ ] **Maylon:** confirmar agrupamento das demais filiais por tenant. A filial ITUPEVA já validada está liberada no comando; as outras não foram importadas. Informar parâmetro de filtro por código maior e paginação quando disponível; crescimento do código e filtros de cancelamento já estão confirmados.

As pendências antigas de banco vazio e ausência de adaptador transacional estão resolvidas. O banco local é operacional; deploy na Locaweb continua separado.

## Histórico e worker periódico — 09/09/2026

- [x] Implementar importação diária de operações, itens e vendedor, com checkpoints separados de vendas/cancelamentos, persistência transacional e recuperação por janela.
- [x] Tratar duplicatas idênticas da API sem duplicar registros; recusar dados conflitantes. Encontrada cópia idêntica da chave 30808763/S/30098297 em 07/04/2026.
- [x] Executar **21 testes de regra e 10 de integração PostgreSQL**, todos aprovados.
- [x] Gravar **1.251 operações** (1.190 S e 61 E) e **2.911 itens**, com checkpoint até **10/04/2026**. Das operações importadas, 1.173 conciliadas; 78 entradas/canceladas não elegíveis. Zero chaves duplicadas no banco.
- [x] Carregar **75 cancelamentos** de janeiro até **09/09/2026** em fluxo separado.
- [x] Construir e iniciar o serviço Docker `sync-worker`, restrito a ITUPEVA, intervalo base **360 segundos**, retentativas persistentes e backoff após três falhas. `SYNC_ENABLED=true`. Não envia mensagens Talk.
- [ ] **Maylon / ERP:** corrigir HTTP 400 em LISTAVENDAS, filial 30098297, **11/04/2026**: `Error trying to write field numero at MILLENIUM!JOINNETWORK.VAREJO.ENDERECOS to N`. Maylon respondeu “ok”; o novo teste ainda falhou. Não pular a data nem avançar checkpoint. Após correção, o worker retomará automaticamente.
- [ ] Concluir a carga de vendas de 11/04 em diante e homologar os totais com o ERP. A carga histórica **não está completa**.
- [ ] Confirmar agrupamento das outras filiais antes de habilitá-las. Agendamento e persistência da filial piloto já estão ativos; deploy Locaweb e reconciliação de alterações antigas continuam pendentes.

Evidência: `docs/validacao-historico.json`. Operação: `database/README.md`.

## Correção de 11/04/2026 confirmada

- [x] **Maylon / ERP:** corrigir a serialização do campo `numero` do endereço. Nova consulta de 11/04/2026 para ITUPEVA retornou 26 operações válidas e nenhuma chave duplicada.
- A falha anterior `ERP_HTTP_400` desse dia foi resolvida; carga retomada do checkpoint preservado. O resultado final da retomada será registrado abaixo.

## Retomada concluída após correção de 11/04

- [x] Validar novamente 11/04: 26 operações e nenhuma chave repetida.
- [x] Retomar do checkpoint e concluir a carga inicial de ITUPEVA de **01/01 a 09/09/2026**, com checkpoints de vendas e cancelamentos em 09/09 e falhas consecutivas zeradas.
- [x] Conferir **3.968 operações** (3.835 S e 133 E), **9.477 itens** e **75 cancelamentos**, sem chaves duplicadas. Classificação de conciliação: 3.769 conciliadas, 194 não elegíveis (entradas/canceladas) e 5 com quantidade divergente.
- [x] Reativar o worker periódico no Docker, com intervalo base de 6 minutos.
- [ ] **Maylon / ERP:** conferir as cinco operações com diferenças de quantidade e valor dos itens: **30816297, 30817402, 30824570, 30824900 e 30826165**. Detalhes em `docs/CONFERENCIA_HISTORICO.md`. Valores originais preservados. Após corrigir, reconsultar essas datas antigas explicitamente.

O bloqueio de 11/04 está resolvido. Importação inicial concluída para a filial piloto; homologação dos números e expansão para outras filiais permanecem pendentes. Evidência: `docs/validacao-historico.json`.

## API e acesso Admin entregues — 10/09/2026

- [x] Criar Admin inicial no banco central, com hash scrypt de senha e sessão opaca de 8 horas, revogável no logout. Credenciais iniciais somente em `ADMIN_EMAIL`/`ADMIN_PASSWORD` no `.env`; não foram exibidas. Cadastro público e recuperação de senha não fazem parte desta etapa.
- [x] Implementar login, logout, usuário atual, filiais autorizadas, indicadores com série diária, vendas paginadas, ranking por vendedor e detalhe por chave composta. Tenant fixado no servidor; acesso piloto limitado a ITUPEVA.
- [x] Usar operações S não canceladas para totais, ticket e PA, com valores do cabeçalho ERP. Exibir pendências, checkpoints e último sucesso. As cinco divergências continuam sinalizadas; bruto/líquido e devoluções permanecem sujeitos à homologação.
- [x] Subir serviço `api` no Docker, saudável em **http://127.0.0.1:3100**. Porta 3000 ocupada por outro serviço; `PORT` local atualizado para 3100. Worker e banco mantidos.
- [x] Executar **24 testes de regra + 18 de integração**, todos aprovados. Verificar também no banco real: login/indicadores/ranking/vendas/detalhe/logout HTTP 200; anônimo 401; filial não autorizada 403; sessão revogada após logout.
- [x] Documentar rotas em `apis/painel.md` e contrato OpenAPI em `apis/painel.openapi.json`. Evidência em `docs/validacao-api.json`. No recorte de 01/01 a 09/09: 3.774 vendas elegíveis, cinco com pendência; listagem e indicadores com mesma contagem.
- [x] **Maylon:** autorizar a criação da interface com direção visual própria; dashboards descartados desconsiderados.
- [x] Implementar interface de login e painel conectados à API, estados de erro/vazio/dados parciais, filtros e conferência das operações. Concluído em 10/09/2026; veja o estado atual no início deste documento.

Sessões opacas persistidas substituem a sugestão histórica de JWT nesta implementação inicial, permitindo revogação imediata sem lista externa de bloqueio. Sem expansão das outras filiais e sem deploy na Locaweb nesta etapa.

Endereço definitivo informado por Maylon para o piloto: `aeropostale.joinnetwork.com.br`. Apontamento A para a Locaweb confirmado em 1.1.1.1; propagação ainda não uniforme. Publicação e HTTPS pendentes. O padrão `.tech` anterior permanece apenas referência da discussão SaaS futura.
