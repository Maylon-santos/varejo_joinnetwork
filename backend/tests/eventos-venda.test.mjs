import test from 'node:test';import assert from 'node:assert/strict';
import {descricaoEvento} from '../src/integracoes/eventos-venda.mjs';
import {permitirPessoas} from '../src/integracoes/projecoes.mjs';

test('descrição do evento usa código confirmado e preserva o texto da origem; ausente/desconhecido é null',()=>{
 assert.equal(descricaoEvento('FR-02'),'VENDA VAREJO CUPOM FISCAL  - FRANQUIA');
 for(const codigo of [null,undefined,10,'DESCONHECIDO','toString','__proto__','FR-02 '])assert.equal(descricaoEvento(codigo),null);
});

test('projeção antiga recebe descrição sem mutação ou alteração da versão; dados pessoais seguem opt-in',()=>{
 const original={data:{id:'vnd_1_S_1',filial_id:'1',cod_operacao:'1',tipo_operacao:'S',evento_codigo:'FR-02',versao:'7',vendedor:{codigo:'42',nome:'Pessoa fictícia'},clientes:[{cliente_codigo:'99',nome:'Cliente fictício'}],cobertura:{pessoas:'disponivel'},itens_url:'/itens',pagamentos_url:'/pagamentos'},itens:[{sku:'A'}],pagamentos:[]};
 const lista=permitirPessoas(original,false,true);assert.equal(lista.data.evento_descricao,descricaoEvento('FR-02'));assert.equal(lista.data.versao,'7');assert.ok(!('nome' in lista.data.vendedor));assert.ok(!('clientes' in lista.data));assert.ok(!('itens_url' in lista.data));
 const detalhe=permitirPessoas(original,true);assert.equal(detalhe.data.clientes[0].cliente_codigo,'99');assert.equal(detalhe.data.vendedor.nome,'Pessoa fictícia');assert.equal(detalhe.data.evento_descricao,lista.data.evento_descricao);
 assert.ok(!('evento_descricao' in original.data));assert.equal(original.data.vendedor.nome,'Pessoa fictícia');
 assert.equal(permitirPessoas({data:{evento_codigo:'DESCONHECIDO',vendedor:{}},itens:[],pagamentos:null},false).data.evento_descricao,null);
});
