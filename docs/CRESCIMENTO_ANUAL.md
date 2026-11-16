# Crescimento anual por filial

No painel, abra **Crescimento anual**. O dashboard mostra as filiais autorizadas ao usuário e compara o ano escolhido com seu antecessor. A seleção **Todas as autorizadas** permite comparar as lojas na mesma tabela; selecionar uma filial ou clicar em seu nome detalha seus resultados e meses.

## Filtros e leitura

- **Ano de referência:** anos desde o primeiro registro importado das filiais autorizadas até o ano atual. O comparativo é sempre com o ano imediatamente anterior.
- **Acumulado até a data de hoje:** de 1º de janeiro até o mesmo mês/dia nos dois anos. Usa o calendário de São Paulo. Em 29 de fevereiro, o corte do ano sem esse dia é 28 de fevereiro. O dia atual pode receber novos registros.
- **Ano completo:** janeiro a dezembro nos dois anos. Disponível somente para anos encerrados. Ao selecionar um ano anterior, esse modo é escolhido; ao selecionar o ano atual, o modo acumulado é obrigatório.
- **Filial:** filtra o conteúdo já autorizado ao usuário. Gráfico, tabela, cartões e total acompanham a seleção.
- **Indicador do comparativo:** valor de vendas, quantidade de vendas, peças ou ticket médio. Define gráfico, tabela por filial e detalhamento mensal. Os cartões mantêm o resumo de valor, crescimento do valor, vendas e ticket.

No celular, o gráfico possui rolagem horizontal e as tabelas se adaptam a cartões. O detalhamento mensal apresenta os valores exatos; meses posteriores ao corte ficam fora do comparativo.

## Cálculos

O valor de vendas, as peças e a elegibilidade seguem o consolidado existente: operações S não canceladas, incluindo cancelamento registrado em tabela separada. Utiliza valor e quantidade do cabeçalho; pendências de conferência continuam incluídas e são informadas. Entradas não são subtraídas como devoluções, cuja regra permanece em homologação.

A diferença é `valor atual - valor anterior`. A variação percentual é `(valor atual - valor anterior) / valor anterior × 100`, com duas casas decimais e truncamento. Quando a base anterior é zero ou negativa, a interface informa **Sem base percentual**. Uma filial sem vendas anteriores continua visível; suas vendas atuais entram no total selecionado.

O ticket médio é a soma dos valores dividida pela quantidade de vendas, arredondado ao centavo. O ticket do total e dos meses é recalculado sobre as somas; não é obtido pela média simples dos tickets das filiais. Valores monetários e diferenças usam inteiros/BigInt, preservando centavos acima do limite exato de Number.

## Acesso e atualização

Compartilha a permissão `consolidado:ler` e os cargos Admin, Diretoria e Supervisão, sem restrição a vendas próprias. Admin vê as filiais configuradas no projeto; Diretoria e Supervisão veem somente vínculos explícitos, inclusive quando seu cargo permite outras consultas a todas as filiais. Não concede novas permissões aos consumidores da API externa.

O primeiro registro importado e o mínimo dos checkpoints de vendas/cancelamentos são exibidos por filial. Checkpoints mostram a atualização final; não comprovam cobertura histórica integral. Sem vendas no retorno não permite concluir fechamento de loja ou ausência de operações na origem. A conferência comercial permanece separada.

Endpoint interno, autenticado pela sessão do painel:

```http
GET /api/v1/crescimento?ano=2026&modo=acumulado
Authorization: Bearer <SESSAO_DO_PAINEL>
```

Aceita somente `ano` e `modo`, sem parâmetros repetidos. Modos: `acumulado` ou `completo`. Retorna períodos explícitos, anos disponíveis, filiais, somas e variações, atualização e série mensal. Transação somente leitura, isolamento REPEATABLE READ e timeout de oito segundos. Nenhuma migration, alteração comercial ou chamada ao ERP é executada pela consulta.

## Publicação e verificação em 16/11/2026

Publicada somente a imagem `aeropostale-varejo-api:crescimento-20261116` na HostGator. Outros 24 containers, Nginx, credenciais das integrações e autenticadores preservados. Worker remoto ativo, local desativado e webhooks desativados.

89 testes unitários, 27 de integração em PostgreSQL isolado e interfaces sintéticas do crescimento/consolidado aprovados. Em produção, as 15 filiais foram comparadas com o consolidado nos anos de referência 2024/2025 completos e 2026 acumulado, conferindo os dois períodos de cada par e as somas mensais. Navegador público verificou login, menu, filtros de filial/indicador/ano, celular sem transbordamento, rolagem do gráfico e limpeza após saída.

Evidências: [publicação](validacao-crescimento-anual.json), [interface isolada](validacao-crescimento-anual-ui.json) e [interface em produção](validacao-crescimento-anual-producao-ui.json). Capturas e material operacional ficam em `artifacts/crescimento-anual/`, fora do Git. O backup prévio teve checksums conferidos no servidor; esse registro não afirma uma nova cópia externa verificada.
