# Notificações e resumo diário

## Piloto

Instalação como aplicativo web, preferências por filial e Web Push implementados e publicados em 23/11/2026. [Evidência de publicação](validacao-notificacoes.json). O piloto fica restrito à conta do titular, definida por identificador numa configuração privada. Nenhuma conta adicional é incluída automaticamente. Ativar o recurso no servidor não inscreve aparelhos nem habilita o resumo: cada aparelho precisa de consentimento, e o resumo diário exige salvar as preferências.

Metas atingidas, pendências de conferência e acontecimentos da Lista da Vez permanecem para etapas posteriores. Esta entrega não reativa os relatórios da R30 nem os webhooks da API de integrações.

## Instalar no iPhone e testar

1. No iPhone com iOS 16.4 ou superior, abra https://aeropostale.joinnetwork.com.br no Safari.
2. Toque em **Compartilhar → Adicionar à Tela de Início → Adicionar**.
3. Abra pelo novo ícone e entre com sua conta.
4. No menu, abra **Notificações**. Toque em **Ativar neste aparelho** e permita as notificações no iPhone.
5. Toque em **Enviar teste**. A rotina verifica a fila a cada minuto. Confira o aviso com o painel fechado ou a tela bloqueada e toque nele para abrir o painel.
6. Marque **Receber o resumo diário**, selecione inicialmente Itupeva e toque em **Salvar preferências**. A seleção inicial é uma sugestão; nada é salvo antes dessa ação.

A primeira entrega real no iPhone precisa ser confirmada pelo titular; a inscrição nativa é simulada nos testes automatizados. No navegador, a área **Seus últimos avisos** distingue fila, aceite do serviço, falha, prazo encerrado e resultado incerto. O aceite do serviço não confirma a exibição no aparelho.

Android e computador podem usar navegadores compatíveis, mas não integram o primeiro teste solicitado. No iPhone, abrir somente uma aba do Safari não habilita o Web Push: é necessário entrar pelo aplicativo adicionado à Tela de Início. Não é necessário número de telefone nem conta Apple Developer.

## Resumo do dia

- Um aviso por conta, aparelho, filial e dia comercial. Agenda a partir de **22h05, America/Sao_Paulo**; a rotina roda a cada minuto.
- O resumo inclui quantidade de vendas, peças, valor de vendas, peças por venda (PA) e ticket médio. PA é peças ÷ vendas; ticket é valor ÷ vendas. Zero vendas resulta em PA/ticket indisponíveis, sem divisão por zero. Os cálculos monetários usam centavos inteiros.
- Usa vendas `S` não canceladas, quantidade e valor do cabeçalho, conforme o painel. Entradas não são subtraídas como devoluções. Pendências de conferência continuam incluídas segundo as regras existentes; não há homologação implícita de bruto/líquido ou cobertura histórica.
- Entre 22h05 e 22h29, aguarda vendas e cancelamentos com checkpoint cobrindo o dia, sem erro, com sucesso após 22h e há no máximo vinte minutos. Esses sinais indicam atualização recente, não comprovam o fechamento definitivo da loja ou a integridade de toda a coleta.
- A partir de 22h30, se esses sinais não forem atendidos, envia uma única versão **Resumo parcial**, identificando a atualização pendente. Não envia outra versão quando a coleta terminar. A geração encerra às 23h55 e o envio expira no fim do dia; não há disparo retroativo na manhã seguinte.
- Valores aparecem no próprio aviso, conforme solicitado. Não inclui clientes, contatos ou vendedores. A exibição e eventual corte de texto são controlados pelo iPhone; o aviso abre a Visão geral na filial e no dia, exigindo login quando necessário.

Exemplo exclusivamente sintético:

```text
Resumo do dia · Loja exemplo
23/11/2026 · 10 vendas · 30 peças
Vendas: R$ 3.000,00
PA: 3,00 · Ticket médio: R$ 300,00
```

## Preferências e aparelhos

A conta precisa estar ativa, na allowlist do piloto, ter `indicadores:ler` e poder consultar a filial completa. Perfis limitados às próprias vendas não recebem o total de uma filial. A geração e cada tentativa verificam novamente os vínculos e as permissões atuais; o histórico também filtra as filiais ainda permitidas.

