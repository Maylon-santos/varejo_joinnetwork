# Reprocessar uma venda corrigida no ERP

Disponível somente para quem entra com o cargo **Admin**.

1. Corrija e salve a venda no ERP.
2. No painel, abra **Conferência**, selecione a filial e o período da venda e aplique os filtros.
3. Localize a operação e pressione **Reprocessar venda**. O botão também aparece em **Ver detalhes**.
4. Confirme a solicitação. Aguarde a indicação de conclusão; a tela acompanha o resultado automaticamente.

O filtro **Todas as pendências** reúne diferenças de quantidade, valor e dados incompletos. Para vendas anteriormente aceitas como erro do ERP, selecione **Erro ERP · Cabeçalho validado**.

## Resultado

- **Aguardando na fila:** solicitação salva. Pode fechar a tela; o processamento continua no servidor.
- **Consultando novamente o ERP:** worker buscando a versão atual.
- **Reprocessada e conciliada:** a versão recebida passou na conferência e sai da lista de pendências.
- **Reprocessada; confira a situação atual:** a consulta terminou, mas o conteúdo recebido ainda apresenta uma pendência.
- **Falha ao reprocessar:** os dados anteriores foram preservados. Tente novamente após pelo menos um minuto da solicitação; persistindo, peça a análise da integração.

É processada uma solicitação por rodada do worker. O tempo depende das outras sincronizações e da resposta do ERP. Não há necessidade de repetir cliques enquanto estiver aguardando.

## Regras da atualização

A consulta usa a filial e a data atualmente salvas da venda na rota LISTAVENDAS. Apenas a operação selecionada é atualizada; outras vendas retornadas na consulta não são gravadas por esse pedido. Se a data foi alterada no ERP e a venda não aparece no dia original, o processo informa falha e exige investigação.

A conferência aceita diferença absoluta de até **R$ 0,02 por venda**, em ambos os sentidos, entre soma dos itens mais ajuste e total informado. Diferença de R$ 0,03 ou mais permanece pendente. Quantidade divergente, composição não homologada e dados incompletos continuam pendentes. Valores originais são preservados; a tolerância altera somente a classificação. A regra vale para novas importações, reprocessamentos e divergências de valor já armazenadas com composição/quantidade verificadas. O painel não escreve no ERP, não força conciliação, não reativa cancelamentos nem altera os cursores da sincronização. Guarda responsável, horário e versões anterior/posterior da operação e dos itens na auditoria do banco, incluída nos backups. A marca anterior de erro do ERP aceito é removida após uma atualização bem-sucedida e permanece no histórico.

Pedidos simultâneos para a mesma venda compartilham o processamento em andamento. Uma falha de gravação desfaz toda a alteração. Solicitação interrompida por reinício do worker pode ser retomada.

## Verificação

Testes de integração em schemas isolados cobrem autorização, isolamento, idempotência, atualização de uma única venda, falhas do ERP/banco, concorrência, retomada, cancelamentos, precisão monetária e filtros. `scripts/verificar-reprocessamento-ui.mjs` exercita confirmação, fila e resultado no computador/celular. A verificação pública é somente leitura; nenhuma venda real é reprocessada pelos testes de publicação.
