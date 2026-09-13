# Lista de tarefas — Aeropostale Varejo

## Correções publicadas — 13/09/2026

- [x] Login e movimentações ajustados para celular, sem largura excedente da página.
- [x] Imagens entregues pela API autenticada em HTTPS e ampliação validada; URLs 404 na origem continuam com marcador de indisponibilidade.
- [x] Nome, DDD e telefones do cliente consultados no ERP ao abrir os detalhes, sem persistência de cadastros.
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

## Decisão SaaS — 12/09/2026

- [x] Padrão aprovado: `cliente.joinnetwork.tech`, com identidade por cliente desde o login.
- [x] Desenho salvo para implementação futura: [planejamento SaaS](docs/PLANEJAMENTO_SAAS.md).
- [ ] Confirmar provedor DNS e preparar apontamento/HTTPS do piloto. Automação SaaS, planos e cobrança continuam futuros.

## Retomada — 11/09/2026
https://github.com/Maylon-santos/varejo_joinnetwork.git

- [x] SSH `localweb` validado por consulta de leitura; Docker e Compose presentes.
- [x] Piloto local ativo: API e PostgreSQL saudáveis, worker em execução.
- [x] Revalidação: 26 testes unitários e 19 de integração aprovados.
- [x] Corrigir o resumo das cinco divergências conforme confirmação já registrada por Maylon.
- [x] Liberar capacidade no servidor em 12/09: painel antigo removido e limpeza autorizada de journals/cache concluída; 4,8 GB livres e 73% ocupado. Os 12 containers existentes permaneceram ativos.
- [ ] Definir domínio do piloto e concluir preparação de backup, restauração e implantação após resolver espaço.

Diagnóstico e sequência de implantação: [LOCAWEB.md](docs/LOCAWEB.md). Esta atualização prevalece sobre os registros históricos abaixo.


## Refinamentos solicitados por Maylon — 10/09/2026

- [ ] **Maylon / ERP:** revisar URLs de fotos que retornam HTTP 404. Encontradas na amostra; miniaturas válidas e ampliação foram verificadas no Chrome. Fotos ausentes exibem um marcador discreto, sem interromper a consulta.
- [x] Validar 26 testes unitários e 18 de integração; conferir PA, miniatura real, ampliação e retorno aos detalhes no Chrome.

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

Atualizada em 09/09/2026. Referência: [ROADMAP_MVP.md](ROADMAP_MVP.md).

`[x]` indica conclusão comprovada; `[ ]` indica pendência. **Maylon** identifica tudo que depende de sua resposta ou validação. Responsável técnico indica trabalho de implementação, sem atribuir uma pessoa ainda não definida.

## Respostas já aproveitadas

- [x] **Maylon:** Node.js, PostgreSQL e Docker definidos no levantamento.
- [x] **Maylon:** banco separado por empresa, hierarquia configurável e histórico por tempo indeterminado registrados no diagnóstico.
- [x] **Maylon:** polling com intenção de atualização em tempo real, preservação de cursor e alerta Talk após três erros registrados.
- [x] **Maylon:** Admin como usuário inicial, faixa de 1 a 100 filiais, prioridade para lançar logo e credenciais informadas como testadas registrados no guia inicial. A validação técnica não foi repetida nesta revisão.

## Respostas prioritárias de Maylon

### M01 — Primeira entrega
- [ ] **Maylon:** confirmar se podemos lançar primeiro um piloto interno com vendas, quantidade de vendas, ticket médio, peças, PA, ranking e consulta de produtos/estoque, deixando cobrança comercial e campanhas para depois. Se algo for indispensável no primeiro acesso, indicar aqui.

R: Sim podemos lancar o piloto com os dados das vendas.

**Resposta de Maylon:**

### M02 — Filiais do piloto
- [ ] **Maylon:** informar quais filiais entram primeiro, seus códigos/IDs e se pertencem à mesma empresa/tenant. O diagnóstico cita 5 lojas e a resposta mais recente prevê de 1 a 100; precisamos identificar a carga inicial, sem alterar a capacidade desejada.

R:
essas sao as filiais que entram primeiro 
('30098400',
				'30098401',
				'30098409',
				'30098495',
				'30098696',
				'30098697',
				'30098704',
				'30098702',
				'30098708',
				'30098795',
				'30098802',
				'30098797',
				'30098699',
				'30098297')

