import test from 'node:test';import assert from 'node:assert/strict';
import {ambienteFila} from '../fixtures/fila.mjs';import {sincronizarEstoque,enriquecerProdutos} from '../../src/sincronizar-estoque.mjs';
const row=(sku,saldo='3',trans_id='20')=>({filial:'1',sku,produto:'9',cod_produto:'CAM',descricao:'Camiseta exemplo',cor:'AZ',tamanho:'P',barra:'123',saldo,trans_id,data_atualizacao_erp:'2026-09-15T10:00:00Z'});
const api=async(e,path,role='admin')=>{const r=await fetch(e.base+'/api/v1'+path,{headers:{Authorization:'Bearer '+e.tokens[role]}});return {status:r.status,data:await r.json()};};
test('estoque: cursor por filial, sobreposição, atomicidade, reprocessamento, negativos, carga completa e isolamento',async()=>{
 const e=await ambienteFila();try{
  const sync=(rows,extra={})=>sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',forcar:true,consultar:async()=>rows,...extra});
  assert.equal((await sync([row('A'),row('B','-2')])).cursor,'20');
  assert.equal((await sync([row('A')],{forcar:false})).aguardando,true);
  let recebido;await sync([row('A','4','25')],{consultar:async p=>{recebido=p;return [row('A','4','25')];}});assert.equal(recebido.cursor,'19');
  await sync([row('A','4','25')]);assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM estoque_historico')).rows[0].n,3);
  await assert.rejects(sync([...Array.from({length:500},(_,i)=>row('C'+i,'1','30')),row('A','7','25')]),/TRANSACAO_DIVERGENTE/);
  assert.equal((await e.pool.query('SELECT cursor::text FROM sync_estoques WHERE filial=1')).rows[0].cursor,'25');assert.equal((await e.pool.query("SELECT 1 FROM estoque_atual WHERE sku LIKE 'C%'")).rowCount,0);
  await assert.rejects(sync([{...row('X'),filial:'2'}]),/ESCOPO_INVALIDO/);await assert.rejects(sync([],{tenant:'outro'}),/TENANT_INCORRETO/);
  await e.pool.query("UPDATE sync_estoques SET ultima_carga_completa=now()-interval '2 days' WHERE filial=1");await sync([row('A','4','25')]);
  const d=(await api(e,'/produtos?filial=1')).data;assert.equal(d.total,1);assert.ok(!d.produtos.some(p=>p.sku==='B'));assert.equal((await api(e,'/produtos?filial=1&saldo=desconhecido')).data.total,0);
  assert.equal((await api(e,'/produtos?filial=2')).data.total,0);assert.equal((await api(e,'/produtos?filial=999')).status,403);
  assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM sync_checkpoints')).rows[0].n,0);
 }finally{await e.close();}
});
test('catálogo: enriquecimento limitado, retentativa e permissão independente de saldo',async()=>{
 const e=await ambienteFila();try{
  await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>[row('A','-2')]});
  await enriquecerProdutos({pool:e.pool,tenant:'teste',consultar:async()=>{throw Error('ERP_HTTP_503');}});
  assert.equal((await e.pool.query('SELECT falhas_consecutivas FROM cadastro_produtos')).rows[0].falhas_consecutivas,1);
  let called=false;await enriquecerProdutos({pool:e.pool,tenant:'teste',consultar:async()=>{called=true;}});assert.equal(called,false);
  await e.pool.query('UPDATE cadastro_produtos SET proxima_tentativa=now()');
  await enriquecerProdutos({pool:e.pool,tenant:'teste',consultar:async()=>({produto:'9',cod_produto:'CAM',descricao:'Camiseta atualizada',trans_id:'33',classificacao:{marca:{codigo:'A',descricao:'Exemplo'}}})});
  assert.equal((await api(e,'/produtos?filial=1&saldo=negativo')).data.total,1);
  assert.equal((await api(e,'/produtos?filial=1','leitor')).status,403);
  await e.control.query("UPDATE access_roles SET permissoes='[\"produtos:ler\"]' WHERE role='Gerentes' AND tenant_key='teste'");
  const r=await api(e,'/produtos?filial=1','leitor');assert.equal(r.status,200);assert.equal(r.data.produtos[0].descricao,'Camiseta atualizada');assert.ok(!('saldo' in r.data.produtos[0]));assert.equal((await api(e,'/produtos?filial=1&saldo=negativo','leitor')).status,403);
  assert.equal((await api(e,'/produtos/indicadores?filial=1&inicio='+e.dia+'&fim='+e.dia,'leitor')).status,403);
  assert.equal((await api(e,'/produtos?filial=1&filial=2')).status,400);assert.equal((await api(e,'/produtos?filial=1&inicio=2026-01-01')).status,400);
 }finally{await e.close();}
});
test('indicadores: percentual ponderado com cobertura, preço não descontado duas vezes, cancelamentos e escopo do vendedor',async()=>{
 const e=await ambienteFila();try{
  await e.pool.query('UPDATE operacoes SET data_operacao=$1',[e.dia]);
  await e.pool.query(`INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,desconto_informado) VALUES
   (10,'S',1,1,'CAM-P','CAM','Camiseta',2,8000,20),(10,'S',1,2,'CAM-P','CAM','Camiseta',1,7000,NULL),
   (20,'S',1,1,'CAM-P','CAM','Camiseta',1,9000,0),(30,'S',1,1,'OUTRO','OUTRO','Cancelado',50,10000,50),
   (10,'S',2,1,'SECRETO','SECRETO','Outra filial',99,10000,10)`);
  await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(30,'S',1,now())");
  const path='/produtos/indicadores?filial=1&inicio='+e.dia+'&fim='+e.dia;
  const d=(await api(e,path)).data;assert.equal(d.total,1);assert.equal(d.pecas,'4');assert.equal(d.subtotal_centavos,'32000');assert.equal(d.pecas_com_desconto,'3');assert.equal(d.produtos[0].desconto_medio_percentual,'13.3333');
  await e.control.query("UPDATE access_roles SET permissoes=permissoes||'[\"produtos:ler\",\"vendas:ler\"]'::jsonb WHERE role='Vendas' AND tenant_key='teste'");
  const v=(await api(e,path,'vendas')).data;assert.equal(v.pecas,'3');assert.equal(v.subtotal_centavos,'23000');assert.equal(v.produtos[0].desconto_medio_percentual,'20.0000');assert.equal(v.produtos[0].vendas,1);
  assert.equal((await api(e,path+'&busca=OUTRO')).data.total,0);assert.equal((await api(e,path+'&pagina=2')).data.produtos.length,0);
 }finally{await e.close();}
});

