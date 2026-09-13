// Snapshot mínimo do cliente recebido junto com a venda.
export function clientesDaVenda(venda){
 if(venda?.customers!=null&&!Array.isArray(venda.customers))throw Error('CLIENTES_INVALIDOS');
 const clientes=venda?.customers??[];
 const texto=v=>typeof v==='string'?v.trim().slice(0,200):v==null?'':String(v).slice(0,200);
 return clientes.map(c=>{
  if(!c||typeof c!=='object'||Array.isArray(c))throw Error('CLIENTE_INVALIDO');
  const contatos=[];const vistos=new Set();
  function adicionar(tipo,ddd,valor){valor=texto(valor);ddd=texto(ddd);if(!valor)return;const key=ddd.replace(/\D/g,'')+valor.replace(/\D/g,'');if(!key||vistos.has(key))return;vistos.add(key);contatos.push({tipo,ddd,telefone:valor});}
  for(const contato of Array.isArray(c.contatos)?c.contatos:[]){adicionar('Celular',contato.ddd_celular??contato.ddd,contato.celular);adicionar('WhatsApp',contato.ddd_celular??contato.ddd,contato.whatsapp);adicionar('Telefone',contato.ddd,contato.fone??contato.telefone);}
  for(const endereco of Array.isArray(c.enderecos)?c.enderecos:[])adicionar('Telefone',endereco.ddd,endereco.fone);
  return {nome:texto(c.nome)||'Cliente sem nome informado',contatos};
 });
}
