# Operação da implementação 0.1.0

Implementada em 11/11/2026 e validada com dados sintéticos em PostgreSQL isolado. **A API externa não foi ativada na produção.** Código enviado ao GitHub não inicia serviços, publica DNS ou cria credenciais.

## Serviços e GitHub

O remoto do projeto é `Maylon-santos/varejo_joinnetwork`, branch `main`. O workflow `.github/workflows/ci.yml` executa testes unitários, integração em PostgreSQL 17 descartável, console no Chromium e validação do contrato. Não tem credenciais de produção ou etapa de deploy. A publicação do piloto continua via SSH conforme `deploy/README.md`.

| Componente | Entrada | Responsabilidade |
| --- | --- | --- |
| API externa | `scripts/integracoes-api.mjs`, porta 3200 em loopback | `/oauth/token`, consultas `/v1`, administração humana opcional |
| Publicador/entregador | `scripts/integracoes-worker.mjs` | Projeções, log, distribuição, entregas e expurgo |
| Provisionamento humano | `scripts/integracoes-operador.mjs` | Habilitação explícita de operador do tenant, com MFA |
| Banco | Migration tenant 019 | Tabelas `integration_*` e captura transacional por trigger |
| Console | `/admin/integracoes/console` | Concessões, chaves, logs, métricas, testes/ativação/pausa/replay |

A nova API usa pool próprio de quatro conexões. O worker de integração não consulta o ERP e é separado do coletor existente. Todos os flags novos começam em `false`; `SYNC_ENABLED` local continua desativado.

## Implementado e limites desta entrega

| Área | Comportamento implementado |
| --- | --- |
| OAuth | Client Credentials/private_key_jwt RS256, RSA 2048–8192, validação de claims, jti atômico por 120 s, token opaco 900 s armazenado por hash; cliente/chave/escopos/filiais revalidados |
| Isolamento | Tenant fixado pelo serviço/banco, ambiente fixado por `INTEGRATIONS_ENVIRONMENT`, filiais explícitas, IDs externos e cursores vinculados ao cliente/concessão |
| Consultas | 21 operações do OpenAPI, DTOs por allowlist, centavos/IDs textuais, saldo decimal/null, fiscal e pessoas condicionais |
| Consistência | Projeções cifradas, revisões por conteúdo, filhos com If-Match, snapshots cifrados de 30 minutos e log de 30 dias; GET não consulta ERP |
| Publicação | Captura no mesmo commit da origem; publicadores serializados até COMMIT. Escrita concorrente aguarda a marca de captura e deixa nova pendência, evitando perda durante projeção |
| Outbox | Revisão, evento mínimo e posição do log no mesmo commit; checkpoint de distribuição e entregas idempotentes |
| Webhook | Cadastro inicialmente inativo, host aprovado, teste assinado antes da ativação, segredo AES-GCM, HMAC, sobreposição de 24 h, idempotência cifrada 24 h, dez tentativas/72 h, circuito e replay |
| SSRF | HTTPS/443, sem IP literal/credencial/query/fragmento, todas as respostas DNS validadas a cada tentativa, IP público fixado no socket, SNI/TLS preservados, sem redirects; DNS até 3 s dentro do limite total de 10 s |
| Auditoria | Cliente autenticado, rota parametrizada, filial autorizada, status, bytes e duração monotônica até finish/close; abortos 499; IP em hash e somente família conhecida de User-Agent |
| Console | Operador humano explicitamente habilitado, senha do painel + TOTP, step-up de cinco minutos vinculado à sessão humana. Admin não ganha acesso automaticamente. Mudanças e consultas de auditoria registradas |
| Retenção | Snapshots 30 min, idempotência 24 h, log/payload/replay 30 dias, acesso/auditoria 90 dias. Expurgo de metadados gera recibo de política, sem edição individual pelo console |

O console implementa **gestão delegada de um tenant**. SuperAdmin global, seleção de bancos de outros tenants, exportação assíncrona de logs, cadastro de contatos técnicos, revisão periódica com alertas e gráficos de tendência continuam evoluções. p50/p95/p99 são calculados sobre tempos realmente medidos; sem amostras os percentis são null. Tempos separados de banco/fila de admissão ainda não são instrumentados. Tentativas de webhook medem duração e espera de fila. A reserva grava a tentativa antes da rede; uma interrupção conserva status/duração desconhecidos como null e a retomada identifica `WORKER_INTERRUPTED`, sem inventar aceite HTTP.