**Resposta de Maylon:**

### M03 — Frequência e histórico inicial
- [ ] **Maylon:** informar o atraso máximo aceitável para vendas aparecerem (em segundos/minutos), horário de operação e desde qual data importar o histórico. A retenção indeterminada já está registrada; esta pergunta trata da carga inicial. O intervalo possível será medido contra os limites do ERP.

Vamos filtrar as vendas a partir de janeiro de 2026 ate o dia de hoje 
01/01/2026 a 09/09/2026 



**Resposta de Maylon:**

### M04 — Regras de vendas e validação ERP
- [ ] **Maylon:** indicar quem pode validar o contrato Millennium e disponibilizar a referência do relatório ERP de ITUPEVA de 01 a 08/09/2026. Confirmar quais operações são vendas, devoluções e trocas; se o dashboard deve destacar bruto e líquido; e como atribuir vendas com mais de um vendedor. Existem duas divergências entre soma dos itens e total da operação na amostra.


R: As vendas sao com somente um vendedor, e sim precisamos mostrar o valor bruto e valor liquido.
pontu quais sao as duas vendas que possuem divergencias e eu analiso para ver oque esta divergente.
as operacoes com "tipo_operacao": "S" sao as operacoes de vendas e o nome do evento indica que foi a venda 
"codigo": "FR-02",
"descricao_evento": "VENDA VAREJO CUPOM FISCAL  - FRANQUIA",

**Resposta de Maylon:**

### M05 — Permissões
- [ ] **Maylon:** informar os níveis iniciais da hierarquia, quais filiais cada nível pode ver e quem gerencia usuários/configurações. Confirmar se o primeiro piloto pode começar só com Admin ou se outros níveis precisam estar disponíveis desde o início. Os nomes dos cargos continuarão configuráveis.

R: A piloto pode ser somente com admin onde precisa ter todos os dados 

a hirarquia deve ser 

Admin 
Diretoria
Supervisao
Gerentes 
Vendas

**Resposta de Maylon:**

### M06 — Recursos e infraestrutura
- [ ] **Maylon:** informar quem desenvolverá e quantas horas semanais estarão disponíveis; teto mensal em reais para aplicação/banco, backups, monitoramento e Talk; e se já existem servidor, domínio e ambiente de hospedagem. Separar esse teto do orçamento de desenvolvimento. Caso haja uma data limite concreta, registrá-la.

R: Vamos hospedar em nosso servidor da localweb 



**Resposta de Maylon:**

## Respostas necessárias antes dos respectivos módulos

### M07 — Talk e alerta operacional
- [ ] **Maylon:** indicar onde está a documentação da API Talk, se há ambiente de teste e qual administrador/canal receberá alertas. Informar onde configurar o segredo com segurança, sem colar token neste arquivo. Necessário antes de integrar os alertas da fase 2.

R:pasta apis/talk.md
crie um .env.exemple para que possamos criar o .env para incluir os tokens 



**Resposta de Maylon:**

### M08 — Comercialização
- [ ] **Maylon:** definir se haverá cobrança no piloto ou apenas na abertura comercial. Antes do módulo comercial, definir unidade de cobrança (empresa, filial ou usuário), planos/limites, preços e gateway. As sugestões antigas divergem e não são decisões aprovadas.


R: apenas na abertura comercial 


**Resposta de Maylon:**

### M09 — Visual e próximas funcionalidades
- [ ] **Maylon:** escolher a referência visual entre `teste/dashboard.html` e `teste/dashboad_2.html`, ou descrever os ajustes desejados; confirmar a marca exibida (Aeropostale, Joinnetwork ou outra), pois a segunda página usa Seline Analytics.

R: Visuais vou descrever nas proximas entregas 
a marca exibida  sera por marca mais no saas sera como Join Network 
no caso o cliente que vamos iniciar a piloto e aeropostale.


- [ ] **Maylon:** ordenar as próximas entregas: fila de atendimento, aniversariantes/clientes novos, notificações internas, campanhas Talk, comparativos e exportações. Para indicadores de margem e conversão, indicar se há fonte de custos e contagem de visitantes.



R: 1 Aniversariantes/ Clientes 
   2 fila de atendimento
   3 notificações internas
   4 campanhas Talk

vou providenciar as fonte de custos 


