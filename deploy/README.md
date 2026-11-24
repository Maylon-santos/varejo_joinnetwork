# Operação do piloto publicado

URL: https://aeropostale.joinnetwork.com.br
Servidor atual: alias SSH `Hostgator`, `143.95.219.212:22022`. Diretório: `/opt/aeropostale-varejo`.

## Expansão autorizada das notificações — 24/11/2026

Lista privada `WEB_PUSH_PILOT_USERS` ampliada de uma para quatro contas: titular preservado e três contas existentes solicitadas. Contas novas elegíveis para leitura de filial completa, com 12/15/15 filiais conforme vínculos atuais. Nenhum perfil, vínculo, inscrição ou preferência alterado. Cada participante precisa de consentimento no aparelho e opt-in do resumo. Nomes/identificadores mantidos na preparação privada.

Recriadas somente API e worker com a mesma imagem `pwa-20261123`, sem build ou migration. Backup `backup-20261124T130410Z-Mlls6Z` conferido; arquivo privado anterior em `/opt/aeropostale-varejo/artifacts/notificacoes-expansao-20261124T130409Z/env.notificacoes.anterior`. VAPID/cofre preservados e cópia atual em `artifacts/notificacoes-20261123/configuracao-privada-expansao-20261124.env`, modo 0600 no Mac. API/worker saudáveis e lista idêntica conferida nos dois processos; conta fora da lista e consulta sem autenticação continuam bloqueadas. Outros 27 containers, Nginx, fontes/envs anteriores, credenciais, permissões e preferências preservados. [Evidência](../docs/validacao-expansao-notificacoes.json).

Para retornar somente esta expansão, restaurar a cópia anterior de `.env.notificacoes` com modo 0600 e recriar somente `api`/`notificacoes-worker` pelo wrapper, sem trocar imagem ou restaurar bancos. Preserve quaisquer inscrições/preferências que os participantes venham a cadastrar; fora da lista, não recebem novos avisos. Não regenerar chaves nem afetar o titular ou outros serviços.

## Aplicativo e resumo diário — 23/11/2026

Imagem atual de `api` e `notificacoes-worker`: `aeropostale-varejo-api:pwa-20261123`. Instalável pela Tela de Início, com manifesto/ícones e service worker sem cache autenticado. Área Notificações com preferências por filial, inscrição pessoal, teste e histórico. Piloto limitado ao identificador da conta do titular; habilitar o servidor não inscreve aparelhos nem ativa preferências. Titular instalou/autorizou o iPhone e confirmou recebimento real do teste com captura às 14h33 de 23/11; resumo ativado por ele para 11 filiais. Em 24/11, titular confirmou o recebimento automático das 11 lojas. Na mesma data, confirmou valores e abertura da filial/dia corretos; piloto homologado pelo titular, sem ampliação da allowlist ou ativação de outros alertas. [Uso e regras](../docs/ALERTAS_NOTIFICACOES.md).

Publicados somente `api` e novo `notificacoes-worker`; os outros 27 containers, Nginx, envs anteriores, contas/perfis/vínculos, clientes/chaves/autenticadores preservados. API e worker saudáveis, nove assets iguais por HTTPS e navegador com API/dados sintéticos aprovado. Na publicação, zero inscrições e envios, preferências desligadas até adesão. Worker local, relatórios antigos e webhooks preservados.

Migration **somente central**, aditiva: `008_notificacoes_push.sql`. Cria preferências, inscrições cifradas e outbox; não altera banco do tenant ou vendas. LOGIN exclusivo `varejo_notificacoes_login`, grupo `varejo_notificacoes_worker`, leitura restrita e escrita somente nas inscrições/entregas. Teste confirmou ausência de leitura dos hashes de senha e de escrita comercial. Não conceder privilégios do owner ao worker.

Configuração privada `.env.notificacoes`, modo 0600, incluída condicionalmente pelo wrapper `deploy/integracoes-hostgator.sh`. API recebe VAPID pública/cofre/allowlist; a chave VAPID privada e os URLs do LOGIN restrito são passados somente ao worker. Cópia privada fora do Git em `artifacts/notificacoes-20261123/configuracao-privada.env` no Mac e no diretório operacional do servidor. Preservar o cofre/VAPID com os dumps para recuperação; não regenerar em atualizações comuns. O backup automático dos bancos inclui as novas tabelas, mas não substitui a cópia das chaves.

Backup de publicação `backup-20261123T171556Z-AvDvEt`, COMPLETE/checksums dos dois bancos conferidos. Fontes/override anteriores e cópia privada da configuração em `/opt/aeropostale-varejo/artifacts/notificacoes-20261123T171556Z`. Para retorno: parar `notificacoes-worker` enquanto o arquivo privado ainda está presente; preservar/remover a configuração ativa `.env.notificacoes`, restaurar as fontes e o override anteriores, usar a imagem anterior `navegacao-fluida-20261123` e recriar somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`. Desabilitar o LOGIN exclusivo se o worker for retirado definitivamente. Não excluir inscrições/entregas, desfazer a migration ou restaurar bancos para retornar esta interface. Os outros serviços não precisam de reinício.

A primeira tentativa voltou automaticamente à API anterior por erro de sintaxe na lista `tmpfs` do worker (vírgula sem aspas dividia a opção em duas montagens). Configuração corrigida e conferida na saída estruturada do Compose; segunda publicação reutilizou a migration e as mesmas chaves, com preservação verificada. [Evidência](../docs/validacao-notificacoes.json).

## Troca de filiais e limite de consultas — 23/11/2026

Imagem desta publicação de `api`: `aeropostale-varejo-api:navegacao-fluida-20261123`. Cotas por conta/tenant, mídia separada, proteção de entrada/login/anônimos e `Retry-After` real. Frontend agrupa filtros, cancela consultas antigas, carrega fotos sob demanda e apresenta a espera restante. Datas e erro ajustados para celular. Autenticação, permissões e regras comerciais preservadas; PWA/Web Push não implementados.

Publicada somente `api` após backup `backup-20261123T134745Z-3RAmkh`, com COMPLETE/checksums dos dois bancos conferidos. API saudável, limitador conferido na imagem e CSS/JS iguais por HTTPS. Navegador com assets de produção e API de dados sintéticos aprovado, sem login comercial nessa verificação. Outros 27 containers, Nginx, envs, concessões/chaves/autenticadores preservados. Sem migration; workers e webhooks preservados.

Fontes/override anteriores em `/opt/aeropostale-varejo/artifacts/troca-filiais-20261123T134745Z`. Para retorno, restaurar `backend/src/http-api.mjs`, `frontend/assets/app.js`, `frontend/assets/styles.css` e `deploy/integracoes-hostgator.yaml` dessa pasta, usando a imagem anterior `mobile-20261123`, e recriar somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`. Não remover o módulo de navegação nem restaurar bancos. [Regras](../docs/TROCA_FILIAIS.md), [evidência](../docs/validacao-troca-filiais.json).

## Menu e filtros no celular — 23/11/2026

Imagem desta publicação de `api`: `aeropostale-varejo-api:mobile-20261123`. Menu lateral modal até 760 px com o mesmo nav/permissões; computador/tablet mantêm a barra lateral. Filtros e alvos de toque ajustados. Novo módulo estático `/assets/navegacao.js` incluído na allowlist do servidor, com CSP e no-store preservados. Nenhuma mudança em regras comerciais, autenticação, migrations ou API externa. PWA/Web Push não implementados.

Publicada somente `api`, com outros 27 containers, Nginx, envs, clientes/chaves/autenticadores preservados. Backup `backup-20261123T124740Z-gg6Drs` com COMPLETE/checksums dos dois bancos conferidos. API saudável e HTML/CSS/JS iguais por HTTPS; interface com assets de produção e respostas sintéticas aprovada em 320/390/430/760/900/1440 px. Não foi usado login comercial nessa verificação. Worker local e webhooks preservados.