Limites adicionais de proteção: até 64 conexões HTTP, vinte snapshots ativos por cliente, dez mil registros/32 MiB por snapshot, 64 MiB de snapshots por cliente e 256 MiB no banco. Ao exceder, 422 exige janela/filtro menor ou 429 exige aguardar. Resposta de página permanece limitada a 2 MiB. Cotas são token buckets transacionais em PostgreSQL: cliente 60/min com burst 10, tenant 120/min, serviço 240/min, IP 120/min; token 6/min/cliente e 30/min/IP. A pré-autenticação também tem teto global. O campo Remaining reflete admissão imediata, incluindo burst, e não garante uma chamada sob outras cotas. Não há espera ilimitada nem liberação sem estado de admissão.

`origem_carga=historica` identifica a carga inicial da projeção dos registros existentes na migration; a captura posterior usa `continua`, e reprocessamento administrativo usa `reprocessamento`. O campo descreve o fluxo local, sem presumir hora real da venda. Alterações intermediárias dentro do mesmo lote podem ser consolidadas no estado final antes da publicação; o log serve para sincronizar estado, sem representar cada movimento contábil do ERP. Exclusões físicas de cabeçalhos/cadastros não fazem parte do fluxo de origem suportado; ausência de estoque usa `presente_ultima_carga=false`.

Idempotência de webhook é conferida antes do ETag e só retorna uma criação/rotação durante suas 24 h. Não guarde essa resposta em logs. Mudança da URL invalida verificação e entregas previamente enfileiradas para a URL anterior não são enviadas à nova. Rotação/ativação mantêm a mesma URL. 401/403 pausam, 410 desativa e 3xx exige reverificação.

Logs de acesso são gravados após finish/close; falha de persistência emite apenas `integration_audit_failed` e request_id, exigindo alerta operacional. A fila assíncrona de auditoria de acesso é limitada a 32 gravações; saturação gera `integration_audit_backpressure` com contagem e request_id, sem criar fila ilimitada. Ações administrativas de concessão e webhook usam auditoria na mesma transação e falham junto dela. No estoque, `consultado_em`/`data_atualizacao_erp` correspondem à posição projetada e não são substituídos pelos timestamps de uma alteração ainda aguardando publicação. O último sucesso da coleta é informado separadamente. O coletor e os dados comerciais permanecem a fonte; a API reflete o progresso do publicador. Antes de liberar um cliente, aguardar o esvaziamento de `integration_dirty` e homologar a cobertura.

## Preparar ambiente isolado

1. Usar dois bancos de homologação e dados fictícios. Aplicar `node --env-file=.env scripts/migrar.mjs`. A migration 019 é aditiva e não altera valores comerciais/checkpoints.
2. Gerar uma chave aleatória de 32 bytes, gravar como 64 caracteres hexadecimais em `INTEGRATIONS_ENCRYPTION_KEY`, somente no arquivo privado. **Guardar cópia protegida fora do servidor e do Git**: sem essa chave não é possível recuperar segredos/payloads cifrados de backups. A versão inicial suporta uma chave de armazenamento; trocá-la exige migração/recriptação planejada, não substituição direta.
3. Configurar `INTEGRATIONS_ENABLED=true`, ambiente `homologacao` e base HTTPS exata. A audience será `${BASE}/oauth/token`; o token de homologação não autentica um serviço configurado para produção.
4. Iniciar a API. Habilitar o worker de projeção com `INTEGRATIONS_WORKER_ENABLED=true`; deixar `INTEGRATIONS_DELIVERIES_ENABLED=false` até ter consumidor aprovado. `--once` processa um lote.
5. Habilitar o console somente por acesso operacional privado, com `INTEGRATIONS_ADMIN_ENABLED=true`. O vhost externo bloqueia integralmente `/admin/`.

```sh
npm run integracoes:api
# Em outro processo, exclusivamente contra o mesmo banco de homologação:
npm run integracoes:worker
```

