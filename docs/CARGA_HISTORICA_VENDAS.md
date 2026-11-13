# Carga histórica de vendas por filial

A rotina complementar consulta de 01/01/2023 a 31/12/2025 na HostGator. O coletor regular já cobre desde 01/01/2026 e continua atualizando até o dia atual. O objetivo combinado é disponibilizar o histórico desde 2023 sem reiniciar os checkpoints de produção.

## Sequência e cobertura

Uma filial é processada integralmente antes da próxima, na ordem de `config/piloto.json`: ITUPEVA, AERO-009, AERO-010, AERO-014, AERO-015, AERO-018, AERO-019, AERO-019-2, AERO-020, AERO-021, AERO-022, AERO-023, AERO-MKTP, BABIES-002 e AERO-BAZAR. A execução usa janelas de um dia, incluindo dias sem movimento. A ausência de retorno em uma data não comprova ausência de histórico em todo o período.

Cada janela consulta operações e cancelamentos, valida o retorno e grava ambos na mesma transação. Preserva entradas, saídas e canceladas, além dos itens, complementos e situação de conferência. A rotina não corrige divergências comerciais nem presume conciliação. Antes de concluir uma filial, confirma que os checkpoints regulares de vendas e cancelamentos alcançaram o dia atual de São Paulo. No fim, aguarda o processamento das projeções da API externa.

Chaves já existentes em outra data e cancelamentos anteriores à operação de mesma chave interrompem a janela. Os locks por filial são os mesmos do coletor regular. Somente os registros recebidos são gravados; os checkpoints do coletor regular não são alterados. A origem das alterações na fila de projeções é `historica`. Console e entregas de webhooks continuam desativados.

## Clientes pendentes

A carga histórica aplica as mesmas validações de vendas da sincronização regular. Quando exclusivamente o cadastro de cliente é inválido, valida novamente todos os demais campos e importa a operação com `clientes = NULL`. Não converte código zero em identidade, não inventa cliente e não grava uma lista vazia como cadastro confirmado. Cadastros válidos recebidos são preservados; uma reexecução com cliente inválido não apaga cadastro já gravado.

O campo `clientesPendentes` no progresso registra ocorrências durante a carga. As operações com `clientes IS NULL` e `clientes_identidade_importada = false` continuam consultáveis para preenchimento posterior a partir de retorno válido do ERP. Essa contagem do progresso não substitui uma consulta atual das pendências no banco. O comportamento é exclusivo da carga histórica; o coletor regular mantém a validação estrita. A conclusão das vendas não significa conclusão da identidade de clientes ou homologação dos indicadores.

## Parcelas pendentes

Quando a venda só falha por seus lançamentos complementares, a rotina valida novamente o retorno retirando exclusivamente `lancamentos`. Se os demais campos forem válidos, importa a venda com `complementos.lancamentos = null`, preservando nota fiscal e demais complementos válidos. Valores com precisão extra não são arredondados. Qualquer erro no cabeçalho, preço do item, ajuste, frete, documento fiscal ou outro campo ainda bloqueia o dia.

`pagamentosPendentes` registra as ocorrências da carga. A API externa apresenta pagamentos como pendentes, e o banco mantém as operações identificáveis por sua chave e data para nova consulta posterior. Uma reexecução não apaga parcelas válidas já armazenadas. Preencher a composição dos pagamentos depende de retorno válido da origem; a carga das vendas não comprova essa composição.

## Implantação e acompanhamento

Servidor: alias SSH `Hostgator`; diretório `/opt/aeropostale-varejo`. Ler `deploy/README.md` antes de operar. O serviço adicional usa a imagem existente do coletor com os arquivos de execução montados em modo somente leitura. Não reconstruir ou recriar os demais serviços para esta carga.

Antes da primeira execução: gerar e verificar o backup dos dois bancos, confirmar o coletor remoto ativo e o local com `SYNC_ENABLED=false`, instalar os arquivos do serviço e preparar `artifacts/carga-historica-2023` com modo 0700 e propriedade do UID/GID 1000. Os arquivos-fonte montados precisam ser legíveis pelo usuário Node. Validar a configuração do Compose sem imprimir as variáveis ou credenciais.

Executar no diretório do projeto remoto:

```sh
docker compose -f compose.yaml -f compose.override.yaml -f deploy/historico.compose.yaml up -d --no-build --no-deps carga-historica
```

Conferir serviço, últimos eventos e progresso:

```sh
docker compose -f compose.yaml -f compose.override.yaml -f deploy/historico.compose.yaml ps -a carga-historica
docker compose -f compose.yaml -f compose.override.yaml -f deploy/historico.compose.yaml logs --tail=20 carga-historica
cat artifacts/carga-historica-2023/estado.json
```

O arquivo privado de progresso contém plano, filial, próxima data, contagens e último código de erro, sem nomes ou contatos de clientes. É salvo atomicamente, com modo 0600, somente após o commit da janela. Uma interrupção entre o commit e o arquivo provoca reexecução idempotente do dia. Preservar esse arquivo e seus diretórios; não editar a posição manualmente nem colocá-lo no Git.

`aguardando_retentativa` significa que o mesmo dia será consultado novamente, com espera progressiva de até cinco minutos. Falhas de paginação, identidade, itens ou validação não são ignoradas e não liberam a próxima filial. Investigar erros persistentes antes de afirmar conclusão. Quando a fila de projeções passa de mil registros, a carga espera o worker escoá-la.

Interromper somente a rotina complementar:

```sh
docker compose -f compose.yaml -f compose.override.yaml -f deploy/historico.compose.yaml stop -t 60 carga-historica
```

Retomar com o primeiro comando `up`, preservando o arquivo de estado. Após alterações nos arquivos montados, parar a rotina, instalar a revisão validada e usar `up -d --no-build --no-deps --force-recreate carga-historica`. O processo Node precisa ser recriado para carregar os módulos atualizados. Não executar o coletor local em paralelo.

O serviço tem limite de 512 MiB e 0,5 CPU, nenhum acesso HTTP publicado e logs com rotação. Reinicia em caso de falha; sai com código zero depois de salvar `estado: concluido`. Nesse caso deve permanecer parado. Progresso `processando` ou `carga_concluida` ainda não representa conclusão final.

A execução iniciada em 13/11/2026 permanece em andamento. A evidência inicial está em [validacao-carga-historica-2023.json](validacao-carga-historica-2023.json). Validar a cobertura das 15 filiais e as pendências ao terminar; não marcar essa etapa concluída por apenas iniciar o serviço.
