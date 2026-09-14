# API do painel — v1

API local: `http://127.0.0.1:3100`. O piloto usa o tenant Aeropostale e, por enquanto, autoriza apenas a filial ITUPEVA (`30098297`). A interface visual é servida na raiz `/`, na mesma origem da API. Veja [frontend/README.md](../frontend/README.md).

## Acesso Admin

`ADMIN_EMAIL` e `ADMIN_PASSWORD` estão no `.env`. Criar o usuário com `npm run admin:create`; repetir esse comando preserva a senha existente. Não há cadastro público. O banco armazena hash scrypt com salt aleatório. A senha gerada no `.env` não é enviada ao container da API: serve apenas para criar o Admin e para acesso local.

`POST /api/v1/auth/login`, com `Content-Type: application/json`:

```json
{"email":"admin@aeropostale.local","senha":"SUA_SENHA_DO_ENV"}
```

Retorna `token` e `expires_at`. Enviar `Authorization: Bearer TOKEN` nas demais rotas. Sessão expira após 8 horas; o banco guarda somente o hash do token. `POST /api/v1/auth/logout` revoga a sessão. `GET /api/v1/auth/me` retorna id, email, role e tenant do usuário autenticado. Um usuário desativado perde acesso imediatamente.

Não há cookies nem autenticação por parâmetros de URL. O frontend mantém o token em memória e usa a mesma origem; CORS não está liberado nesta entrega. HTTPS será necessário ao publicar o acesso fora do ambiente local. Limites por IP do socket: 120 requisições/minuto e 10 tentativas de login/15 minutos, em memória por instância. Não confia em `X-Forwarded-For`. Proxy e limites distribuídos ficam para a implantação.

## Rotas de consulta

Todas exigem sessão autenticada e permissão do recurso, exceto `/health` e login. Tenant é resolvido no servidor, nunca recebido do cliente.

| Método | Caminho | Resultado |
|---|---|---|
| GET | `/health` | Saúde da conexão e correspondência entre tenant e bancos, sem detalhes internos |
| GET | `/api/v1/filiais` | IDs internos e `cod_filial` das filiais autorizadas |
| GET | `/api/v1/indicadores` | Valor das vendas, quantidade de vendas, peças, ticket, PA, série diária e qualidade |
| GET | `/api/v1/vendas` | Operações paginadas, filtros de tipo/estado/conciliação |
| GET | `/api/v1/ranking` | Vendas por código do vendedor, ordenadas por valor, peças ou ticket |
| GET | `/api/v1/operacoes/{filial}/{tipo}/{codigo}` | Cabeçalho, itens e cancelamento efetivo da chave composta |

Indicadores, vendas e ranking exigem `filial`, `inicio` e `fim` (datas `AAAA-MM-DD`, inclusivas, até 366 dias). Paginação: `pagina` a partir de 1, `limite` entre 1 e 100 (padrão 50). Ranking aceita `ordenar=valor|pecas|ticket`; desempate por código do vendedor. Vendas aceita `tipo=S|E|todas`, `estado=ativas|canceladas|todas` e `conciliacao` (por exemplo `quantidade_divergente`). Padrões: S e ativas. Parâmetros desconhecidos ou repetidos são rejeitados nas rotas de listagem/indicadores.

Exemplo de caminho:

```text
/api/v1/indicadores?filial=30098297&inicio=2026-01-01&fim=2026-09-09
```

## Significado dos indicadores

- `valor_vendas_centavos`: soma do valor final de operações S não canceladas. Valores monetários são strings de centavos inteiros; não converter para float para fazer cálculos financeiros.
- `vendas`: quantidade de operações elegíveis, pela chave composta.
- `pecas_cabecalho`: soma da quantidade do cabeçalho; string inteira para preservar precisão. Não usa soma de itens divergentes.
- `ticket_medio_centavos`: valor de vendas / quantidade de vendas, arredondado a centavos. `null` se não há vendas.
- `pecas_por_venda`: peças do cabeçalho / quantidade de vendas, string decimal com quatro casas. `null` se não há vendas.
- Ranking usa a mesma população e agrupa por código do vendedor; o nome mais recente do período é exibido. Vendas sem código ficam em um grupo sem identificação.
- Cancelamentos são reconhecidos tanto pelo cabeçalho quanto pela tabela de cancelamentos. Entradas não são abatidas como devoluções enquanto essa regra não for homologada.
- `vendas_com_pendencia`, `qualidade` e `indicadores_provisorios` explicitam registros ainda não homologados. As cinco operações divergentes permanecem incluídas pelos valores de cabeçalho do ERP e sinalizadas; não foram corrigidas silenciosamente.
- `sincronizacao` mostra checkpoint, último sucesso e falhas. `checkpoints_cobrem_fim` verifica se ambos os recursos alcançam o fim solicitado, mas não comprova cobertura antes da data de início da importação nem substitui a conferência com o ERP. Dia atual contém dados somente até o último ciclo.
- Não são publicados indicadores com os nomes “bruto” ou “líquido” ainda: as deduções comerciais continuam pendentes de definição.

