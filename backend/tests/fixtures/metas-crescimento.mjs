// Somente dados sintéticos. Novembro/dezembro completos; janeiro parcial; fevereiro sem vendas.
export async function dadosMetasCrescimento(e){
 await e.pool.query('DELETE FROM operacoes');
 await e.pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,conciliacao) VALUES
 (1,'S',1,'2025-01-01',1,100,false,'conciliada'),
 (2,'S',1,'2025-11-10',10,1000000,false,'conciliada'),(3,'S',1,'2025-11-20',2,10000,false,'divergente'),
 (4,'S',1,'2025-11-21',20,9000000,true,'conciliada'),(5,'S',1,'2025-11-22',20,9000000,false,'conciliada'),
 (6,'E',1,'2025-11-23',20,9000000,false,'nao_elegivel'),
 (7,'S',1,'2025-12-05',10,2000000,false,'conciliada'),(8,'S',1,'2026-01-10',5,3000000,false,'conciliada'),
 (9,'S',2,'2025-01-01',1,100,false,'conciliada'),(10,'S',2,'2025-11-10',1,1000000,false,'conciliada')`);
 await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(5,'S',1,now())");
 await e.pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) SELECT f,r,'2025-12-31'::date FROM unnest(ARRAY[1,2]) f CROSS JOIN unnest(ARRAY['vendas','cancelamentos']) r");
 await e.pool.query("INSERT INTO metas_filiais(filial,competencia,valor_centavos,versao,atualizado_por) VALUES(1,'2026-12-01',2500000,1,$1)",[e.usuarios.admin]);
}
