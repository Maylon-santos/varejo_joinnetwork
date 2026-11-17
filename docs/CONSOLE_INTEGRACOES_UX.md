# Console de integrações

O console administrativo fica em https://aeropostale.joinnetwork.com.br/admin/integracoes/console . A documentação pública para integradores permanece separada.

A visão geral apresenta aplicações, status, ambiente, quantidade de filiais e permissões, chaves válidas e último acesso. A busca aceita nome ou client_id. O filtro inicial mostra aplicações ativas e suspensas; os registros revogados continuam disponíveis no filtro de histórico, sem exclusão de auditoria.

**Nova integração** abre o formulário com três seções: Identificação, Permissões e filiais, e Registro e confirmação. As permissões possuem descrições; as filiais mostram nome/código da projeção autorizada, com identificador como referência. Buscar uma filial não desmarca seleções anteriores. A configuração opcional de domínios para webhooks não ativa envios.

**Editar / chaves** abre o cadastro e sua lista de chaves. O client_id pode ser copiado. **Adicionar chave** abre um formulário separado; a chave privada permanece com o integrador. A confirmação de revogação identifica aplicação e kid, exige motivo e preserva as demais chaves e concessões. A interface adapta o modal e seus botões às telas menores.

A contagem de autenticação usa o prazo de cinco minutos informado pelo servidor. **Renovar autenticação** solicita outro código, mantendo os campos preenchidos somente na memória desta página. A expiração durante uma revogação preserva o motivo para revisão após a nova validação, sem envio automático. Se a versão da concessão mudou, o rascunho é descartado e o cadastro atualizado precisa ser revisado. Recarregar ou sair encerra a memória da página; não há rascunho em localStorage/sessionStorage.

O controle de acesso continua no servidor: operador habilitado, MFA vinculado à sessão, tenant, filiais autorizadas, versão da concessão e auditoria. A revisão não altera autenticação externa, credenciais, permissões concedidas, dados comerciais ou ativação de webhooks.

Validação: fluxos PostgreSQL com dados sintéticos; busca/status/histórico, nomes e busca de filiais, cadastro, chaves, cancelamento, revogação e auditoria; renovação de MFA com rascunho e bloqueio de versão obsoleta; QR/cadastro de autenticador e manual privado; telas de 1440 e 390 px e controles do modal contidos. Evidência: [validação da experiência do console](validacao-console-integracoes-ux.json).