Fontes/override anteriores em `/opt/aeropostale-varejo/artifacts/navegacao-mobile-20261123T124740Z`. Para retorno, restaurar esses arquivos, remover somente o módulo novo `frontend/assets/navegacao.js`, usar a tag anterior `imagens-alternativas-20261116` e recriar somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`. Não restaurar bancos para retornar esta alteração. Uma primeira tentativa voltou automaticamente por uma expectativa de HTTP 404 no teste de arquivo privado; o servidor bloqueia com HTTP 401. Checagem corrigida, publicação repetida e preservação conferida. [Uso](../docs/NAVEGACAO_MOBILE.md), [evidência](../docs/validacao-navegacao-mobile.json).

## Descrição do evento nas vendas — 18/11/2026

Imagem atual de `integracoes-api`: `aeropostale-varejo-integracoes:eventos-vendas-20261118`. Lista e detalhe incluem `evento_descricao`, obtida do catálogo confirmado de dez códigos. Código ausente/desconhecido retorna null. Enriquecimento na leitura de projeções existentes; nenhuma migration, reimportação ou alteração de versão comercial. Cursores anteriores podem omitir o campo até expirar. Documentação pública e exemplos dos escopos publicados nos 25 caminhos permitidos, com igualdade de bytes por HTTPS.

Publicada somente `integracoes-api`; outros 27 containers, Nginx, envs, clientes, chaves e autenticadores preservados. API saudável e DTO executado na imagem; consultas sem token HTTP 401 e administração bloqueada no domínio público HTTP 404. Worker local e webhooks continuam desativados. Concessão real preservada somente com `filiais:ler`; esta publicação não libera acesso a vendas, produtos ou pessoas.

Backup `backup-20261118T204038Z-sHkhP1` com COMPLETE/checksums dos dois bancos conferidos. Fontes e override anteriores em `/opt/aeropostale-varejo/artifacts/eventos-api-20261118T204038Z`. Para retorno, restaurar os arquivos anteriores, remover somente o módulo novo `backend/src/integracoes/eventos-venda.mjs` e recriar exclusivamente `integracoes-api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait integracoes-api`, usando a tag anterior `console-ux-20261116`. A documentação anterior permanece em `/var/www/aeropostale-integracoes-releases/20261113T125859Z`; restaurar o symlink público se necessário. Não restaurar bancos para retornar esta alteração. [Evidência](../docs/validacao-eventos-escopos-api.json).

## Fonte alternativa de imagens — 16/11/2026

Imagem desta publicação de `api`: `aeropostale-varejo-api:imagens-alternativas-20261116`. A imagem importada continua prioritária. Sem URL ou com falha de download/decodificação, o painel consulta a segunda base por código e, quando disponível, cor do SKU. Permissões e restrições de filial/vendedor continuam obrigatórias; catálogo sem venda com foto usa uma rota autenticada de consulta ao estoque atual.

`PASSWORD_JOINKEY` foi acrescentada ao `.env` privado e fornecida somente à `api` pelo Compose. Nenhum valor foi incluído nas fontes ou nos assets do navegador. Sem token a segunda base fica desativada. Cache somente em memória; sem migrations ou alteração de registros comerciais. [Correspondência, limites e cobertura](../docs/IMAGENS_PRODUTOS.md).

Publicada somente `api`; outros 24 containers, Nginx, clientes/chaves/autenticadores e `.env.integracoes` preservados. Backup `backup-20261117T022423Z-4fCCKn` com COMPLETE/checksums conferidos (16/11 às 23h24 de São Paulo). Fontes/override e `.env` anterior privados em `/opt/aeropostale-varejo/artifacts/imagens-alternativas-20261117T022423Z`. Para retorno, restaurar os arquivos anteriores dessa pasta, remover o módulo novo que não existia e usar a tag `crescimento-limpo-20261116`; recriar somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`. Não alterar os workers nem os demais serviços.

Download real da segunda API validado dentro da VPS; login/catálogo por HTTPS aprovados e imagens sem sessão bloqueadas. A disponibilidade final depende de imagens cadastradas nas duas origens. [Evidência](../docs/validacao-imagens-alternativas.json).

## Experiência do console — 16/11/2026

Imagem desta publicação de `integracoes-api`: `aeropostale-varejo-integracoes:console-ux-20261116`. Atualizados lista, busca/filtros, formulários, seleção de filiais com nomes, chaves e modal responsivo. A consulta administrativa de clientes passa a incluir `filiais_detalhes`, obtido somente das projeções de filiais autorizadas existentes, sob os mesmos controles de operador/MFA. Contrato público e permissões do banco preservados.

Contagem do prazo e renovação de MFA preservam campos apenas em memória. Não há envio automático após renovar; mudança de versão invalida o rascunho. O prazo e a validação continuam sendo impostos pelo servidor. Manual interno acompanha os novos botões.

Publicada somente `integracoes-api`, com outros 24 containers, Nginx, envs, clientes, chaves e autenticadores preservados. Backup `backup-20261117T013509Z-rIQSzV` com COMPLETE/checksums conferidos no servidor (16/11 às 22h35 de São Paulo). Fontes/override anteriores em `/opt/aeropostale-varejo/artifacts/console-ux-20261117T013509Z`. Para retorno, restaurar esses arquivos, usar a imagem anterior `revogacao-20261116` e recriar somente `integracoes-api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait integracoes-api`. Sem migration ou alteração de credenciais/webhooks. [Evidência](../docs/validacao-console-integracoes-ux.json).

## Histórico: revogação por chave — 16/11/2026

Imagem desta publicação: `aeropostale-varejo-integracoes:revogacao-20261116`. Nova rota administrativa `POST /admin/integracoes/clientes/{id}/chaves/{kid}/revogar`, com os mesmos requisitos de operador/MFA, tenant, If-Match e motivo. O console lista os kids com botão Revogar e confirmação individual, sem PEM ou validade. Cancelar preserva a chave; MFA expirado fecha a confirmação e solicita autenticação novamente. Não expor esta rota no domínio público da API.

Publicada somente `integracoes-api`; outros 24 containers, Nginx, envs, clientes, chaves e autenticadores preservados. Backup prévio `backup-20261117T004151Z-h9hFc7` com COMPLETE/checksums conferidos no servidor (16/11 às 21h41 de São Paulo). Fontes/override anteriores em `/opt/aeropostale-varejo/artifacts/revogacao-chave-20261117T004151Z`. Para retorno, restaurar esses arquivos, usar a tag anterior `qr-20261114` e recriar somente `integracoes-api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait integracoes-api`. Retornar a imagem não reativa chaves revogadas. Sem migrations; workers e webhooks preservados.

A publicação preservou as credenciais. Posteriormente, o titular confirmou a revogação real no console: consulta somente leitura confirmou chave anterior inativa, nova como única ativa, auditoria e concessões preservadas. Os três cadastros temporários continuam revogados. O teste assinado com a nova chave depende do integrador. [Evidência](../docs/validacao-revogacao-chaves.json).

## Textos do crescimento removidos — 16/11/2026

Imagem desta publicação: `aeropostale-varejo-api:crescimento-limpo-20261116`. Retirados somente os dois parágrafos de metodologia/pendências abaixo do dashboard. HTML e JavaScript conferidos por HTTPS; navegação computador/celular aprovada nos dois modos. Publicada somente `api`, demais assets, outros 24 containers e Nginx preservados. Sem alteração de banco.

Backup existente reconferido no servidor: `backup-20261116T151554Z-ud7mPC`. Fontes/override anteriores em `/opt/aeropostale-varejo/artifacts/crescimento-limpo-20261116T195937Z`; para retorno, restaurar HTML, `assets/crescimento.js` e override, usando a tag anterior `rodape-20261116`, e recriar somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`. A apuração comercial foi somente leitura. [Evidência](../docs/validacao-limpeza-crescimento-apuracao.json).

## Histórico: rodapé atualizado — 16/11/2026

Imagem desta publicação: `aeropostale-varejo-api:rodape-20261116`. Rodapé compartilhado com o texto **Feito por Join Network**, conferido por igualdade do HTML servido por HTTPS. Publicada somente `api`; demais assets, outros 24 containers e Nginx preservados. Sem alteração de banco.

Backup existente `backup-20261116T151554Z-ud7mPC` reconferido no servidor. HTML/override anteriores em `/opt/aeropostale-varejo/artifacts/rodape-20261116T190940Z`. Para retorno, restaurar esses dois arquivos e recriar somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`, usando a imagem anterior `crescimento-todos-20261116`. [Evidência](../docs/validacao-rodape.json).

## Histórico: comparação de todos os anos — 16/11/2026

Imagem desta publicação: `aeropostale-varejo-api:crescimento-todos-20261116`. Nova opção `comparacao=todos` em `/api/v1/crescimento`, com padrão `anterior` preservado no endpoint e ao abrir/retornar à tela. Publicada somente `api`, sem migrations/Nginx/permissões novas. Outros 24 containers e credenciais/autenticadores preservados; worker remoto ativo, local e webhooks desativados.

Backup `backup-20261116T151554Z-ud7mPC` com COMPLETE/checksums dos dois bancos conferidos no servidor. Fontes/override anteriores e relatório operacional em `/opt/aeropostale-varejo/artifacts/crescimento-todos-20261116T151552Z`. Retorno: restaurar essas fontes/override e recriar somente `api` usando `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`. A tag anterior `crescimento-20261116` foi preservada. [Evidência](../docs/validacao-crescimento-todos-anos.json).

## Histórico: primeira publicação do crescimento anual — 16/11/2026