## Respostas de erro

JSON com `erro` e `request_id`. 400: parâmetro inválido; 401: login/sessão inválidos; 403: filial não autorizada; 404: recurso inexistente; 405: método não permitido; 415: corpo não JSON; 429: limite excedido; 500: erro interno sem detalhes sensíveis. Respostas usam `Cache-Control: no-store`.

## Execução e validação

```sh
npm run db:migrate
npm run admin:create
docker compose up -d --build --wait api
node --env-file=.env scripts/verificar-api.mjs
```

Parar apenas a API: `docker compose stop api`. O banco e o worker continuam ativos. A API tem porta publicada somente em loopback; logs não incluem senha, token ou corpos de requisições. A imagem Docker não recebe o `.env` nem as credenciais Millennium/Talk.

Contrato de rotas importável: [painel.openapi.json](painel.openapi.json). Evidência da validação local: [validacao-api.json](../docs/validacao-api.json).

O ranking também retorna `pecas_por_venda` (PA), string decimal com quatro casas, calculada com a mesma população elegível dos demais indicadores. O detalhe inclui `imagem_url` por item, nula quando não fornecida. A interface exibe PA com duas casas e miniatura ampliável.

## Detalhes complementares — 13/09/2026

- `GET /api/v1/operacoes/:filial/:tipo/:codigo/cliente`: exige `vendas:ler`, `clientes:ler` e filial/vendedor autorizados; lê somente o banco do tenant. Retorna `{clientes:[{nome,contatos:[{tipo,ddd,telefone}]}],importados_em}`. `clientes: null` indica histórico ainda não importado; lista vazia indica cliente não informado pelo ERP. O detalhe da operação já inclui `operacao.clientes` e `operacao.clientes_importados_em`, usados pela interface sem uma segunda chamada. Dados de clientes são persistidos e incluídos nos backups privados; não aparecem nos logs.
- `GET /api/v1/operacoes/:filial/:tipo/:codigo/itens/:ordem/imagem`: exige a mesma autenticação; obtém somente a URL persistida do item e aceita a origem fixa de fotos do ERP. Responde imagem raster de até 5 MB, sem redirecionamentos, timeout de 12 segundos e `Cache-Control: no-store`. A interface usa um blob temporário e o libera ao fechar os detalhes. Origem HTTP é consultada pelo servidor; o navegador recebe HTTPS.

Alguns arquivos de fotos não existem na origem (404). A tela mantém o marcador de indisponibilidade nesses casos. O proxy não inventa fotos nem permite URLs arbitrárias.

## Código exibido das filiais

`GET /api/v1/filiais` retorna `{filiais:[{filial,cod_filial,trans_id}],tenant}`. O seletor exibe `cod_filial` e mantém `filial` como valor interno dos filtros. O cadastro vem da tabela `cadastro_filiais`, sincronizada pelo worker; o login não consulta o ERP. Um cadastro ausente retorna código e trans_id nulos, com aviso no seletor.

A lista de autorização continua em `branchIds`. O cursor cadastral não concede acesso a novas filiais. `branchCodes` é apenas a referência estática da conferência anterior; a API não utiliza esse mapa.


## Gerenciador de permissões por empresa — 14/09/2026

A tela **Permissões** permite selecionar um cargo à esquerda e marcar seus recursos e acesso aos dados à direita, conforme a referência fornecida por Maylon. Somente Admin edita. Os cinco cargos iniciais são Admin, Diretoria, Supervisão, Gerentes e Vendas; o nome exibido dos quatro últimos pode ser alterado.