test('recarga completa remove ausentes da apresentação sem apagar histórico e falha mantém posição anterior',async()=>{
 const e=await ambienteFila();try{
 const sync=(rows,extra={})=>sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',forcar:true,consultar:async()=>rows,...extra});
 await sync([row('ACABADO'),{...row('CONSUMO'),produto:'19',cod_produto:'CONSUMO',descricao:'Material de consumo'}]);
 const antes=(await e.pool.query('SELECT count(*)::int AS n FROM estoque_historico')).rows[0].n;
 await assert.rejects(sync([],{cargaCompleta:true,consultar:async()=>{throw Error('ERP_HTTP_503');}}));assert.equal((await api(e,'/produtos?filial=1')).data.total,2);
 let cursor;await sync([row('ACABADO')],{cargaCompleta:true,consultar:async p=>{cursor=p.cursor;return [row('ACABADO')];}});assert.equal(cursor,'0');
 const d=(await api(e,'/produtos?filial=1')).data;assert.equal(d.total,1);assert.equal(d.produtos[0].sku,'ACABADO');assert.equal((await api(e,'/produtos?filial=1&busca=CONSUMO')).data.total,0);
 const summary=(await api(e,'/produtos/resumo-estoque?filial=1')).data;assert.equal(summary.grupos.marca.reduce((a,g)=>a+g.skus,0),1);
 assert.equal((await e.pool.query('SELECT count(*)::int AS n FROM estoque_historico')).rows[0].n,antes);assert.equal((await e.pool.query('SELECT cursor::text FROM sync_estoques WHERE filial=1')).rows[0].cursor,'20');
 const ids=[];await enriquecerProdutos({pool:e.pool,tenant:'teste',consultar:async({produto})=>{ids.push(produto);return {produto,cod_produto:'CAM',descricao:'Camiseta',trans_id:'30',classificacao:{}};}});assert.deepEqual(ids,['9']);
 // Saldo desconhecido de um SKU ainda retornado continua visível.
 await sync([row('ACABADO',null,'21')]);assert.equal((await api(e,'/produtos?filial=1&saldo=desconhecido')).data.total,1);
 }finally{await e.close();}
});
test('fotos do catálogo respeitam filial, produto, vendedor e permissão de imagens',async()=>{
 const e=await ambienteFila();try{
 await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>[row('CAM-P')]});
 await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url) VALUES(20,'S',1,1,'CAM-P','CAM','Camiseta',1,1000,'https://aeropostale1.hospedagemdesites.ws/fotosaero/teste.jpg')");
 assert.equal((await api(e,'/produtos?filial=1')).data.produtos[0].imagem.cod_operacao,'20');
 await e.control.query("UPDATE access_roles SET permissoes=permissoes||'[\"produtos:ler\",\"vendas:ler\",\"imagens:ler\"]'::jsonb WHERE role='Vendas' AND tenant_key='teste'");
 assert.equal((await api(e,'/produtos?filial=1','vendas')).data.produtos[0].imagem,null);
 await e.pool.query("UPDATE operacao_itens SET cod_operacao=10 WHERE cod_operacao=20 AND filial=1");assert.equal((await api(e,'/produtos?filial=1','vendas')).data.produtos[0].imagem.cod_operacao,'10');
 await e.control.query("UPDATE access_roles SET permissoes=permissoes-'imagens:ler' WHERE role='Vendas' AND tenant_key='teste'");assert.equal((await api(e,'/produtos?filial=1','vendas')).data.produtos[0].imagem,null);
 }finally{await e.close();}
});