Nunca ligar o coletor ERP local para esse teste. Os testes automatizados usam schemas exclusivos e removem seus dados ao terminar.

## Habilitar o primeiro operador

O usuário humano deve existir e ser Admin **do tenant configurado**. Descobrir seu UUID pela sessão autenticada existente, sem copiar a senha para arquivos versionados. Preparar arquivo privado em uma pasta ignorada:

```sh
mkdir -p artifacts/integracoes-operador
node scripts/integracoes-operador.mjs --preparar UUID_DO_USUARIO artifacts/integracoes-operador/operador.json
```

O arquivo é criado com modo 0600, sem sobrescrever outro, e contém o segredo e a URI `otpauth_uri`. Importá-la em autenticador confiável por canal local; não enviar a URI a um gerador de QR remoto. Preencher `codigo` com o TOTP atual e executar:

```sh
node --env-file=.env scripts/integracoes-operador.mjs artifacts/integracoes-operador/operador.json
```

O script confirma usuário/tenant, exige a prova do autenticador e grava concessão cifrada e auditoria atomicamente. O código usado não pode ser reutilizado: aguardar o próximo período de 30 s para entrar no console. Depois da configuração, guardar/remover o arquivo privado conforme política de segredos.

Para recuperar acesso em perda de MFA, um operador com acesso SSH controlado pode preparar nova matrícula. Para bloquear o operador sem possuir o autenticador, arquivo 0600 com `usuario_id`, `ativo=false` e `motivo` revoga concessão/sessões com auditoria. Isso não concede permissões globais ao Admin.

O console usa credenciais somente em memória da aba. O logout revoga a sessão do painel criada para esse acesso e o step-up; não grava tokens em localStorage. Endereço operacional: túnel SSH para `127.0.0.1:3200` e `/admin/integracoes/console`. No console, cadastrar cliente, escolher ambiente/escopos/filiais/hosts e registrar somente sua chave pública PEM/kid. Segredo privado RSA permanece no consumidor. Chave revogada não pode ser reativada; usar novo kid.

## Publicação controlada

Ler `deploy/README.md`. A entrega inclui `Dockerfile.integracoes`, override `deploy/integracoes.compose.yaml`, grupos PostgreSQL em `deploy/integracoes-permissoes.sql` e vhost adicional `deploy/nginx-integracoes.conf`. Não substituir o vhost do painel.

**Ambiente atual — 13/11/2026:** o piloto foi recuperado na HostGator, alias SSH `Hostgator`, `143.95.219.212:22022`, em `/opt/aeropostale-varejo`. API interna, PostgreSQL e coletor ERP estão ativos, com migrations até 018 e fonte estável `c1c1eb2`. A API externa, o worker de integrações, o console e a migration 019 ainda não foram implantados. O DNS público de `api-varejo.aeropostale.joinnetwork.com.br` já retorna o IP novo; isso não comprova serviço ou certificado específico. Os demais portais/containers foram preservados. Na conferência da migração havia aproximadamente 154 GiB livres e 5,9 GiB de memória disponível, sem ensaio de carga. Backups e coleta externa retomados; o envio diário de relatórios permanece pausado. Evidência: [validação da migração](../validacao-migracao-hostgator.json).

O diagnóstico de 11/11 com raiz em 92% e LVM sem espaço refere-se à **Locaweb antiga**, agora desligada conforme confirmação de Maylon. A ampliação/reparação desse disco não é requisito para implantar na HostGator. Preservar os discos e snapshots da origem; não realizar limpeza ou expansão nela como parte desta publicação. Evidência histórica: `docs/validacao-preparacao-integracoes.json`.

