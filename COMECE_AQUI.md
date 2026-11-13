# Comece aqui — estado atual em 12/11/2026

## Capacidade da HostGator para recuperar o piloto — 12/11/2026

- [x] A pedido de Maylon, interrompida a tentativa de recuperação pela Locaweb e analisada a HostGator somente por leitura: Ubuntu 22.04, 4 vCPUs, 7,8 GiB de RAM (6,1 GiB disponíveis) e raiz de 196 GiB com aproximadamente 155 GiB livres. Os 13 containers ativos e o Nginx existentes foram preservados; Docker/Compose disponíveis, configuração atual do Nginx válida e portas 3100/55432 livres na consulta.
- [x] **Há capacidade para receber o Aeropostale Varejo**, sem ampliar o plano na condição observada. Referência anterior: cerca de 310 MiB de RAM nos três containers e banco tenant de 126 MB. Reservas propostas de 20 GiB em disco e 2 GiB de RAM são margens de planejamento, não consumo medido nem teste de carga. Evidência: `docs/validacao-capacidade-hostgator.json`.
- [ ] **Migração ainda não executada:** restaurar e verificar o backup em PostgreSQL 17 isolado, preparar projeto/credenciais/vhost próprios e validar dados, API, HTTPS e backup externo antes da troca de DNS. Preservar os portais já existentes, manter worker local desativado e impedir sincronizações simultâneas em bancos separados. R31/migration 019 e homologações comerciais continuam pendentes.
- [ ] **Incidente anterior permanece sem recuperação confirmada:** último diagnóstico da Locaweb encontrou LVM ativo, mas raiz sem sistema de arquivos identificado e montagem somente leitura malsucedida; montagem do Rescue pelo painel retornou erro 500 em duas tentativas. Snapshot anterior disponível, sem confirmação de abrangência dos dois discos; nenhuma restauração ou reparo foi executado. MacBook Home acessível, com 873 GiB livres e 95 backups do Aeropostale; quatro mais recentes com checksums válidos, incluindo `backup-20261112T033238Z-S86XWx`. Imagens completas dos discos ainda não copiadas. Estes backups são dos dois bancos do Aeropostale, não dos outros serviços da VPS.

## Backup e reinicialização da VPS — 11/11/2026

- [x] Backup atualizado dos dois bancos, `backup-20261112T004339Z-u1FTI2`, com leitura estrutural aprovada, checksums no servidor e cópia privada fora da VPS conferida. Dumps e capturas permanecem fora do Git; não foi feita nova restauração integral deste backup.
- [x] Snapshot `pre-upgrade-disco-20261111` disponível, conferido no painel da Locaweb; snapshot anterior preservado. Reinício por SSH concluído e, após o disco permanecer igual, reinício pelo provedor com encerramento controlado dos 16 containers e sincronização do disco. Novos boots confirmados.
- [x] Os 16 containers anteriores retomados; cinco healthchecks configurados saudáveis, mesmos IDs/imagens/montagens e container anteriormente inativo preservado. Nginx, Docker, API/PostgreSQL, coletor remoto e timers de backup/relatórios ativos; HTTPS público com HTTP 200. Worker local continua desativado. Não representa homologação dos fluxos comerciais dos demais serviços.
- [ ] **Ampliação ainda pendente na hospedagem:** adicional de disco aparece ativo na Central, mas o Linux continua vendo dois discos de 10 GiB, raiz de 19G com 1,5G livres (92%) e LVM sem espaço livre, mesmo após os dois reinícios. Nenhuma partição/LVM/filesystem alterado. Aguardar apresentação da capacidade física antes de estender o volume; publicação da R31 continua pendente.

Evidência: `docs/validacao-reinicio-vps.json`. Snapshot complementa a cópia externa e não a substitui.

## API externa e webhooks implementados — 11/11/2026

