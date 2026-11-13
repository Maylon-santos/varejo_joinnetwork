# Documento interno de implementação

> Referência de arquitetura e validação do projeto. Este arquivo não integra a documentação pública nem é servido pelo portal.

# Base de implementação e critérios de aceite

> Arquitetura do contrato e critérios de aceite. Implementação e testes isolados em 11/11/2026; infraestrutura, OAuth, consultas e projeções publicados na HostGator em 13/11. Entregas de webhooks e console desativados; primeiro consumidor e sua homologação pendentes. [Escopo entregue e roteiro operacional](operacao.md).

## Evidência do código atual

| Informação | Fonte no repositório | O que está confirmado |
| --- | --- | --- |
| Cabeçalho e itens de vendas | `backend/src/vendas.mjs` e `repositorio-postgres.mjs` | IDs compostos, dia de São Paulo, quantidades, valores, vendedor e evento |
| Fiscal e pagamentos | `backend/src/complementos-venda.mjs` | Quatro campos fiscais, condição e lançamentos |
| Snapshots de pessoas | `backend/src/clientes.mjs` | Código quando disponível, nome, contatos e aniversário MM-DD |
| Cancelamentos | `backend/src/cancelamentos.mjs`, `sincronizar-cancelamentos.mjs`, `painel.mjs` | Eventos e cancelamento efetivo separado do status fiscal |
| Conciliação | `backend/src/reconciliar-venda.mjs` | Tolerância de dois centavos, regras confirmadas e pendências explícitas |
| Filiais | `backend/src/filiais.mjs` | ID, código, fantasia e transação cadastral |
| Produto/estoque | `backend/src/produtos-estoque-erp.mjs`, `produtos.mjs`, `sincronizar-estoque.mjs` | Cadastro básico, seis dimensões, SKU, saldo e prioridade de tipo cadastral |
| Persistência | Migrations tenant 001–018 | JSONB de complementos, histórico observado, checkpoints e controle de sincronização |
| Autorização interna | `backend/src/permissoes.mjs`, `http-api.mjs` | Tenant, filiais/vendedor e permissões do painel |
| Sessão interna | `backend/src/admin-auth.mjs` | Token opaco de usuário por oito horas; não implementa o OAuth externo |

O mapeamento baseia-se no código do commit `c1c1eb2` e nas atualizações de 11/11/2026. A consulta pública realizada naquela entrega validou nota fiscal nos detalhes; ela não validou qualquer rota externa desta proposta. O campo `x-origem` no OpenAPI/dicionário indica se um atributo está mapeado, é derivado ou depende da nova camada.

## Inventário do que não será prometido sem nova origem

| Campo/capacidade desejada | Limitação atual | Tratamento na proposta |
| --- | --- | --- |
| Hora real da venda | Fonte atual não confirma horário; banco guarda dia | `hora_venda=null`, dependência R29 |
| Bruto, líquido e devolução | Eventos/composições pendentes de homologação | Não gerar colunas financeiras presumidas; R22/R11 continuam abertas |
| Situação fiscal traduzida | Status ERP pode ser nulo e sem catálogo de códigos confirmado | Retornar texto/null sem inferir autorização |
| Chave de acesso fiscal validada | IDNFE não foi homologado como chave SEFAZ | Manter `idnfe` textual |
| Liquidação, estorno e adquirente | Não há contrato confirmado nos lançamentos persistidos | Expor somente campos importados; sem saldo financeiro calculado |
| Preço atual do produto | Cadastro básico não guarda tabela atual de preços | Preços somente no snapshot dos itens de venda |
| Estoque em data arbitrária | Observações não cobrem todos os movimentos nem abertura histórica | Primeira versão fornece posição atual |
| Quantidade de reserva separada | Saldo já desconta reserva; quantidade separada não confirmada | Não subtrair novamente nem inventar campo |
| Unidade de medida | Não persistida no contrato atual do SKU | Evolução depende de origem confirmada |
| CNPJ, razão social/endereço filial | Modelo cadastral atual é mínimo | Não preencher por inferência |
| ID interno do produto em todo item de venda | Item guarda código comercial/SKU; mapeamento nem sempre existe | Não trocar código comercial por `produto_id` inventado |
| Cadastro completo de cliente/documentos | Base guarda snapshot limitado | Não criar API mestre de clientes nessa fase |
| URL pública estável de fotos | Referência atual depende de venda/autorização e hospedagem | URL bruta excluída; serviço externo de imagens em fase própria |
| SLA de atualização em segundos | Coleta sequencial, filas e dependência ERP | Retornar frescor; sem SLA comercial nesta documentação |

