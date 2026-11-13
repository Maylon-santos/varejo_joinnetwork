# Join Network · API para desenvolvedores

> Versão 0.1.0 • infraestrutura publicada em 13/11/2026 • aguardando definição do primeiro consumidor.

**Situação em 13/11/2026:** API externa, OAuth e worker de projeções ativos na HostGator, com migration 019, HTTPS e documentação pública. Consultas e controles de acesso foram verificados com uma credencial temporária revogada ao concluir. Maylon optou por deixar a infraestrutura pronta para o futuro: **nenhum consumidor real está habilitado, entregas de webhooks e console administrativo estão desativados**. Código, OpenAPI e exemplos permanecem no GitHub. Consulte a [operação atual do piloto](../../deploy/README.md) e o [provisionamento futuro](operacao.md#publicação-controlada).

Integre vendas, filiais, produtos e estoque com consultas autenticadas e notificações de vendas. Este material documenta a implementação da API externa e orienta o cadastro e a homologação de consumidores. Os exemplos são inteiramente fictícios.

**Endereço publicado:** `https://api-varejo.aeropostale.joinnetwork.com.br`. [Abrir documentação online](https://api-varejo.aeropostale.joinnetwork.com.br/docs/integracoes/). As rotas exigem credenciais próprias de integração; login do painel não concede acesso à API externa.

[Operação da implementação](operacao.md): serviços, console com MFA, configuração, GitHub/CI, ativação e limites conhecidos. O deploy continua via SSH; o push no GitHub executa validação automática, sem publicar a aplicação.

## Escolha como integrar

| Modelo | Quem inicia | Quando usar | Como recuperar perdas |
| --- | --- | --- | --- |
| Consulta REST | Seu sistema faz GET na plataforma | Carga inicial, consulta pontual, conciliação e busca de detalhes | Cursor persistido e log de alterações |
| Webhook de vendas | A plataforma faz POST no seu destino | Avisar sobre importação, atualização ou cancelamento de uma venda | Retentativas, reenvio e consulta do log |
| Híbrido | Ambos | Receber notificações e buscar o estado atual pela API | Deduplicação por evento e aplicação por revisão |

Neste guia, **passiva** significa que a plataforma responde às suas consultas; **ativa** significa que a plataforma inicia a entrega do webhook. Esses termos dependem do ponto de vista e não alteram as garantias do protocolo.

## Roteiro de leitura

1. [Autenticação e segurança](autenticacao.md): onboarding, chaves, tokens, escopos, filiais e limites.
2. [Consultas REST](consultas.md): endpoints, filtros, exemplos e interpretação dos dados.
3. [Sincronização](sincronizacao.md): carga inicial, páginas estáveis, revisões e recuperação.
4. [Webhooks](webhooks.md): cadastro, assinatura, filas, retentativas e processamento seguro.
5. [Console de SuperAdmin e auditoria](administracao.md): controle de integrações, quem acessou o quê e tempos de resposta.
6. [Dicionário de campos](dicionario.md): tipos, presença, origem e restrições dos objetos.
7. [Plano de implementação](implementacao.md): o que já existe, o que falta e critérios de aceite.

Abra também o [portal visual](index.html), o [contrato OpenAPI 3.1](../../apis/integracoes.openapi.json) e os [exemplos JSON](exemplos/manifesto.json). O contrato pode ser importado em ferramentas que suportem OpenAPI 3.1; a autenticação por prova JWT pode exigir configuração adicional da ferramenta.

## O que está implementado e o que depende de ativação

| Capacidade | Situação em 13/11/2026 |
| --- | --- |
| Dados de vendas, itens, pagamentos, nota fiscal, filiais e catálogo no banco local | Implementados, com cobertura parcial e ressalvas descritas neste guia |
| API interna `/api/v1` do painel e autorização por usuário/filial | Implementadas para o painel |
| Autenticação da API interna | Login de usuário, sessão Bearer opaca de oito horas; não é Client Credentials |
| API externa `/v1` neste domínio | Publicada com HTTPS; acesso depende de consumidor provisionado |
| OAuth de integrações, cadastro de clientes e escopos externos | Implementados; nenhum cliente real provisionado |
| Revisões externas, cursores estáveis e log incremental | Implementados com projeções, snapshots cifrados e captura transacional |
| Webhooks, outbox, assinaturas e painel de entregas | Implementados; entregas e console desativados, sem inscrições ou disparos reais |
| Limites quantitativos deste guia | Aplicados; dimensionamento e carga do primeiro consumidor continuam pendentes |

Não compartilhe login Admin, token do painel ou credenciais do ERP com um integrador. A documentação externa descreve uma camada própria de acesso, sem conceder permissões administrativas do painel.

## Primeira integração, do cadastro à primeira consulta

1. Informe sistema responsável, contato técnico, ambiente, finalidade, recursos e filiais necessários.
2. Gere um par RSA de pelo menos 2048 bits no seu ambiente. Cadastre somente a chave pública e seu `kid` por canal administrativo autenticado. Guarde a privada em cofre de segredos.
3. Receba um `client_id` vinculado a um único tenant, escopos e filiais explícitos. Uma credencial de homologação não valerá em produção.
4. Gere uma prova JWT de até 60 segundos e troque por um token opaco de 900 segundos.
5. Consulte `/v1/filiais` e confirme os vínculos concedidos.
6. Salve um checkpoint do log antes da carga inicial. Importe as janelas e depois consuma as alterações desde o checkpoint.
7. Se precisar de notificações, cadastre um destino de webhook, valide o teste assinado e então ative-o.

Exemplos de autenticação e polling: [prova JWT em Python](exemplos/gerar_assertion.py), [primeiras consultas em cURL](exemplos/consultas.sh) e [polling incremental em Node.js](exemplos/consumir-alteracoes.mjs). Eles são referências de implementação, não SDKs oficiais; a liberação de um cliente real depende da homologação.

## Convenções que evitam erros de integração

| Assunto | Regra do contrato |
| --- | --- |
| Transporte | HTTPS, JSON UTF-8 e autenticação Bearer nos recursos |
| Identificadores | Strings. Não converter código de barras, IDNFE, IDs ou cursores em Number |
| Valores monetários | Strings de inteiros em centavos de BRL: `"18000"` = R$ 180,00 |
| Saldo | String decimal exata, até seis casas; pode ser negativo ou null |
| Datas de operação | `YYYY-MM-DD`, dia civil de São Paulo |
| Timestamps | RFC 3339, preferencialmente UTC com `Z`; não confundir com hora da venda |
| Null | Informação desconhecida/não informada, conforme o campo; não é zero |
| Campo omitido | Pode indicar restrição de permissão; campos pessoais exigem escopo e opt-in |
| Array vazio | Coleção conhecida sem registros; não é o mesmo que importação pendente |
| Revisões | Strings inteiras monotônicas; comparar com BigInt ou inteiro de precisão arbitrária |
| Campos novos | Consumidores devem ignorar propriedades desconhecidas nas respostas |

## Escopo funcional da primeira versão

A primeira versão permite ler dados comerciais já importados. Não cria/edita vendas, reserva estoque, baixa pagamentos ou modifica o ERP. A administração de webhooks afeta somente as inscrições da própria integração.

Vendas por hora, valores bruto/líquido homologados, devoluções classificadas automaticamente, saldo histórico por período, preço atual do catálogo, CNPJ/endereço completo das filiais e liquidação dos pagamentos não têm contrato confirmado na base atual. O [plano de implementação](implementacao.md) registra essas lacunas sem inventar campos ou regras.

## Downloads e exemplos

| Artefato | Uso |
| --- | --- |
| [OpenAPI](../../apis/integracoes.openapi.json) | Contrato de rotas, segurança e schemas implementados |
| [Venda detalhada](exemplos/venda.json) | Cabeçalho, nota fiscal, condições e cobertura |
| [Itens](exemplos/itens.json) | Preços, quantidade e desconto informado |
| [Pagamentos](exemplos/pagamentos.json) | Parcelas sem assumir liquidação |
| [Filiais](exemplos/filiais.json) | Identidade e código de exibição |
| [Produtos](exemplos/produtos.json) | Cadastro e seis classificações |
| [Estoque](exemplos/estoque.json) | SKU, saldo e frescor |
| [Evento de venda](exemplos/webhook-venda.json) | Snapshot mínimo assinado |
| [Alterações](exemplos/alteracoes.json) | Retomada incremental |
| [Erro](exemplos/erro.json) | Problem Details com código estável |