- [x] **GitHub confirmado:** implementação registrada no commit `62891ea` e enviada ao remoto configurado; [workflow de validação aprovado](https://github.com/Maylon-santos/varejo_joinnetwork/actions/runs/43126674181) com PostgreSQL 17 descartável e Chromium. Código publicado no GitHub não ativa produção.

- [x] **Retomada e preparação da publicação — 11/11:** repetidos 80 unitários, 92 integração em PostgreSQL descartável, 19 respostas OpenAPI, console e portal em computador/celular; sintaxe e revisão do escopo aprovadas. Consulta SSH somente leitura confirmou DNS no resolvedor do servidor, painel/banco saudáveis e coletor remoto ativo.
- [ ] **Infraestrutura antes de ativar:** raiz em 92% de uso, 1,6 GB livres e certificado específico ausente. Maylon escolheu ampliar o disco e preservar imagens de retorno; nenhuma limpeza autorizada. Os dois discos de 10 GiB estão alocados no LVM, sem espaço livre no grupo; a ampliação depende da hospedagem. Reserva para projeções/retenção/backups, carga real e egress ainda precisam de validação. Migration 019 e serviços externos não ativados; timers preservados. Evidência: `docs/validacao-preparacao-integracoes.json`.

- [x] **R31 — implementação em ambiente isolado:** 21 operações para OAuth, vendas/itens/pagamentos, filiais, produtos/variações, estoque, alterações e webhooks. Credenciais de máquina separadas do painel, RS256/private_key_jwt, jti atômico, tokens por hash, escopos/filiais/ambientes e revogação.
- [x] Migration aditiva 019, captura transacional, projeções cifradas/revisões por conteúdo, snapshots assinados de 30 minutos, log de 30 dias e outbox recuperável. Worker separado, HMAC/rotação, idempotência, teste antes de ativar, retries/replay, circuito e proteção SSRF com DNS validado/IP fixado. Pools, cotas e concorrência próprios.
- [x] Console delegado do tenant com habilitação explícita e MFA/TOTP, cadastro de clientes/chaves públicas, concessões/revogação, ações de webhook auditadas, acessos, entregas e p50/p95/p99 reais. Admin não vira SuperAdmin global. Papéis PostgreSQL separados impedem alterações comerciais; identidade central usa grupo restrito ao login/sessões.
- [x] 80 testes unitários, 92 de integração em PostgreSQL 16 isolado, 19 respostas contra OpenAPI e Chrome em 1440/390 px aprovados. Inclui concorrência de captura, grant/cursor emprestado, revogação, BigInt, saldo negativo/ausente, retry/replay, MFA e permissões SQL. Evidência: `docs/validacao-implementacao-integracoes.json`.
- [x] Portal atualizado para nove capítulos, 51 schemas e 277 campos, com [operação e ativação](docs/integracoes/operacao.md). Serviços opt-in, vhost adicional, backup de dados cifrados e workflow de validação GitHub preparados. Deploy continua via SSH; push não publica produção.
- [ ] **R31 continua em andamento:** publicação do domínio confirmado `api-varejo.aeropostale.joinnetwork.com.br`, DNS/TLS/egress, capacidade/carga real, provisionamento de operador/cliente/destino e homologação com consumidor. Nenhuma credencial real ou webhook criado; produção e coletor local não alterados. SuperAdmin global/exportação de auditoria são evoluções. R11/R22/R29/SaaS permanecem separados.

## Nota fiscal nos detalhes da venda — 11/11/2026

- [x] Quatro campos confirmados na LISTAVENDAS e implementados em **Nota fiscal** nos detalhes: número da nota, modelo, IDNFE e status original do ERP. Identificadores textuais preservados; status nulo separado de histórico aguardando importação.
- [x] Importação/reprocessamento e preenchimento gradual do histórico preparados, sem migration. Carga exclusivamente fiscal preserva pagamentos, frete/cortesia existentes, valores, peças, itens, conciliação, cancelamentos e checkpoints; divergências bloqueiam a atualização.
- [x] 74 testes unitários, 76 de integração em PostgreSQL 16 isolado e navegador sintético em 1280/390 px aprovados. Regressão de cortesia zero verificada. Evidências: `docs/validacao-fonte-nota-fiscal.json`, `docs/validacao-nota-fiscal.json` e `docs/validacao-nota-fiscal-ui.json`.
- [x] Publicado e validado em **11/11/2026**, backup `backup-20261111T122541Z-Gpm2lu` e imagens de retorno preservadas. Saúde, login, 15 filiais, conteúdo fiscal e computador/celular conferidos. Hashes de vendas, itens, cancelamentos e checkpoints iguais na troca; amostra fiscal preservou também pagamentos, frete/cortesia e conciliação. Worker remoto retomado e local desativado; outros serviços e timer Talk preservados. Evidência: `docs/validacao-nota-fiscal-producao.json`.
- [ ] Preenchimento completo do histórico continua gradual: 358 de 31.192 operações na conferência posterior; retentativas por validação de cliente/itens registradas na evidência, sem forçar gravação. Status nulo permanece sem interpretação fiscal. Falha da última execução diária de relatórios já existia antes da publicação; timer ativo preservado, sem disparar novos envios.

Uso e operação: [Nota fiscal na venda](docs/NOTA_FISCAL_VENDA.md).

## Classificação pelo cadastro e recarga do estoque — 31/10/2026

- [x] `CONSULTAPRODUTOS` passou a retornar `tipo_prod`, confirmado em consulta ao ERP. Implementado o vínculo por ID interno do produto: tipo cadastral principal, tipo do saldo como alternativa e ausência explícita quando ambos não informados. Todas as variações usam a mesma classificação; filtros/total/paginação coerentes e tipo visível nos detalhes.
- [x] Migration aditiva 018 e rotina de recarga completa/classificação por produto preparadas, com lock, lotes sequenciais e hashes das vendas/itens/cancelamentos/checkpoints. 73 testes unitários, 74 de integração e navegador sintético computador/celular aprovados.
- [x] Publicado e reprocessado em **01/11**: recarga completa das **15 filiais**, 7.337 produtos consultados e 7.301 cadastros atualizados. **38.558 SKUs AC entre 38.606 presentes**; em ITUPEVA, **4.256 AC e 19 sem tipo**. Backup `backup-20261101T125720Z-scBjC3`, migration 018 e imagens anteriores preservadas. Vendas/itens/cancelamentos/checkpoints iguais por hash, API saudável, worker remoto e timer Talk ativos; local desativado.
- [ ] **48 SKUs / 36 produtos** continuam sem cadastro pelo ID na API. Conferência por código: 33 sem retorno e 3 retornando outro ID; nenhuma identidade trocada ou classificação presumida. Evidência: `docs/validacao-tipo-cadastro-producao.json`.

Regra e comando: [Tipo pelo cadastro](docs/TIPO_PRODUTO_CADASTRO.md). Não representa homologação das demais pendências da R19/R22/R11.

## Todas as pendências reprocessadas — 31/10/2026

- [x] Pedido expresso de Maylon: reprocessar todas as pendências. Levantamento inicial com 3.462; 228 resolvidas pelo preenchimento automático antes de iniciar. Lote congelado nas **3.234 vendas S ativas pendentes** das 15 filiais autorizadas, mantendo erros ERP já aceitos separados.
- [x] **3.234 vendas com reprocessamento concluído; 2.390 conciliadas.** Uma falha inicial de validação de cliente foi superada com consulta isolada por código da operação, mantendo a mesma validação. 3.235 tentativas auditadas, nenhuma falha técnica ou pedido ativo ao terminar. ERP consultado sequencialmente, com resposta por dia/filial reaproveitada (718 consultas no lote principal).
- [x] Rotina administrativa existente, responsável Admin e snapshots antes/depois; 40 cabeçalhos atualizados conforme retorno ERP. Vendas fora dos lotes, cancelamentos e checkpoints preservados em ambas as execuções. Backups `backup-20261031T221053Z-Lc45fa` e `backup-20261031T221804Z-g2Ud46`. API saudável, worker remoto retomado, local desativado e timer Talk preservado. Nenhuma regra financeira alterada.
- [ ] **844 continuam pendentes no retorno atual:** 15 diferenças de quantidade e 829 com cortesia numérica não zerada, cuja composição depende da R22. Reprocessamento não força conciliação nem homologa os totais da R11.

Evidência agregada: `docs/validacao-reprocessamento-lote.json`. Plano, recibos e detalhes das vendas permanecem nos artifacts privados, fora do Git.

## Cortesia zero e campos de conferência — 31/10/2026

- [x] Cortesia zero explícita não aciona regra pendente. Quantidades, valor, ajuste e tolerância de dois centavos continuam verificados; frete/cortesia não zerados ou formatos não confirmados continuam pendentes.
- [x] Detalhes incluem Frete e Cortesia, distinguindo zero, resposta nula e histórico aguardando importação. Campos persistidos nos complementos, sem migration. Preenchimento gradual conserva pagamentos, itens, totais e checkpoints e rejeita cabeçalho divergente.
- [x] 72 testes unitários, 73 de integração PostgreSQL e navegador sintético em 1280/390 px aprovados. [Regra e operação](docs/FRETE_CORTESIA.md); evidência `docs/validacao-cortesia-ui.json`.
- [x] API/worker publicados com backup `backup-20261031T220134Z-4D11RO` e imagens de retorno preservadas. Venda indicada conciliada, fora das pendências e com campos visíveis; comparação com snapshot anterior confirmou valores, peças e itens preservados. Hashes comerciais/cancelamentos/checkpoints iguais na publicação; API saudável, worker remoto e timer Talk ativos, local desativado. Evidência: `docs/validacao-cortesia-producao.json`. R22 continua aberta para composições não zeradas, bruto/líquido e devoluções.

## Exportações CSV, layout ajustado e envio diário — 31/10/2026

- [x] Amostra **01 a 20/10/2026** e histórico **01/01 a 30/10/2026**, após substituição de 2025 por 2026. Seis CSVs iniciais e dois de vendas por cupom ajustados aceitos pela API Talk, exclusivamente ao WhatsApp administrativo autorizado; aceite não comprova entrega/leitura.
- [x] **Vendas por cupom:** uma linha por operação, exatamente `data;empresa;canal;DESCRICAO;TIPO_OPERACAO;VALOR_FINAL;QTDE`. Empresa = código - Fantasia, canal de loja física, descrição dos dez eventos confirmada no ERP e valor com vírgula. AERO-MKTP excluída somente dos CSVs: **14 filiais exportáveis**, sem mudar painel/sincronização. Meia-noite é convenção do layout, sem afirmar hora real.
- [x] **R30 — rotina ativa às 08h de São Paulo pela Talk**, do primeiro dia do mês anterior até ontem, conforme confirmação. Primeira janela 01/09–30/10 aceita; repetição sem novos envios. Próxima execução conferida: **01/11 às 08h**. Configuração privada, serviço isolado, lock e recibos por arquivo. Backup `backup-20261031T213658Z-zzmj4o`; API saudável, banco/worker remoto preservados e worker local desativado.
- [x] Totais, peças, campos e checksums verificados; 70 testes unitários Node, um teste PostgreSQL da exportação e três SMTP simulados aprovados. Geração final no servidor: sete colunas, 4.990 operações na janela e 14 filiais.
- [ ] Devoluções/bruto/líquido continuam na R22 e homologação comercial na R11. Consolidado/cadastro preservam dimensões sem mapeamento. Nenhuma regra financeira ou venda alterada.

Uso: [Exportações CSV](docs/EXPORTACAO_CSV.md). Evidência: `docs/validacao-exportacao-csv.json`. Arquivos e recibos em `artifacts/exportacoes-csv/`, fora do Git.

## Clareza da conferência — 19/10/2026

- [x] Detalhes apresentam comparação de peças, soma de preços × quantidades, ajuste, valor do cabeçalho e diferença com tolerância de R$ 0,02. Dados ausentes não são presumidos como zero.
- [x] Motivo e orientação por situação; regra pendente identificada como frete/cortesia ainda não homologados, mesmo quando os números coincidem. Reprocessamento sem alteração não garante resolução. Nenhuma regra financeira ou dado importado alterado.
- [x] Validação: 62 testes unitários e sintaxe aprovados; Chrome em 1280 e 390 px com dados sintéticos, comparação de 2 peças/R$ 369,98/diferença zero e ausência de transbordamento.
- [x] Publicado no piloto em 19/10/2026, backup `backup-20261019T180222Z-Zx25Ne`. API saudável; banco e worker remoto preservados. Chrome público validou assets idênticos, login, detalhes, comparação, desktop/celular sem transbordamento ou erros JS. Evidência: `docs/validacao-conferencia-clareza.json`. R22 e homologação ERP permanecem pendentes.


## Vendas por hora — preparação em 28/09/2026

- [x] Pedido registrado como **R29**, com proposta para Visão geral e Visão das filiais: 24 faixas, valor, quantidade de vendas e peças, acumulados no período e respeitando permissões.
- [x] Fonte conferida: nas 21 operações de ITUPEVA de 27/09, `data` veio às 00:00 no horário de São Paulo; sem campo específico do horário de venda. O banco guarda somente o dia.
- [ ] **Dependência ERP:** incluir/confirmar o horário real na resposta da LISTAVENDAS. Proposto `hora_venda` em `HH:mm:ss`, horário de Brasília; aguardando confirmação de Maylon. Não usar meia-noite do campo data nem horário da importação como venda por hora.
- [ ] Persistência, carga dos horários do histórico, gráficos e validação pendentes. **Ainda não publicado.** Vendas sem horário deverão ter cobertura explícita e grupo separado.

[Planejamento e contrato proposto](docs/VENDAS_POR_HORA.md). [Evidência da consulta](docs/validacao-fonte-horarios.json).

## AERO-BAZAR habilitada — 23/09/2026

- [x] Maylon autorizou publicar somente a nova **AERO-BAZAR — BAZAR AERO COMPANY LTDA**, ID `30098803`, deixando a conferência das demais para depois.
- [x] Cadastro confirmado na API ERP e acrescentado ao escopo em `config/piloto.json`. Agora são **15 filiais**. As 14 anteriores foram preservadas; a ordem da nova filial é a última da rodada.
- [x] API/worker publicados com backup `backup-20260923T211529Z-5HlZ1y`. Releitura cadastral recebeu 15 filiais e gravou apenas a nova. API/banco saudáveis, worker remoto ativo.
- [x] Verificação pública: código/Fantasia no seletor Admin, indicadores disponíveis, inclusão no consolidado e bloqueio de filial não autorizada. Seis testes de cadastro/ordenação aprovados. Nenhum vínculo de usuário ou meta criado por inferência.
- [x] **R28 — carga inicial concluída em 23/09 às 22h58 de Brasília:** Maylon confirmou início das vendas em **20/09/2026**. A carga estava percorrendo meses sem vendas; foi executada a importação direcionada de 20/09 a 23/09 usando as rotinas existentes, sem avançar checkpoint sem consultar o dia. ERP retornou 26 operações e 16 eventos de cancelamento; 15 vendas ativas após aplicação dos cancelamentos. Checkpoints de vendas/cancelamentos em 23/09; leitura pública confirmou cobertura e totais. API/banco saudáveis e worker automático retomado. Hashes das operações, itens, cancelamentos e checkpoints das demais filiais preservados. Backup `backup-20260924T015804Z-tQFhcd`; evidência `docs/validacao-carga-bazar.json`. A rotina contínua segue do checkpoint atual; nenhuma data global de importação foi alterada.

Evidência: `docs/validacao-aero-bazar.json`. A descoberta de cadastro no ERP continua separada da habilitação no painel; novas filiais não são autorizadas automaticamente. Conferência das outras filiais adiada a pedido de Maylon.

## Visão das filiais e metas mensais — 20/09/2026

- [x] Novo dashboard **Visão das filiais**, com período independente, valor de vendas, peças, quantidade de vendas, ranking, participação, total, pendências e cobertura por filial. Inclui filiais sem vendas.
- [x] Restrito a **Admin, Diretoria e Supervisão**, com validação na API. Admin acessa as 14 filiais autorizadas; Diretoria/Supervisão consultam e editam somente vínculos explícitos, mesmo se outros recursos permitirem todas as filiais. Gerentes/Vendas bloqueados.
- [x] Cadastro mensal de metas pelos três cargos, com filial, competência e valor; edição/remoção com versão, auditoria e proteção contra concorrência. Acompanhamento do mês inteiro separado do período do ranking, percentual e valor faltante. Filiais sem meta não entram no atingimento conjunto.
- [x] **Setembro/2026: nove metas cadastradas, total R$ 1.490.000,00**, conforme imagem e autorização. OUTLET 729 vinculado a **AERO-019**; TIVOLI a **AERO-009**, por confirmação expressa. AERO-009 conserva Fantasia **AERO - SBDE** do ERP. As cinco filiais não listadas na imagem ficam sem meta, sem inferir zero.
- [x] 62 testes unitários e 70 de integração; computador/celular com dados sintéticos, cargos, filial atribuída, edição e limpeza de sessão aprovados. Leitura pública comparou os resultados de **19/09/2026** com os indicadores individuais das 14 filiais, preservando os totais.
- [x] API publicada com backup `backup-20260921T001032Z-tCu61y`, migrations central 007/tenant 017 e worker remoto retomado. Nove metas verificadas após gravação; nenhum cadastro anterior sobrescrito. Nenhuma venda alterada por esta entrega.
- [ ] **R22:** identificar os eventos de devolução e homologar a composição bruto/líquido antes de reproduzir essas colunas do relatório ERP. Hoje o consolidado usa o mesmo valor de vendas da Visão geral; entradas não são presumidas como devoluções.
- [ ] **R11:** conferência mensal/anual com o ERP permanece pendente; comparação entre telas do painel não substitui esse aceite.

Manual: [Visão das filiais e metas](docs/CONSOLIDADO_METAS.md). Evidências: `docs/validacao-consolidado-ui.json`, `docs/validacao-consolidado-producao.json` e `docs/validacao-cadastro-metas.json`. Plano de carga e capturas ficam em `artifacts/deploy`, fora do Git.

## Reprocessamento Admin e tolerância de dois centavos — 20/09/2026

- [x] **Conferência → Reprocessar venda**, exclusivo Admin, também nos detalhes. Confirmação, fila persistida, atualização automática do resultado e apresentação em cards no celular. Filtro padrão reúne todas as pendências; erros ERP anteriormente aceitos continuam no filtro específico.
- [x] Worker consulta o dia/filial no ERP e grava somente a operação selecionada. Guarda responsável e versões anterior/posterior; mantém cancelamentos, valores recebidos e cursores. Falhas preservam dados anteriores; pedido interrompido pode ser retomado.
- [x] Maylon autorizou tolerância de **até R$ 0,02 por venda**, em ambos os sentidos. Diferenças maiores, de quantidade, dados incompletos e composição não homologada permanecem pendentes. Nenhum arredondamento dos valores importados.
- [x] Migration 016 reclassificou **145 vendas** existentes; comparação de hashes comprovou preservação dos campos comerciais, itens, checkpoints e cancelamentos. Migration 015 criou a fila/auditoria administrativa. Backup final: `backup-20260920T122853Z-a3R3Nm`.
- [x] 62 testes unitários e 66 de integração aprovados. Reprocessamento completo testado com ERP sintético; leitura pública verifica botão, status e celular sem reprocessar vendas reais. API/PostgreSQL saudáveis, worker remoto retomado e local desativado.
- [ ] Maylon selecionar e reprocessar as vendas corrigidas no ERP; resolução depende da versão devolvida pela API. Não foi disparado reprocessamento em massa. Recargas de estoque continuam automáticas; conferência mensal/anual R11 permanece pendente.

Uso: [Reprocessar vendas](docs/REPROCESSAR_VENDAS.md). Evidências: `docs/validacao-reprocessamento-ui.json`, `docs/validacao-reprocessamento-producao.json`, `docs/validacao-tolerancia.json`.

## Recarga completa priorizando AERO-023 — 19/09/2026

- [x] Pedido de Maylon: agendar todas as filiais para carga completa, começando por **AERO-023 — Ibirapuera (30098802)**.
- [x] Rotina executada como tarefa independente no servidor (`aeropostale-recarga-estoque-20260919`), com backup `backup-20260919T233559Z-BtobA2`, worker contínuo pausado durante a execução e retomada automática ao finalizar. API disponível.
- [x] Ordem: AERO-023 → ITUPEVA → AERO-009 → AERO-010 → AERO-014 → AERO-015 → AERO-018 → AERO-019 → AERO-019-2 → AERO-020 → AERO-021 → AERO-022 → AERO-MKTP → BABIES-002.
- [x] Carga por SKU com cursor zero e maior cursor preservado. Falhas deixam a posição anterior e mantêm solicitação de carga completa para retentativa; não avançam para incremental como se a recarga tivesse terminado.
- [x] 61 testes unitários e seis testes de integração de estoque aprovados. Código da primeira filial validado contra o cadastro, sem alterar o escopo autorizado nem a ordem da sincronização de vendas.
- [x] Primeiro lote: dez filiais concluídas e quatro timeouts. Na retentativa automática, AERO-023 e ITUPEVA concluíram: **12 de 14** na última conferência; AERO-009/AERO-010 continuam agendadas. Hashes comerciais/checkpoints preservados e worker retomado. Maylon pediu deixar as retentativas rodando. Evidência: `docs/validacao-recarga-priorizada.json`.
- [ ] Conclusão das filiais em retentativa e cobertura de tipo_prod: conferir o relatório da execução; uma carga completa sem o campo no retorno não homologa a classificação AC. O enriquecimento do cadastro continua em lotes de cinco produtos.

Comando: `node scripts/sincronizar-estoques.mjs --completa --primeira=AERO-023`. Log privado no servidor: `/opt/aeropostale-varejo/artifacts/recargas/recarga-aero023-20260919.log`.


## Total de estoque, tipo de produto e fotos de funcionários — 19/09/2026

- [x] Card com soma do estoque da filial para o tipo escolhido, considerando todos os SKUs/páginas e incluindo saldos negativos. Busca e filtro de saldo não alteram esse total; saldos desconhecidos são sinalizados.
- [x] Filtro local **AC — Acabado** como padrão, com SE, MP, MC, Todos os tipos e Tipo não informado. `tipo_prod` é lido do **retorno** do ERP; a requisição padrão continua enviando somente `filial` e `trans_id`.
- [x] **Funcionários**, exclusivo para Admin: seleção de filial/vendedor, upload, substituição e remoção de foto. JPEG/PNG/WebP até 2 MB, validação e armazenamento no banco do tenant. Foto também exibida no ranking; leitura respeita filial e escopo próprio.
- [x] Foto fornecida cadastrada e conferida visualmente no vendedor indicado de **AERO-014 — Curitiba**. CPF/nascimento não foram adicionados ao cadastro; arquivo pessoal permanece fora do Git.
- [x] 59 testes unitários e 59 de integração; interface no computador/celular e consulta pública das 14 filiais aprovadas. Backup `backup-20260919T152713Z-yH6mHK`; migrations 013/014, API/worker e proxy publicados. API/PostgreSQL saudáveis; worker remoto ativo, local desativado.
- [ ] **Cobertura do tipo depende do retorno do ERP**: amostra da rota padrão trouxe quatro SKUs sem `tipo_prod`. Após publicação, 13 de 14 filiais concluíram releitura automática; uma estava em retentativa. Dos 34.434 SKUs presentes, nenhum tinha tipo preenchido na conferência final. Não homologar AC nem declarar concluída a separação dos materiais.
- [ ] Confirmar publicação do campo no ERP e repetir a carga completa para preencher registros antigos. Enquanto isso, AC mostra **Aguardando classificação**; **Todos os tipos** permite consultar o total e a posição salva. Campos ausentes não são inferidos a partir do nome do produto.

Evidências: `docs/validacao-tipo-fotos.json`, `docs/validacao-tipo-fotos-producao.json`, `docs/validacao-fotos-funcionarios-ui.json` e `docs/validacao-produtos-ui.json`. Uso: [Fotos dos funcionários](docs/FOTOS_FUNCIONARIOS.md). R23 concluída; R19 mantém a dependência de dados. A proposta anterior de trocar para CONSULTAESTOQUES foi substituída pela leitura do novo campo na rota padrão.


## Estoque em lista e pagamento no celular — 16/09/2026

- [x] Condições de pagamento da Visão geral organizadas dentro do card no celular, com identificação, vendas, valor, participação e total. Detalhe do pagamento com quebra de texto e contenção.
- [x] Produtos e estoque em lista compacta com miniatura, ampliação e **Ver detalhes** por SKU. Detalhes mostram classificação, cor, tamanho, código de barras e saldo quando autorizado. Indicadores por SKU conservam desconto e cobertura.
- [x] Fotos do catálogo usam referências de vendas autorizadas; isolamento por filial/vendedor e recurso de imagens preservados. Sem consulta ERP ao abrir.
- [x] Catálogo/resumos atuais excluem SKUs marcados ausentes em carga completa. Saldo nulo de SKU presente continua diferente de zero. Histórico de vendas e de estoque preservado.
- [x] 58 testes unitários e 57 de integração; navegador local e consulta pública das 14 filiais aprovados, incluindo card no celular e detalhes. API publicada com backup `backup-20260916T164223Z-z1nzOT`; worker existente continuou ativo.
- [ ] **Recarga e retirada dos materiais ainda não executadas**: a rota em uso continua `millenium_eco/produtos/saldodeestoque`, com `filial` e `trans_id`, **sem tipo_prod**. Testar `tipo_prod=AC` retornou HTTP 400: parâmetro não suportado.
- [x] Maylon confirmou os tipos: **AC acabado; SE serviço; MP matéria-prima; MC material de consumo**. A `CONSULTAESTOQUES` ajustada já exclui a bobina, mas não aceita `trans_id` de entrada e retorna somente SKU/saldo/datas.
- [ ] Ampliar a rota customizada conforme [contrato da nova origem](apis/estoque-custom.md), validar completo/incremental e executar nova carga das 14 filiais. O código de recarga `--completa` e enriquecimento apenas de produtos presentes foi preparado/testado localmente; ainda não implantado no worker. Materiais ainda presentes na posição anterior podem continuar aparecendo até essa recarga.

Evidências: `docs/validacao-estoque-lista-producao.json`, `docs/validacao-produtos-ui.json`, `docs/validacao-visao-geral-ui.json`, `docs/validacao-contrato-estoque-ajustado.json`. R19 mantém a pendência da recarga; R11 continua aguardando conferência mensal/anual.


## Ajustes publicados — filiais e ranking de produtos — 16/09/2026

- [x] Filtros exibem **COD_FILIAL - Fantasia**, com nomes recebidos do ERP nas 14 filiais. A identificação interna e o acesso por filial permanecem preservados.
- [x] Top 20 em **lista compacta**, com foto pequena ampliável, quantidade, vendas, valor e participação.
- [x] **Valor vendido é a ordenação padrão**; opção de quantidade recalcula os 20 primeiros entre todos os produtos do filtro. Cores e tamanhos continuam somados por produto. Participação acompanha a medida escolhida.
- [x] Botão **Ver detalhes** mostra variações vendidas, SKU, peças, vendas, subtotal, último preço/data e cadastro disponível; saldo atual somente com permissão de estoque. Paginação e escopo do vendedor aplicados no servidor, sem consulta ERP ao abrir.
- [x] 58 testes unitários e 55 de integração aprovados; interface desktop/celular, ordenações, detalhes e restrições verificadas com dados sintéticos. Consulta pública das 14 filiais aprovada, incluindo nomes, duas ordenações e totais dos detalhes.
- [x] Backup `backup-20260916T101111Z-CHKp1M`, migration tenant 012 e preenchimento cadastral concluídos. API e PostgreSQL saudáveis; worker remoto retomado. Worker local desativado.

Evidências: `docs/validacao-visao-geral-ui.json` e `docs/validacao-ranking-produtos-producao.json`. [Uso e regras](docs/INDICADORES_VISAO_GERAL.md). R19 mantém as pendências de dados anteriores; estes ajustes não homologam os totais mensais/anuais da R11.


## R19.2 publicada — indicadores na Visão geral — 16/09/2026

- [x] **Top 20 por produto**, somando tamanhos e cores e ordenando por peças, conforme Maylon. Fotos com ampliação, vendas distintas, subtotal e participação nas peças de todo o escopo autorizado.
- [x] Resumo mensal com peças, vendas e valor; condições de pagamento sem duplicar parcelas; participação dos vendedores calculada antes da paginação.
- [x] Saldo disponível **atual** por marca e categoria, com classificação ausente, saldos desconhecidos e negativos explícitos. Não representa estoque histórico do período.
- [x] Permissões por recurso e restrições de filial/vendedor preservadas. Consultas usam o banco local; somente as fotos acessam a hospedagem autorizada.
- [x] 57 testes unitários e 52 de integração, interface desktop/celular e consultas públicas nas 14 filiais aprovados. Totais mensais/condições conservam os indicadores; ordenação numérica do Top 20 e do relatório por SKU verificada.
- [x] Backup `backup-20260916T041612Z-bZdNfh`; publicação da API sem migrations. Worker permaneceu ativo.
- [ ] Fotos: na consulta anual de ITUPEVA, 7 carregaram e 13 URLs retornaram **404 na hospedagem**. Lista de produtos para correção na central pessoal (`pendencias/fotos-top20-itupeva.md`).
- [ ] Evento/devoluções: cadastro dos eventos, natureza/sinal e regras de vínculo e competência.
- [ ] Tipo de pagamento: identificação, estado e vínculo dos lançamentos; base temporal e tratamento de parcelas/estornos.
- [ ] Estoque inicial/entradas/saídas/final por marca e categoria: abertura histórica e movimentos completos, com base físico/disponível e classificações.
- [ ] Bruto/líquido e cobertura de cadastro/condições/fotos continuam pendentes. Conferência mensal/anual pelo usuário permanece na R11.

Acesse **Visão geral** e escolha filial/período; para o ano, use 01/01 até a data desejada. [Análise dos modelos e informações necessárias por indicador](docs/INDICADORES_VISAO_GERAL.md). Evidências em `docs/validacao-visao-geral*.json` e `docs/validacao-fotos-top20.json`.

R19 continua em andamento pelas pendências de dados acima; R19.2 está publicada. Kanban mantém **16 de 26 tarefas concluídas**.


## R19.1 publicada — produtos, estoque e desconto percentual — 16/09/2026

- [x] **Produtos e estoque**: catálogo por filial/SKU, busca, saldo atual, negativos sinalizados, posição desconhecida distinta de zero e data da sincronização. Consulta somente o banco local.
- [x] Estoque das **14 filiais** carregado: **34.704 registros filial/SKU**, com 7.034 produtos básicos. Cursor independente por filial; incremental automático observado sem erros, reconciliação diária e snapshots desde a implantação.
- [x] Produtos vendidos por período: peças, quantidade de vendas por SKU, subtotal dos itens e desconto médio informado, com cobertura. Vendas restrito ao próprio vendedor antes dos cálculos.
- [x] Maylon confirmou: desconto no item é percentual (`20` = `20%`); saldo já desconta reservas. Não reaplicar desconto nem subtrair reservas novamente. Detalhes exibem `%`.
- [x] Permissões de produtos e estoque separadas no gerenciador; somente Admin recebe ambas automaticamente. Indicadores exigem também acesso às movimentações.
- [x] 57 testes unitários, 48 de integração, desktop/celular e leitura pública das 14 filiais aprovados. Backup `backup-20260916T010501Z-TIZjib`; hashes de operações, itens e checkpoints preservados na carga.
- [x] API/PostgreSQL saudáveis e worker remoto ativo; worker local permanece desativado. Servidor com 3,6 GB livres (80% ocupado) e cerca de 2,4 GiB de memória disponível na conferência final.
- [ ] Classificação completa do catálogo: na fotografia de **16/09 às 00h42 de Brasília**, 1.292 de 7.034 produtos enriquecidos. Carga gradual continua; 18 cadastros retornaram ausência. Uma retentativa confirmou resposta vazia do ERP. Dados básicos/estoque preservados, sem inventar marca/coleção.
- [ ] R22: regras de bruto/líquido, frete, cortesia e devoluções; confirmação de percentual do item não define os ajustes do cabeçalho.
- [ ] R11: conferência mensal/anual por Maylon continua pendente. Publicação e importação não representam homologação.

Acesse **Produtos e estoque → Catálogo e estoque atual** ou **Produtos vendidos no período**. Outros cargos precisam de liberação em **Permissões**. [Regras, uso e limites](docs/PRODUTOS_ESTOQUE.md). Evidências: `docs/validacao-produtos.json`, `docs/validacao-produtos-ui.json` e `docs/validacao-produtos-producao.json`.

R19 permanece em andamento para cobertura da classificação e indicadores dependentes da R22; a primeira entrega operacional está publicada. O Kanban mantém **16 de 26 tarefas concluídas**.

## R16.2: relatórios e movimento intenso publicados — 15/09/2026

- [x] Relatórios por filial e período de até 31 dias, com resultados por vendedor/dia, conversão informada, motivos e histórico paginado.
- [x] Tempo médio ponderado pelos concluídos e disponibilidade reconstruída pelos eventos, excluindo abordagem, atendimento, pausa e ausência. Não mede espera do cliente.
- [x] Permissão **Consultar relatórios da fila** por cargo; somente Admin habilitado automaticamente. Vendas restrito ao próprio código antes de agregar/paginar.
- [x] Gestão ativa/desativa movimento intenso com motivo e histórico. Apenas a ordem é flexibilizada; continua um registro aberto por vendedor. Sair do modo preserva atendimentos em andamento.
- [x] 52 testes unitários, 45 de integração e interface desktop/celular aprovados. Fechamento com cinco abordagens revalidado; consultas públicas das 14 filiais aprovadas sem modificar jornadas reais.
- [x] Backup `backup-20260915T191333Z-nOtjtD`, migrations central 005/tenant 010 aplicadas; API e PostgreSQL saudáveis e worker remoto retomado.
- [x] Manual v1.1 atualizado em Markdown, HTML e PDF, com dez páginas.
- [ ] Correções gerenciais do histórico: proposta de corrigir com venda/sem venda com motivo, preservando horários; aguarda definição, em entrega separada.
- [ ] R16.3: associar atendimento à operação do ERP e confirmar venda.

Acesse **Lista da Vez → Relatórios da fila → Consultar relatório**. Para um dia, use a mesma data em De/Até. Na jornada aberta, use **Ativar movimento intenso** / **Encerrar movimento intenso**, com permissão de gestão. A loja do relatório é independente da loja da jornada.

R16 permanece em andamento; Kanban mantém **16 de 26 tarefas concluídas**. Evidências: `docs/validacao-fila-r162.json`, `docs/validacao-fila-relatorio-ui.json` e `docs/validacao-fila-relatorio-producao.json`.


## Manual de treinamento da fila — 15/09/2026

Manual de boas práticas para gerentes e vendedores, com abertura, atendimento, pausas, reservado, fechamento, dúvidas frequentes, exercícios de 35 minutos e ficha de treinamento.

- Fonte editável: [Manual da Lista da Vez](docs/MANUAL_FILA_ATENDIMENTO.md), também incorporado à central pessoal.
- [HTML navegável para consulta](output/html/manual-fila-atendimento.html) e [PDF para compartilhar ou imprimir](output/pdf/manual-fila-atendimento.pdf), com nove seções/páginas no PDF.
- Conteúdo conferido com a interface e as regras publicadas. PDF revisado visualmente; HTML verificado no computador e no celular, sem transbordamento horizontal ou erros JavaScript.

Para atualizar as versões, edite o Markdown e execute `python3 scripts/gerar-manual-fila.py` em um ambiente com `reportlab` instalado. O gerador usa Arial do macOS; em outros sistemas, informe fontes TTF com `--font` e `--font-bold`. Depois execute `python3 scripts/gerar-central.py`. Ao compartilhar o HTML junto com o PDF, preserve as pastas `html/` e `pdf/` para o link entre eles funcionar.

Esta entrega é documental. R16.2 (relatórios/movimento intenso) e R16.3 (vínculo com ERP) permanecem pendentes.

## Fechamento da fila: status esclarecidos — 15/09/2026

A captura enviada por Maylon mostrava cinco abordagens abertas, ainda sem início. “Não iniciado” era um botão de encerramento, mas podia ser confundido com um status já concluído. Abordagens abertas também impedem fechar a jornada.

- [x] Status distintos: **Em abordagem — aguardando início** e **Em atendimento**. Quem não pode consultar detalhes de outro vendedor continua vendo apenas “Ocupado”.
- [x] Ação renomeada para **Encerrar sem iniciar**, com motivo e preservação da prioridade.
- [x] Resumo conta abordagens e atendimentos pendentes. Fechar jornada orienta como resolver antes de oferecer confirmação; a proteção no servidor permanece.
- [x] Cenário de cinco abordagens reproduzido com dados sintéticos: encerramento individual com motivo e fechamento bem-sucedido, sem inventar início nem apagar registros. Pendências mistas e fluxo de vendedor também verificados.
- [x] Publicação somente da interface, com backup `backup-20260915T115312Z-mI1DDW` e API saudável. Worker permaneceu ativo; nenhuma jornada real foi encerrada pelo teste.

Orientação: em registros de teste sem atendimento, usar **Encerrar sem iniciar** em cada cartão, informar o motivo e então **Fechar jornada**. Evidência: `docs/validacao-fechamento-fila-ui.json`; verificação pública em `docs/validacao-fila-producao.json`. R16.2/R16.3 seguem pendentes.


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
