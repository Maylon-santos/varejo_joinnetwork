# Documento interno de administração

> Acesso restrito à manutenção do projeto. Este arquivo não integra a documentação pública nem é servido pelo portal.

# Console de SuperAdmin e auditoria

> Requisitos de produto de Maylon. Gestão delegada de um tenant com MFA, clientes/chaves, logs/métricas e ações de webhook está implementada. SuperAdmin global, exportação de logs e campos administrativos adicionais continuam evoluções. A tabela de requisitos abaixo inclui essas evoluções; o escopo entregue está em [operação](operacao.md).

## O que o console precisa responder

O SuperAdmin deverá conseguir identificar **qual integração acessou**, **qual recurso/filial consultou**, **quando acessou**, **qual foi o resultado** e **quanto tempo a aplicação levou para responder**. Para webhook, deve identificar o cliente proprietário, o destino autorizado, o evento, cada tentativa e seu resultado.

Webhook é saída da plataforma: o destinatário não está fazendo login no painel a cada POST. A identidade auditada é a inscrição/cliente de integração, o worker emissor e, em teste/replay/alteração manual, o usuário humano que iniciou a ação. Não tentar identificar o consumidor somente por IP.

## Navegação proposta

| Tela | Conteúdo principal | Ações |
| --- | --- | --- |
| Integrações | Cliente, tenant, responsável, ambiente, estado e último uso | Cadastrar, suspender, revogar e revisar concessões |
| Permissões | Escopos, filiais, chaves públicas e validade | Aprovar/reduzir escopos e filiais; rotacionar/revogar chave |
| Webhooks | Destino, eventos, filiais, verificação e circuito | Testar, ativar, pausar, rotacionar segredo e reenviar |
| Acessos da API | Requisição, rota, recurso, status e duração | Filtrar e correlacionar por request_id |
| Entregas | Evento, tentativas, HTTP, espera e latência | Inspecionar metadados e solicitar replay auditado |
| Desempenho | Volume, p50/p95/p99, falhas, 429 e atraso de fila | Comparar integrações e detectar saturação |
| Auditoria administrativa | Quem concedeu, alterou, exportou ou revogou | Consultar histórico imutável de decisões |

Não oferecer editor de SQL, acesso a bancos de outros serviços ou visualização de segredos. Consulta de logs deve ter paginação, filtros indexados e cota própria para não degradar a aplicação.

## Autorização administrativa

O console é uma superfície administrativa separada do OAuth de máquina. Um token externo, mesmo com `webhooks:gerenciar`, nunca pode acessar cadastros de outros clientes ou a auditoria global.

| Capacidade lógica proposta | Quem poderá receber | Restrição |
| --- | --- | --- |
| Administração da plataforma | SuperAdmin humano com autenticação forte | Tenant selecionado explicitamente e ação auditada |
| Gestão delegada de integrações | Administrador de um tenant, se autorizado | Somente seu tenant e filiais que pode conceder |
| Leitura de auditoria | Responsável técnico/segurança autorizado | Sem alteração de concessões ou acesso a segredos |
| Métricas operacionais | Equipe de operação autorizada | Preferir agregados; detalhes de acesso exigem concessão própria |

Exigir MFA para administração humana e nova confirmação forte em concessões, revogação de chave, rotação de segredo e exportação de logs. O console delegado implementa TOTP e step-up de cinco minutos, sem alterar o login comum do painel. Não existe papel global SuperAdmin.

Registrar o ator humano e o tenant alvo em cada ação. A ampliação de acesso não pode ser aprovada apenas pela própria credencial de integração. Evitar ações globais por padrão; acesso excepcional deve ter motivo e trilha específica. Redução/revogação precisa impedir novas chamadas, cursores e entregas que perderam autorização.

## Cadastro da integração