nao posuimos contagem de visitantes de ideia de como podemos implementar 



**Resposta de Maylon:**

### M10 — Homologação e operação
- [ ] **Maylon:** indicar quem confere os indicadores e quem responde por suporte, infraestrutura e gestão dos dados pessoais; esclarecer se a retenção indeterminada pretendida inclui cadastros pessoais ou apenas histórico operacional.
R: Eu maylon 
- [ ] **Maylon:** na fase 3, validar relatório de reconciliação e experiência do piloto e registrar as filiais liberadas. Esta validação depende da implementação; não bloqueia a análise e preparação atuais.

**Resposta de Maylon:**

## Execução técnica

### P0 — Contrato e preparação
- [x] **Responsável técnico:** revisar requisitos, respostas, rotas, protótipos e JSON; atualizar o roadmap com evidências.
R
- [ ] **T01 — Responsável técnico:** reconciliar o exemplo de itens em `apis/rotas.md` com o JSON de operações; documentar campos, chaves, paginação, datas e incremental por recurso. Apoio: M04.
- [ ] **T02 — Responsável técnico:** investigar as duas divergências monetárias, validar quantidade de itens, cancelamentos e devoluções; criar fixtures anonimizadas e casos de reconciliação. Apoio: M04.
- [ ] **T03 — Responsável técnico:** validar transporte seguro para a URL HTTP documentada, limites do ERP e acesso aos endpoints; não expor credenciais no navegador. Apoio: M04/M06.
- [ ] **T04 — Responsável técnico:** consolidar os documentos antigos com o roadmap após as decisões, removendo propostas conflitantes de sync diário, tenancy e indicadores estimados.

### P1 — Fundação e dashboard
- [ ] **T05 — Responsável técnico:** preparar versionamento, aplicação Node, frontend, PostgreSQL, Docker e migrations; documentar frameworks e dependências escolhidos.
- [ ] **T06 — Responsável técnico:** implementar bancos por tenant, autenticação e permissões no servidor. Dependência: M05 e T05.
- [ ] **T07 — Responsável técnico:** implementar importação e persistência idempotente de vendas/itens/filiais com precisão decimal. Dependência: T01–T03 e T05.
- [ ] **T08 — Responsável técnico:** implementar indicadores reconciliados no backend; excluir custos/estoques fictícios; corrigir PA, ticket por vendedor e filtros de cancelamento. Dependência: M01/M04 e T07.
- [ ] **T09 — Responsável técnico:** integrar dashboard, filtros, detalhes e estados de erro/vazio/atualização; aplicar visual escolhido e evitar inserção insegura de textos do ERP no HTML. Dependência: T06/T08; visual: M09.

### P2 — Atualização e operação
- [ ] **T10 — Responsável técnico:** implementar polling, paginação, checkpoint após commit, deduplicação, reprocessamento e backoff; validar estratégia de vendas sem `trans_id` comprovado. Dependência: M03 e T07.
- [ ] **T11 — Responsável técnico:** integrar alertas Talk após três falhas com controle de repetição. Dependência: M07 e T10.
- [ ] **T12 — Responsável técnico:** implementar produtos, saldo por SKU/filial, snapshots e ranking por identificador estável do vendedor. Dependência: T01/T07 e regras M04.

### P3 — Homologação e lançamento
- [ ] **T13 — Responsável técnico:** testar cálculos, duplicidades, datas, falhas de sincronização, permissões e jornada completa; medir carga com 5 e 100 filiais. Dependência: T06–T12.
- [ ] **T14 — Responsável técnico:** configurar deploy, HTTPS, logs, healthcheck, backups e teste de restauração; documentar operação e tratamento da amostra com dados pessoais. Dependência: M06/M10.
- [ ] **T15 — Responsável técnico:** preparar relatório comparando ERP e dashboard; corrigir diferenças antes de submeter o piloto à validação de Maylon. Dependência: M02/M04 e T13/T14.
- [ ] **T16 — Responsável técnico:** detalhar fila, clientes/aniversariantes, notificações, campanhas, billing e indicadores adicionais conforme M08/M09, mantendo os requisitos futuros rastreáveis.

## Como responder

Preencher os campos “Resposta de Maylon” usando os IDs M01–M10. Respostas parciais já permitem avançar nas tarefas relacionadas. Marcar uma decisão como concluída somente depois de incorporá-la ao roadmap; marcar implementação como concluída somente com evidência de funcionamento.

