# PostgreSQL local

Configuração em `compose.yaml`, usando PostgreSQL 17 e volume nomeado `postgres_data` do projeto Compose `aeropostale-varejo`.

- Host: `127.0.0.1`; porta padrão: `55432` (configurável por `POSTGRES_PORT`).
- Banco central/usuário: `varejo_control`.
- Banco piloto/usuário: `varejo_aeropostale`.
- Senhas e URLs: `.env`, fora do versionamento. Não usar `docker compose config` em saídas compartilhadas: ele pode expandir segredos.
- As URLs do `.env` são para a aplicação executada no host. Uma aplicação no mesmo Compose usará host `postgres` e porta `5432`.

Iniciar: `docker compose up -d --wait postgres`.

Verificar estado: `docker compose ps`.

Verificar autenticação, escrita e isolamento: `docker compose exec -T postgres sh < scripts/verificar-postgres.sh`.

Parar mantendo dados: `docker compose stop postgres`.

O script `database/init/01-databases.sh` cria bancos e usuários apenas no primeiro início com volume vazio. Cada usuário possui seu banco, sem privilégio de conectar ao outro. Senhas alteradas no `.env` após essa inicialização precisam também ser alteradas no PostgreSQL; editar o arquivo não troca senhas existentes.

Não usar `docker compose down -v` para reiniciar: esse comando apaga o volume. O volume persiste entre reinícios, mas não substitui backup. Esta preparação é local; implantação no servidor Locaweb, backups e migrations da aplicação ainda serão feitos.

## Tabelas e sincronização

Instalar dependências: `npm ci`.

Aplicar migrations: `npm run db:migrate`. O runner mantém o hash de cada arquivo aplicado e recusa alterações retroativas. Cada banco é migrado em uma transação independente. O banco central registra tenant/nome do banco sem duplicar senhas. O banco de operações mantém uma identidade de tenant verificada pelo repositório.

Tabelas do tenant: `operacoes`, `cancelamentos`, `sync_checkpoints`, `tenant_identity`, `schema_migrations`. View `operacoes_ativas` exclui cancelamentos imediatamente; não há cache de indicadores nesta etapa. Valores de operações são armazenados como centavos inteiros; a importação completa de itens/vendedores ainda será implementada.

Testes de regra: `npm test`. Testes de PostgreSQL: `npm run test:integration`; criam e removem um schema com nome aleatório, sem tocar nos registros do piloto.

Importar uma amostra real sem checkpoint:

```sh
npm run sync:cancelamentos -- --filial=30098297 --inicio=2026-09-09 --fim=2026-09-09 --amostra
```

O modo amostra preserva os cancelamentos no banco, mas não declara todo o histórico como sincronizado. Para um ciclo completo, omitir `--amostra` e `--inicio`; a primeira execução parte de `initialImport.from` no cadastro do piloto, e as seguintes usam o checkpoint com um dia de sobreposição. Fornecer `--fim=AAAA-MM-DD`. O comando sempre executa uma vez; não inicia agendador. Resposta que indique paginação/incompletude provoca erro sem avanço de checkpoint; parâmetros de paginação geral ainda não foram documentados.

Somente ITUPEVA (30098297) está liberada enquanto o agrupamento das outras filiais no tenant não for confirmado. Cancelamentos e operações da mesma filial usam o mesmo bloqueio transacional. Uma falha reverte lote e checkpoint. Reprocessar operação cancelada não reativa a venda; eventual reversão de cancelamento precisa de regra explícita.

