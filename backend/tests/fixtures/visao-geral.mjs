export const fotoTeste={type:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')};
export async function semearVisaoGeral(e){
 await e.pool.query('DELETE FROM operacoes');
 await e.pool.query("UPDATE cadastro_filiais SET cod_filial='AERO-015',fantasia='AERO BRASILIA' WHERE filial=1");
 await e.pool.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada,vendedor_codigo,vendedor_nome,complementos) VALUES
 (100,'S',1,'2026-09-01',30,30000,false,'10','Ana Exemplo','{"codigo_condicaopgto":"A","desc_condicoes_pgto":"Cartão"}'),
 (200,'S',1,'2026-09-02',3,12000,false,'20','Bruno Exemplo','{"codigo_condicaopgto":"B","desc_condicoes_pgto":"Cartão"}'),
 (300,'S',1,'2026-09-02',99,99900,true,'20','Bruno Exemplo',NULL),
 (400,'S',1,'2026-09-02',99,99900,false,'10','Ana Exemplo',NULL),
 (500,'E',1,'2026-09-02',99,99900,false,'10','Ana Exemplo',NULL),
 (600,'S',1,'2026-01-10',1,1000,false,'10','Ana Exemplo',NULL),
 (700,'S',2,'2026-09-02',99,99900,false,'20','Segredo filial 2',NULL)`);
 await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(400,'S',1,now())");
 const photo='https://aeropostale1.hospedagemdesites.ws/fotosaero/teste.png';
 for(let i=1;i<=22;i++)await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url) VALUES(100,'S',1,$1,$2,$3,$4,$5,CASE WHEN $3='P22' THEN 50000 ELSE 1000 END,$6)",[i,'SKU-'+i,'P'+String(i).padStart(2,'0'),'Produto exemplo '+i,i===1?3:1,i===2?null:i===3?photo.replace('teste.png','ausente.png'):photo]);
 await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url) VALUES(100,'S',1,23,'SKU-1-M','P01','Produto exemplo 1',2,1000,$1),(200,'S',1,1,'SKU-1-G','P01','Produto exemplo 1',4,1000,$1),(200,'S',1,2,'SKU-2','P02','Produto exemplo 2',8,1000,NULL),(600,'S',1,1,'SKU-1-P','P01','Produto exemplo 1',1,1000,$1),(300,'S',1,1,'SEGREDO','SEGREDO','Cancelada',99,1000,$1),(400,'S',1,1,'SEGREDO','SEGREDO','Cancelada tardia',99,1000,$1),(500,'E',1,1,'SEGREDO','SEGREDO','Entrada',99,1000,$1),(700,'S',2,1,'SEGREDO','SEGREDO','Outra filial',99,1000,$1)",[photo]);
 await e.pool.query(`INSERT INTO cadastro_produtos(produto,cod_produto,descricao,classificacao) VALUES(1,'P01','Produto 1','{"marca":{"codigo":"A","descricao":"Marca A"},"categoria":{"codigo":"T","descricao":"Têxtil"}}'),(2,'P02','Produto 2','{"marca":{"codigo":"B","descricao":"Marca B"}}'),(3,'P03','Produto 3','{}')`);
 await e.pool.query("INSERT INTO estoque_atual(filial,sku,produto,saldo,trans_id,presente_ultima_carga) VALUES(1,'SKU1',1,5,1,true),(1,'SKU2',1,-2,1,true),(1,'SKU3',2,NULL,1,true),(1,'SKU4',3,9,1,false)");
 await e.pool.query('INSERT INTO sync_estoques(filial,ultimo_sucesso) VALUES(1,now())');
 await e.pool.query("INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES(1,'vendas','2026-09-16'),(1,'cancelamentos','2026-09-16')");
 await e.control.query("UPDATE access_roles SET permissoes=permissoes||'[\"produtos:ler\",\"vendas:ler\",\"indicadores:ler\",\"ranking:ler\",\"imagens:ler\"]'::jsonb WHERE tenant_key='teste' AND role='Vendas'");
 await e.control.query("DELETE FROM user_branches WHERE filial<>1 AND user_id IN (SELECT id FROM admin_users WHERE role='Vendas')");
}