1. Medir novamente disco/memória/conexões da HostGator compartilhada; reservar orçamento para projeções, retenção, snapshots e novos backups, preservando os serviços existentes. A capacidade livre observada na migração permite retomar a preparação, mas não substitui ensaio de carga com volume real. Aprovar responsáveis e retenção antes de liberar consumidores; a configuração PostgreSQL/worker deve corresponder ao destino atual, sem reutilizar comandos de LVM da VPS antiga.
2. Fazer backup completo e preservar imagens/fontes anteriores. Pausar coletor remoto para migration 019. Conferir hashes comerciais antes/depois e preservar os demais serviços. Migration captura o histórico sem expô-lo automaticamente.
3. Criar LOGINs privados separados para API/worker e atribuir os grupos do SQL de permissões. Gravar URLs `INTEGRATIONS_DATABASE_URL` e `INTEGRATIONS_WORKER_DATABASE_URL` fora do Git, com host `postgres` dentro dos containers. Os grupos não podem atualizar tabelas comerciais; o LOGIN do worker não deve ser owner. Para o console, aplicar também `deploy/integracoes-controle-permissoes.sql` no banco central e criar LOGIN próprio com esse grupo, gravando a URL em `INTEGRATIONS_CONTROL_DATABASE_URL`. O grupo permite ler identidades/perfis/vínculos e gerenciar sessões, sem alterar usuários/permissões. Os containers novos não recebem as URLs dos owners. Nunca entregar URLs de banco ao integrador.
4. Construir/subir os serviços adicionais com o override. Preparar a imagem do coletor remoto com a pequena instrumentação de origem do reprocessamento em `repositorio-postgres.mjs` antes de retomá-lo; as regras e valores comerciais permanecem iguais. API e worker possuem limites de CPU/memória e nenhuma porta pública direta. Retomar o coletor remoto após conferir saúde/hashes; local permanece desativado.
5. Criar/conferir DNS do domínio confirmado, emitir certificado exato, instalar o vhost adicional, testar `nginx -t` e recarregar preservando outros vhosts. Definir apenas IPs exatos do proxy em `INTEGRATIONS_TRUSTED_PROXIES`; não confiar no header arbitrário do cliente. No Docker, conferir o IP do gateway que realmente aparece no socket.
6. Restringir egress do worker na infraestrutura a DNS confiável e HTTPS público. A validação/pinning na aplicação já está implementada; o firewall/egress de produção ainda precisa ser aplicado na infraestrutura. Não liberar entregas antes de conferir essa camada.
7. Habilitar operador, cliente **de produção** e chave pública explicitamente aprovados. Aguardar projeções e testar consulta, revogação e cobertura. Autorizar um destino, habilitar entregas, confirmar teste assinado e ativar inscrição. Não cadastrar um endpoint de terceiro sem responsável/consentimento.
8. Conferir cotas/carga, frescor, p95/p99, fila, erros, disco, logs e backup/recuperação com a chave cifradora guardada. Só então registrar publicação/homologação; não marcar R11/R22/R29/SaaS concluídos por essa entrega.

```sh
docker compose -f compose.yaml -f deploy/integracoes.compose.yaml build integracoes-api integracoes-worker
docker compose -f compose.yaml -f deploy/integracoes.compose.yaml up -d --wait integracoes-api
docker compose -f compose.yaml -f deploy/integracoes.compose.yaml up -d integracoes-worker
```

Não usar `docker compose config` em logs compartilhados, pois pode expandir segredos. Os prazos de retenção da API referem-se ao banco ativo; backups seguem a política própria documentada do piloto. Reenvios preservam a data original do evento e não renovam seus 30 dias de payload/replay; metadados de tentativa permanecem até 90 dias. O backup agora exclui dados de tokens externos, step-ups, leases, cotas e snapshots; demais tabelas/segredos cifrados são preservados. Após restauração, exigir novo login/token e recriar carga inicial do consumidor. Preservar a chave de armazenamento separadamente. Retorno: parar os dois serviços adicionais e remover somente seu vhost; a migration é compatível com o painel anterior, mas manter/expurgar as marcas de captura conforme plano de retomada.

## Verificar sem produção

```sh
npm test
npm run test:integration
npm run test:integracoes:ui
artifacts/documentacao-integracoes/.venv/bin/python scripts/validar-respostas-integracoes.py
```

`test:integration` exige URLs de bancos **descartáveis**, pois cria/remove schemas; não executar com URLs de produção. O teste de contrato consome apenas respostas sintéticas geradas pela suíte. O CI configura bancos temporários próprios. Verificação local: PostgreSQL 16 nativo; CI preparado para PostgreSQL 17. A execução do workflow no GitHub só pode ser confirmada após o push.
