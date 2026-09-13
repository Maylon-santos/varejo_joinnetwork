import test from 'node:test';import assert from 'node:assert/strict';
import {clientesDaVenda,consultarClienteOperacao,carregarImagemProduto} from '../src/detalhes-erp.mjs';
const op={filial:'1',cod_operacao:'10',tipo_operacao:'S',data_operacao:'2026-09-01'};
test('Cliente retorna somente nome e telefones, incluindo DDD de contatos e endereços',()=>{
 const result=clientesDaVenda({customers:[{nome:' Cliente Exemplo ',cpf:'IGNORAR',contatos:[{ddd_celular:'11',celular:'99999-0000'}],enderecos:[{ddd:'11',fone:'3333-0000',logradouro:'IGNORAR'},{ddd:'11',fone:'3333-0000'}]}]});
 assert.deepEqual(result,[{nome:'Cliente Exemplo',contatos:[{tipo:'Celular',ddd:'11',telefone:'99999-0000'},{tipo:'Telefone',ddd:'11',telefone:'3333-0000'}]}]);assert.deepEqual(clientesDaVenda({customers:[]}),[]);
});
test('Consulta do cliente usa data/filial autorizadas e seleciona a chave composta exata',async()=>{
 const result=await consultarClienteOperacao({baseUrl:'http://erp.example/api',token:'teste',operacao:op,fetchImpl:async(url,opts)=>{assert.equal(url.searchParams.get('data_inicial'),op.data_operacao);assert.equal(url.searchParams.get('filial'),'1');assert.equal(opts.redirect,'error');return new Response(JSON.stringify({'odata.count':2,value:[{filial:2,cod_operacao:10,tipo_operacao:'S',customers:[{nome:'Outro'}]},{filial:1,cod_operacao:10,tipo_operacao:'S',customers:[{nome:'Correto'}]}]}));}});
 assert.equal(result.clientes[0].nome,'Correto');
});
test('Consulta do cliente recusa resposta incompleta e operação não encontrada',async()=>{
 for(const body of [{'odata.count':2,value:[]},{'odata.count':0,value:[]}])await assert.rejects(consultarClienteOperacao({baseUrl:'http://erp.example/api',token:'teste',operacao:op,fetchImpl:async()=>new Response(JSON.stringify(body))}));
});
test('Proxy de imagens recusa hosts locais, portas, credenciais e caminhos não autorizados antes do fetch',async()=>{
 for(const url of ['http://127.0.0.1/a','http://evil.example/a','http://aeropostale1.hospedagemdesites.ws:8080/fotosaero/a','http://user:pass@aeropostale1.hospedagemdesites.ws/fotosaero/a','http://aeropostale1.hospedagemdesites.ws/segredo'])await assert.rejects(carregarImagemProduto(url,{fetchImpl:()=>assert.fail('não deve consultar')}));
});
test('Proxy preserva imagem binária e não segue redirecionamentos',async()=>{
 const result=await carregarImagemProduto('http://aeropostale1.hospedagemdesites.ws/fotosaero/exemplo.jpg',{fetchImpl:async(_url,opts)=>{assert.equal(opts.redirect,'error');return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/jpeg'}});}});
 assert.equal(result.type,'image/jpeg');assert.deepEqual([...result.body],[1,2,3]);
});
test('Proxy recusa HTML, SVG e respostas acima do limite',async()=>{
 for(const headers of [{'content-type':'text/html'},{'content-type':'image/svg+xml'},{'content-type':'image/jpeg','content-length':String(6*1024*1024)}])await assert.rejects(carregarImagemProduto('http://aeropostale1.hospedagemdesites.ws/fotosaero/exemplo.jpg',{fetchImpl:async()=>new Response('nao imagem',{headers})}));
});