Imagem desta publicação: `aeropostale-varejo-api:crescimento-20261116`. Publicada somente `api` com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait api`; sem migration ou Nginx novo. API de integrações continua `qr-20261114`, workers e os outros 24 containers preservados. Permissão existente `consolidado:ler`, com vínculos explícitos de Diretoria/Supervisão; nenhuma concessão adicional à API de terceiros.

Backup prévio `backup-20261116T143826Z-Q1gyqu` com COMPLETE e checksums dos dois bancos conferidos no servidor. Fontes/override anteriores e relatório privado de publicação em `/opt/aeropostale-varejo/artifacts/crescimento-anual-20261116T143824Z`. Para retorno, restaurar as fontes e o override dessa pasta e recriar exclusivamente `api`, preservando imagens, credenciais, workers e webhooks desativados. Não requer alteração de banco.

Cálculos conferidos nas 15 filiais com o consolidado para 2024/2025 completos e 2026 acumulado; interface HTTPS verificada em computador/celular. Histórico financeiro/itens e credenciais/autenticadores preservados por hash. [Regras e uso](../docs/CRESCIMENTO_ANUAL.md) e [evidência](../docs/validacao-crescimento-anual.json).

## Estado do primeiro consumidor — 14/11/2026

Titular concluiu o cadastro do autenticador e validou MFA diretamente na interface. Primeiro consumidor ativado pelo console, restrito a `filiais:ler` e 11 filiais. Chave de teste válida até 21/11/2026 às 23h59 de São Paulo. Identificadores e arquivos individuais ficam na preparação privada ignorada pelo Git. Não foi necessário publicar imagens, executar migrations ou alterar dados comerciais.

Teste com `curl` confirmou OAuth HTTP 200/token de 900 segundos, lista HTTP 200 com exatamente as 11 filiais e HTTP 403 para filial fora da concessão e vendas sem escopo. Conferência somente leitura confirmou concessão/chave ativas, auditoria e zero inscrições desse consumidor; envios de webhooks continuam desativados. [Evidência agregada](../docs/validacao-acesso-integracao-filiais.json). A matrícula e o primeiro cadastro substituem as respectivas pendências históricas abaixo; homologação de outros recursos e renovação da chave permanecem separadas.

## Console de integrações no painel — 14/11/2026

Acesso Admin pelo menu **Integrações e API** ou https://aeropostale.joinnetwork.com.br/admin/integracoes/console#manual . `INTEGRATIONS_ADMIN_ENABLED=true`; `INTEGRATIONS_DELIVERIES_ENABLED=false`. O domínio público da API continua bloqueando `/admin/`; a rota administrativa existe somente no domínio do painel e exige operador individual e MFA para consultar dados.

Um convite individual de 24 horas foi criado para a conta administrativa configurada. O titular entra com sua senha, abre o Google Authenticator em **+ → Ler QR code**, escaneia o código mostrado no console e confirma os seis dígitos na própria interface. A inclusão manual da chave permanece disponível como alternativa. O QR é gerado localmente no navegador e apagado após confirmação, expiração ou saída; não usa serviço externo de imagens. Até essa confirmação não há operador ativo ou acesso ao manual. O desafio expira em cinco minutos, fica vinculado à sessão e não serve como autorização de MFA. Não cadastrar o autenticador, copiar chaves ou enviar códigos pelo chat em nome do titular.

Imagens atuais: `aeropostale-varejo-api:pwa-20261123` e `aeropostale-varejo-integracoes:eventos-vendas-20261118` para `api` e `integracoes-api`, respectivamente. Coletor ERP e worker de projeções mantêm suas imagens. Operar via `bash deploy/integracoes-hostgator.sh`; atualizar somente esses dois serviços quando necessário. O Nginx do painel encaminha a lista de rotas administrativas para a porta local 3200 e usa log sem query/payload. Não abrir portas adicionais, alterar o vhost público da API ou servir o conteúdo do manual como arquivo estático.

Sem migration. `deploy/integracoes-permissoes.sql` concede `UPDATE(ativo)` além de `UPDATE(ultimo_passo)` no registro administrativo; o LOGIN da API continua sem INSERT/DELETE de operadores ou UPDATE do segredo. A emissão do convite usa `scripts/autorizar-operador.mjs UUID` em processo operacional com as URLs dos owners e a chave existente disponibilizadas de forma privada; cria somente um registro inativo e auditoria. Não cria usuário do painel, não substitui cadastro de operador existente e não ativa consumidores ou entregas. Para matrícula/revogação/recuperação operacional já existente, consultar `docs/integracoes/operacao.md`.

Antes de alterar, guardar `.env.integracoes`, override e vhost, verificar backup dos dois bancos e registrar os containers. Para retorno, restaurar os arquivos privados anteriores, as tags e o vhost, validar `nginx -t`, recriar somente `api`/`integracoes-api` e recarregar o Nginx. Não reativar webhooks durante retorno. A evidência desta publicação está em `docs/validacao-console-integracoes.json`; a confirmação real do autenticador ainda depende do titular.

## Carga complementar de vendas desde 2023

O serviço `carga-historica`, definido em `deploy/historico.compose.yaml`, processa 2023–2025 por filial na HostGator. O coletor regular permanece ativo cobrindo 2026 até hoje. Não resetar checkpoints nem ativar o worker local. Estado e erros ficam em `artifacts/carga-historica-2023/estado.json`, fora do Git. Rotina iniciada em 13/11/2026 e concluída nas 15 filiais em 14/11/2026; consultar [procedimento, sequência, pendências e comandos de retomada](../docs/CARGA_HISTORICA_VENDAS.md). Não incluir este guia operacional na documentação pública.

## Histórico: publicação inicial do manual em 13/11/2026

A aba **Manual** do console apresenta o procedimento de cadastro de credencial de máquina e preparação de API/webhooks. O conteúdo está em `backend/src/integracoes/manual.mjs`, entregue somente após autorização do operador e MFA, em `GET /admin/integracoes/manual`. O Nginx público continua bloqueando `/admin/` e o console continua dependente de habilitação operacional privada. Não incluir o manual no manifesto de documentação pública.

Esta revisão usa a imagem `aeropostale-varejo-integracoes:manual-20261113` somente para `integracoes-api`, mantendo a imagem anterior do worker e dos demais serviços. Publicar exclusivamente com `bash deploy/integracoes-hostgator.sh up -d --no-build --no-deps --wait integracoes-api`, depois de construir e validar a imagem. Preservar `INTEGRATIONS_ADMIN_ENABLED=false` e `INTEGRATIONS_DELIVERIES_ENABLED=false` até o provisionamento planejado; nenhuma migration é necessária. Para retorno, restaurar a tag anterior da API no override e recriar somente esse serviço.

## Publicação da documentação pública

Este arquivo e os guias `administracao.md`, `implementacao.md` e `operacao.md` são documentos internos, fora da publicação HTTP. O contrato público e seus exemplos são definidos por `config/documentacao-integracoes-publica.json`.

Após editar o conteúdo, execute `python3 scripts/gerar-contrato-integracoes.py`, `python3 scripts/gerar-portal-integracoes.py` e `python3 scripts/preparar-docs-integracoes.py`. O último comando prepara exclusivamente os 25 arquivos autorizados em `artifacts/documentacao-integracoes/publico` e gera `deploy/nginx-integracoes-publico.conf`. Valide com `scripts/validar-docs-integracoes.py` e `node scripts/verificar-portal-integracoes.mjs`.

Na HostGator, os arquivos públicos ficam em uma revisão própria de `/var/www/aeropostale-integracoes-releases`, apontada pelo symlink `/var/www/aeropostale-integracoes-publico`. Instale o snippet gerado em `/etc/nginx/snippets/aeropostale-integracoes-publico.conf` e o vhost `deploy/nginx-integracoes.conf` como `/etc/nginx/sites-available/varejo-integracoes`. Valide com `nginx -t` antes de recarregar. Preserve a revisão/configuração anterior para retorno. Não copie integralmente `docs/`, `deploy/` ou o diretório de autoria para uma raiz pública.

O Nginx permite somente os caminhos exatos do manifesto. Verifique HTTP 200 e igualdade de hashes dos arquivos públicos, HTTP 404 nos guias internos e relatórios operacionais, HTTP 401 na consulta sem token e a disponibilidade dos outros portais. Esta atualização de documentação não exige reconstrução de imagens, migrations ou reinício dos containers.

## API externa preparada para uso futuro — 13/11/2026

Publicados https://api-varejo.aeropostale.joinnetwork.com.br e seu [portal de documentação](https://api-varejo.aeropostale.joinnetwork.com.br/docs/integracoes/). API/OAuth e worker de projeções ativos, migration 019 aplicada com hashes comerciais/checkpoints preservados. Projeção inicial de 94.829 recursos concluída. Consultas autenticadas, permissões, omissão de dados pessoais sem escopo, JWT reutilizado e revogação verificados pelo HTTPS público; credencial temporária revogada. Nenhum consumidor real, inscrição ou entrega de webhook criado. Console e entregas permanecem desativados por decisão de Maylon; homologação de um consumidor continua pendente.

Fonte base `b8d8448`, com ajustes de publicação: sharp 0.35.5, CONNECT explícito dos grupos restritos, vhost/documentação e política de egress. API do painel e coletor atualizados; PostgreSQL e os outros serviços/vhosts preservados. Ver [operação das integrações](../docs/integracoes/operacao.md). Usar `bash deploy/integracoes-hostgator.sh` para operar os serviços adicionais; ele lê `.env.integracoes` privado e o override próprio. As tags identificam as imagens operacionais verificadas; os hashes das imagens ficam na evidência de publicação. Não limpar as imagens/fontes anteriores.

Os novos serviços recebem apenas LOGINs de menor privilégio, sem permissão de alterar tabelas comerciais. Egress atual permite somente PostgreSQL, com regras exclusivas dos IPs fixos e persistência no systemd. A chave de armazenamento tem cópia protegida conferida fora do servidor; não trocá-la em manutenção. Backups pós-migration devem ser restaurados com essa chave para recuperar as projeções cifradas. Relatórios diários R30 continuam pausados separadamente.

Backup pós-publicação `backup-20261113T100337Z-WiY71c` restaurado em PostgreSQL 17 descartável, sem rede; migration 019 e decifragem de uma projeção conferidas sem exibir seu conteúdo. Tokens/snapshots/step-ups ausentes na recuperação, nenhum cliente ativo. Cópia no MacBook Home com checksums conferidos. Evidência: `docs/validacao-publicacao-integracoes-hostgator.json`.

## Recuperação na HostGator — 13/11/2026

O DNS foi alterado por Maylon e verificado nos resolvedores públicos. A VPS antiga da Locaweb foi desligada pelo console, conforme confirmação de Maylon; preservar discos e snapshots. O alias `localweb` identifica a origem antiga e não deve ser usado para implantar o piloto atual.

Recuperado o backup `backup-20261112T033238Z-S86XWx`, de 12/11 às 00h32 de São Paulo: teste em PostgreSQL 17 descartável, restauração em bancos/volume próprios, contagens e hashes comerciais/checkpoints iguais antes da ativação do worker. Logins e 15 filiais validados. Dados manuais posteriores ao backup não têm recuperação garantida; o ERP volta a ser consultado pelos checkpoints restaurados. Os dumps cobrem os dois bancos deste projeto, não a máquina inteira nem outros serviços.

A recuperação inicial usou a versão estável `c1c1eb26201aaac9d2e0f333baffd7ea14dad8ab`, com migrations até 018. A publicação posterior da API externa está registrada acima e inclui a migration 019; este parágrafo descreve a recuperação inicial. O projeto Compose `aeropostale-varejo` usa PostgreSQL em `127.0.0.1:55432` e API em `127.0.0.1:3100`, sem exposição direta desses serviços. `compose.override.yaml` no servidor limita PostgreSQL a 1 GiB/1 CPU, API a 512 MiB/1 CPU e worker a 512 MiB/0,5 CPU.

Os três serviços retomaram sem reinícios; API/banco saudáveis. Vendas e cancelamentos concluíram a primeira rodada nas 15 filiais; estoque apresentou timeouts e consultas concluídas. Validações de complementos/identidade ainda rejeitam retornos divergentes do ERP. Não remover essas validações nem presumir histórico completo. Os 14 containers existentes (13 ativos/um parado), suas montagens/imagens e os vhosts anteriores foram preservados; os quatro portais existentes responderam 200.

**Relatórios diários R30 permanecem pausados:** recuperar/conferir `.env.relatorios` e recibos do diretório de exportações antes de instalar/ativar o timer na HostGator. Esses arquivos não estão nos dumps dos bancos. Nenhum envio foi executado nesta migração. R31, demais filiais/cargos e homologações comerciais não estão concluídos por esta publicação.

Evidência agregada: `docs/validacao-migracao-hostgator.json`. Dumps, inventários detalhados, configurações privadas e logs ficam em `artifacts/migracao-hostgator`, ignorado pelo Git.

## Histórico Locaweb: backup e reinicialização — 11/11/2026

Manutenção autorizada para verificar o upgrade de disco: backup `backup-20261112T004339Z-u1FTI2` dos dois bancos, leitura estrutural aprovada e cópia privada externa com checksums conferidos. Snapshot `pre-upgrade-disco-20261111` disponível no painel, com o anterior preservado. Não foi realizada nova restauração integral deste backup.

Reinícios por SSH e pelo provedor concluídos; antes da ação forçada do painel, os 16 containers foram encerrados e o disco sincronizado. O plano privado de retomada está em `/opt/aeropostale-varejo/artifacts/manutencao-disco-20261111/retomar-containers.json`. Os mesmos 16 containers retornaram, com IDs/imagens/montagens preservados e cinco healthchecks saudáveis. Container antes inativo permanece inativo. Nginx/Docker, API/PostgreSQL, coletor remoto e timers de backup/relatórios ativos; HTTPS público HTTP 200, worker local desativado.

O adicional aparece ativo na Central, mas a capacidade física continua em dois discos de 10 GiB. Raiz 19G, 1,5G livres, 92% de uso; grupo LVM sem espaço livre. Nenhuma partição/LVM/filesystem alterado. Confirmar provisionamento com a hospedagem antes de qualquer extensão e da publicação da R31. Evidência agregada: `docs/validacao-reinicio-vps.json`; inventários e cópia dos dumps em `artifacts/manutencao-disco`, fora do Git. Snapshot não substitui a cópia externa.

## Serviços

API e PostgreSQL publicados somente em loopback; Nginx atende o domínio com HTTPS. O worker remoto é o responsável pela sincronização. O worker local foi parado e `SYNC_ENABLED=false` foi salvo no `.env` local.

```sh
cd /opt/aeropostale-varejo
docker compose ps
docker compose logs --tail 30 sync-worker
curl -f https://aeropostale.joinnetwork.com.br/health
```

Não habilitar workers locais e remotos simultaneamente com bancos separados. O bloqueio PostgreSQL não é compartilhado entre esses bancos.

## Backup e recuperação

`bash deploy/backup.sh` gera dumps customizados de ambos os bancos, checksums SHA-256 e marcador COMPLETE. O diretório usa permissões privadas. Sessões Admin são excluídas dos dados do backup, exigindo novo login após restauração; usuários e hashes de senha são preservados.

O timer `aeropostale-backup.timer` executa diariamente às 03:30 UTC (00:30 de São Paulo), com até cinco minutos de variação. Verificar com `systemctl list-timers aeropostale-backup.timer` e `journalctl -u aeropostale-backup.service`. Os backups diários ficam em `/opt/aeropostale-varejo/backups`. Retenção ativa: 5 dias na HostGator após confirmação externa e 90 dias no mabookhome, preservando sempre a última cópia completa. O backup após a retomada, `backup-20261113T035422Z-4TFW7A`, foi copiado para o Mac e teve seus checksums conferidos. Cópias privadas no computador de origem também permanecem ignoradas pelo Git.

Os dumps são consistentes individualmente; não são um snapshot simultâneo entre os dois bancos. Para uma migração coordenada, pausar escritas/sincronização antes da cópia. O backup inicial foi restaurado nos bancos novos antes da publicação e conferido contra contagens, totais, hashes de operações/itens/cancelamentos, tenant e checkpoints da origem.

Para recuperar, usar uma instância isolada de PostgreSQL 17, criar os usuários e bancos com `database/init`, verificar SHA256SUMS e restaurar cada dump no banco correspondente com `pg_restore --no-owner --role=USUARIO --exit-on-error --single-transaction`. Conferir os dados com `deploy/conferencia.sql`, aplicar migrations e testar API/login antes de alterar o destino do Nginx. Nunca restaurar por cima da produção em uso. O script de backup não realiza restauração automaticamente.

## Atualizações e retorno

Antes de atualizar, fazer backup e registrar os IDs das imagens em uso. Transferir somente arquivos versionados; `.env`, importação e backups permanecem privados no servidor. Construir as imagens e aplicar migrations com:

```sh
docker compose build api sync-worker
docker compose run --rm --no-deps api node scripts/migrar.mjs
docker compose up -d --wait api
docker compose up -d sync-worker
```

A imagem da API inclui migrations e scripts administrativos. O provisionamento inicial não é executado a cada inicialização.

Se uma atualização falhar, manter o worker pausado e retornar a imagem anterior somente se compatível com o schema. Mudanças de schema incompatíveis exigem recuperação isolada a partir de backup e validação antes da troca. Não usar `docker compose down -v`: isso remove o volume de dados.

## HTTPS e verificação

Certificado emitido para o hostname exato na HostGator e renovado em 13/11, com vencimento em 11/02/2027 às 02h56 UTC. Certbot usa webroot em `/var/www/letsencrypt` e desafio HTTP; renovação simulada e real aprovadas. `certbot.timer` ativo, com deploy hook `/opt/aeropostale-varejo/deploy/renovar-nginx.sh`, que valida e recarrega o Nginx. O TXT criado para a emissão inicial não é necessário para as próximas renovações. Propagação depende dos caches de cada resolvedor; a validação externa usou DNS público e TLS estrito, sem ignorar certificado.

Verificação externa autenticada: `node --env-file=.env scripts/verificar-producao.mjs`, no computador que possui as credenciais Admin. Nunca imprimir token/senha. Opcionalmente `DEPLOY_VERIFY_IP` permite testar um IP preservando a verificação TLS do hostname.

Em 13/09/2026, Maylon confirmou o agrupamento das 14 filiais no mesmo tenant Aeropostale. Admin acessa as 14; o histórico das novas filiais é carregado gradualmente. ITUPEVA foi homologada por confirmação de Maylon; os totais das outras lojas e o SaaS permanecem etapas separadas. O limitador da API atual usa o IP de conexão do proxy: limites ficam compartilhados entre os usuários neste piloto, devendo ser revisados antes da expansão.

## Conferência da expansão

`node --env-file=.env scripts/verificar-filiais.mjs` verifica os cadastros ERP; `--retomar` repete somente os cadastros não confirmados no relatório anterior. São consultas de leitura, sem importação. A sincronização periódica usa `config/piloto.json`, com ITUPEVA primeiro e até sete dias por recurso/filial por rodada. O evento `lote_historico_concluido` significa que um lote terminou, não que o histórico está completo.

`node --env-file=.env scripts/verificar-producao.mjs` confere a lista autorizada, indicadores por filial, TLS, login e rejeição de filial não autorizada. A evidência inclui cobertura por filial; novas lojas continuam parciais até seus checkpoints cobrirem o período consultado.

Para preparar uma referência de homologação de ITUPEVA: `node --env-file=.env scripts/preparar-homologacao.mjs`. O relatório lê somente o painel, verifica somas e gera arquivos privados na central. `HOMOLOGACAO_INICIO` e `HOMOLOGACAO_FIM` mudam o período. Cada execução cria uma extração nova e preserva a ficha de aceite existente; não comprova, por si só, equivalência com o ERP. Atualize o HTML com `python3 scripts/gerar-central.py`.

## Implantação do cadastro incremental

Aplicar migrations antes de publicar a API que lê `cadastro_filiais`. Com o worker pausado, executar `docker compose run --rm --no-deps sync-worker node scripts/sincronizar-filiais.mjs` e confirmar os 14 cadastros antes de atualizar a API. Retomar o worker após a publicação. Backup do tenant inclui cadastro e cursor.

Acompanhar eventos `cadastro_filiais_sincronizado` e `cadastro_filiais_falhou`, além da tabela `sync_cadastro_filiais`. O cursor não substitui a autorização nem os checkpoints dos outros recursos.

## Kanban pessoal

Editar tarefas e estados em `config/roadmap.json`, então executar `python3 scripts/gerar-central.py`. O gerador atualiza somente o bloco delimitado `KANBAN` do roadmap e gera o quadro na central pessoal. Notas e edições pessoais anteriores são preservadas; o HTML continua ignorado pelo Git. O quadro é uma fotografia do planejamento, sem consulta automática ao servidor.

## Permissões por cargo — 14/09/2026

Fazer backup e aplicar `control/003_permissoes.sql` antes de subir a API nova. Não requer atualizar o worker. O Admin existente mantém suas credenciais e acesso completo. Testar `/auth/me`, `/acessos/perfis` e filiais após a atualização. O gerenciamento de permissões exige Admin; os demais usuários dependem dos recursos do cargo e vínculos cadastrados. Perfis e vínculos entram no backup central. A tela de cadastro de usuários continua em R13.

## Gestão de usuários — 14/09/2026

A API inclui a tela Usuários e as rotas `/acessos/usuarios` e `/acessos/vendedores`. Usa a migration de permissões já instalada; não há nova migration nesta entrega. Publicação com backup prévio e atualização somente da API. Cadastro, cargo, ativação, senha e vínculos ficam no banco central e no backup existente. Alterações de usuário revogam sessões anteriores. O próprio Admin não pode se alterar pela tela; outro Admin deve fazê-lo. Nenhum convite ou senha é enviado automaticamente.

## Teste isolado de recuperação — 14/09/2026

Executar `python3 scripts/verificar-backup.py CAMINHO_DO_BACKUP` no computador com Docker e imagem `postgres:17`. O script exige COMPLETE e os dois checksums corretos, rejeita links/manifestos inesperados e cria um container temporário sem rede, sem portas e com dados em tmpfs. Restaura os bancos com `--no-owner --no-acl --exit-on-error --single-transaction`, verifica identidades, registro, Admin ativo e ausência de sessões; remove o container ao terminar. Não utiliza URLs dos bancos nem acessa a produção. Limites do container: 1 CPU, 1 GB de memória e tmpfs de 1 GB; revisar esses limites quando o histórico crescer.

Relatório agregado: `docs/validacao-backup.json` (pode escolher outro caminho com `--relatorio`). Logs privados: `artifacts/deploy/varejo-restore-test-*/restore.log`. O teste verifica recuperação do backup indicado, sem comparação com a produção em alteração. Dumps e logs continuam fora do Git. Cinco testes de validação: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-verificar-backup.py`.