## Componentes da arquitetura

1. **Borda externa:** DNS/TLS do domínio confirmado, reverse proxy restrito, identificação de IP confiável e exposição apenas das rotas externas.
2. **Identidade de integração:** cadastro administrativo de clientes/filiais/escopos, chave pública, revogação, trilha de auditoria e separação de ambientes.
3. **Emissão/autorização:** private_key_jwt, replay cache de jti, tokens opacos por hash e verificação compartilhada de permissões.
4. **Admissão de carga:** cotas por cliente/tenant/instância/IP, concorrência, circuit breaker e pool separado do painel.
5. **DTOs externos:** allowlist explícita de campos. Não retornar `SELECT *`, colunas administrativas ou JSON de origem integral.
6. **Projeção e revisões:** representação estável por recurso, versão monotônica e hash de conteúdo relevante; mudanças de fiscal/pagamentos/cancelamentos também contam.
7. **Snapshots e log:** cursor assinado, índices, retenção, tombstones e publicação em ordem segura de commits.
8. **Outbox:** revisão e intenção de evento gravadas atomicamente; publicador recuperável e idempotente.
9. **Entrega ativa:** inscrição verificada, chave cifrada, worker isolado, limites, retries, replay, inbox e observabilidade segura.
10. **Console e auditoria:** gestão de integrações no SuperAdmin proposto, concessões/revogação e logs de quem acessou qual recurso, resultados e tempos de resposta. [Requisitos e campos administrativos](administracao.md).
11. **Homologação e operação:** testes de isolamento/carga/falha, métricas, alertas, procedimentos de rotação, revogação e recuperação.

O armazenamento proposto pode incluir entidades como `integration_clients`, `integration_client_keys`, `integration_tokens`, `integration_grants`, `integration_resource_versions`, `integration_changes`, `integration_snapshots`, `integration_outbox`, `integration_webhooks`, `integration_deliveries` e `integration_idempotency`. A implementação usa tabelas `integration_*` na migration tenant 019; consultar operacao.md para os nomes efetivos.

## Liberação em fases

| Fase | Entrega | Condição para concluir |
| --- | --- | --- |
| 0 — contrato | Este guia, OpenAPI, exemplos e revisão do domínio | Revisão técnica/comercial dos campos, limites e retenção |
| 1 — acesso de homologação | Cliente máquina, token, filiais e consultas limitadas | Isolamento negativo entre tenants/filiais e revogação aprovados |
| 2 — consulta confiável | DTOs, snapshots, revisões e log | Bootstrap e retomada sem perda/duplicação de efeito |
| 3 — webhook piloto | Um consumidor, outbox e assinatura | Retry, replay, dedupe, SSRF, rotação e indisponibilidade aprovados |
| 4 — produção controlada | Domínio, monitoração e clientes autorizados | Teste de carga, capacidade e suporte definidos |

Não marcar API externa ou webhook concluídos por existir este contrato ou por estarem disponíveis as rotas internas. Não conceder filiais adicionais nem concluir SaaS, ERP ou outras pendências do produto por esta documentação.

## Cenários mínimos de aceite

