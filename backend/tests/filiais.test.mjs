import test from 'node:test';import assert from 'node:assert/strict';
import {normalizarFiliais,consultarFiliais} from '../src/filiais.mjs';
const row={filial:1,cod_filial:' AERO-009 ',trans_id:10};
const body=value=>({'odata.count':value.length,value});
test('Normaliza cadastro mínimo com precisão e escolhe maior transação por filial',()=>{
 assert.deepEqual(normalizarFiliais(body([row,{...row,cod_filial:'NOVO',trans_id:11}])),[{filial:'1',cod_filial:'NOVO',trans_id:'11'}]);
 assert.equal(normalizarFiliais(body([{...row,trans_id:'999999999999999999'}]))[0].trans_id,'999999999999999999');
 for(const v of [{...row,trans_id:1e18},{...row,cod_filial:''},{...row,filial:-1}])assert.throws(()=>normalizarFiliais(body([v])));
});
test('Recusa paginação incompleta, cursor fora da janela e duplicatas conflitantes',()=>{
 for(const b of [{value:[row]},{'odata.count':2,value:[row]},{...body([row]),'odata.nextLink':'pagina2'},body([row,{...row,cod_filial:'OUTRO'}])])assert.throws(()=>normalizarFiliais(b));
 assert.throws(()=>normalizarFiliais(body([row]),'11'));assert.deepEqual(normalizarFiliais(body([]),'11'),[]);
});
test('Incremental envia trans_id sem filtrar filial e consulta inicial não envia cursor',async()=>{
 for(const cursor of [null,'9']){
  const rows=await consultarFiliais({baseUrl:'http://erp.example/api',token:'teste',cursor,fetchImpl:async(url,opts)=>{
   assert.equal(url.searchParams.get('trans_id'),cursor);assert.equal(url.searchParams.has('filial'),false);assert.equal(opts.redirect,'error');return new Response(JSON.stringify(body([row])));
  }});assert.equal(rows.length,1);
 }
});