- `GET /api/v1/acessos/perfis`: retorna `recursos` e `perfis` da empresa autenticada.
- `PUT /api/v1/acessos/perfis/:role`: recebe `nome`, `permissoes` (lista de códigos), `todas_filiais` e `somente_proprias_vendas` (booleanos). Campos adicionais são rejeitados.
- Recursos: `indicadores:ler`, `vendas:ler`, `ranking:ler`, `conferencia:ler`, `clientes:ler`, `imagens:ler`. Conferência, clientes e imagens dependem de movimentações. Conferência autoriza a tela e seus filtros; o estado de conciliação de uma operação continua disponível junto à venda autorizada.
- Admin mantém acesso completo e não pode ser reduzido pelo gerenciador. Diretoria, Supervisão e Gerentes começam sem recursos liberados, aguardando configuração do Admin.
- Vendas começa com indicadores, movimentações, ranking, clientes e fotos; fica obrigatoriamente limitado às próprias vendas e às filiais atribuídas. O vínculo usa o código do vendedor em cada filial. Ausência do vínculo não libera dados.
- Para outros cargos, todas as filiais significa somente as lojas autorizadas para aquela empresa. Desmarcado, aplica os vínculos individuais. Limitar às próprias vendas exige filiais atribuídas.

O servidor relê cargo, permissões e vínculos em cada requisição: alterações valem na próxima consulta. `/auth/me` inclui nome do cargo, permissões, filiais e restrição de vendas. Recursos bloqueados retornam 403; detalhe de outro vendedor na mesma filial retorna 404. Clientes e URLs de imagens são removidos dos detalhes quando não autorizados. A interface atualiza sua navegação após novo login.

A migration `control/003_permissoes.sql` preserva usuários e credenciais existentes, cria perfis por tenant e os vínculos `user_branches`. Novas empresas recebem perfis próprios automaticamente. A tela de cadastro/desativação de usuários, atribuição de cargo/filial/vendedor e criação de grupos personalizados permanece em R13; nenhum novo usuário real foi criado nesta entrega.

Verificação reproduzível: `node --env-file=.env scripts/verificar-permissoes.mjs` (Chrome instalado e PostgreSQL local). O script cria e remove schemas temporários com dados sintéticos, sem usar os cadastros reais. Capturas ficam em `artifacts/deploy/`.


## Cadastro de usuários — 14/09/2026

Somente Admin acessa a tela **Usuários**. É possível criar contas, alterar e-mail/cargo/vínculos, definir nova senha e ativar/desativar. A senha inicial deve ter pelo menos 16 caracteres (limite de 256 bytes); na edição, deixar vazia mantém a atual. Não há envio automático de convite, senha ou mensagens. Senhas e hashes não são retornados pela API.

- `GET /api/v1/acessos/usuarios`: lista os usuários da empresa com `id`, `email`, `role`, `active` e `vinculos`.
- `POST /api/v1/acessos/usuarios`: cria um usuário; retorna 201 com `id`.
- `PUT /api/v1/acessos/usuarios/:id`: atualiza o usuário; retorna 200 com `id`.
- Corpo: `email`, `role`, `active` (booleano), `senha` e `vinculos: [{filial: "ID", vendedor_codigo: "CODIGO" ou null}]`. Tenant não é aceito no corpo. E-mail duplicado na mesma empresa retorna 409.
- `GET /api/v1/acessos/vendedores`: lista código/nome dos vendedores presentes nas operações locais, separado por filial autorizada. Não consulta o ERP. Um vendedor sem histórico importado ainda não aparece; aguardar sua importação para vinculá-lo.

Usuários ativos precisam de filial quando o cargo não abrange todas. Cargos limitados às próprias vendas exigem vendedor em cada vínculo. O servidor rejeita filiais fora da empresa, vínculos duplicados e vendedor ausente do histórico daquela loja. Salvar um usuário encerra suas sessões anteriores. A desativação impede novos logins; reativação exige novo login. Os vínculos e mudanças do cadastro são gravados numa única transação.

O Admin não pode alterar seu próprio cadastro pela tela/API. As alterações administrativas são serializadas por empresa e revalidam o Admin executor, evitando que administradores se desativem simultaneamente e deixem a empresa sem acesso. Grupos personalizados e hierarquia permanecem evolução futura; os cinco cargos são os configurados em Permissões.

Validação: `node --env-file=.env scripts/verificar-usuarios.mjs`, com Chrome instalado e PostgreSQL local; usa schemas e usuários sintéticos temporários. Relatório em `docs/validacao-usuarios-ui.json`, capturas privadas em `artifacts/deploy/`.
