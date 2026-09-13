import {test} from 'node:test';
import assert from 'node:assert/strict';
import {imagemProduto} from '../src/vendas.mjs';
test('Imagens aceitam somente HTTP(S) sem credenciais e usam alternativa válida',()=>{
 assert.equal(imagemProduto({imagem_01:'javascript:alert(1)',imagem_02:'https://example.com/a.jpg'}),'https://example.com/a.jpg');
 assert.equal(imagemProduto({imagem_01:'https://user:pass@example.com/a'}),null);
 assert.equal(imagemProduto({}),null);
});
