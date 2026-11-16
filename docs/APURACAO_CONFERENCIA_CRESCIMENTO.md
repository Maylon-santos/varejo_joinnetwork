# Apuração de conferência do crescimento anual

Consulta realizada em 16/11/2026, sem alterações de dados comerciais, status ou checkpoints. O resumo de pendências e os parágrafos de metodologia foram retirados do dashboard a pedido do responsável. A API interna mantém os metadados e a tela Conferência continua disponível.

## Resultado da conferência

O número apresentado depende do ano, corte de data e filial. No acumulado de 01/01 a 16/11 de 2025 versus 2026, tanto Itupeva quanto Imigrantes possuem 29 pendências: em cada filial, 17 de regra de cortesia e 12 de quantidade. Foram realizadas 46 consultas diárias ao ERP, uma filial por vez. As 58 operações retornaram com os mesmos cabeçalhos, totais de itens, ajuste, frete e cortesia gravados no banco.

Nas 34 operações de regra pendente, a cortesia é negativa e a igualdade `valor final = soma dos itens + ajuste + cortesia` fecha exatamente. Esse resultado é uma fórmula candidata, sem homologação comercial. Nas outras 24 operações, a soma das quantidades dos itens supera a quantidade do cabeçalho. Não há itens de preço zero nesses casos, e o cabeçalho também não coincide com a contagem de linhas; essas hipóteses não explicam a diferença. Uma nova importação das mesmas respostas não resolveria essas situações.

No histórico completo das filiais configuradas foram identificadas 17.787 pendências de conciliação: 17.515 de regra, 271 de quantidade e uma de valor. O comparativo atual de todas as filiais contém 6.309. Esses totais são de conciliação e não correspondem às pendências fiscais, cadastrais ou de parcelas da carga histórica. A confirmação no ERP ficou limitada às 58 operações das duas filiais; não extrapolar esse resultado para todo o histórico.

## Próximo tratamento

1. Validar com o responsável pelo ERP a definição do campo `cortesia`, o sinal e a fórmula de composição do valor final; confrontar documentos originais antes de implementar a fórmula candidata.
2. Conferir documentos e itens das diferenças de quantidade para distinguir kits, brindes ou inconsistências do cabeçalho.
3. Após comprovar a regra ou corrigir a origem, reprocessar com auditoria. Não aumentar tolerância, marcar como conciliada ou confirmar erro de ERP apenas para remover a pendência.

A relação individual, dados comerciais e CSV permanecem na pasta privada `artifacts/apuracao-crescimento/`, fora do Git e da documentação pública. [Evidência agregada](validacao-limpeza-crescimento-apuracao.json).
