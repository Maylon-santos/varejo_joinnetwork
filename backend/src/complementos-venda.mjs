import {centavos} from './reconciliar-venda.mjs';
const texto=v=>v==null?null:String(v).trim().slice(0,500);
const valor=v=>v==null?null:centavos(v).toString();
export function precosComplementares(p){
 const desconto=p.desconto==null?null:String(p.desconto);
 if(desconto!==null&&!/^-?\d+(\.\d{1,6})?$/.test(desconto))throw new Error('DESCONTO_ERP_INVALIDO');
 return {preco_tabela_centavos:valor(p.preco_tabela),desconto_informado:desconto,preco_aplicado_centavos:valor(p.preco_aplicado)};
}
export function complementosDaVenda(v,normalizarDia){
 if(v.lancamentos!=null&&!Array.isArray(v.lancamentos))throw new Error('LANCAMENTOS_INVALIDOS');
 return {condicoes_pgto:texto(v.condicoes_pgto),codigo_condicaopgto:texto(v.codigo_condicaopgto),desc_condicoes_pgto:texto(v.desc_condicoes_pgto),lancamentos:v.lancamentos==null?null:v.lancamentos.map(l=>{
  if(!l||typeof l!=='object'||Array.isArray(l))throw new Error('LANCAMENTO_INVALIDO');
  return {origem:texto(l.origem),n_documento:texto(l.n_documento),data_emissao:l.data_emissao==null?null:normalizarDia(l.data_emissao),data_vencimento:l.data_vencimento==null?null:normalizarDia(l.data_vencimento),desc_gerador:texto(l.desc_gerador),historico:texto(l.historico),desc_tipopgto:texto(l.desc_tipopgto),nsu:texto(l.nsu),valor_inicial_centavos:valor(l.valor_inicial)};
 })};
}
// A ordem do retorno ERP pode variar; associar somente identidades/valores iguais.
export function associarItensComplementares(gravados,recebidos){
 if(gravados.length!==recebidos.length)throw new Error('COMPLEMENTOS_ITENS_DIVERGENTES');
 const signature=p=>JSON.stringify([p.cod_produto==null?null:String(p.cod_produto),p.sku==null?null:String(p.sku),p.quantidade,String(p.preco_centavos)]);
 const groups=new Map();for(const p of recebidos){const key=signature(p);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);}
 for(const values of groups.values())if(new Set(values.map(p=>JSON.stringify([p.preco_tabela_centavos,p.desconto_informado,p.preco_aplicado_centavos]))).size>1)throw new Error('COMPLEMENTOS_ITENS_AMBIGUOS');
 return gravados.map(saved=>{const p=groups.get(signature(saved))?.shift();if(!p)throw new Error('COMPLEMENTOS_ITENS_DIVERGENTES');return {...p,ordem:saved.ordem};});
}