## Atualização após conferência de Maylon — 09/09/2026

Respostas anteriores preservadas acima. Esta atualização registra o estado mais recente; os dashboards de `teste/` continuam descartados.

- [x] **Maylon / T02:** explicar as diferenças das operações 30835456 e 30835576: descontos de cabeçalho agora retornados em `v_acerto`.
- [x] **Responsável técnico / T02:** conferir as duas equações, criar fixtures sem cadastros pessoais e implementar reconciliação monetária isolada. Sete testes aprovados, incluindo ajuste, diferença de um centavo, cancelamento, tipo de operação e quantidade.
- [x] **Responsável técnico / T01 (parcial):** incorporar os novos campos `v_acerto`, `acerto`, `v_frete`, `cortesia` e as respostas completas ao contrato técnico.
- [ ] **Maylon:** definir bruto/líquido para casos com descontos nos itens, frete, cortesia e devoluções/trocas. A explicação dos dois descontos está resolvida e não precisa ser repetida.

- [ ] **Maylon:** confirmar agrupamento das 14 filiais por empresa/tenant, intervalo/horário de polling e recursos/acesso ao servidor Locaweb; essas respostas não foram encontradas nos arquivos atuais.

- [ ] **Responsável técnico:** validar paginação, chave das operações, incremental e transporte do ERP; em seguida integrar a reconciliação à importação persistente. T01/T02 completos e T07/T08 ainda não estão concluídos.

A implementação atual é um módulo de reconciliação testado, não uma aplicação integrada. O modelo `.env.exemple`, a configuração do piloto e o restante do roadmap continuam válidos.

## Verificação do ambiente — 09/09/2026

- [x] **Responsável técnico:** confirmar presença das credenciais Millennium/Talk e número administrador no `.env`, sem exibir valores. Intervalo de sincronização também preenchido.
- [x] **Responsável técnico:** criar `scripts/verificar-erp.mjs` para consulta de uma filial por HTTPS, sem imprimir dados ou seguir redirecionamentos.

- [ ] **Maylon / infraestrutura:** informar endereço HTTPS do ERP ou acesso por túnel seguro. O teste TLS na porta configurada retornou `ERR_SSL_WRONG_VERSION_NUMBER`; não foi possível autenticar. A tentativa parou antes de transmitir o token.

- [ ] **Responsável técnico:** repetir consulta de leitura após configurar transporte seguro. URLs dos bancos central e do tenant ainda estão vazias; persistência não pode ser validada. Talk não foi acionada.

### Acesso ERP confirmado — 09/09/2026

- [x] **Responsável técnico:** usar exatamente `MILLENNIUM_BASE_URL`, conforme orientação de Maylon. Consulta autenticada de leitura a `listafiliais` retornou HTTP 200, `value` válido e uma filial correspondente a 30098297. Credenciais e corpo não foram exibidos.
- A exigência anterior de outro endereço foi retirada para esta validação: o endpoint informado usa HTTP. HTTPS permanece melhoria de infraestrutura, não pendência de resposta para continuar as consultas autorizadas.
- Validação limitada a filiais; vendas, paginação, incremental e persistência ainda precisam ser testados. Nenhuma mensagem Talk enviada.

## Validação real do próximo passo — 09/09/2026

- [x] **T01/T02 — Responsável técnico (etapa de validação):** consultar vendas reais de ITUPEVA em 06–07/09/2026: HTTP 200, 80 registros e 80 conciliações exatas, incluindo os dois descontos corrigidos. Evidência em `docs/validacao-vendas.json`, sem cadastros pessoais.
- [x] **Responsável técnico:** confirmar que o endpoint retorna cabeçalho, produtos, vendedor e ajustes; nenhuma chave duplicada neste lote.
- [ ] **T01/T07 — Responsável técnico:** validar paginação/limites e suporte incremental antes da carga histórica. `trans_id` não veio em nenhuma venda consultada. Planejar janelas de consulta com reprocessamento idempotente, sem presumir que o lote observado garante completude.
- [ ] **T05/T07 — Responsável técnico:** preparar persistência e importação após configuração do PostgreSQL e confirmação do agrupamento das filiais por tenant. Ainda não houve carga histórica.

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
