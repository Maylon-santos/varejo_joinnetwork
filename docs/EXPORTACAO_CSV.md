# Exportações CSV

Preparação em 31/10/2026. Pedido atualizado pelo usuário para histórico de **2026**, substituindo 2025. Amostra: 01 a 20/10/2026. Histórico: 01/01 a 30/10/2026 (ontem na data da extração). Os seis CSVs foram aceitos pela API Talk para envio ao único WhatsApp administrativo configurado, após autorização expressa do usuário. Arquivos, recibos e snapshot comercial ficam em `artifacts/exportacoes-csv/`, ignorado pelo Git. Não houve publicação de API/worker nem alteração de dados comerciais.

## Formato e relatórios

UTF-8 sem BOM, separador `;`, finais CRLF, datas `AAAA-MM-DD`, valores BRL com ponto decimal e duas casas, sem separador de milhares. Campo vazio significa informação ausente. Aspas, delimitadores e quebras internas são escapados. IDs são texto; importar como texto para preservar zeros iniciais.

- `faturamento_diario`: dia, empresa/unidade/canal, marca e situação da classificação, filial/código/Fantasia, tipo, operações, valor e peças.
- `vendas_por_cupom`: uma linha por operação ERP, mesmas dimensões, código interno, campo fiscal vazio, valor do cabeçalho, subtotal dos itens, ajuste informado, peças, conciliação, evento e vendedor.
- `cadastro_filiais`: posição cadastral atual das filiais autorizadas, inclusive sem vendas. Não representa cadastro histórico.

Todos os relatórios comerciais usam **operações S ativas**: excluem cancelamento do cabeçalho e eventos de cancelamento conhecidos na extração. Incluem pendências de conciliação sem modificar os valores recebidos. Devoluções, bruto/líquido, frete e cortesia continuam na R22; não tratar toda entrada como devolução. `valor` é o valor do cabeçalho, sem qualificá-lo como faturamento líquido homologado.

Empresa, unidade e canal precisam de mapeamento confirmado; ficam vazios por padrão. `cod_operacao` é a chave interna, **não o número fiscal do cupom**. O número fiscal não é persistido na origem atual; `cupom_fiscal` fica vazio.

Marca usa o cadastro atual do produto associado por filial/SKU/código do produto. Marca única só é preenchida quando todos os itens têm classificação e a quantidade coincide com o cabeçalho. Cupons mistos ficam com marca vazia e `situacao_marca=multiplas`; incompletos usam `incompleta`. O cabeçalho não é rateado entre marcas. Portanto, esta extração ainda não atende à análise completa por marca/empresa/canal nem às devoluções. Essas lacunas precisam de contrato complementar ERP.

## Uso

```sh
node --env-file=.env scripts/exportar-relatorios.mjs --inicio=2026-10-01 --fim=2026-10-20
node --env-file=.env scripts/exportar-relatorios.mjs --ano=2026
node --env-file=.env scripts/exportar-relatorios.mjs
```

Sem datas, calcula **primeiro dia do mês anterior até ontem**, usando America/Sao_Paulo, inclusive em viradas de ano e ano bissexto. `--ano` exporta o calendário inteiro; para o ano corrente usar datas explícitas até ontem. O histórico preparado em 31/10 tem um CSV por relatório/ano, sem divisão mensal.

Leitura em transação REPEATABLE READ READ ONLY, verificando tenant e filiais. `--snapshot=CAMINHO_PRIVADO` reaproveita uma extração consistente, sem reler produção; não combinar com datas. `--dimensoes=JSON_PRIVADO` aceita objeto indexado por ID de filial, com `empresa`, `unidade`, `canal` explicitamente confirmados. Não inferir canal pelo nome da filial nem marca pela empresa.

Cada execução cria diretório novo, sem sobrescrever lotes anteriores, com CSVs, LEIA-ME e manifesto/checksums. `--saida` precisa ser uma subpasta de `artifacts/exportacoes-csv/`. Não incluir dados pessoais, credenciais ou CSVs no Git.

## Envio e agendamento preparados, ainda inativos

O usuário autorizou **um único destinatário**, registrado na central privada. Nenhum CC/BCC. A tentativa pelo plugin Gmail falhou com ferramenta indisponível, inclusive na consulta de perfil; nenhum envio de e-mail confirmado. O plugin foi verificado como instalado/habilitado. A alternativa no Chrome foi bloqueada pela ausência de permissão de controle. Depois, o usuário pediu WhatsApp pela API Talk: **seis CSVs enviados individualmente e aceitos pela API**; notas de cobertura incluídas nas legendas. Aceite HTTP não comprova entrega/leitura no WhatsApp.

```sh
node --env-file=.env scripts/enviar-relatorios-talk.mjs artifacts/exportacoes-csv/amostra-2026 artifacts/exportacoes-csv/historico-2026
```

O script verifica todos os checksums antes do envio e usa somente `TALK_ADMIN_NUMBER`, `TALK_SEND_URL` e `TALK_TOKEN` já configurados no `.env`. Segue o multipart documentado em `apis/talk.md`, sem expor arquivo em URL pública, mudar atribuição/fila ou solicitar fechamento do atendimento. Cada aceite é persistido no recibo privado `envio-talk.json`; nova execução pula arquivos aceitos. Uma execução interrompida, timeout ou resultado incerto impede repetição automática: conferir no Talk antes de reenviar. Não ativar alertas do worker para enviar estes arquivos.

O servidor não possui configuração SMTP nem sendmail/msmtp. O timer proposto é 08h de São Paulo, **não instalado/ativado**; confirmação do canal recorrente (WhatsApp ou e-mail) solicitada após a entrega. Para ativar por e-mail, configurar remetente em `.env.relatorios` privado (modo 600) com `RELATORIOS_EMAIL_DESTINO`, `RELATORIOS_EMAIL_REMETENTE`, `RELATORIOS_SMTP_HOST`, `RELATORIOS_SMTP_PORTA` (587 por padrão), `RELATORIOS_SMTP_USUARIO` e `RELATORIOS_SMTP_SENHA`. Usar somente o destino autorizado; não colocar segredos em mensagens, logs ou commits.

`scripts/enviar-relatorios.py PASTA_DO_LOTE` verifica checksums e aceita somente um endereço. Exige STARTTLS e autenticação. Marca `ENVIADO.json` apenas após aceite SMTP; não equivale a confirmação de recebimento. Se a conexão cair após o aceite e antes do marcador, conferir a caixa de enviados antes de repetir. Não há retentativa cega.

Antes da implantação, seguir `deploy/README.md`, criar diretório privado de exportação com escrita pelo UID 1000 do container da API, construir a imagem com o script novo e instalar as unidades `deploy/aeropostale-relatorios.*`. O serviço usa `docker compose run --rm --no-deps api` para exportar sem iniciar worker. O shell usa `flock`, mantém escopo próprio e não altera outros timers. Testar um envio autorizado antes de habilitar o timer. Worker local continua desativado.

## Verificação

69 testes unitários Node (incluindo transporte Talk simulado), teste PostgreSQL em schema sintético isolado e três testes SMTP simulados. Conferência independente com Python `csv`/`Decimal`: codificação, separador, datas, chaves únicas, checksums, totais diário/cupom/snapshot e cadastro das 15 filiais. Evidência sem valores comerciais: `docs/validacao-exportacao-csv.json`.