A restauração do backup de 14/09 às 11h56 UTC foi validada. Destino e política definidos posteriormente por Maylon: mabookhome, 5 dias na Locaweb e 90 dias no Mac. A política de 30 dias não foi aplicada.


## Cópia automática para mabookhome

Pasta no Mac: `/Users/maylonsantos/Backups/JoinNetwork/Aeropostale`. No Finder, usar ⌘⇧G e colar esse caminho. Cada backup contém `control.dump`, `tenant.dump`, `SHA256SUMS` e `COMPLETE`; os dumps são arquivos PostgreSQL para restauração.

O Mac busca os backups pela conexão SSH à HostGator em `143.95.219.212:22022`. Acesso ao Mac pelo alias `mabookhome` já funciona via rede Tailscale; não foi necessário instalar Tailscale no servidor. A chave privada exclusiva `~/.ssh/aeropostale_backup_ed25519` fica somente no Mac. O known_hosts dedicado foi copiado da conexão confiável existente; o coletor exige verificação estrita da identidade do servidor.

Na HostGator, a chave pública tem `restrict` e comando forçado `/usr/bin/python3 /opt/aeropostale-varejo/deploy/exportar-backups.py`. O comando permite apenas `exportar-backups` e `confirmar-copias`; não libera shell, terminal ou encaminhamento de portas. O helper usa `scripts/backup_retencao.py`, valida os backups completos e limita a confirmação aos nomes e hashes existentes. O acesso deve continuar restrito ao reinstalar; nunca autorizar essa chave como login geral. Uma tentativa de comando não permitido foi rejeitada na validação da migração.

