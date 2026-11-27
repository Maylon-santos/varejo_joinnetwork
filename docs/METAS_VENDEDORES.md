# Metas mensais por vendedor

Em **Menu → Metas → Por vendedor**, cadastre objetivos individuais para cada **filial + código do vendedor no Millennium + mês**. Nomes são apresentados para consulta; não são usados para identificar ou unificar vendedores. Um mesmo código em lojas diferentes tem metas independentes. O vendedor não precisa ter usuário de acesso ao painel.

## Cadastrar e acompanhar

1. Escolha a loja e o mês. Informe o intervalo de acompanhamento dentro desse mês, por exemplo de 01 a 15. Clique em **Consultar**.
2. Localize o vendedor por nome ou código e clique em **Definir metas**. Para localizar alguém sem vendas no intervalo, marque **Incluir vendedores sem vendas e sem meta no mês**. A lista usa o histórico importado, não um cadastro de funcionários ativos; vendedores sem qualquer operação importada ainda não estão disponíveis.
3. Informe a meta de vendas em reais, PA e/ou ticket médio. Pelo menos uma deve ser preenchida. Campo vazio significa ausência de objetivo; zero é uma meta explícita, sem percentual de atingimento.
4. Em **Informações complementares do mês**, preencha função e admissão se desejar. São referências manuais desse cadastro mensal. A admissão **não é importada da API atual**, não altera o cadastro de funcionários, não filtra o realizado e não calcula proporcionalidade. Admissão, férias e afastamentos exigem ajuste manual da meta, conforme definido.
5. Clique em **Salvar metas**. O objetivo passa a valer imediatamente. **Editar metas** altera os valores; **Remover metas** exige confirmação e preserva o histórico.

A meta continua sendo do mês completo mesmo quando o relatório cobre apenas parte dele. Não há divisão da meta da loja, distribuição entre vendedores, comissão, transferência de histórico entre filiais ou renovação automática. As metas individuais também não alteram nem substituem a meta da loja.

## Indicadores

| Indicador | Cálculo |
| --- | --- |
| Vendas realizadas | Operações de saída não canceladas no intervalo, atribuídas ao código do vendedor e à filial |
| Valor vendido | Soma dos valores dos cabeçalhos dessas operações |
| Peças | Soma das quantidades dos cabeçalhos |
| PA | Peças ÷ número de vendas |
| Ticket médio | Valor vendido ÷ número de vendas |
| Atingimento das vendas | Valor do intervalo ÷ meta mensal em reais × 100 |
| Atingimento de PA | PA do intervalo ÷ meta de PA × 100 |
| Atingimento de ticket | Ticket do intervalo ÷ meta de ticket × 100 |

PA e ticket são calculados pelas somas, sem média de médias. Sem vendas, ambos ficam indisponíveis; a meta permanece visível. O ticket exibido é arredondado para centavos; o atingimento usa a razão original, sem reaplicar o arredondamento. O percentual é truncado em duas casas, como nas metas das lojas, e pode superar 100%.

Os cartões refletem os vendedores exibidos pela busca e pelo filtro de histórico. As colunas distinguem **Peças** e **Vendas**. Aqui, “atendimento” no PA significa operação de venda; não representa os atendimentos registrados na Lista da Vez nem mede conversão de visitantes.

Vendas sem código de vendedor são sinalizadas à parte com quantidade e valor, sem criar um vendedor fictício. Vendas não canceladas com pendências de conferência continuam incluídas e sinalizadas, conforme a regra vigente do painel. Cancelamentos separados também são excluídos. Entradas não são subtraídas como devoluções; bruto/líquido e devoluções continuam dependentes da homologação comercial existente. Não há consulta ao ERP ao abrir o relatório nem promessa de cobertura integral de dados ainda não importados.

## Acesso e histórico

O acesso segue as metas por loja: Admin, Diretoria ou Supervisão com consulta ao consolidado; edição também exige `metas:gerenciar`. Diretoria e Supervisão ficam limitadas às filiais explicitamente atribuídas. Perfis restritos às próprias vendas não acessam esta área nesta entrega. Nenhuma conta, perfil ou vínculo é ampliado automaticamente.

O servidor revalida o acesso antes de gravar e impede sobrescrita de uma versão alterada por outra pessoa. Nesse caso, feche o formulário e abra-o novamente para revisar os valores atualizados. Repetir a mesma solicitação após uma falha de conexão não duplica a alteração. O histórico guarda responsável, horário e estado anterior/posterior de metas, função e admissão. Não há exclusão física de registros ou alteração das vendas.

## Operação

A migration tenant `020_metas_vendedores.sql` adiciona somente as tabelas de metas individuais e histórico. Os backups existentes incluem os novos registros. A API pública de integrações e os webhooks não ganham novos campos ou permissões; nenhum aviso de meta atingida é ativado por esse cadastro. A nova tela usa rotas internas autenticadas do painel.

Validação: [evidência técnica](validacao-metas-vendedores.json). Dados e capturas do exemplo enviado permanecem na preparação privada, fora do Git; os testes usam somente dados sintéticos. Nenhuma meta do exemplo foi importada automaticamente.
