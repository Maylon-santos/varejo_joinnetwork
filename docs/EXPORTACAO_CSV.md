# Exportações CSV e envio diário

Atualizado em 31/10/2026. Amostra de 01 a 20/10/2026 e histórico de 01/01 a 30/10/2026, conforme confirmação do usuário para usar 2026. Seis CSVs iniciais aceitos pela Talk, seguidos de dois arquivos de vendas por cupom corrigidos no layout solicitado. AERO-MKTP excluída somente da exportação; cadastro, autorização e sincronização do painel permanecem com 15 filiais.

## Layout final de vendas por cupom

Uma linha por operação S ativa, com **exatamente sete colunas**, nesta ordem:

```csv
data;empresa;canal;DESCRICAO;TIPO_OPERACAO;VALOR_FINAL;QTDE
2026-01-02 00:00:00.000;ITUPEVA - AERO - ITUPEVA;varejo - loja fisica;VENDA VAREJO CUPOM FISCAL  - FRANQUIA;S;219,98;2
```

`empresa` combina COD_FILIAL e Fantasia. Canal de lojas físicas confirmado pelo usuário. `DESCRICAO` usa `descricao_evento`, conferida diretamente no ERP para os dez códigos presentes no histórico e registrada em `config/exportacao-csv.json`. Evento novo sem descrição confirmada interrompe a exportação para revisão, sem inventar texto. O valor vem do cabeçalho, em BRL com vírgula e duas casas, sem novo cálculo de desconto. `QTDE` mantém as peças do cabeçalho.

UTF-8 sem BOM, separador `;`, finais CRLF e escape de aspas/delimitadores/quebras internas. O sufixo `00:00:00.000` é **convenção do layout**: a base guarda apenas o dia e não confirma horário real (R29). Cancelamentos do cabeçalho ou dos eventos conhecidos são excluídos. Uma linha por venda, sem somar por dia/empresa e sem adicionar número fiscal ou outras colunas.

## Outros relatórios e limites

- `faturamento_diario`: agrupamento por dia, filial e dimensões disponíveis, operações, valor e peças. Preserva layout anterior, datas AAAA-MM-DD e ponto decimal.
- `cadastro_filiais`: posição atual das 14 filiais exportáveis, inclusive sem vendas. Não representa cadastro histórico.

No consolidado/cadastro, empresa, unidade e canal permanecem vazios sem mapeamento específico. Marca usa cadastro atual por SKU/produto; cupons mistos ou incompletos não recebem marca única e não têm rateio do cabeçalho. Devoluções, bruto/líquido, frete/cortesia e homologação comercial continuam nas R22/R11. Os relatórios usam vendas S ativas e incluem pendências de conciliação sem alterar os valores importados.

## Geração e envio

```sh
node --env-file=.env scripts/exportar-relatorios.mjs --inicio=2026-10-01 --fim=2026-10-20
node --env-file=.env scripts/exportar-relatorios.mjs --ano=2026
node --env-file=.env scripts/exportar-relatorios.mjs
node --env-file=.env scripts/enviar-relatorios-talk.mjs PASTA_PRIVADA_DO_LOTE
```

Sem datas, a janela vai do **primeiro dia do mês anterior até ontem**, em America/Sao_Paulo, com viradas de mês/ano e bissextos verificadas. `--ano` usa o calendário inteiro; para o ano corrente passar datas até ontem. O histórico solicitado tem um arquivo por relatório/ano. `--snapshot=CAMINHO_PRIVADO` reaproveita a mesma extração, sem combinar com datas. `--dimensoes=JSON_PRIVADO` aceita mapeamento por filial para os outros relatórios.

Leitura em REPEATABLE READ READ ONLY, com identidade do tenant e filiais autorizadas verificadas. Saída exclusivamente em subpastas de `artifacts/exportacoes-csv/`, ignorado pelo Git; lotes anteriores preservados. Cada lote inclui manifesto/checksums e avisos. Os dois CSVs ajustados de amostra/histórico foram conferidos linha a linha contra o snapshot antes do envio.

Talk usa multipart conforme `apis/talk.md`, exclusivamente para `TALK_ADMIN_NUMBER` configurado, com `TALK_SEND_URL` e `TALK_TOKEN` privados. Sem URL pública do arquivo, CC/BCC ou solicitação de fechamento do atendimento. Recibo `envio-talk.json` mantém cada aceite; repetição pula aceitos. Resultado incerto/timeout interrompe e exige conferir no Talk antes de reenviar. Aceite da API não comprova entrega/leitura no WhatsApp. E-mail não enviado; o usuário substituiu o canal por Talk.

## Rotina diária ativa

**08h de São Paulo, todos os dias**, pelo timer `aeropostale-relatorios.timer` na Locaweb. Próxima execução conferida: **01/11/2026 às 08h**. Envia três relatórios, incluindo vendas por cupom no layout final, ao único WhatsApp administrativo autorizado. A escolha do canal e horário foi confirmada pelo usuário.

Serviço isolado `relatorios-csv` em `deploy/relatorios.compose.yaml`, usando a imagem existente e montagens explícitas dos scripts/configuração; não reinicia API, banco ou worker. `.env.relatorios` no servidor contém somente a configuração Talk, modo 600. Saídas pertencem ao UID 1000 do container, modo 700. Um lock impede execuções concorrentes; pasta determinística por período reaproveita o snapshot e os recibos, evitando duplicidade. Resultados incertos não são reenviados automaticamente.

Primeiro envio da janela 01/09–30/10 aceito pela API (três arquivos). Reexecução do serviço reutilizou o lote sem novos envios. Depois do ajuste, geração no servidor validou sete colunas, 14 filiais e igualdade de valores/peças com o consolidado. Os próximos períodos usam o layout final. Backup prévio `backup-20261031T213658Z-zzmj4o`; versões anteriores dos scripts preservadas nos artifacts privados do servidor. Worker local permanece desativado.

Operação e retorno: `deploy/README.md`. Alternativa SMTP mantida em `scripts/enviar-relatorios.py`, sem ativação. Não exibir tokens, telefones completos ou valores comerciais em logs de verificação.

## Validação

70 testes unitários Node, um teste PostgreSQL da exportação em schema isolado e três testes SMTP simulados. Python csv/Decimal conferiu codificação, delimitador, colunas, empresa/canal/descrição, datas, valores, peças, chaves, checksums e exclusão de MKTP. Compose/sintaxe aprovados. API saudável, PostgreSQL e worker remoto ativos após instalação. Evidência: `docs/validacao-exportacao-csv.json`.
