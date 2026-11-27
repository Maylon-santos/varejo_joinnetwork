# Processo de metas

A primeira etapa permite cadastrar no painel uma **meta mensal de valor de vendas, em reais, por filial do Millennium**. As metas pertencem ao painel; não são importadas do ERP nem gravadas nele.

## Cadastrar a meta de uma loja

1. Entre no painel e abra **Menu → Metas**. Também há um atalho em **Visão das filiais → Consultar metas**.
2. Selecione o **Mês da meta**. O mês é independente do período usado nos outros dashboards.
3. Clique em **Definir meta mensal** e escolha a loja pelo código e nome recebidos do Millennium.
4. Informe o **Valor da meta (R$)**, por exemplo `200.000,00`.
5. Clique em **Salvar meta**. O acompanhamento passa a usar o valor salvo imediatamente.

Há uma meta por loja e mês. Se a loja já tiver meta naquele mês, o formulário mostra o valor atual para edição. O botão **Cadastrar meta** na linha da loja também inicia o cadastro.

## Acompanhar e ajustar

A tabela apresenta realizado no mês, meta, percentual de atingimento, valor que falta e situação. Use os filtros **Loja** e **Situação** para localizar metas atingidas, abaixo da meta, ausentes ou com valor zero. Os cartões refletem a seleção; trocar esses dois filtros não consulta o servidor novamente. **Atualizar** busca os dados mais recentes.

- **Atingimento:** realizado ÷ meta × 100. Pode superar 100%; somente a barra visual para em 100%.
- **Falta:** meta menos realizado, limitada ao mínimo zero.
- **Sem meta:** nenhum valor definido, diferente de uma meta explicitamente igual a zero.
- **Meta zero:** valor permitido, com percentual indisponível para evitar divisão por zero.
- **Atingimento da seleção:** vendas apenas das lojas com meta cadastrada, divididas pela soma das metas dessas lojas. Lojas sem meta não aumentam o indicador.

Clique em **Editar meta** para ajustar o valor. **Remover meta** pede confirmação e retira o objetivo daquele mês, preservando o histórico. Não altera metas de outros meses.

Se outra pessoa salvar antes de você, a versão antiga é recusada. Feche e abra novamente a meta para conferir o valor atualizado antes de reenviar. Em falha de conexão, a repetição da mesma solicitação é protegida contra duplicidade.

## Base do realizado

O realizado utiliza as vendas importadas do mês selecionado: operações de saída não canceladas, com valores do cabeçalho e incluindo pendências de conferência. Cancelamentos recebidos separadamente também são excluídos e podem reduzir o atingimento. Na área Metas, não há consulta ao ERP ao abrir a página, rateio diário ou projeção do fechamento do mês.

Em **Visão geral → Evolução das vendas**, a meta mensal também fornece uma referência visual distribuída por dias corridos, nos modos Diário e Acumulado. O ritmo do intervalo é comparado com essa referência proporcional, sem substituir o atingimento mensal da área Metas. [Leitura e critérios do gráfico](EVOLUCAO_VENDAS_METAS.md).

Cobertura parcial aparece na loja; valores ainda não importados não entram no realizado. Esta base mantém a regra atual dos dashboards. A definição de faturamento bruto/líquido e devoluções continua na R22; entradas não são automaticamente descontadas como devoluções.

## Acesso e histórico

Admin, Diretoria e Supervisão podem consultar conforme **Dashboard consolidado**. A edição também exige **Cadastrar metas por filial**. Diretoria e Supervisão ficam restritas às filiais explicitamente atribuídas ao usuário; a opção de acesso geral de outros recursos não substitui esses vínculos. Perfis restritos às próprias vendas não acessam esta área.

As permissões são conferidas no servidor em cada gravação. O histórico registra responsável, horário, versão, valores anteriores/posteriores e identificador da solicitação. Está incluído nos backups existentes. Cadastro e remoção de metas não alteram vendas, estoque ou dados do Millennium.

Esta entrega reorganiza o cadastro existente em uma área própria; nenhum valor de produção foi criado ou modificado durante a publicação. Não adiciona aprovação ou rascunho: salvar torna a meta vigente. Alertas de metas atingidas permanecem em etapa separada das notificações de resumo diário.

## Próximas etapas

Os dois tipos abaixo estão planejados e **ainda não estão disponíveis**:

| Tipo | Identificação e definições necessárias |
| --- | --- |
| Vendedor por loja | Filial e código exato do vendedor no Millennium; definir período, afastamentos e tratamento de transferências. Não dividir automaticamente a meta da loja entre vendedores. |
| Produto ou classificação | Produto/SKU ou identificador confirmado de marca, categoria ou outra classificação disponível no catálogo; definir se a meta será em reais ou unidades e como tratar descontos, devoluções e classificações alteradas após a venda. |

As próximas etapas devem explicitar a origem do realizado, a cobertura dos itens e o tratamento de produtos sem classificação. Metas sobre classificações que se sobrepõem não devem ser somadas como objetivos independentes sem uma regra para evitar dupla contagem.

## Validação

Cadastro, edição, remoção auditada, conflito de versão, permissões por filial, filtros, valores zero/ausentes, competências separadas e navegação em computador/celular foram verificados com PostgreSQL e dados sintéticos. O teste foi repetido com os arquivos HTTPS publicados e API interceptada para a base isolada, sem gravações comerciais em produção. [Evidência](validacao-metas-lojas.json).
