import test from 'node:test';import assert from 'node:assert/strict';
import {clientesDaVenda} from '../src/clientes.mjs';
import {carregarImagemProduto} from '../src/detalhes-erp.mjs';
test('Cliente retorna somente nome e telefones, incluindo DDD de contatos e endereços',()=>{
 const result=clientesDaVenda({customers:[{nome:' Cliente Exemplo ',cpf:'IGNORAR',contatos:[{ddd_celular:'11',celular:'99999-0000'}],enderecos:[{ddd:'11',fone:'3333-0000',logradouro:'IGNORAR'},{ddd:'11',fone:'3333-0000'}]}]});
 assert.deepEqual(result,[{nome:'Cliente Exemplo',contatos:[{tipo:'Celular',ddd:'11',telefone:'99999-0000'},{tipo:'Telefone',ddd:'11',telefone:'3333-0000'}]}]);assert.deepEqual(clientesDaVenda({customers:[]}),[]);
});
test('Cliente inválido interrompe a importação, ausência de cliente é explícita',()=>{
 for(const customers of [{},[null],['invalido']])assert.throws(()=>clientesDaVenda({customers}));
 assert.deepEqual(clientesDaVenda({}),[]);
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
