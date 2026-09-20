-- Tolerância autorizada de até dois centavos por venda, em ambos os sentidos.
-- Altera somente o estado; preserva valores, itens, histórico e checkpoints.
UPDATE operacoes o SET conciliacao='conciliada'
WHERE o.tipo_operacao='S' AND NOT o.cancelada AND o.conciliacao='divergente'
 AND NOT EXISTS(SELECT 1 FROM cancelamentos c WHERE c.filial=o.filial AND c.tipo_operacao=o.tipo_operacao AND c.cod_operacao=o.cod_operacao)
 AND abs(o.subtotal_itens_centavos::numeric+o.ajuste_centavos::numeric-o.valor_final_centavos::numeric)<=2
 AND o.quantidade=(SELECT sum(i.quantidade) FROM operacao_itens i WHERE i.filial=o.filial AND i.tipo_operacao=o.tipo_operacao AND i.cod_operacao=o.cod_operacao)
 AND o.subtotal_itens_centavos=(SELECT sum(i.quantidade::numeric*i.preco_centavos::numeric) FROM operacao_itens i WHERE i.filial=o.filial AND i.tipo_operacao=o.tipo_operacao AND i.cod_operacao=o.cod_operacao);