O cadastro é pessoal e aceita até três aparelhos, sem transferir uma inscrição entre contas. **Desativar neste aparelho**, a lista **Aparelhos autorizados** e o logout interrompem novos envios para o dispositivo correspondente e cancelam sua fila pendente. Sair de uma sessão não desativa os demais aparelhos. A expiração natural de uma sessão de oito horas não é um logout: os avisos podem chegar com o aplicativo fechado, mas o acesso ao painel continuará exigindo login. Mensagens já aceitas pelo serviço de push não podem ser recolhidas pelo servidor.

A permissão do iOS é dada no próprio aparelho. Bloqueio, Modo Foco, conexão e preferências de exibição podem silenciar ou atrasar avisos. Reative a permissão nos ajustes quando estiver negada. Uma rotação de chave VAPID exige reconectar os aparelhos.

## Implementação e operação

- Assets públicos fixos: `/manifest.webmanifest`, `/sw.js`, ícones PNG e módulo/CSS de notificações. Service worker apenas recebe/exibe push e abre o painel; não intercepta consultas nem guarda tokens, vendas ou dados pessoais em cache offline.
- API do painel: `GET /api/v1/notificacoes`, `PUT /preferencias`, `POST /dispositivos`, `DELETE /dispositivos/{id}`, `POST /teste` e `GET /historico`, sob `/api/v1/notificacoes`. Todas exigem a sessão do painel; não são endpoints da API de terceiros.
- Configuração privada `.env.notificacoes`: VAPID pública/privada, cofre AES-256-GCM próprio, IDs do piloto e LOGIN exclusivo do worker. A API recebe a chave pública e a chave do cofre; a chave VAPID privada fica somente no worker. Nunca registrar endpoints, inscrições, URLs de banco, chaves ou conteúdo comercial em logs.
- Migration central aditiva `008_notificacoes_push.sql`: preferências, inscrições cifradas e outbox cifrada. Não altera vendas, itens, filas de atendimento, integrações, concessões ou autenticadores existentes. Histórico e inscrições inativas retidos por trinta dias.
- Worker separado, com leitura dos indicadores e das permissões e escrita somente na outbox/inscrições. Não lê hashes de senha, não escreve em usuários ou registros comerciais. O wrapper inclui `deploy/notificacoes.compose.yaml` apenas quando o arquivo privado existe; worker local continua desativado.
- Transporte usa `web-push` para VAPID/criptografia e socket HTTPS com certificado/SNI, DNS público fixado e sem redirecionamentos. Destinos limitados a `*.push.apple.com`, `push.apple.com`, `fcm.googleapis.com` e `updates.push.services.mozilla.com`. Não ampliar o egress dos serviços de integrações.
- Lock de worker por tenant e chave única por resumo/aparelho/dia. Teste pessoal tem chave de idempotência e intervalo de um minuto. Respostas 404/410 desativam a inscrição; 429/5xx conhecidos admitem até três tentativas, respeitando Retry-After. TTL limitado a trinta minutos e ao prazo da entrega; avisos substituídos usam o mesmo tag/topic.
- Intenção de envio é persistida antes da rede. Timeout após iniciar a requisição ou processo interrompido fica **incerto**, sem reenvio automático. Isso evita repetir cegamente um aviso que o serviço pode ter aceitado, mas não garante entrega exatamente uma vez de ponta a ponta.

Consultar `deploy/README.md` para implantação, backup e retorno. Guardar as chaves privadas com os backups; não regenerar o cofre em uma atualização comum.

## Validação

Testes verificam horários/data de São Paulo, cálculo monetário/PA, cancelamentos, atraso/versão parcial, opt-in, isolamento de conta/filial, logout, idempotência, concorrência, inscrição expirada, espera do serviço, resultado incerto e permissões do LOGIN restrito. Transporte real é cifrado/decifrado com chaves sintéticas e socket simulado, sem envio externo. Interface confere manifesto/service worker real com push sintético, instalação orientada, autorização simulada, preferências, teste, logout e abertura do resumo em computador/celular.

Esses testes não substituem o recebimento no iPhone nem um teste de carga de todos os usuários. Metas, conferência e Lista da Vez terão validação própria quando implementados.

Referências: [Apple — Web Push](https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers), [WebKit — Web Push no iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push](https://github.com/web-push-libs/web-push).
