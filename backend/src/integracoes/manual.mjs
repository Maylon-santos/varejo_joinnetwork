// Conteúdo interno: entregue exclusivamente pelo endpoint administrativo após MFA.
export const manualIntegracoes={
 titulo:'Manual de integrações por API e webhook',
 descricao:'Procedimento para cadastrar uma credencial de sistema, conceder acesso aos dados e preparar o recebimento de notificações.',
 secoes:[
  {id:'identidades',titulo:'1. Entenda os dois tipos de acesso',paragrafos:[
   'O operador administrativo é uma pessoa autorizada a gerenciar integrações. Seu acesso utiliza login, senha e código do autenticador. A habilitação como operador é realizada previamente pela equipe responsável pelo ambiente.',
   'A integração é a identidade do sistema consumidor. Ela recebe um client_id e utiliza uma chave privada para obter tokens OAuth. Para cadastrar esse acesso, use a aba Integrações deste console. Não é necessário criar um usuário do painel para cada sistema.',
   'API e webhook podem pertencer à mesma integração. A API atende consultas feitas pelo consumidor; o webhook envia notificações para um destino HTTPS verificado.'
  ],nota:'O console atual administra a organização configurada no ambiente. As filiais concedidas a cada integração devem ser selecionadas explicitamente.'},
  {id:'preparacao',titulo:'2. Reúna as informações necessárias',passos:[
   'Defina o sistema consumidor, a finalidade do acesso e quem ficará responsável por sua operação.',
   'Identifique o ambiente de execução, os recursos necessários e as filiais que o sistema poderá consultar.',
   'Solicite ao integrador uma chave pública RSA em formato PEM PUBLIC KEY, um identificador kid e a validade pretendida. São aceitas chaves de 2048 a 8192 bits.',
   'Se houver webhook, confirme a URL HTTPS de recebimento, seu hostname e os tipos de evento desejados. A equipe responsável pelo ambiente deve preparar a conectividade de saída antes do teste.',
   'Entre no console com um operador habilitado e valide o MFA. A confirmação forte dura até cinco minutos; informe um novo código quando solicitado.'
  ],nota:'A chave privada fica exclusivamente com o integrador. Nunca a cole no console nem a envie junto com a chave pública.'},
  {id:'cadastro',titulo:'3. Cadastre a integração',passos:[
   'Abra Integrações e clique em Novo cadastro. Preencha o formulário Cadastrar integração.',
   'Informe um nome que identifique o sistema e descreva sua finalidade. Selecione Homologação ou Produção conforme o serviço que será acessado. O ambiente não poderá ser alterado após o cadastro.',
   'Durante a preparação, selecione Suspenso. Escolha os escopos e as filiais estritamente necessários.',
   'Para webhook, preencha Hostnames autorizados com um domínio por linha, sem https://, caminho ou porta. Exemplo: integrador.example.com. São permitidos até três hostnames.',
   'Registre o Motivo da concessão ou alteração e clique em Salvar concessão.',
   'Localize a integração na tabela e clique em Editar / chaves. O client_id é exibido na tabela e na mensagem de edição. Guarde esse identificador para a configuração do consumidor.'
  ],campos:[
   {campo:'Ativo',orientacao:'Permite autenticação quando existir uma chave válida e os demais requisitos forem atendidos.'},
   {campo:'Suspenso',orientacao:'Interrompe o acesso sem encerrar definitivamente o cadastro. Pode ser utilizado durante a preparação.'},
   {campo:'Revogado',orientacao:'Encerra o acesso de forma definitiva. Uma integração revogada não pode ser reativada; será necessário um novo cadastro.'}
  ],nota:'Credenciais de homologação não autenticam o serviço de produção. Para utilizar os dois ambientes, mantenha cadastros e pares de chaves separados.'},
  {id:'escopos',titulo:'4. Selecione escopos e filiais',paragrafos:[
   'Os escopos definem o que o consumidor pode fazer. A seleção de filiais define sobre quais registros ele pode atuar. Solicitar um escopo no token não amplia a concessão cadastrada.'
  ],campos:[
   {campo:'filiais:ler',orientacao:'Consultar os cadastros das filiais concedidas.'},
   {campo:'vendas:ler',orientacao:'Consultar vendas, itens, pagamentos e informações fiscais.'},
   {campo:'vendas:pessoas:ler',orientacao:'Consultar dados pessoais vinculados à venda. Exige vendas:ler e o parâmetro incluir_pessoas=true; conceda somente quando necessário.'},
   {campo:'produtos:ler',orientacao:'Consultar produtos e variações vinculados às filiais concedidas.'},
   {campo:'estoques:ler',orientacao:'Consultar posições de estoque por filial e SKU.'},
   {campo:'webhooks:ler',orientacao:'Consultar inscrições e entregas da própria integração. Exige também vendas:ler.'},
   {campo:'webhooks:gerenciar',orientacao:'Criar, testar, alterar e reenviar webhooks da própria integração. Exige também vendas:ler.'}
  ],nota:'Para o fluxo completo de webhook, conceda vendas:ler, webhooks:ler e webhooks:gerenciar. Para uma integração somente de consulta, selecione apenas os recursos de leitura necessários.'},
  {id:'chave',titulo:'5. Registre a chave pública',passos:[
   'Na tabela de integrações, clique em Editar / chaves no cadastro desejado.',
   'No formulário Chave pública da integração, informe um kid exclusivo. Utilize letras, números, hífen ou sublinhado, com até 100 caracteres.',
   'Defina uma validade futura, limitada a 366 dias a partir do cadastro. O horário do formulário segue o fuso do navegador.',
   'Selecione Ativa, cole somente o PEM PUBLIC KEY e informe o motivo do registro.',
   'Clique em Salvar chave. Depois, reabra Editar / chaves para conferir o kid e seu estado.',
   'Quando o consumidor estiver pronto para testar, altere a integração de Suspenso para Ativo e salve a concessão com o motivo correspondente.'
  ],nota:'Não substitua a chave de um kid existente por outra. Na rotação, utilize um novo kid. Uma chave revogada não pode voltar ao estado ativo.'},
  {id:'api',titulo:'6. Configure e valide o acesso à API',passos:[
   'Forneça ao integrador o client_id, o kid registrado, o ambiente, as filiais concedidas, os escopos e o endereço da documentação pública.',
   'O consumidor gera uma prova private_key_jwt com sua chave privada: assinatura RS256, iss e sub iguais ao client_id, aud igual ao endereço exato de /oauth/token, iat atual, exp de até 60 segundos e um jti novo em cada tentativa.',
   'Envie a prova a POST /oauth/token com grant_type=client_credentials e client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer. O token retornado é opaco e vale por 900 segundos.',
   'Valide uma consulta autorizada usando Authorization: Bearer. Confirme também que filiais e recursos não concedidos são recusados.',
   'Abra Acessos da API para conferir a integração, a rota, o status e a duração. Use Desempenho para acompanhar as amostras disponíveis.',
   'Oriente o consumidor a respeitar paginação, versões e limites. Para manter uma base local, utilize o fluxo de carga inicial e log incremental descrito na documentação pública.'
  ],codigo:{linguagem:'http',texto:'GET /v1/filiais?limite=100\nHost: api-varejo.aeropostale.joinnetwork.com.br\nAuthorization: Bearer <ACCESS_TOKEN>\nAccept: application/json'},
  links:[{rotulo:'Documentação pública da API',url:'https://api-varejo.aeropostale.joinnetwork.com.br/docs/integracoes/'}],
  nota:'Não forneça a senha do operador administrativo, o código MFA ou credenciais de banco ao consumidor. Esses dados não fazem parte da autenticação da API.'},
  {id:'webhook',titulo:'7. Crie a inscrição de webhook',paragrafos:[
   'A aba Webhooks lista as inscrições e permite testar, ativar e pausar destinos existentes. Nesta versão, a criação da inscrição é feita pela API, com o token da integração.',
   'O destino deve utilizar HTTPS na porta 443, certificado válido e um hostname autorizado no cadastro. Não são aceitos endereços IP literais, redes privadas, credenciais na URL, query string ou fragmento.'
  ],passos:[
   'Confirme que a integração está ativa, possui chave válida, escopos de webhook e as filiais necessárias.',
   'O consumidor envia POST /v1/webhooks com Idempotency-Key no formato UUID, conforme o exemplo. Cada integração pode ter até três inscrições.',
   'Crie a inscrição com ativo=false. Salve o id retornado e configure o signing_secret no armazenamento protegido do destinatário.',
   'O segredo é informado na criação e na rotação, incluindo repetição idempotente por até 24 horas. Ele não é exibido nas consultas GET ou nas listagens.',
   'Configure o destinatário para validar os headers webhook-id, webhook-timestamp e webhook-signature sobre os bytes originais do corpo, usando HMAC-SHA256. Persista e deduplique o evento antes de responder 2xx.'
  ],codigo:{linguagem:'http',texto:'POST /v1/webhooks\nAuthorization: Bearer <ACCESS_TOKEN>\nContent-Type: application/json\nIdempotency-Key: <UUID_NOVO>\n\n{\n  "nome": "Notificações de vendas",\n  "url": "https://integrador.example.com/webhooks/vendas",\n  "eventos": ["venda.importada", "venda.atualizada", "venda.cancelada"],\n  "filiais": ["1001"],\n  "ativo": false\n}'},
  nota:'Os identificadores do exemplo são fictícios. Substitua a filial e o destino pelos valores aprovados. Se uma resposta se perder, repita a mesma operação com a mesma Idempotency-Key e o mesmo corpo.'},
  {id:'ativacao',titulo:'8. Teste e ative o webhook',passos:[
   'Solicite à equipe responsável pelo ambiente a habilitação de entregas e a conectividade de saída para o destino aprovado. Criar uma inscrição ou conceder escopos não habilita o envio de rede.',
   'Abra Webhooks, identifique a inscrição pelo cliente e pelo hostname e clique em Testar. Informe o motivo da ação.',
   'Uma resposta 202 confirma o enfileiramento do teste. Abra Entregas e confira o retorno HTTP. O destinatário deve validar a assinatura, persistir o evento e responder 2xx.',
   'Depois do teste aceito, volte a Webhooks e clique em Ativar. Informe o motivo. A ativação exige que o destino já tenha sido verificado.',
   'Acompanhe a primeira notificação real em Entregas e confirme seu processamento no sistema consumidor. Aceite HTTP não comprova a conclusão do processamento comercial.',
   'Em manutenção ou falha do destinatário, utilize Pausar. Para reenviar uma entrega de venda elegível, localize-a em Entregas, clique em Reenviar e registre o motivo.'
  ],nota:'Reenvios respeitam a retenção de 30 dias, as permissões atuais e o destino verificado. O consumidor precisa tratar duplicatas e eventos fora de ordem. Alterar a URL exige nova verificação.'},
  {id:'manutencao',titulo:'9. Mantenha e encerre acessos',passos:[
   'Revise periodicamente as filiais, os escopos, o estado da integração e a validade das chaves.',
   'Para trocar a chave da API, cadastre um novo kid, valide a autenticação do consumidor com ele e revogue a chave anterior após concluir a transição.',
   'A rotação do segredo de webhook é realizada pela operação POST /v1/webhooks/{webhook_id}/rotacionar-segredo. Ela exige Idempotency-Key e If-Match e possui sobreposição de 24 horas. Essa ação não possui formulário próprio neste console.',
   'Para interromper temporariamente o sistema, selecione Suspenso no cadastro. Para encerrar definitivamente, selecione Revogado. Novos acessos são recusados após a alteração.',
   'Use Auditoria para acompanhar concessões e ações administrativas. Registre o motivo de cada mudança sem inserir tokens, segredos ou dados comerciais.',
   'Finalize o uso com Sair. As credenciais da sessão são mantidas somente na memória da aba.'
  ]},
  {id:'diagnostico',titulo:'10. Resolva as ocorrências mais comuns',campos:[
   {campo:'Operador não habilitado',orientacao:'Solicite a matrícula administrativa e a configuração do autenticador à equipe responsável pelo ambiente. Criar uma integração não habilita um operador humano.'},
   {campo:'MFA solicitado novamente',orientacao:'Informe um código atual ainda não utilizado. A confirmação forte expira em cinco minutos.'},
   {campo:'invalid_client ou HTTP 401',orientacao:'Confira estado da integração, ambiente, client_id, kid, validade da chave, assinatura, audience e relógio do consumidor. Gere uma nova prova JWT em cada tentativa.'},
   {campo:'HTTP 403',orientacao:'Revise escopos e filiais concedidas. Não amplie o acesso sem necessidade e aprovação.'},
   {campo:'HTTP 412',orientacao:'A configuração mudou. Atualize a lista, reabra o cadastro e repita a ação sobre a versão atual.'},
   {campo:'VERIFICATION_REQUIRED',orientacao:'Execute o teste assinado e confirme seu aceite antes de ativar. Uma mudança de URL exige nova verificação.'},
   {campo:'Teste permanece na fila',orientacao:'Confira a habilitação de entregas, o worker e a conectividade de saída com a equipe responsável pelo ambiente. O status 202 não confirma envio.'},
   {campo:'Falha de entrega',orientacao:'Confira disponibilidade do destino, certificado, hostname e validação da assinatura. Registre o identificador da entrega; não compartilhe o segredo.'},
   {campo:'HTTP 429',orientacao:'Reduza a concorrência e respeite Retry-After. Tentativas administrativas e consultas também possuem limites.'}
  ]}
 ]
};