test('tipo retornado pelo ERP: filtro local e total de toda a filial independentes de página/busca/saldo, desconhecidos e permissões',async()=>{
 const e=await ambienteFila();try{
  const rows=[...Array.from({length:35},(_,i)=>({...row('AC'+i,'2'),tipo_prod:'AC'})),{...row('NEG','-3'),tipo_prod:'AC'},{...row('NULL',null),tipo_prod:'AC'},{...row('BOBINA','100'),tipo_prod:'MC'},row('SEM','5')];
  await sincronizarEstoque({pool:e.pool,tenant:'teste',filial:'1',consultar:async()=>rows});
  const d=(await api(e,'/produtos?filial=1&tipo_prod=AC')).data;assert.equal(d.total,37);assert.equal(d.produtos.length,30);assert.equal(Number(d.resumo_estoque.saldo_disponivel),67);assert.equal(d.resumo_estoque.sem_saldo,1);assert.equal(d.skus_sem_tipo,1);
  const second=(await api(e,'/produtos?filial=1&tipo_prod=AC&pagina=2')).data;assert.deepEqual(second.resumo_estoque,d.resumo_estoque);
  const busca=(await api(e,'/produtos?filial=1&tipo_prod=AC&busca=NEG&saldo=negativo')).data;assert.equal(busca.total,1);assert.deepEqual(busca.resumo_estoque,d.resumo_estoque);
  assert.equal((await api(e,'/produtos?filial=1&tipo_prod=MC')).data.total,1);assert.equal((await api(e,'/produtos?filial=1&tipo_prod=desconhecido')).data.total,1);assert.equal((await api(e,'/produtos?filial=1&tipo_prod=SE')).data.total,0);assert.equal((await api(e,'/produtos?filial=1&tipo_prod=INVALIDO')).status,400);
  assert.equal((await api(e,'/produtos?filial=2&tipo_prod=AC')).data.total,0);
  await e.control.query("UPDATE access_roles SET permissoes='[\"produtos:ler\"]' WHERE role='Gerentes' AND tenant_key='teste'");
  assert.equal((await api(e,'/produtos?filial=1&tipo_prod=AC','leitor')).data.resumo_estoque,null);
 }finally{await e.close();}
});
