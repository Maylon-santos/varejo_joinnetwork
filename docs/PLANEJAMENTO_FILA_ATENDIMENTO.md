# Fila de atendimento — R16

Atualização: 15/09/2026. Situação: requisitos organizados; implementação e publicação pendentes.

Fonte: descrição adicionada por Maylon em `docs/central/correcoes/correcao.md`, seção “fila de atendimento”. O original foi preservado. Exemplos de outras lojas e opções mencionadas no texto não equivalem a políticas já escolhidas para Aeropostale.

## Objetivo

Criar uma Lista da Vez por empresa, filial e dia: distribuir as oportunidades entre os vendedores presentes, registrar início e resultado dos atendimentos e fornecer um relatório diário. A fila começa uma nova jornada a cada dia, preservando o histórico anterior.

## Decisões confirmadas em 15/09/2026

- Retorno de almoço ou outra pausa: entrar no final da fila.
- Movimento intenso: flexibilizar somente a ordem da vez, mantendo um atendimento aberto por vendedor. A mesma restrição vale para atendimento reservado.

## Fluxo principal

1. O gerente abre a jornada, seleciona os vendedores presentes, ordena a lista e confirma a abertura.
2. O primeiro vendedor disponível inicia a abordagem. Enquanto estiver ocupado, o próximo disponível assume a vez.
3. Se o cliente estiver apenas olhando e o atendimento não começar, registrar o motivo e preservar a prioridade do vendedor.
4. Se o atendimento começar, registrar seu início e acompanhar até a finalização.
5. Ao concluir com venda, registrar o resultado e colocar o vendedor no final da fila.
6. Ao concluir sem venda, exigir o motivo e também colocar o vendedor no final. Exceções por falta de estoque são opções citadas no texto, ainda não adotadas como regra.
7. O gerente fecha a jornada e consulta o relatório. O dia seguinte recebe uma nova lista.

```text
Gerente abre a jornada → confirma presentes e ordem
                                  ↓
                       Próximo vendedor disponível
                                  ↓
                              Abordagem
                 ┌────────────────┴────────────────┐
           Não iniciou                        Em atendimento
         registra motivo                            ↓
         preserva a vez                   Com venda / Sem venda
                 │                         resultado + motivo
                 │                                  ↓
                 └──── próximo disponível ← final da fila

Pausa / Ausência / Atendimento reservado → regras próprias + histórico
Fechamento → relatório diário → nova jornada no dia seguinte
```

## Estados e transições propostas

Separar a situação do vendedor do resultado de cada atendimento evita que “venda realizada” se torne um estado permanente do vendedor.

| Entidade | Estados propostos |
| --- | --- |
| Jornada | Em preparação, aberta, fechada |
| Vendedor na jornada | Disponível, em abordagem/atendimento, em pausa, ausente |
| Atendimento | Em abordagem, iniciado, concluído com venda, concluído sem venda, não iniciado |
| Modalidade | Lista da vez, reservado; movimento intenso como política da jornada |

Propostas técnicas para preservar a ordem:

- Reservar a vez atomicamente no servidor. Duas telas não podem iniciar o mesmo atendimento ou ocupar a mesma vez simultaneamente.
- Guardar a prioridade original durante uma abordagem não iniciada e durante um atendimento reservado. Restaurá-la entre os vendedores disponíveis; isso não interrompe outro atendimento já iniciado.
- Usar horário do servidor e jornada no fuso `America/Sao_Paulo`. A virada do dia não apaga registros nem finaliza automaticamente atendimentos abertos.
- Impedir fechamento silencioso com atendimentos em aberto. O gerente deve resolver as pendências; a política de encerramento excepcional ainda será detalhada.
- Registrar autor, horário, filial, ação e motivo nas alterações. Correções não apagam o histórico.

## Situações especiais

| Situação | Tratamento previsto | Definição |
| --- | --- | --- |
| Almoço/pausa | Gerente registra a pausa; vendedor fica fora da distribuição | Retorno ao final da fila: confirmado por Maylon em 15/09 |
| Cliente procura vendedor específico | Atendimento reservado, preservando prioridade na fila geral | Regra descrita no material |
| Vendedor reservado já está ocupado | Não interromper outro cliente nem criar simultaneidade implicitamente | Aguardar disponibilidade; não abrir outro atendimento enquanto ocupado |
| Movimento intenso | Flexibilizar a ordem da vez, com ativação e encerramento registrados pelo responsável | Somente flexibilizar a ordem; um atendimento aberto por vendedor, confirmado em 15/09 |
| Ausência | Retirar da distribuição do dia e manter o registro | Regra descrita no material |
| Chegada após abertura | Inserir no final da fila | Regra descrita no material |
| Falta de estoque | Registrar como motivo de não conversão | Preservar a vez nesse caso é alternativa ainda não escolhida |
| Ordem inicial | Gerente define e confirma a ordem manualmente | Sorteio e rodízio podem ser acrescentados sem bloquear a primeira entrega |

Não aplicar penalidades nem alterar comissão automaticamente a partir das observações exemplificadas no material.

## Acesso por cargo e filial

Usar o gerenciador de permissões existente, com recursos próprios para consultar a fila, operar atendimentos e gerenciar a jornada/consultar relatórios. A matriz abaixo é uma proposta de capacidades, não uma concessão automática a todos os gerentes.