| Campo proposto | Tipo | Uso / visibilidade |
| --- | --- | --- |
| `id` | UUID | Identidade administrativa do cliente |
| `client_id` | string | Identidade pública usada na troca OAuth; não é segredo |
| `nome` | string até 120 | Identificação legível do sistema |
| `tenant_id` | string | Tenant fixado no cadastro; somente administração autorizada |
| `ambiente` | enum | Homologação ou produção; credenciais separadas |
| `responsavel_tecnico` | objeto | Nome/contato operacional com acesso restrito |
| `finalidade` | string | Por que o sistema recebe os dados |
| `estado` | enum | Pendente, ativo, suspenso ou revogado |
| `escopos` | array de strings | Subconjunto aprovado; sem herança de Admin |
| `filiais` | array de IDs | Concessões explícitas, não descoberta automática |
| `chaves_publicas` | array | kid, algoritmo, chave pública, validade e estado; nunca a privada |
| `limites` | objeto | Cotas/concurrency aprovadas, dentro dos tetos operacionais |
| `criado_em` / `alterado_em` | timestamps | Ciclo de vida do cadastro |
| `criado_por` / `alterado_por` | IDs de usuários | Responsabilidade administrativa, com acesso restrito |
| `ultimo_acesso_em` | timestamp ou null | Última chamada autenticada; não última tentativa inválida |
| `ultima_revisao_acesso_em` | timestamp ou null | Revisão periódica das concessões |
| `revogado_em` / `motivo_revogacao` | timestamp/texto ou null | Auditoria de encerramento, sem apagar histórico |

Essa tabela documenta a futura interface de administração, não acrescenta rotas ao OpenAPI público. Os 277 campos do contrato externo não incluem esses campos internos de console.

## Log de consulta à API

| Campo proposto | Tipo | Significado e cuidado |
| --- | --- | --- |
| `id` | UUID | Registro da auditoria |
| `request_id` | UUID | Mesmo identificador devolvido ao integrador |
| `iniciado_em` / `finalizado_em` | timestamps | Início e término do atendimento na aplicação |
| `duracao_ms` | inteiro | Tempo total dentro da aplicação, até finalizar/abortar a resposta |
| `espera_admissao_ms` | inteiro ou null | Tempo na fila de admissão, se instrumentado |
| `banco_ms` | inteiro ou null | Tempo agregado de consultas, se instrumentado; null não é zero |
| `tenant_id` | string | Contexto autorizado; não aceitar tenant arbitrário do cliente |
| `cliente_id` | UUID ou null | Cliente autenticado; null em falha sem identidade confirmada |
| `client_id_informado` | string redigida ou null | Somente se necessário à investigação de falhas; nunca prova de identidade |
| `canal` | enum | API externa, administração ou autenticação |
| `metodo` | string | GET/POST/PUT efetivo |
| `rota_template` | string | Ex.: `/v1/vendas/{venda_id}`, sem URL crua |
| `recurso` | enum ou null | Vendas, filiais, produtos, estoques ou webhook |
| `filial_id` | string ou null | Filial efetivamente autorizada/solicitada, conforme política de auditoria |
| `recurso_id_redigido` | string ou null | Identidade mínima necessária; acesso ao detalhe comercial é separado |
| `filtros_seguros` | objeto | Allowlist de período/estado/limite; não query string integral |
| `http_status` | inteiro | Status da resposta |
| `codigo_erro` | string ou null | Código estável, sem mensagem interna/stack |
| `decisao_autorizacao` | enum | Permitida, negada ou não autenticada |
| `cota_atingida` | enum ou null | Cliente, tenant, IP, instância ou concorrência |
| `bytes_resposta` | inteiro | Tamanho enviado; não corpo da resposta |
| `ip_origem` | string restrita ou redigida | Derivado de proxy confiável; dado de acesso protegido |
| `user_agent_resumido` | string sanitizada | Limite de tamanho, remoção de caracteres de controle e escape no console |
| `kid_autenticacao` | string ou null | Identificador público da chave, se apropriado; sem JWT/token |

`duracao_ms` não mede o processamento final do integrador nem toda a latência da internet. Usar relógio monotônico para duração e timestamp UTC para correlação. Registrar requisições abortadas como abortadas, sem inventar status 200 ou duração zero. Tempos de banco/fila só aparecem quando houver instrumentação real.

Não guardar Authorization, access token, client_assertion, segredo HMAC, corpos de vendas ou filtros de busca pessoal em log operacional. Se for necessário inspecionar um recurso comercial, abrir uma consulta autorizada separada e auditada; não copiá-lo integralmente para a trilha de requisições.

## Log de tentativas de webhook

