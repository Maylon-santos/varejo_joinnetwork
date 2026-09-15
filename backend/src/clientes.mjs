// Snapshot mínimo do cliente recebido junto com a venda.
export function codigoCliente(valor){
 if(valor==null)return null;
 if(typeof valor==='number'&&(!Number.isSafeInteger(valor)||valor<=0))throw Error('CLIENTE_CODIGO_INVALIDO');
 if(!['string','number'].includes(typeof valor)||!/^[1-9]\d{0,29}$/.test(String(valor)))throw Error('CLIENTE_CODIGO_INVALIDO');
 return String(valor);
}
export function aniversarioCliente(valor){
 if(valor==null||valor==='')return null;
 const m=/^\/Date\((-?\d+)(?:[+-]\d+)?\)\/$/.exec(valor);
 const ms=m?Number(m[1]):NaN;
 if(!Number.isSafeInteger(ms)||!Number.isFinite(new Date(ms).getTime()))throw Error('CLIENTE_ANIVERSARIO_INVALIDO');
 // A fonte entrega meia-noite de São Paulo (03h UTC na amostra real).
 // Aniversariantes precisam apenas de mês/dia, sem armazenar ano de nascimento.
 const dia=new Date(ms).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))throw Error('CLIENTE_ANIVERSARIO_INVALIDO');
 return dia.slice(5);
}
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
  const codigo=codigoCliente(c.cliente);
  const aniversario=aniversarioCliente(c.data_aniversario);
  // Ausência continua sem identidade: nunca gerar uma chave a partir de nome/telefone.
  return {...(codigo===null?{}:{cliente_codigo:codigo}),...(aniversario?{aniversario_mm_dd:aniversario}:{}),nome:texto(c.nome)||'Cliente sem nome informado',contatos};
 });
}
