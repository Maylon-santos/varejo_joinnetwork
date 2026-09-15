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

test('Identidade ERP preserva clientes distintos com mesmo nome e telefone',()=>{
 const comum={nome:'Pessoa exemplo',contatos:[{ddd:'11',fone:'33330000'}]};
 const clientes=clientesDaVenda({customers:[{...comum,cliente:123},{...comum,cliente:'124'},{...comum}]});
 assert.equal(clientes[0].cliente_codigo,'123');assert.equal(clientes[1].cliente_codigo,'124');
 assert.equal('cliente_codigo' in clientes[2],false);
 assert.equal(clientesDaVenda({customers:[{cliente:'9007199254740993'}]})[0].cliente_codigo,'9007199254740993');
});
test('Identidade inválida ou número sem precisão não produz vínculo incorreto',()=>{
 for(const cliente of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'','01','123x',true,{},'1'.repeat(31)]){
  assert.throws(()=>clientesDaVenda({customers:[{cliente}]}),/CLIENTE_CODIGO_INVALIDO/);
 }
});

test('Aniversário preserva dia/mês de São Paulo e aceita ausência e ano bissexto',()=>{
 const parse=data_aniversario=>clientesDaVenda({customers:[{cliente:123,data_aniversario}]})[0];
 assert.equal(parse('/Date('+Date.parse('2000-02-29T03:00:00Z')+')/').aniversario_mm_dd,'02-29');
 assert.equal(parse('/Date('+Date.parse('2000-03-01T01:00:00Z')+')/').aniversario_mm_dd,'02-29');
 assert.equal('aniversario_mm_dd' in parse(null),false);
 for(const v of ['invalido','/Date(999999999999999999999)/',{},true])assert.throws(()=>parse(v),/CLIENTE_ANIVERSARIO_INVALIDO/);
 assert.equal('data_aniversario_erp' in parse('/Date(0)/'),false);
});
