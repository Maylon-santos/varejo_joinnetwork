# Sincronização de operações e cancelamentos

Atualizado em 09/09/2026 (America/Sao_Paulo).

## Confirmado

Maylon confirmou que `cod_operacao` é crescente por tipo e filial. A chave é `(cod_operacao, tipo_operacao, filial)`, sempre no contexto do tenant.

Novo endpoint: `GET /MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDASCANCELADAS`, com `filial`, `data_inicial` e `data_final`. Consulta de 09 a 10/09/2026 para filial 30098297 retornou HTTP 200 e cancelamento 30836007/S. Evidência em `validacao-cancelamentos.json`.

A resposta contém código, tipo, data, usuário e motivo de cancelamento; não contém filial. O conector deve completar a filial com o contexto da requisição, sem compartilhar esse contexto entre jobs de lojas distintas.

## Fluxos a implementar com persistência

1. **Carga inicial:** importar histórico em janelas limitadas por filial/tipo, validando completude/paginação. Persistir por chave composta sem duplicar. Consultar também cancelamentos desde o início do histórico.
2. **Novas operações:** manter último código persistido por tenant/filial/tipo. Usar filtro “maior que” somente quando seu parâmetro e comportamento forem confirmados. Até lá, consultar por datas e reprocessar com a mesma chave; não tratar o parâmetro de igualdade `cod_operacao` como limite inferior.
3. **Cancelamentos periódicos:** job independente por tenant/filial. Usar período pela data do cancelamento, sujeito à confirmação do endpoint. Não depender do último código de venda para buscar cancelamentos.
4. **Checkpoint de cancelamentos:** armazenar fim da última janela concluída. Na retomada, iniciar no dia anterior ao checkpoint para sobrepor bordas; após indisponibilidade, cobrir todo o intervalo desde o checkpoint, não apenas hoje. Datas no fuso America/Sao_Paulo. Intervalos inclusivos/exclusivos ainda precisam ser verificados.
5. **Aplicação:** upsert de um registro de cancelamento pela chave composta e marcação da operação como cancelada na mesma transação. Guardar cancelamento mesmo se a venda ainda não existir e consultá-lo ao importar a venda depois. Não reativar cancelamento com um retorno antigo de vendas.
6. **Indicadores:** excluir canceladas na consulta/recalcular agregados da data original da venda. Não subtrair valor a cada evento, porque a janela sobreposta devolve eventos repetidos. Invalidar cache após commit.
7. **Falhas:** avançar checkpoint somente após completar todas as páginas e persistir com sucesso. Após três falhas consecutivas, aplicar backoff e preparar alerta Talk conforme configuração. O envio ainda não foi implementado nem acionado.

O polling dos dois fluxos terá frequências configuráveis. O intervalo informado no `.env` poderá ser utilizado após validar limites do ERP. A carga inicial e os checkpoints deverão usar horários fixados no começo de cada ciclo para não criar lacunas enquanto a importação executa.

## Código já preparado

`backend/src/cancelamentos.mjs`: função pura que normaliza a chave, aplica cancelamentos sem duplicar, preserva eventos recebidos antes das vendas e rejeita lote inválido sem alterar o estado original. Quatro testes específicos e sete de reconciliação passaram (11 no total). Este módulo usa Map em memória como preparação da regra; ainda não é banco, agendador ou sincronização em produção.

## Limites ainda abertos

- Confirmar que as datas filtram **data_cancelou**, não data original da operação. Um único exemplo não distingue essas duas semânticas.
- Confirmar paginação/limites, inclusividade das datas e parâmetro de busca de códigos maiores.
- O endpoint de cancelamento não resolve outras alterações posteriores de valores/itens nem eventual reversão de cancelamento. Essas situações precisam de regra própria ou reconciliação periódica.
- Configurar PostgreSQL e o agrupamento das filiais por tenant antes da importação persistente.

## Filtros de cancelamento confirmados — 09/09/2026

- [x] **Maylon:** disponibilizar `data_caninicial` e `data_canfinal`, específicos da data de cancelamento. Esta pendência está encerrada; não usar os filtros de data da venda para o job de cancelamentos.
- [x] **Responsável técnico:** validar consulta real com ambos os filtros em 09/09/2026: HTTP 200, cancelamento 30836007/S retornado. O endpoint agora também retorna `filial = 30098297`; validar contra a filial solicitada. Evidência atualizada em `docs/validacao-cancelamentos.json`.
- [x] **Responsável técnico:** implementar conector e ciclo em `backend/src/sincronizar-cancelamentos.mjs`, com validação de período/filial, recusa de resposta explicitamente incompleta, retomada com sobreposição e checkpoint solicitado apenas depois da gravação dos eventos.
- [x] **Responsável técnico:** executar 15 testes, todos aprovados. Incluem filtros novos, retorno fora do período, paginação indicada, retomada após intervalo e ordem de gravação.
- [ ] **Responsável técnico:** implementar adaptador PostgreSQL com transação real, isolamento por tenant, bloqueio de ciclos concorrentes e agendador. O ciclo atual depende de um repositório injetado; os testes não comprovam rollback de um banco real. Nenhum polling contínuo foi ativado.
- [ ] **Maylon:** preencher `CONTROL_DATABASE_URL` e `TENANT_DATABASE_URL` no `.env` para a conexão persistente, ou indicar que o PostgreSQL deve ser provisionado localmente. As duas variáveis ainda estão vazias.

As observações anteriores sobre filtros de datas ainda indefinidos e ausência de filial no retorno foram superadas por esta validação. Limites/paginação geral e busca de novas operações por código maior continuam em aberto; uma resposta completa de um evento não comprova limites gerais.

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