| Capacidade | Escopo proposto |
| --- | --- |
| Consultar a vez | Ver ordem e disponibilidade da equipe na filial autorizada, sem revelar vendas ou dados dos clientes dos colegas |
| Operar atendimento | Vendedor atua somente nos atendimentos vinculados ao seu código nessa filial |
| Gerenciar jornada | Quem tiver a permissão pode definir ordem, presença, pausa e fechamento na filial autorizada |
| Consultar relatório | Recurso específico; vendedor continua restrito aos próprios resultados |
| Configurar permissões | Continua exclusivo de Admin, conforme sistema atual |

Ver a posição dos colegas na fila não libera acesso às vendas ou aos clientes deles. O backend deve verificar filial, cargo/permissões e vínculo do vendedor a cada ação.

## Venda informada e venda confirmada

O material menciona encerramento manual pelo vendedor e encerramento na emissão da venda pelo PDV. Esses eventos precisam ser separados:

- **Resultado informado:** vendedor concluiu o atendimento dizendo que houve venda.
- **Venda confirmada:** atendimento foi vinculado a uma operação importada do ERP e validada na mesma filial/vendedor.
- **Fim do atendimento:** horário da conclusão registrada no painel.
- **Horário da venda:** horário de emissão do ERP, quando disponível e confirmado pelo contrato da API.

O código do vendedor sozinho não identifica qual venda pertence a qual atendimento. A integração precisa da chave da operação (`filial`, `tipo_operacao`, `cod_operacao`) e de uma associação explícita. Não associar automaticamente apenas por nome, horário próximo ou vendedor, nem vincular a mesma venda a vários atendimentos sem regra definida.

Proposta de primeira entrega: conclusão manual com resultado informado claramente identificado. A confirmação no ERP entra na etapa de integração; o painel não escreve vendas, comissão ou estoque no ERP.

## Relatório e cálculo dos tempos

| Medida | Regra proposta |
| --- | --- |
| Atendimentos iniciados | Contagem de inícios efetivamente registrados, separada das abordagens não iniciadas |
| Concluídos | Atendimentos finalizados com ou sem venda |
| Conversão informada | Concluídos com venda informada / total concluído; excluir não iniciados e abertos. Denominador zero resulta em “sem dados” |
| Vendas confirmadas | Contagem separada, dependente do vínculo com o ERP |
| Tempo de atendimento | Conclusão menos início efetivo; abordagem anterior não é atendimento |
| Tempo médio | Média dos tempos dos concluídos; mostrar quantidade e pendências. Média geral ponderada pelos atendimentos, não média simples das médias por vendedor |
| Tempo disponível sem atendimento | Somar apenas intervalos disponíveis com jornada aberta; excluir pausas, ausência e períodos ocupados |
| Motivos de não conversão | Preço, tamanho indisponível, pesquisa, estilo, concorrente e outros com descrição; catálogo inicial revisável |
| Espera do cliente | Exige registro de chegada; não inferir pela posição do vendedor ou por horário de venda |
| Tempo até a venda | Depende de início e horário de emissão confirmado no ERP |

No movimento intenso, continua permitido apenas um atendimento aberto por vendedor. A liberação de ordem não autoriza simultaneidade. Não usar duração isolada para classificar desempenho ou calcular remuneração.

## Entregas e dependências

### R16.1 — Jornada e Lista da Vez

- [ ] Banco, permissões e histórico de ações por empresa/filial/dia.
- [ ] Abertura manual, presença, ordem inicial e chegada tardia.
- [ ] Abordagem, não iniciado com preservação de prioridade, início e conclusão com/sem venda.
- [ ] Motivo obrigatório quando aplicável e retorno ao final após atendimento.
- [ ] Pausa/retorno conforme política escolhida e atendimento reservado.
- [ ] Tela de operação no desktop/celular e indicação do próximo disponível.
- [ ] Fechamento com tratamento de atendimentos abertos.

### R16.2 — Relatórios e exceções

- [ ] Relatório diário, tempos, resultados informados e motivos de perda.
- [ ] Movimento intenso sem simultaneidade; registro da ativação e retorno à regra normal.
- [ ] Ajustes gerenciais auditados e tratamento das exceções de encerramento.

### R16.3 — Integração e automações

- [ ] Associação explícita a venda importada e distinção de resultado confirmado.
- [ ] Validar se o contrato ERP oferece o horário necessário; não usar horário da sincronização como horário da venda.
- [ ] Avaliar sorteio/rodízio inicial e políticas adicionais por empresa.
- [ ] Notificações e alertas por duração: R17; definir canal e limiar, sem presumir que rádio/tablet já estão integrados.
- [ ] Consulta de estoque: R19; depende do contrato e atualização do estoque.
- [ ] Registro de chegada e espera: detalhar fluxo próprio. Sensores, câmeras e totens citados são alternativas futuras, não integrações existentes.

## Critérios de aceite

- [ ] Duas pessoas acionando a vez ao mesmo tempo não criam distribuição duplicada.
- [ ] Repetir uma requisição não conclui atendimento nem move vendedor duas vezes.
- [ ] “Só olhando” preserva a prioridade; atendimento concluído sem venda consome a vez.
- [ ] Pausa, ausência e reservado respeitam a política escolhida e a disponibilidade.
- [ ] Restrições de filial/vendedor e permissões são verificadas também pela API.
- [ ] Histórico sobrevive a recarga, encerramento de sessão e mudança de dia.
- [ ] Relatório distingue abertos, não iniciados, concluídos e vendas confirmadas.
- [ ] Publicação com backup e validação em desktop/celular.

Nenhum item de implementação foi marcado como concluído apenas por estar descrito neste planejamento.