No Mac, `scripts/receber-backups-mac.py` e `scripts/backup_retencao.py` ficam em `Backups/JoinNetwork/Aeropostale/automacao/`, junto de `hostgator-known-hosts` e `origem.json`. A configuração atual é:

```json
{"host":"root@143.95.219.212","port":22022,"known_hosts":"hostgator-known-hosts","nome":"hostgator"}
```

Sem `origem.json`, o coletor mantém o padrão legado da Locaweb para compatibilidade; uma instalação nova na HostGator precisa desse arquivo. Host, porta e nomes são validados antes da conexão. O coletor transfere os backups completos, aceita somente os quatro arquivos esperados, rejeita links e caminhos externos, confere o lote antes de publicar cópias novas e preserva cópias existentes diferentes para análise. Um lock impede execuções concorrentes. Não há exclusão por espelhamento. A transferência atual envia todos os backups completos ainda retidos na origem; somente as cópias novas são adicionadas ao destino. Arquivos anteriores de automação/identidade foram preservados com sufixo `.antes-hostgator-20261113`.

`deploy/instalar-coleta-mac.py --known-hosts hostgator-known-hosts`, executado no Mac como o usuário do backup após instalar os arquivos e a configuração acima, mantém um bloco próprio no crontab, preservando as demais tarefas. Frequência definitiva: `17 * * * *`. O cron existente foi preservado byte a byte na migração, sem reinstalação. Não exige sudo nem sessão gráfica. Quando o computador estiver desligado, dormindo ou sem internet, a tentativa ocorrerá no próximo horário em que puder executar; a rotina não acorda o Mac. Não houve alteração das configurações de energia.

Após conferir os hashes no destino, o Mac envia confirmação por SSH. O servidor então remove somente backups completos confirmados com mais de **5 dias**. Depois do sucesso remoto, o Mac remove cópias completas com mais de **90 dias**. Em ambos os lados, a última cópia completa é preservada. Idade calculada pelo timestamp UTC do nome do backup; cópias incompletas, diretórios inesperados, links e diretórios com arquivos adicionais não são apagados. Dados corrompidos interrompem a limpeza. Se a cópia/confirmacão externa falhar, a retenção remota não avança; o disco pode conservar backups além dos cinco dias até a conexão voltar.

Status local: `automacao/ultima-copia.json`; execuções e falhas: `automacao/coleta.log`. Status remoto: `/opt/aeropostale-varejo/backups/.confirmacao-mabookhome.json`. O JSON local representa a última execução bem-sucedida; conferir também sua data e o log para identificar falhas posteriores. Revogar o acesso removendo somente a chave pública identificada como `aeropostale-backup-mabookhome` do authorized_keys do servidor; desativar a coleta removendo somente o bloco JOINNETWORK AEROPOSTALE BACKUP do crontab do Mac. Preservar as outras chaves e tarefas.