| Campo proposto | Tipo | Significado |
| --- | --- | --- |
| `tentativa_id` | UUID | Tentativa individual, diferente do ID imutável do evento |
| `entrega_id` / `evento_id` | UUIDs | Correlação do ciclo e do evento |
| `webhook_id` / `cliente_id` / `tenant_id` | IDs | Propriedade e isolamento |
| `tipo_evento` / `recurso_versao` | string / inteiro textual | O que estava sendo notificado |
| `filial_id` | string | Concessão revalidada antes de enviar |
| `destino_hostname` | string | Hostname aprovado; não expor segredo ou headers |
| `iniciado_em` / `finalizado_em` | timestamps | Ciclo da chamada de saída |
| `duracao_http_ms` | inteiro ou null | Tempo da tentativa até resposta/falha de transporte |
| `atraso_fila_ms` | inteiro | Espera entre disponibilidade e tentativa |
| `http_status` | inteiro ou null | Null quando não houve resposta HTTP |
| `codigo_falha` | string ou null | Timeout, transporte, assinatura/HTTP ou configuração, sem body do destino |
| `numero_tentativa` | inteiro | Posição no orçamento de até dez tentativas |
| `proxima_tentativa_em` | timestamp ou null | Próxima programação |
| `estado_circuito` | enum | Fechado, aberto ou em teste |
| `acao_origem` / `ator_usuario_id` | enum / ID ou null | Automática, teste ou replay e responsável quando humano |

Eventos/payloads ficam em armazenamento próprio cifrado, com autorização e retenção de 30 dias. Os logs de tentativa não precisam repetir o payload. Uma resposta 2xx aparece como aceita, sem o rótulo de “venda processada pelo integrador”.

## Painel de desempenho

Exibir volume por integração/rota, taxa de 2xx/4xx/5xx, 401/403, chamadas bloqueadas por cota, p50/p95/p99 de duração, tamanho de resposta e tendência por janela. Para webhook, incluir aceita/falha/retry, atraso de fila, idade do evento mais antigo e destinos com circuito aberto.

Separar latência de atendimento HTTP do atraso da coleta ERP. Uma API que respondeu em 40 ms pode ter retornado uma posição coletada há uma hora. Mostrar ambos, sem sugerir atualização em tempo real.

Os valores agregados devem informar janela, quantidade de amostras e momento de atualização. Ausência de amostras é “sem dados”, não latência zero. Evitar IDs de cliente/recurso como labels ilimitados em métricas; detalhamento por identidade deve ficar na consulta indexada de auditoria.

## Busca, exportação e retenção

Filtros iniciais: tenant explícito, integração, canal, recurso, rota, filial, status, request_id/evento e período. Proposta: padrão de última hora, janela máxima de 31 dias por consulta, páginas de até 200 registros e índices compatíveis. Exportação de logs exige permissão específica, motivo e auditoria; grandes exportações devem ser assíncronas e redigidas.

Proposta de retenção: metadados de acesso/alteração por 90 dias; payload de evento e replay por 30 dias. O responsável pelo produto deve aprovar prazo e acesso antes da implementação. Retenção não autoriza armazenar segredos ou coletar mais dados pessoais que o necessário.

O console não deve permitir editar/apagar registros isolados de auditoria. Expurgo por política é um processo controlado e auditado. Falha da trilha em operações sensíveis de concessão/revogação não pode concluir a mudança silenciosamente sem registro.

## Critérios de aceite do console

1. Uma chamada autenticada aparece com o cliente correto, a rota parametrizada, filial, status e tempo medido.
2. Tentativa inválida não é atribuída a um cliente apenas porque ele foi informado no formulário.
3. Um teste/replay de webhook mostra o usuário que o solicitou, o evento e cada tentativa, sem exibir assinatura/segredo.
4. Usuário de um tenant não lista clientes/logs de outro; o token externo não acessa nenhuma tela global.
5. Revogação é registrada e bloqueia novas consultas/entregas autorizadas anteriormente.
6. Tokens, contatos de clientes, payloads comerciais e resposta do destinatário não aparecem nos logs operacionais. Identificadores de atores/IP têm acesso restrito; textos controlados são escapados, nunca interpretados como HTML.
7. p95/p99, duração e atraso usam medições reais; falta de instrumentação é null/sem dados.
8. Consultar auditoria ou gerar relatório não degrada o coletor e o painel comercial.
