# Vendas por hora — R29

Solicitado em 28/09/2026 para identificar os horários de maior venda nos dashboards. **Em preparação: depende do horário real da venda na API ERP. Ainda não publicado.**

## Apresentação proposta

- **Visão geral:** distribuição das vendas da filial e do período selecionados. Perfis limitados às próprias vendas continuam restritos ao seu vendedor.
- **Visão das filiais:** distribuição conjunta das filiais autorizadas. Mantém os cargos Admin, Diretoria e Supervisão e, para os dois últimos, somente filiais atribuídas.
- Gráfico com 24 faixas, de 00h–00h59 até 23h–23h59, e escolha entre valor vendido e quantidade de vendas. Proposta inicial: valor como padrão.
- Tabela de apoio com faixa horária, vendas, peças, valor e participação; destacar o horário de pico na medida escolhida, incluindo empates.
- Em períodos com vários dias, somar as vendas da mesma hora de todos os dias selecionados. Explicar que é um acumulado, não uma média diária nem contagem de atendimentos.
- Usar a mesma elegibilidade dos indicadores atuais: operações S não canceladas, valores/peças do cabeçalho e mesmas restrições de acesso. Sem inferir devoluções ou faturamento líquido.

## Dependência confirmada na fonte

Leitura da `MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS`, filial ITUPEVA (`30098297`), dia 27/09/2026: 21 operações; todas com campo `data` às **00:00:00 no horário de São Paulo**. Não foi encontrado um campo específico do horário de venda. O banco atual persiste `data_operacao` como data, sem hora.

Campos temporais encontrados: `data`, `data_cancelou`, aniversário/cadastro do cliente e emissão/vencimento dos lançamentos. Esses campos complementares não substituem a hora da venda. Evidência agregada, sem dados pessoais: [verificação da fonte](validacao-fonte-horarios.json).

Proposta enviada a Maylon para ajustar a **resposta**, sem adicionar parâmetro de consulta:

```json
{
  "hora_venda": "14:35:27"
}
```

Confirmar o nome do campo e sua semântica: horário efetivo da venda, associado ao dia comercial `data`, em `America/Sao_Paulo`. Se a origem fornecer um timestamp completo com fuso, documentar o formato antes de implementar a conversão. Não usar horário de importação, atualização, cancelamento ou emissão de parcela. Não alterar o contrato de `data` usado na sincronização existente.

## Sequência de implementação

- [x] Conferir persistência atual e amostra ERP, incluindo campos complementares.
- [ ] ERP disponibilizar o horário real; confirmar campo, formato, fuso e presença no histórico.
- [ ] Validar o contrato com amostras em horários diferentes e nas bordas do dia.
- [ ] Persistir o horário junto da importação/reprocessamento da venda, com migration aditiva. Ausência fica nula; horário explícito válido 00:00:00 continua legítimo e distinto de ausência.
- [ ] Acrescentar agregações nos dois dashboards, somente sobre dados locais e após aplicação das permissões.
- [ ] Mostrar vendas sem horário em grupo separado, com contagem/valor e cobertura. As somas dos horários mais o grupo desconhecido devem coincidir com o total do período. Não representar histórico sem horário como vendas à meia-noite.
- [ ] Completar os horários do histórico em lotes controlados, sem alterar valores, itens, cancelamentos ou checkpoints comerciais. Se a fonte não fornecer histórico, comunicar a cobertura disponível.
- [ ] Validar cancelamentos, vendedor restrito, filiais atribuídas, período, empates de pico, limites das horas, valores exatos e celular; publicar com backup e registrar evidências.

Não foi alterada a sincronização nem feita reimportação nesta preparação. O gráfico depende da validação da fonte para apresentar horários reais.