Testes: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-receber-backups.py` e `PYTHONDONTWRITEBYTECODE=1 python3 scripts/test-retencao-backups.py`, além do teste de integridade citado acima. A retenção foi testada com datas antigas sintéticas; a primeira execução real não precisou excluir arquivos.


## Complementos de vendas — 14/09/2026

Pausar o worker, fazer backup, construir API e worker e aplicar `tenant/007_complementos_venda.sql`. `scripts/preencher-complementos.mjs` preenche uma amostra (padrão ITUPEVA, 13/09/2026), adquire o lock exclusivo do worker e compara hashes dos dados comerciais antes/depois. `COMPLEMENTOS_FILIAL` e `COMPLEMENTOS_DIA` permitem outra amostra autorizada. Executar pela imagem do worker com o worker contínuo pausado; nunca habilitar o worker local.

Publicar API e retomar o worker remoto. A cada rodada, o worker prioriza vendas/cancelamentos e depois preenche até três dias históricos por filial, com cooldown/backoff. Verificar `complementos_preenchidos`, `complementos_falharam` e `sync_status`/recurso `complementos`. Conferir cobertura com `SELECT count(*) FILTER(WHERE complementos IS NULL) FROM operacoes`. A conclusão depende de pendências zero e revisão das divergências; abrir o detalhe não inicia consulta ERP.

O aviso de preço aplicado abaixo da tabela depende de desconto informado igual a zero; não aplica novas regras aos indicadores. Histórico e gerador das parcelas respeitam a permissão de clientes. Os novos campos entram no backup do tenant e na cópia automática já configurada para mabookhome.

## Clientes e aniversariantes — 14/09/2026

Aplicar `tenant/008_identidade_clientes.sql` antes de publicar API/worker. Backup e worker pausado durante a atualização. `scripts/preencher-identidade-clientes.mjs` é a amostra operacional protegida pelo lock global do worker: por padrão, ITUPEVA de 01 a 07/09. `CLIENTES_FILIAL`, `CLIENTES_INICIO` e `CLIENTES_FIM` permitem escolher até sete dias; compara hashes dos dados comerciais, itens e checkpoints antes/depois.

O worker contínuo faz a carga de identidade após vendas, cancelamentos e complementos: um dia por filial/rodada, cooldown de 360 segundos e backoff em falhas. `sync_status.recurso='clientes'` acompanha o estado e `operacoes.clientes_identidade_importada` registra cobertura, inclusive respostas sem cliente. Não executar o worker local. A carga não reseta checkpoints.

A rota `GET /api/v1/clientes` aceita os filtros comuns de filial/período/paginação, `busca` de até 100 caracteres e `mes` vazio ou `01` a `12`. Exige `clientes:ler` e `vendas:ler`. O agrupamento ocorre por código ERP depois da restrição de filial/período/vendedor. Contatos refletem o snapshot da movimentação mais recente nesse escopo. Não existe mesclagem por nome/telefone nem edição de cadastro nesta entrega. Aniversário persiste somente mês/dia; o ano não é necessário para esse filtro.

Validação da fonte (somente leitura, saída agregada): `node --env-file=.env scripts/verificar-fonte-clientes.mjs`, opcional `CLIENTES_DIA`. Validações de interface: `scripts/verificar-clientes-ui.mjs` com dados sintéticos isolados e `scripts/verificar-clientes-producao.mjs` no domínio público. Capturas ficam em `artifacts/deploy`, fora do Git. Cobertura histórica pendente no roadmap R26.

## Lista da Vez — R16.1

A API usa `tenant/009_fila_atendimento.sql` e `control/004_fila_permissoes.sql`. Pausar o worker e fazer backup antes da atualização coordenada. Construir a API, aplicar migrations, subir a API com verificação de saúde e retomar o worker existente; esta entrega não requer reconstruir o worker.

Somente Admin recebe automaticamente `fila:ler`, `fila:operar` e `fila:gerenciar`. Configurar os demais cargos na tela Permissões. Operar exige consultar; gerenciar exige operar e não pode ser concedido a perfil limitado às próprias vendas. Vendas continua vinculado ao código do vendedor em cada filial. A ordem da equipe pode ser consultada na filial autorizada, mas detalhes de atendimentos são retornados somente ao próprio operador ou gestor autorizado.

`GET /api/v1/fila?filial=ID&dia=AAAA-MM-DD` retorna jornada, ordem, disponibilidade, atendimentos abertos autorizados e eventual jornada anterior pendente. Candidatos para abertura/chegada são lidos do histórico local e retornados somente ao gestor. Não consulta ERP.

`POST /api/v1/fila` recebe `filial`, `dia`, `versao`, `requisicao` UUID e `acao`. Ações: `abrir` (lista ordenada `vendedores`), `chegada`, `pausar`, `retornar`, `ausente` (campo `vendedor`), `abordar` (`vendedor`, `modalidade` = `vez` ou `reservado`), `iniciar` (`atendimento` UUID), `concluir` (`atendimento`, `resultado` = `com_venda`, `sem_venda` ou `nao_iniciado`) e `fechar`. Pausa, ausência, reservado, conclusão sem venda e não iniciado exigem `motivo` com até 300 caracteres. Limite inicial: 60 participantes por jornada.

Cada mutação usa transação, lock por filial, versão otimista e histórico de eventos. Repetir exatamente a mesma requisição com o mesmo UUID/autor é idempotente; reutilizar o UUID com outros dados retorna conflito. A autorização é relida depois da espera pelo lock. Índices únicos impedem duas jornadas abertas na filial ou dois atendimentos abertos por vendedor. Fechar exige zero atendimentos abertos. Uma abordagem já existente pode prosseguir após a meia-noite; novos atendimentos começam somente no dia atual. A jornada anterior precisa encerrar antes da abertura da nova.

A fila registra resultado informado, sem confirmar venda automaticamente ou alterar ERP/comissões. Relatórios consolidados, movimento intenso e vínculo explícito com a operação ERP continuam em R16.2/R16.3. Backup PostgreSQL inclui automaticamente as novas tabelas e o histórico de eventos.

Verificação local completa: `node --env-file=.env scripts/verificar-fila-ui.mjs`, com Chrome e schemas temporários. Verificação pública somente de leitura: `node --env-file=.env scripts/verificar-fila-producao.mjs`; não cria jornadas reais. Capturas ficam em `artifacts/deploy`, fora do Git. Acompanhar códigos `FILA_DESATUALIZADA` (recarregar estado) e `FILA_JORNADA_PENDENTE` (resolver dia anterior), sem expor dados de atendimentos em logs.

## Relatórios e movimento intenso — R16.2

Atualizar somente a API. As migrations aditivas são `tenant/010_fila_relatorios_intenso.sql` e `control/005_fila_relatorios.sql`. Construir a nova imagem, pausar API/worker para a cópia coordenada, executar backup, aplicar migrations, subir API com verificação de saúde e retomar o worker existente. Não reconstruir nem ativar worker local.

`fila:relatorios` exige `fila:ler`, com concessão automática somente a Admin. Configurar outros cargos no gerenciador. Vendas continua limitado ao próprio código; gerente sem o recurso de relatórios continua podendo operar a jornada, mas não consultar relatórios.

`GET /api/v1/fila/relatorio?filial=ID&inicio=AAAA-MM-DD&fim=AAAA-MM-DD` aceita até 31 dias, `vendedor` opcional e `pagina` (30 registros por página). Totais por vendedor/dia, motivos e paginação usam o escopo antes da agregação. Retorna conversão informada e média ponderada dos concluídos; denominador zero retorna null. Disponibilidade é reconstruída pelos eventos desde a abertura/chegada, excluindo ocupação, pausa e ausência, até o fechamento ou o timestamp consistente da consulta. Datas representam a jornada, inclusive após meia-noite. Leitura em transação consistente e sem ERP.

`POST /api/v1/fila` aceita `acao=movimento_intenso`, `ativo` booleano e `motivo`. Exige gestão, mantém lock, versão e idempotência. Ativar exige jornada de hoje; desligar pode resolver jornada anterior. O modo flexibiliza apenas a vez, preserva a ocupação única e fica gravado em cada abordagem. Fechar a jornada desliga o modo; nova jornada começa normal. Eventos guardam responsável e motivo; a consulta das últimas 100 alterações do modo é exclusiva da gestão com permissão de relatório.

Validação sintética: `scripts/verificar-fila-relatorio-ui.mjs`. Validação pública somente de leitura: `scripts/verificar-fila-relatorio-producao.mjs`; não liga/desliga modo nem altera jornadas reais. Correções excepcionais do histórico dependem de definição; vínculo com ERP continua na R16.3.


## Produtos, estoque e indicadores — R19

Construir API e worker; pausar ambos para backup coordenado e aplicar migrations aditivas `control/006_produtos_estoque.sql` e `tenant/011_produtos_estoque.sql`. Subir a API saudável, executar `docker compose run --rm --no-deps sync-worker node scripts/sincronizar-estoques.mjs` com worker contínuo pausado e, depois, retomar **somente o worker remoto** atualizado. O script usa o lock global e compara hashes comerciais/checkpoints; consultas ERP são sequenciais. Falha parcial de filial preserva as outras e fica explícita para retentativa.

O worker prioriza vendas/cancelamentos, até duas filiais de estoque por rodada e cinco cadastros de produto, antes dos históricos de complementos/clientes. Cursor próprio por filial com sobreposição; atualização completa após um dia, sem transformar SKU ausente em saldo zero. Classificação do catálogo é gradual, com TTL diário após sucesso. A frequência efetiva depende da duração da rodada. A interface não chama o ERP.

Acompanhar `estoque_sincronizado`, `estoque_falhou`, `cadastro_produtos_atualizado`, `sync_estoques` e a cobertura de `cadastro_produtos.enriquecido_em`. Apenas Admin recebe `produtos:ler`/`estoque:ler`; liberar outros cargos no gerenciador. Backups e retenção existentes cobrem as novas tabelas.

Validar com `scripts/verificar-produtos-producao.mjs` (14 filiais, leitura) e conferir worker ativo. Preservar imagens anteriores para retorno compatível; schemas são aditivos. [Regras completas](../docs/PRODUTOS_ESTOQUE.md).


## Indicadores da Visão geral — R19.2

Entrega somente de API/interface, sem migrations ou reimportação. Construir a API, fazer backup e substituir a API com verificação de saúde; manter worker remoto ativo e local desabilitado. Novas rotas Top 20/resumo de estoque usam permissões existentes; indicadores/condições e participação de vendedores são aditivos.

Testes: `scripts/verificar-visao-geral-ui.mjs` com dados sintéticos, incluindo falha de foto na origem e vendedor restrito. Validação pública de leitura: `scripts/verificar-visao-geral-producao.mjs`, com totais de condições/mês conservados nas 14 filiais, fotos/ampliação e celular. As fotos usam a hospedagem de imagens já autorizada, com no máximo quatro downloads simultâneos no navegador. Alterar ordenação/página de vendedores não recarrega fotos do Top 20.

## Ajustes do ranking e Fantasia das filiais — 16/09/2026

Aplicar a migration tenant `012_fantasia_filiais.sql` com o worker pausado após backup. Ela acrescenta Fantasia e solicita uma releitura completa do cadastro de filiais pelo escopo, preservando o cursor cadastral e os checkpoints comerciais. Construir API e worker; executar `scripts/sincronizar-filiais.mjs` na nova imagem do worker, conferir preenchimento e então publicar ambos. O incremental passa a atualizar código e Fantasia juntos. A coluna é aditiva e compatível com retorno às imagens anteriores.

Top 20 aceita `ordenar=valor` (padrão) ou `ordenar=quantidade`; a seleção acontece antes do limite de 20. `/api/v1/produtos/detalhe` recebe filial, início, fim, chave exata do agrupamento e página; limita variações a 30 por página. Não consulta ERP ao abrir detalhes. Fotos mantêm ampliação; dados de estoque exigem permissão específica.

Validação: `npm test`, `npm run test:integration`, `node --env-file=.env scripts/verificar-visao-geral-ui.mjs` e, após publicação, `node --env-file=.env scripts/verificar-visao-geral-producao.mjs`. Este último registra `docs/validacao-ranking-produtos-producao.json`.

## Recarga e limpeza da apresentação de estoque — 16/09/2026

`node scripts/sincronizar-estoques.mjs --completa` solicita carga com cursor zero em todas as filiais, mantendo o maior cursor persistido. Executar somente com backup e worker contínuo pausado; o lock global protege contra duas sincronizações. Qualquer filial com erro deixa saída não zero e mantém a posição anterior daquela filial. Os hashes comerciais/checkpoints são conferidos antes/depois.

Catálogo e resumos atuais apresentam somente `presente_ultima_carga=true`; ausentes na carga completa ficam fora da apresentação e do enriquecimento cadastral, mantendo histórico/auditoria. Saldo nulo de um SKU retornado continua desconhecido, sem ser convertido em zero.

A rota customizada ajustada por Maylon precisa cumprir [o contrato da nova origem](../apis/estoque-custom.md) antes da troca definitiva. Não apontar o worker para uma resposta sem identificação dos produtos ou sem suporte ao cursor. As correções de interface e leitura do catálogo podem ser publicadas independentemente dessa troca.

## Fotos dos funcionários e filtro de estoque — 19/09/2026

Construir API/worker com o novo lockfile (Sharp), fazer backup com os serviços pausados e aplicar migrations tenant 013/014. Fotos são bytea no banco existente; não requerem novo volume. Atualizar somente o virtual host do piloto com `deploy/nginx.conf`, validar `nginx -t` e recarregar: uploads precisam de limite 3 MB para o JSON/base64, restrito à rota de funcionários, com limite real de imagem 2 MB na API.

O worker passa a armazenar `tipo_prod` do retorno padrão sem enviá-lo como parâmetro. A migration solicita uma carga completa; uma falha conserva a posição anterior. Conferir cobertura de `estoque_atual.tipo_prod` antes de declarar completa a filtragem AC. Nunca inferir tipo a partir do nome/SKU. Fotos são administrativas; leitura autenticada por filial e escopo próprio. Validar `scripts/verificar-fotos-funcionarios-ui.mjs` e `scripts/verificar-produtos-ui.mjs`.

## Carga completa com primeira filial definida — 19/09/2026

`node scripts/sincronizar-estoques.mjs --completa --primeira=AERO-023` faz a releitura de **estoque por SKU** nas filiais autorizadas, começando pelo código exato informado no cadastro local. A ordem das demais filiais é preservada; não altera `config/piloto.json` nem a ordem das vendas. Código inexistente, ambíguo ou fora do escopo interrompe antes das escritas.

Executar no servidor com backup e worker contínuo pausado, garantindo sua retomada ao terminar, inclusive em falhas. Para tarefas independentes da sessão SSH, usar uma unidade transitória do systemd com log privado e rotina de retomada. A API permanece disponível. O processo adquire o mesmo lock do worker e confere hashes de operações, itens e checkpoints comerciais.

Cada filial recebe `trans_id=0`, preservando o maior cursor salvo. Falhas mantêm a posição anterior e invalidam a marca de carga completa para que o worker repita a carga integral após o backoff. Sucessos voltam ao incremental; o relatório registra ordem, resultado por filial e cobertura de `tipo_prod`. Uma recarga sem esse campo não resolve a classificação AC. O enriquecimento cadastral permanece gradual, até cinco produtos por rodada.

## Reprocessamento administrativo de vendas — 19/09/2026

Construir API e worker; pausar ambos brevemente para backup coordenado e aplicar a migration aditiva `tenant/015_reprocessar_vendas.sql` antes de publicar a API. Retomar API saudável e worker remoto. A fila de recargas de estoque permanece persistida. Não há alteração de Nginx, dependências ou credenciais da API.

`POST /api/v1/operacoes/:filial/S/:codigo/reprocessar`, exclusivo Admin, recebe `requisicao` UUID. Retorna 202 e enfileira no banco do tenant. GET na mesma rota consulta o último resultado. Worker processa um pedido por rodada antes das outras rotinas, usando a consulta de vendas existente. A API continua sem acesso direto ao ERP. Logs `venda_reprocessada`/`reprocessamento_falhou` contêm apenas identificador, estado e código seguro.

Snapshots anterior/posterior ficam no banco, com backups/retenção existentes. Migration compatível com retorno às imagens anteriores; nesse retorno, pedidos pendentes ficam aguardando o worker atualizado. Manter imagens anteriores identificadas até validar saúde e leitura pública. Uso: [Reprocessar vendas](../docs/REPROCESSAR_VENDAS.md).

### Tolerância de dois centavos

Migration tenant 016 aplica a tolerância autorizada a operações antes classificadas como divergência de valor, verificando quantidade/soma dos itens e excluindo cancelamentos. Atualiza somente `conciliacao`; não altera valores, marcações anteriores, itens ou checkpoints. Construir API/worker e fazer backup com ambos pausados antes da migration, para impedir reclassificação concorrente com a regra antiga. Novas importações e reprocessamentos usam BigInt com limite inclusivo de ±2 centavos.

## Dashboard consolidado e metas mensais — 20/09/2026

Publicação somente da API/interface. Construir API, pausar brevemente API/worker para backup coordenado, aplicar migrations aditivas `control/007_consolidado_metas.sql` e `tenant/017_metas_filiais.sql`, subir API saudável e retomar o worker remoto existente. Nenhuma reimportação nem alteração de Nginx; worker local permanece desativado.

`GET /api/v1/consolidado?inicio=AAAA-MM-DD&fim=AAAA-MM-DD` agrega somente o escopo autorizado em snapshot consistente. `GET /api/v1/metas?competencia=AAAA-MM` compara o mês inteiro. `PUT /api/v1/metas/:filial/:AAAA-MM` recebe `valor` decimal textual ou null para remoção, `versao` e `requisicao` UUID. Atualização atômica com versão, lock por filial/mês, auditoria e nova autorização após espera. Valores monetários usam centavos exatos; leituras não consultam ERP.

Somente Admin/Diretoria/Supervisão, com recursos específicos. Diretoria/Supervisão usam vínculos explícitos, mesmo se outros recursos tiverem todas_filiais. Admin pode desabilitar os recursos desses cargos. Metas e auditoria estão no banco tenant e nos backups. Não carregar nomes ambíguos; script de cadastro inicial deve conferir código, nome, competência e versão, sem sobrescrever meta divergente existente.

Validar `scripts/verificar-consolidado-ui.mjs` em schemas isolados e `scripts/verificar-consolidado-producao.mjs` em leitura pública. As imagens antigas permanecem compatíveis com as tabelas aditivas. Uso e limites: [Visão das filiais e metas](../docs/CONSOLIDADO_METAS.md).


## Exportação diária CSV pela Talk — 31/10/2026

`aeropostale-relatorios.timer` envia diariamente às **08h America/Sao_Paulo** os relatórios do primeiro dia do mês anterior até ontem. `relatorios-csv` é serviço isolado, definido no segundo Compose `deploy/relatorios.compose.yaml`; usa a imagem existente da API com montagens somente dos módulos/scripts/configuração necessários e saída privada. Sem portas públicas, migrations, reinício de API/worker ou ativação do worker local.

Credenciais e destino único em `.env.relatorios` privado (600), sem alterar `.env`. Saída `artifacts/exportacoes-csv/` pertence a UID/GID 1000, modo 700. `flock` serializa execuções; o lote diário tem caminho determinístico e mantém recibos por arquivo. Reexecuções pulam aceitos; em resultado incerto, conferir no Talk antes de qualquer repetição manual.

```sh
systemctl list-timers aeropostale-relatorios.timer
systemctl show aeropostale-relatorios.service -p Result -p ExecMainStatus
journalctl -u aeropostale-relatorios.service -n 20 --no-pager
```

O serviço gera e envia; iniciá-lo manualmente pode enviar um lote ainda não entregue. Antes da primeira implantação foi feito backup `backup-20261031T213658Z-zzmj4o`. Primeiro envio aceito e reexecução sem novos envios verificados; layout final gerado e validado no servidor. Saúde pública e API/PostgreSQL/worker preservados. Próxima execução conferida em 01/11 às 08h de São Paulo.

Para interromper a recorrência, parar/desabilitar **somente** `aeropostale-relatorios.timer`. Não remover recibos para forçar reenvio. Para retornar o código, parar o timer e restaurar somente os arquivos da rotina a partir da cópia privada `artifacts/relatorios-antes-layout-*`; nenhuma restauração de banco é necessária. Novo evento ERP sem descrição confirmada exige atualizar `config/exportacao-csv.json`. AERO-MKTP é excluída somente dos CSVs. Manual: [Exportações CSV](../docs/EXPORTACAO_CSV.md).


## Cortesia zero e campos de frete/cortesia — 31/10/2026

Construir API e worker atualizados, guardar as imagens anteriores, pausar ambos para backup coordenado e publicar. Não requer migrations, Nginx, dependências ou reinício do banco. Campos aditivos em `operacoes.complementos`: `frete_centavos` e `cortesia_informada`. Registros antigos são preenchidos pelos lotes/cooldown existentes de complementos; pagamentos e campos comerciais já importados não são substituídos nessa carga. Cabeçalho divergente bloqueia o preenchimento legado para revisão.

Cortesia zero permite a conferência normal com tolerância de dois centavos; outras composições permanecem na R22. Validar com `npm test`, `npm run test:integration` e `node --env-file=.env scripts/verificar-cortesia-ui.mjs`. Verificação pública dirigida: configurar `CORTESIA_FILIAL`, `CORTESIA_OPERACAO` e, opcionalmente, `CORTESIA_SNAPSHOT` privado, então executar `scripts/verificar-cortesia-producao.mjs`. Esse script **pode solicitar reprocessamento da venda configurada** caso ainda esteja pendente; usar somente para operação autorizada.

Publicação validada com backup `backup-20261031T220134Z-4D11RO`; hashes comerciais/itens/cancelamentos/checkpoints preservados. Capturas e snapshot ficam fora do Git. Worker local segue desativado e rotina diária Talk preservada. Imagens de retorno identificadas em `artifacts/publicacao-cortesia-*/imagens-anteriores.json` no servidor; cópias anteriores dos arquivos no mesmo diretório. Retorno compatível com o JSON aditivo, mas a imagem antiga volta a bloquear zero ao importar/reprocessar. [Regras e limites](../docs/FRETE_CORTESIA.md).


## Tipo pelo cadastro e recarga completa — 01/11/2026

O tipo principal vem de CONSULTAPRODUTOS, importado em cadastro_produtos.tipo_prod pela migration tenant 018. A API cruza pelo ID produto e utiliza COALESCE(cadastro.tipo_prod,estoque.tipo_prod) em lista, filtros, totais e contagem de desconhecidos. Não copiar nem inferir tipos a partir de nomes/categorias. O saldo continua na rota saldodeestoque e suas consultas continuam enviando filial/trans_id.

Publicar API e worker novos com backup e ambos pausados; aplicar migrations antes de iniciar. Depois da API saudável, manter o worker contínuo pausado e executar pela imagem do worker `node scripts/reprocessar-estoque.mjs --executar`, montando o diretório privado artifacts/estoque-cadastro com escrita para UID/GID 1000. O script usa o lock global, recarrega as filiais autorizadas, consulta produtos distintos em lotes e confere hashes das vendas/itens/cancelamentos/checkpoints. Retomar o worker remoto inclusive em falha; nunca iniciar o worker local.

Publicação/recarga de 01/11 validada: 15 filiais, 38.558 SKUs AC e 48 sem tipo (36 cadastros ausentes pelo ID). Uma retentativa de estoque foi resolvida. Consulta por código não autoriza trocar ID: em três casos voltou outro produto. Backup backup-20261101T125720Z-scBjC3; imagens e arquivos anteriores em artifacts/publicacao-tipo-cadastro-20261101T125710Z. Relatório privado em artifacts/estoque-cadastro/20261101T125710Z/resultado.json. API/worker e timer Talk preservados, sem Nginx ou alterações de regras financeiras.

Validação pública somente leitura: `node --env-file=.env scripts/verificar-tipo-cadastro-producao.mjs`; relatórios e capturas comerciais ficam nos artifacts privados. Para retorno, parar worker, restaurar imagens anteriores e retomar API/worker; a coluna aditiva é compatível com a versão anterior, que volta a usar somente o tipo do saldo. Não desfazer a recarga apagando histórico. [Regras e cobertura](../docs/TIPO_PRODUTO_CADASTRO.md).


## Nota fiscal nos detalhes — publicada em 11/11/2026

API e worker devem ser atualizados juntos para importar/exibir número da nota, modelo, IDNFE e status original. Campos aditivos em `operacoes.complementos.nota_fiscal`, sem migration. Fazer backup coordenado com API/worker pausados e guardar imagens anteriores antes da publicação. Subir a API saudável e retomar somente o worker remoto; local desativado. Não requer alteração de PostgreSQL, Nginx ou timer Talk.

A rotina existente de complementos preencherá gradualmente operações sem o grupo fiscal, mantendo lotes/cooldown/backoff. Carga exclusivamente fiscal preserva conciliação e todos os dados comerciais, inclusive frete/cortesia/pagamentos existentes. Cabeçalho/itens divergentes bloqueiam o preenchimento; status nulo não recebe interpretação. Conferir campos nos detalhes, cobertura `complementos ? 'nota_fiscal'` e saúde dos serviços. Versão anterior é compatível com o JSON aditivo, mas deixa de importar/exibir os novos campos. [Contrato e validação](../docs/NOTA_FISCAL_VENDA.md).

Publicado e validado em **11/11/2026**, backup `backup-20261111T122541Z-Gpm2lu` e imagens de retorno preservadas. Saúde, login, 15 filiais, conteúdo fiscal e computador/celular conferidos. Hashes de vendas, itens, cancelamentos e checkpoints iguais na troca; amostra fiscal preservou também pagamentos, frete/cortesia e conciliação. Worker remoto retomado e local desativado; outros serviços e timer Talk preservados. Evidência: `docs/validacao-nota-fiscal-producao.json`. Retorno em `/opt/aeropostale-varejo/artifacts/publicacao-nota-fiscal-20261111T122424Z`. A verificação pública de leitura é `DEPLOY_VERIFY_IP=191.252.1.241 node --env-file=.env scripts/verificar-nota-fiscal-producao.mjs`. A falha da última execução Talk foi observada antes da implantação e mantida registrada; não iniciar o serviço manualmente para validar esta entrega.

Conferência posterior: **358 de 31.192 operações** com grupo fiscal, 30.834 ainda aguardando. O worker segue ativo sem reinícios; há retentativas por validação de cliente e divergência de itens, além de outros códigos sem diagnóstico nesta entrega. Não forçar preenchimento de operações divergentes.


## Histórico: API externa e webhooks — preparação em 11/11/2026

Implementação 0.1.0 e validação isolada concluídas; serviços externos ainda não publicados. Consulte [operação de integrações](../docs/integracoes/operacao.md) antes de ativar. Migration tenant 019 é aditiva e captura mudanças para a nova projeção. Os serviços adicionais são opt-in via `deploy/integracoes.compose.yaml`, com papéis/URLs próprios, limite de recursos e vhost separado para `api-varejo.aeropostale.joinnetwork.com.br`. Não habilitar sem reserva de capacidade, cópia protegida da chave cifradora, DNS/TLS, egress e consumidor aprovado.

O workflow `.github/workflows/ci.yml` valida pushes/PRs com bancos descartáveis. Não publica o piloto nem possui credenciais de produção. O backup agora omite tokens externos, step-ups, leases, cotas e snapshots; segredos/payloads cifrados são preservados e dependem da chave privada de armazenamento, guardada separadamente. Console de um tenant exige concessão explícita e MFA e permanece acessível somente pelo canal operacional privado; não expor `/admin/` no novo vhost.
