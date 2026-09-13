// Apenas os dados solicitados para a operação autorizada; sem persistir cadastros.
export function clientesDaVenda(venda){
 const clientes=Array.isArray(venda?.customers)?venda.customers:[];
 const texto=v=>typeof v==='string'?v.trim().slice(0,200):v==null?'':String(v).slice(0,200);
 return clientes.map(c=>{
  const contatos=[];const vistos=new Set();
  function adicionar(tipo,ddd,valor){valor=texto(valor);ddd=texto(ddd);if(!valor)return;const key=ddd.replace(/\D/g,'')+valor.replace(/\D/g,'');if(!key||vistos.has(key))return;vistos.add(key);contatos.push({tipo,ddd,telefone:valor});}
  for(const contato of Array.isArray(c.contatos)?c.contatos:[]){adicionar('Celular',contato.ddd_celular??contato.ddd,contato.celular);adicionar('WhatsApp',contato.ddd_celular??contato.ddd,contato.whatsapp);adicionar('Telefone',contato.ddd,contato.fone??contato.telefone);}
  for(const endereco of Array.isArray(c.enderecos)?c.enderecos:[])adicionar('Telefone',endereco.ddd,endereco.fone);
  return {nome:texto(c.nome)||'Cliente sem nome informado',contatos};
 });
}
export async function consultarClienteOperacao({baseUrl,token,operacao,fetchImpl=fetch}){
 if(!baseUrl||!token)throw Error('ERP_NAO_CONFIGURADO');
 const url=new URL(baseUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('URL_INVALIDA');
 url.pathname=url.pathname.replace(/\/$/,'')+'/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS';
 url.search=new URLSearchParams({filial:String(operacao.filial),data_inicial:operacao.data_operacao,data_final:operacao.data_operacao});
 const r=await fetchImpl(url,{headers:{Authorization:`Basic ${token}`,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error('CLIENTE_ERP_INDISPONIVEL');const body=await r.json();
 if(!Array.isArray(body.value)||Number(body['odata.count'])!==body.value.length||Object.keys(body).some(k=>k.toLowerCase().includes('nextlink')))throw Error('RESPOSTA_ERP_INCOMPLETA');
 const matches=body.value.filter(v=>String(v.filial)===String(operacao.filial)&&String(v.cod_operacao)===String(operacao.cod_operacao)&&v.tipo_operacao===operacao.tipo_operacao);
 if(!matches.length)throw Error('OPERACAO_ERP_NAO_ENCONTRADA');
 const clientes=clientesDaVenda(matches[0]);if(matches.some(v=>JSON.stringify(clientesDaVenda(v))!==JSON.stringify(clientes)))throw Error('CLIENTE_ERP_DIVERGENTE');
 return {clientes};
}
export async function carregarImagemProduto(url,{fetchImpl=fetch}={}){
 const u=new URL(url);
 // Origem fixa observada no ERP; não aceitar proxy para URLs arbitrárias ou redes locais.
 if(u.hostname!=='aeropostale1.hospedagemdesites.ws'||u.port||u.username||u.password||!['http:','https:'].includes(u.protocol)||!u.pathname.startsWith('/fotosaero/'))throw Error('IMAGEM_ORIGEM_INVALIDA');
 const r=await fetchImpl(u,{redirect:'error',signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('IMAGEM_INDISPONIVEL');
 const type=(r.headers.get('content-type')||'').split(';')[0].toLowerCase();
 if(!['image/jpeg','image/png','image/webp','image/gif','image/avif'].includes(type)){await r.body?.cancel();throw Error('IMAGEM_TIPO_INVALIDO');}
 const max=5*1024*1024;if(Number(r.headers.get('content-length'))>max){await r.body?.cancel();throw Error('IMAGEM_MUITO_GRANDE');}
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>max)throw Error('IMAGEM_MUITO_GRANDE');chunks.push(Buffer.from(chunk));}
 return {type,body:Buffer.concat(chunks)};
}