O adaptador usa consultas parametrizadas e uma conexão por transação, seguindo a [documentação do node-postgres](https://node-postgres.com/features/transactions).

## Importação histórica e rotina periódica

- `npm run sync:historico`: carga inicial de ITUPEVA por dias, desde `SYNC_INITIAL_DATE` até `SYNC_INITIAL_END_DATE`, retomando checkpoints. Executar com o worker Docker parado para não disputar a exclusividade.
- `docker compose up -d --build sync-worker`: inicia execução periódica. Exige `SYNC_ENABLED=true`; intervalo configurado de 360 segundos, contado após o término de cada recurso.
- `docker compose logs --tail 30 sync-worker`: progresso e falhas, sem cadastros de clientes ou tokens.
- `docker compose stop sync-worker`: pausa somente a sincronização, mantendo o banco e seus dados.
- `node --env-file=.env scripts/resumo-sync.mjs`: produz resumo em `docs/validacao-historico.json`.

O worker usa um bloqueio de sessão PostgreSQL para garantir uma única instância por tenant. Vendas e cancelamentos têm checkpoints e estado de falhas separados. Após três falhas, o intervalo dobra progressivamente até 16 vezes o intervalo base; o estado persiste em `sync_status`. Cancelamentos continuam sendo consultados se uma janela de vendas falhar. Talk permanece desabilitada e não há envio automático de mensagens nesta entrega.

São persistidos cabeçalho operacional, itens, identificação do vendedor e estado de conciliação. Nome, DDD e telefones dos clientes são importados na mesma resposta da venda e armazenados em `operacoes.clientes` (JSONB), com `clientes_importados_em`. São snapshots por operação, atualizados na reimportação; não constituem ainda um cadastro unificado para campanhas. CPF e endereço completo não são copiados. Os backups do tenant incluem esses dados. Duplicatas com conteúdo operacional normalizado idêntico são colapsadas e registradas; conteúdo conflitante interrompe o lote. Respostas com indicação de página parcial são recusadas. O indicador `conciliacao` não transforma entradas ou canceladas em vendas elegíveis.

A execução por datas inclui o dia anterior ao checkpoint para reprocessar bordas. Sem um filtro incremental de código documentado, não se assume `cod_operacao` como parâmetro “maior que”. Alterações de valor/itens fora da janela recente precisam de reconciliação histórica adicional. Cancelamentos antigos são detectados pelas datas de cancelamento. O modo periódico acompanha a data atual em America/Sao_Paulo; o fim da carga inicial não congela o histórico permanentemente.

Limitação operacional: o processamento é local e depende do Docker Desktop ligado. A implantação na Locaweb continua pendente. Sucesso de consultas diárias e igualdade de `odata.count` não demonstram ausência de limites silenciosos do ERP; a homologação com relatórios da origem permanece necessária.

## API local

Após `npm run db:migrate` e `npm run admin:create`, iniciar com `docker compose up -d --build --wait api`. Porta publicada em `127.0.0.1:3100` (`PORT` no `.env`). Credenciais iniciais em `ADMIN_EMAIL` e `ADMIN_PASSWORD`; o banco guarda apenas hash de senha e hash das sessões. Não expor o `.env`. Validar com `node --env-file=.env scripts/verificar-api.mjs`. Documentação: `apis/painel.md`. Parar API não interrompe o worker.

## Preenchimento dos clientes no histórico

A migration `005_clientes.sql` adiciona os campos sem modificar o histórico operacional. `NULL` significa importação pendente; `[]` significa que o ERP não informou cliente. O worker grava cliente, venda e checkpoint na mesma transação.

Com o worker remoto pausado, executar `docker compose run --rm --no-deps sync-worker node scripts/preencher-clientes.mjs`. A rotina verifica o tenant, usa somente filiais autorizadas na configuração e consulta um dia por vez, com intervalo de um segundo e até três tentativas. Atualiza somente clientes ainda nulos, por chave composta e data; não altera valores, itens, cancelamentos, timestamps operacionais ou checkpoints. Pode ser retomada: dias já preenchidos não são consultados novamente. Ausências de operações na resposta permanecem pendentes e fazem a rotina encerrar com código 1.

O futuro envio de mensagens utilizará os contatos locais. Cadastro unificado, preferências de contato, fila, deduplicação e histórico de envios serão uma etapa própria; nenhum envio é realizado nesta entrega.

## Expansão autorizada — 13/09/2026

Maylon confirmou as 14 filiais no mesmo tenant Aeropostale. O modo contínuo limita cada recurso/filial a sete dias por rodada (`syncMaxDaysPerCycle`), começando por ITUPEVA. As consultas continuam sequenciais; o intervalo base é contado por recurso/filial após cada lote. A duração total da rodada pode ampliar o tempo entre atualizações de uma loja.

O checkpoint avança somente até o último dia gravado; o log `lote_historico_concluido` informa `pendente: true` e o alvo quando falta histórico. A rodada seguinte preserva a sobreposição de um dia anterior ao checkpoint. Limites menores que três dias são recusados para evitar que a sobreposição impeça avanço. `--once` mantém a carga integral até o fim inicial configurado.

O Admin acessa as filiais configuradas. Usuários restritos continuam dependentes da implementação de permissões por cargo e filial. A interface sinaliza períodos sem cobertura; totais das novas filiais não são homologados automaticamente pela aprovação de ITUPEVA.

## Cadastro de filiais por trans_id

A migration `006_cadastro_filiais.sql` cria `cadastro_filiais` e `sync_cadastro_filiais`. Cadastro e cursor global do endpoint são confirmados na mesma transação, após validar tenant, contagem da resposta e ausência de paginação parcial. Respostas conflitantes ou inválidas revertem a carga.

O worker consulta o cadastro antes das rodadas de vendas/cancelamentos, com intervalo base de seis minutos e backoff após três falhas. Uma falha cadastral não interrompe os outros recursos. A carga inicial não envia cursor; incrementais enviam o último cursor menos um para reler a última transação de forma idempotente. A validação de 13/09 observou filtro exclusivo (`trans_id` maior que o enviado). Datas e checkpoints de vendas/cancelamentos são independentes.

Só os cadastros das filiais autorizadas são persistidos. O cursor considera toda a resposta do endpoint; alteração da lista autorizada força uma consulta total, evitando perder cadastros antigos de filiais recém-autorizadas. Uma carga total exige encontrar todas as filiais autorizadas antes do commit. Cadastros ausentes não são interpretados como exclusão: não há contrato de exclusão validado.

Com o worker pausado, `docker compose run --rm --no-deps sync-worker node scripts/sincronizar-filiais.mjs` executa uma passagem forçada. A execução normal fica no worker e respeita os tempos de retentativa. O seletor lê o banco, sem republicação para mudanças de código no ERP.
