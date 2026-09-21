# Visão das filiais e metas mensais

A tela **Visão das filiais** reúne vendas de várias lojas no período selecionado e acompanha suas metas mensais. Disponível somente para **Admin, Diretoria e Supervisão**. Diretoria e Supervisão enxergam e editam apenas filiais atribuídas ao próprio usuário. Admin acessa todas as filiais autorizadas da empresa.

## Consultar resultados

1. Abra **Visão das filiais**.
2. Escolha o período ou informe as datas e pressione **Aplicar filtros**.
3. Consulte valor de vendas, peças, número de vendas, ranking por valor, participação, total e pendências por filial.

Filiais sem vendas também aparecem. Cancelamentos, inclusive os recebidos separadamente, ficam excluídos. As quantidades e valores vêm do cabeçalho da venda e incluem pendências sinalizadas. Não há chamada ao ERP ao abrir a tela.

**Limitação atual:** “Valor de vendas” usa a mesma base da Visão geral. Ainda não equivale aos campos “Faturamento bruto”, “Devolução” e “Faturamento líquido” do relatório de referência. A regra de devoluções/eventos e de composição bruto/líquido precisa ser validada; entradas de mercadoria não são presumidas como devolução. A pendência permanece em R22.

A cobertura é informada por filial: datas não cobertas pelos checkpoints ou anteriores à primeira operação importada ficam sinalizadas. Cobertura técnica não substitui conferência mensal/anual com o ERP (R11).

## Cadastrar e editar uma meta

No bloco **Metas por filial**, selecione o mês em **Mês da meta**. Pressione **Cadastrar meta** ou **Editar meta** na loja desejada, informe o valor em reais e salve. Exemplo de formato: `200.000,00`. Cadastro e edição são permitidos aos três cargos, dentro do mesmo escopo de filiais.

Os campos identificam filial, competência e valor mensal. A competência selecionada é independente das datas do ranking. A comparação usa todas as vendas já importadas daquele mês, sem dividir a meta por dia nem extrapolar o resultado. Uma consulta diária no ranking não muda a base mensal das metas.

- Atingimento: vendas do mês ÷ meta × 100. Pode ultrapassar 100%; a barra visual fica limitada a 100%.
- Falta: diferença entre meta e vendas, com mínimo zero.
- Meta não cadastrada: aparece como tal, sem ser tratada como meta zero.
- Meta zero: valor explícito; o percentual fica indisponível para evitar divisão por zero.
- Atingimento conjunto: somente vendas das filiais que têm meta cadastrada, dividido pela soma dessas metas. Filiais sem meta não inflam o resultado.

**Remover meta** exige confirmação e preserva histórico. Uma edição feita por outra pessoa impede sobrescrever uma versão antiga: feche e abra novamente a meta para ver o valor atual. Usuários e permissões são conferidos novamente antes da gravação.

O histórico no banco registra responsável, horário, versão anterior/posterior e identificador de requisição. Repetir a mesma solicitação não duplica a alteração. Metas não alteram vendas, estoque ou dados no ERP. Histórico incluído nos backups existentes.

## Permissões e atribuição

Em **Permissões**, os recursos são **Dashboard consolidado** e **Cadastrar metas por filial**. Somente Admin pode configurar cargos. Mesmo que alguém tente conceder esses recursos a Gerentes/Vendas, a API bloqueia o acesso. Perfis limitados às próprias vendas não acessam o consolidado.

Para Diretoria/Supervisão, atribua as lojas em **Usuários**. Neste dashboard, a opção de acesso a todas as filiais para outros recursos não substitui a atribuição explícita. O gestor não vê totais nem metas de lojas fora do próprio escopo.

## Implantação das metas da imagem

Maylon confirmou cadastro das metas da imagem em **setembro de 2026**. Usar a chave exata da filial, sem inferir equivalência entre nomes de lojas. Maylon confirmou OUTLET 729 em AERO-019 (AERO - COMPANY 729) e TIVOLI em AERO-009 (AERO - SBDE). Esses nomes continuam como recebidos do ERP. AERO-019-2 não recebe a meta de OUTLET 729. O estado do cadastro inicial fica registrado na atualização mais recente do planejamento e na evidência de publicação.
