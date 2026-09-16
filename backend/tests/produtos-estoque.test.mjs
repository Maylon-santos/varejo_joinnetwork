import test from 'node:test';import assert from 'node:assert/strict';
import {normalizarEstoque,normalizarProduto,consultarEstoque} from '../src/produtos-estoque-erp.mjs';
import {validarPerfil} from '../src/gestao-permissoes.mjs';
const item={filial:1,sku:'CAM-1-P',produto:9,cod_produto:'CAM',desc_produto:'Camiseta',saldo:-2.5,trans_id:20,data_atualizacao:'/Date(1789488000000)/',reservas:50};
const body=value=>({'odata.count':value.length,value});
test('estoque preserva negativos e saldo sem descontar reservas; ausente não vira zero',()=>{
 const [r]=normalizarEstoque(body([item]),'1','19');assert.equal(r.saldo,'-2.5');assert.equal(r.trans_id,'20');assert.ok(!('reservas' in r));assert.equal(normalizarEstoque(body([{...item,saldo:null}]),'1')[0].saldo,null);
});
test('contrato rejeita filial errada, cursor antigo, página incompleta e SKU conflitante',()=>{
 assert.throws(()=>normalizarEstoque(body([item]),'2'),/FILIAL_INESPERADA/);assert.throws(()=>normalizarEstoque(body([item]),'1','21'),/TRANS_ID/);
 assert.throws(()=>normalizarEstoque({...body([item]),'odata.count':2},'1'),/PAGINACAO/);assert.throws(()=>normalizarEstoque({...body([item]),'odata.nextLink':'next'},'1'),/PAGINACAO/);
 assert.throws(()=>normalizarEstoque(body([item,{...item,saldo:2}]),'1'),/DUPLICADO/);assert.equal(normalizarEstoque(body([item,item]),'1').length,1);
 for(const changes of [{trans_id:Number.MAX_SAFE_INTEGER+1},{saldo:'NaN'},{saldo:1e30},{sku:''},{data_atualizacao:'inválida'}])assert.throws(()=>normalizarEstoque(body([{...item,...changes}]),'1'));
});
test('cadastro usa produto interno e conserva somente classificação autorizada',()=>{
 const p=normalizarProduto(body([{produto:9,cod_produto:'CAM',descricao:'Camiseta',trans_id:2,cod_marca:'A',desc_marca:'Exemplo',segredo:'ignorar'}]),'9');assert.deepEqual(p.classificacao.marca,{codigo:'A',descricao:'Exemplo'});assert.ok(!('segredo' in p));assert.throws(()=>normalizarProduto(body([]),'9'));
});
test('consulta envia cursor e filial e recusa redirecionamento',async()=>{
 let url,opt;await consultarEstoque({baseUrl:'https://erp.example/api',token:'teste',filial:'1',cursor:'19',fetchImpl:async(u,o)=>{url=u;opt=o;return new Response(JSON.stringify(body([item])));}});assert.equal(url.searchParams.get('filial'),'1');assert.equal(url.searchParams.get('trans_id'),'19');assert.equal(opt.redirect,'error');
});
test('estoque requer produtos e não concede vendas',()=>{
 const p={nome:'Equipe',permissoes:['estoque:ler'],todas_filiais:false,somente_proprias_vendas:false};assert.throws(()=>validarPerfil('Gerentes',p),/ESTOQUE_REQUER/);p.permissoes.push('produtos:ler');assert.deepEqual(validarPerfil('Gerentes',p).permissoes,p.permissoes);
});
