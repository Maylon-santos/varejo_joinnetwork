import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {ambienteFila} from '../fixtures/fila.mjs';
test('tolerância histórica muda só a conferência de valor; quantidades, composição e valores preservados',async()=>{
 const e=await ambienteFila();try{
 const statuses=['divergente','divergente','divergente','quantidade_divergente','contrato_incompleto','regra_pendente','divergente','divergente','divergente','divergente'];
 for(let n=1;n<=10;n++){await e.pool.query("UPDATE operacoes SET conciliacao=$2,valor_final_centavos=$3,subtotal_itens_centavos=100,ajuste_centavos=0,cancelada=$4,quantidade=$5 WHERE filial=$1 AND cod_operacao=10",[n,statuses[n-1],n===2?102:n===3?103:98,n===7,n===8?2:1]);await e.pool.query("INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,quantidade,preco_centavos) VALUES(10,'S',$1,0,1,$2)",[n,n===9?90:100]);}
 await e.pool.query("INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou) VALUES(10,'S',10,now())");
 const snap=async()=>({ops:(await e.pool.query("SELECT (to_jsonb(o)-'conciliacao')::text AS v FROM operacoes o ORDER BY filial,cod_operacao")).rows,itens:(await e.pool.query('SELECT to_jsonb(i)::text AS v FROM operacao_itens i ORDER BY filial,cod_operacao,ordem')).rows});const before=await snap();
 await e.pool.query(await readFile(new URL('../../../database/migrations/tenant/016_tolerancia_conciliacao.sql',import.meta.url),'utf8'));
 assert.deepEqual((await e.pool.query('SELECT conciliacao FROM operacoes WHERE cod_operacao=10 ORDER BY filial')).rows.map(o=>o.conciliacao),['conciliada','conciliada',...statuses.slice(2)]);assert.deepEqual(await snap(),before);
 }finally{await e.close();}
});
