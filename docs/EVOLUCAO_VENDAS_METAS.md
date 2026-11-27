# Evolução das vendas e metas

Em **Visão geral → Evolução das vendas**, consulte o realizado e a referência das metas mensais da loja selecionada. O gráfico acompanha os filtros aplicados, sem cadastrar ou alterar objetivos.

## Leitura do gráfico

- **Diário:** vendas de cada dia e referência correspondente da meta. É o modo inicial.
- **Acumulado:** soma das vendas e da referência desde o primeiro dia do intervalo selecionado. Um filtro que começa no dia 10 inicia o acumulado no dia 10, sem acrescentar os dias anteriores.
- **Linha verde:** vendas realizadas. **Linha lilás tracejada:** referência da meta.
- **Cartão em destaque:** realizado no intervalo. Ao lado aparecem a meta mensal cadastrada, a referência até o último dia exibido e o ritmo em relação a essa referência.

Passe o mouse ou toque em um ponto para consultar data, valor realizado, referência, diferença, meta mensal e quantidade de vendas/peças do dia. No modo acumulado, o valor e a referência são acumulados; as quantidades permanecem identificadas como do dia. Clique ou toque para fixar; novo toque, toque externo ou Escape fecha. No teclado, use setas, Home, End, Enter e Espaço. No celular, deslize horizontalmente para percorrer os dias.

## Referência da meta

A meta cadastrada continua sendo **mensal, por loja, em reais**. Para desenhar uma referência visual, seu valor é distribuído pelos dias corridos daquele mês. Não há calendário de dias úteis ou peso especial para Black Friday, fins de semana ou feriados.

Exemplo ilustrativo: meta de R$ 40.000,00 em novembro. Até o dia 27, a referência é R$ 36.000,00. Um realizado de R$ 33.660,00 representa 93,50% dessa referência, com diferença de R$ 2.340,00. Esse percentual não é o atingimento da meta mensal integral, apresentado na área Metas.

O rateio usa centavos inteiros e a diferença entre os acumulados de dois dias consecutivos; os resíduos são distribuídos sem perder ou criar centavos. A soma do mês completo corresponde exatamente à meta cadastrada. A referência do intervalo considera somente os dias exibidos. O gráfico usa números para posicionar os pontos; valores apresentados e somas permanecem em centavos com BigInt.

## Datas e metas ausentes

O realizado termina na menor data entre o fim selecionado, o dia atual de São Paulo e os checkpoints de vendas/cancelamentos disponíveis. Dias futuros ou posteriores ao corte sincronizado não aparecem como vendas zero. Alertas de cobertura e conferência do painel continuam valendo.

Intervalos acima de 62 dias agrupam os pontos por mês. No modo Diário, cada ponto passa a representar o resultado daquele mês dentro do filtro; a descrição e o detalhe identificam essa mudança. No modo Acumulado, os valores continuam somados desde o início selecionado.

Meta zero permanece explícita, sem percentual quando a referência é zero. Meta ausente ou removida não vira zero: fica sem linha de referência. Se faltar meta em algum mês, a comparação acumulada fica indisponível a partir da lacuna e o resumo sinaliza a ausência. Não são preenchidos objetivos por inferência.

## Acesso e origem dos dados

As metas aparecem somente para quem já possui acesso ao consolidado: Admin, Diretoria ou Supervisão, sem restrição a vendas próprias. Diretoria/Supervisão continuam limitadas às filiais explicitamente atribuídas, mesmo quando podem consultar outras filiais em outros recursos. Outros acessos aos indicadores mantêm o gráfico de vendas, sem receber metas na resposta.

O servidor acrescenta `metas_mensais` à resposta interna de indicadores somente dentro desse escopo, com competência e valor da filial consultada. Não envia autoria, histórico ou metas de outras lojas. Não há nova chamada do navegador para buscar metas nem consulta adicional ao alternar Diário/Acumulado ou abrir detalhes.

A base de vendas e cancelamentos permanece a mesma dos indicadores. Pendências continuam incluídas conforme a regra vigente; bruto/líquido e devoluções permanecem na R22. A API pública de integrações, permissões, cadastros de metas, históricos, notificações e dados do Millennium não são alterados por este gráfico.

O [processo de metas](PROCESSO_METAS.md) explica como cadastrar os valores. [Evidência de validação](validacao-evolucao-metas.json).
