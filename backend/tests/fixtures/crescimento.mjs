export async function dadosCrescimento(e){
 await e.pool.query('DELETE FROM operacoes');
 await e.pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,conciliacao) VALUES
 (1,'S',1,'2024-01-10',2,10000,false,'conciliada'),
 (2,'S',1,'2025-01-10',3,15000,false,'conciliada'),
 (3,'S',1,'2026-01-10',4,30000,false,'divergente'),
 (4,'S',2,'2025-02-10',3,20000,false,'conciliada'),
 (5,'S',2,'2026-02-10',1,10000,false,'conciliada'),
 (6,'S',3,'2026-03-10',2,8000,false,'conciliada'),
 (7,'S',4,'2025-04-10',2,5000,false,'conciliada'),
 (8,'S',1,'2025-12-20',1,50000,false,'conciliada'),
 (9,'S',1,'2026-12-20',1,990000,false,'conciliada'),
 (10,'S',1,'2026-01-10',1,990000,true,'conciliada'),
 (11,'S',1,'2026-01-10',1,990000,false,'conciliada'),
 (12,'E',1,'2026-01-10',1,990000,false,'nao_elegivel')`);
 await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(11,'S',1,now())");
 await e.pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) SELECT f,r,'2026-11-16'::date FROM generate_series(1,10) f CROSS JOIN unnest(ARRAY['vendas','cancelamentos']) r ON CONFLICT(filial,recurso) DO UPDATE SET ate=EXCLUDED.ate");
 await e.pool.query("UPDATE cadastro_filiais SET cod_filial='LOJA-'||filial::text,fantasia='FILIAL EXEMPLO '||filial::text");
}
