SELECT json_build_object(
 'operacoes',(SELECT count(*) FROM operacoes),
 'itens',(SELECT count(*) FROM operacao_itens),
 'cancelamentos',(SELECT count(*) FROM cancelamentos),
 'erros_confirmados',(SELECT count(*) FROM operacoes WHERE erro_erp_confirmado_por IS NOT NULL),
 'total_centavos',(SELECT sum(valor_final_centavos)::text FROM operacoes),
 'operacoes_hash',(SELECT md5(string_agg(md5(row_to_json(o)::text),'' ORDER BY cod_operacao,tipo_operacao,filial)) FROM operacoes o),
 'itens_hash',(SELECT md5(string_agg(md5(row_to_json(i)::text),'' ORDER BY cod_operacao,tipo_operacao,filial,ordem)) FROM operacao_itens i),
 'cancelamentos_hash',(SELECT md5(string_agg(md5(row_to_json(c)::text),'' ORDER BY cod_operacao,tipo_operacao,filial)) FROM cancelamentos c),
 'checkpoints',(SELECT json_agg(c ORDER BY filial,recurso) FROM sync_checkpoints c),
 'tenant',(SELECT tenant_key FROM tenant_identity WHERE singleton)
);