| Área | Cenários verificáveis |
| --- | --- |
| Autenticação | Prova válida; assinatura/algoritmo/kid/audience incorretos; expiração; relógio; jti repetido; cliente revogado |
| Isolamento | Tenant adulterado; ID de outra filial; cursor emprestado; escopo insuficiente; permissão reduzida durante paginação |
| Dados | Null versus zero/ausente/restrito; IDs grandes; centavos negativos; saldo negativo; tipo ausente; fiscal incompleto |
| Paginação | Atualização/cancelamento entre páginas; mesma revisão dos filhos; snapshot expirado; filtros alterados; parâmetro duplicado |
| Log | Cancelamento tardio; nota preenchida depois; falha entre persistência e cursor; commit concorrente sem pular entrada |
| Outbox | Falha antes/depois do commit; publicador reiniciado; reimportação idêntica sem evento; mudança real com revisão |
| Webhook | Assinatura/raw bytes; timestamp futuro/antigo; repetição; ordem invertida; timeout; 429; segredo rotacionado |
| Destino | DNS rebinding; redirect; IP privado/IPv6; certificado inválido; destinatário revogado; destino alterado |
| Recuperação | Limite de tentativas; circuito; replay dentro/fora de retenção; fila cheia; consumidor indisponível por horas |
| Capacidade | Sem consulta ERP em GET; SQL cancelado; cotas distribuídas; consumidor lento sem degradar painel/worker |
| Auditoria | Nenhum token, chave, telefone, texto pessoal ou body comercial integral nos logs |

Os exemplos de assinatura e os serviços têm testes com dados sintéticos. A evidência docs/validacao-implementacao-integracoes.json registra os cenários executados; operação real, carga e consumidor homologado continuam etapas próprias.

## Critérios operacionais antes de liberar clientes

Definir responsáveis, ambiente de homologação, retenção aprovada, janela de suporte, alertas, orçamento de armazenamento e capacidade real. A instância atual do piloto hospeda outros serviços; implantação futura deve reservar recursos e preservar esses serviços. Não ligar worker local enquanto o remoto estiver ativo.

Eventos e logs devem medir filas, atraso, falhas por destino, cotas, latência e revisões publicadas. Acompanhar duração da coleta e frescor, sem afirmar tempo real. Alertas não devem conter payload comercial; o acesso a detalhes precisa ser autenticado e auditado.

## Compatibilidade e evolução

`/v1` versiona o contrato HTTP. `schema_version` versiona o payload de webhook e `versao` é revisão de um recurso: não confundir os três. Adição de campo opcional tende a ser compatível; remoção/renomeação, mudança de significado ou tipo exige nova versão e migração comunicada. Novos tipos de webhook só serão enviados se contratados; enums financeiros não serão ampliados silenciosamente com novos significados.

Uma futura descontinuação deverá ter período comunicado e critérios acordados com integradores. Nenhuma data ou SLA de descontinuação foi contratado por esta proposta.

## Fontes técnicas primárias

- [OAuth 2.0 — RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.html): Client Credentials e resposta do token.
- [OAuth Security BCP — RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html): autenticação assimétrica de clientes.
- [JWT para autenticação OAuth — RFC 7523](https://www.rfc-editor.org/rfc/rfc7523.html): prova assinada do cliente.
- [429 — RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html): sinalização de excesso de chamadas.
- [Problem Details — RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html): envelope de erro dos recursos.
- [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html): formato da especificação e webhooks. O arquivo entregue usa o dialeto 3.1.0 para compatibilidade com ferramentas.
- [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md): headers e formato de assinatura.
- [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html): validação e isolamento do destino.

Os RFCs e guias fundamentam os protocolos. Quantidades, tempos, escopos, endpoints e políticas comerciais deste documento são decisões propostas para este produto, não requisitos atribuídos a essas referências.

## Regenerar e validar os artefatos

```bash
python3 scripts/gerar-contrato-integracoes.py
python3 scripts/gerar-portal-integracoes.py
python3 -m venv artifacts/documentacao-integracoes/.venv
artifacts/documentacao-integracoes/.venv/bin/python -m pip install -r docs/integracoes/exemplos/requirements-validacao.txt
artifacts/documentacao-integracoes/.venv/bin/python scripts/validar-docs-integracoes.py
node scripts/verificar-portal-integracoes.mjs
```

Os geradores usam a biblioteca padrão de Python 3.10 ou superior. O validador completo usa dependências isoladas de documentação: `openapi-spec-validator` e `jsonschema`; instalar conforme `exemplos/requirements-validacao.txt`. Nenhuma dependência ou serviço de produção é alterado.
