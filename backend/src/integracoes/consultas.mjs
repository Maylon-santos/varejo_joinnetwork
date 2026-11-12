import {randomUUID} from 'node:crypto';
import {exigir,Falha,hash,etag} from './seguranca.mjs';
import {escopo,transacao,identidade} from './banco.mjs';
import {contextoRecurso,permitirPessoas,sincronizacaoDTO} from './projecoes.mjs';

const DIA=/^20\d{2}-\d{2}-\d{2}$/;
const ID={test:v=>/^(0|[1-9]\d{0,18})$/.test(v??'')&&BigInt(v)<=9223372036854775807n};
export const concessao=c=>hash([c.id,c.tenant_key,c.versao,c.escopos,c.filiais]);
export function parametros(params,permitidos){
 for(const k of params.keys())exigir(permitidos.includes(k)&&params.getAll(k).length===1,400,'INVALID_PARAMETER');
 const p=Object.fromEntries(params);if(p.limite!==undefined)exigir(/^\d{1,3}$/.test(p.limite)&&+p.limite>=1&&+p.limite<=200,400,'INVALID_LIMIT');
 return p;
}
export function meta(requestId,extra={}){return {request_id:requestId,gerado_em:new Date().toISOString(),snapshot_id:null,snapshot_expira_em:null,recurso_versao:null,...extra};}
export function criarConsultas(pool,tenant,cofre,filiais){
 async function pontual(db,c,recurso,filial,chave){
  const r=(await db.query('SELECT * FROM integration_resources WHERE recurso=$1 AND filial=$2 AND chave=$3',[recurso,filial,chave])).rows[0];
  exigir(r&&filiais.includes(filial)&&c.filiais.includes(filial),404,'NOT_FOUND');return ler(db,r);
 }
 async function ler(db,r){
  const p=cofre.abrir(r.dados,contextoRecurso(r));
  if(r.recurso==='estoques'){
   const e=(await db.query('SELECT e.consultado_em,e.data_atualizacao_erp,s.ultimo_sucesso,s.ultima_carga_completa,s.falhas_consecutivas FROM estoque_atual e LEFT JOIN sync_estoques s USING(filial) WHERE e.filial=$1 AND e.sku=$2',[r.filial,r.chave])).rows[0];
   if(e)p.data.sincronizacao=sincronizacaoDTO({...e,consultado_em:p.data.sincronizacao.consultado_em,data_atualizacao_erp:p.data.sincronizacao.data_atualizacao_erp});
  }return p;
 }
 async function paginar(db,c,path,p,carregar,requestId,recursoVersao=null){
  const digest=hash([path,Object.fromEntries(Object.entries(p).filter(([k])=>k!=='cursor'))]),grant=concessao(c),limite=+(p.limite??100);
  let snapshot,offset=0;
  if(p.cursor){
   const cur=cofre.verificar(p.cursor);exigir(cur.tipo==='snapshot'&&cur.cliente===c.id&&cur.concessao===grant&&cur.consulta===digest&&Number.isSafeInteger(cur.offset)&&cur.offset>=0,400,'INVALID_CURSOR');
   snapshot=(await db.query('SELECT * FROM integration_snapshots WHERE id=$1 AND cliente_id=$2 AND expira_em>now()',[cur.id,c.id])).rows[0];exigir(snapshot,410,'CURSOR_EXPIRED');offset=cur.offset;
  }else{
   await db.query("SELECT pg_advisory_xact_lock(hashtextextended('integration:snapshot-budget',0))");
   await db.query('DELETE FROM integration_snapshots WHERE expira_em<=now()');
   // Limite por cliente para evitar acúmulo de snapshots grandes; consultas menores podem ser repartidas.
   const count=(await db.query('SELECT count(*)::int n FROM integration_snapshots WHERE cliente_id=$1 AND expira_em>now()',[c.id])).rows[0].n;exigir(count<20,429,'SNAPSHOT_LIMIT');
   const rows=await carregar(),size=Buffer.byteLength(JSON.stringify(rows));exigir(rows.length<=10000&&size<=32*1024*1024,422,'SNAPSHOT_TOO_LARGE');
   const budget=(await db.query('SELECT coalesce(sum(octet_length(dados)),0)::text total,coalesce(sum(octet_length(dados)) FILTER(WHERE cliente_id=$1),0)::text cliente FROM integration_snapshots WHERE expira_em>now()',[c.id])).rows[0];
   exigir(Number(budget.total)+size<=256*1024*1024&&Number(budget.cliente)+size<=64*1024*1024,429,'SNAPSHOT_STORAGE_LIMIT');
   const id=randomUUID();snapshot=(await db.query('INSERT INTO integration_snapshots(id,cliente_id,concessao,consulta_hash,dados,recurso_versao) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id,c.id,grant,digest,cofre.cifrar(rows,'snapshot:'+id),recursoVersao])).rows[0];
  }
  exigir(snapshot.concessao===grant&&snapshot.consulta_hash===digest,400,'INVALID_CURSOR');
  const all=cofre.abrir(snapshot.dados,'snapshot:'+snapshot.id),data=all.slice(offset,offset+limite),mais=offset+data.length<all.length;
  return {data,paginacao:{limite,quantidade:data.length,tem_mais:mais,cursor_proximo:mais?cofre.assinar({tipo:'snapshot',id:snapshot.id,cliente:c.id,concessao:grant,consulta:digest,offset:offset+data.length}):null},meta:meta(requestId,{snapshot_id:snapshot.id,snapshot_expira_em:snapshot.expira_em.toISOString(),recurso_versao:snapshot.recurso_versao})};
 }
 return {
  paginar,
  consultar:async(c,path,params,headers,requestId)=>transacao(pool,async db=>{
   await identidade(db,tenant);
   const parts=path.split('/').slice(2),recurso=parts[0];
   const venda=recurso==='vendas',produto=recurso==='produtos',stock=recurso==='estoques'||recurso==='filiais'&&parts[2]==='estoques';
   const scope=venda?'vendas:ler':produto?'produtos:ler':stock?'estoques:ler':'filiais:ler';escopo(c,scope);
   const allowed=['limite','cursor'];
   if(venda)allowed.push('filial_id','inicio','fim','estado','tipo_operacao','incluir_pessoas');
   if(produto)allowed.push('filial_id','busca','tipo_prod');
   if(recurso==='estoques')allowed.push('filial_id','produto_id','sku','saldo','incluir_ausentes');
   const p=parametros(params,allowed),filial=p.filial_id??(recurso==='filiais'?parts[1]:undefined);
   const pessoas=p.incluir_pessoas==='true';if(p.incluir_pessoas!==undefined)exigir(['true','false'].includes(p.incluir_pessoas),400,'INVALID_PARAMETER');if(pessoas)escopo(c,'vendas:pessoas:ler');
   if(filial!==undefined)exigir(ID.test(filial)&&filiais.includes(filial),403,'BRANCH_FORBIDDEN');
   const detalhe=!!parts[1]&&!(recurso==='estoques');
   if(detalhe){
    if(venda){
     exigir(Object.keys(p).every(k=>['limite','cursor','incluir_pessoas'].includes(k)),400,'INVALID_PARAMETER');
     const m=/^vnd_(\d+)_(S|E)_(\d+)$/.exec(parts[1]);exigir(m&&ID.test(m[1])&&ID.test(m[3]),404,'NOT_FOUND');
     const d=permitirPessoas(await pontual(db,c,'vendas',m[1],parts[1]),pessoas),tag=etag(d.data.id,d.data.versao);
     if(parts.length===2)return {body:{data:d.data,meta:meta(requestId)},etag:tag};
     exigir(parts.length===3&&['itens','pagamentos'].includes(parts[2]),404,'NOT_FOUND');
     exigir(headers['if-match'],428,'IF_MATCH_REQUIRED');
     // Cursor já materializado conserva revisão antiga; a primeira página precisa da revisão atual.
     if(!p.cursor)exigir(headers['if-match']===tag,412,'RESOURCE_CHANGED');
     const arr=d[parts[2]];if(!p.cursor)exigir(arr!==null&&(parts[2]!=='itens'||d.data.cobertura.itens==='disponivel'),409,'RESOURCE_NOT_READY');
     const result=await paginar(db,c,path,{...p,parent_etag:headers['if-match']},async()=>arr,requestId,d.data.versao);return {body:result};
    }
    if(produto){
     exigir(ID.test(parts[1])&&filial,400,'BRANCH_REQUIRED');escopo(c,scope,filial);
     const d=await pontual(db,c,'produtos',filial,parts[1]);
     if(parts.length===2)return {body:{data:d.data,meta:meta(requestId)},etag:etag(parts[1],d.data.versao)};
     exigir(parts.length===3&&parts[2]==='variacoes',404,'NOT_FOUND');
     return {body:await paginar(db,c,path,p,async()=>{
      const rows=(await db.query("SELECT * FROM integration_resources WHERE recurso='estoques' AND filial=$1 AND filtros->>'produto_id'=$2 ORDER BY chave LIMIT 10001",[filial,parts[1]])).rows;
      return rows.map(r=>{const {saldo_disponivel,reservas_ja_descontadas,sincronizacao,versao,atualizado_em,...v}=cofre.abrir(r.dados,contextoRecurso(r)).data;return v;});
     },requestId)};
    }
    if(stock){exigir(parts.length===4&&parts[2]==='estoques',404,'NOT_FOUND');let sku;try{sku=decodeURIComponent(parts[3]);}catch{throw new Falha(400,'INVALID_PARAMETER');}exigir(sku.length>0&&sku.length<=200,400,'INVALID_PARAMETER');escopo(c,scope,filial);const d=await pontual(db,c,'estoques',filial,sku);return {body:{data:d.data,meta:meta(requestId)},etag:etag(hash([filial,sku]),d.data.versao)};}
    exigir(recurso==='filiais'&&parts.length===2,404,'NOT_FOUND');escopo(c,scope,filial);const d=await pontual(db,c,'filiais',filial,filial);return {body:{data:d.data,meta:meta(requestId)},etag:etag(filial,d.data.versao)};
   }
   exigir(parts.length===1&&['vendas','filiais','produtos','estoques'].includes(recurso),404,'NOT_FOUND');
   const values=[recurso],where=['recurso=$1'];const add=(clause,value)=>{values.push(value);where.push(clause.replace('?',`$${values.length}`));};
   if(recurso==='filiais')add('filial=ANY(?::bigint[])',c.filiais.filter(f=>filiais.includes(f)));
   else{exigir(filial,400,'BRANCH_REQUIRED');escopo(c,scope,filial);add('filial=?',filial);}
   if(venda){
    exigir(DIA.test(p.inicio??'')&&DIA.test(p.fim??'')&&Number.isFinite(Date.parse(p.inicio))&&Number.isFinite(Date.parse(p.fim))&&new Date(p.inicio).toISOString().slice(0,10)===p.inicio&&new Date(p.fim).toISOString().slice(0,10)===p.fim,400,'INVALID_DATE');
    const dias=(Date.parse(p.fim)-Date.parse(p.inicio))/86400000+1;exigir(dias>=1&&dias<=31,400,'INVALID_WINDOW');
    exigir(['S','E','todas'].includes(p.tipo_operacao??'S')&&['todas','ativas','canceladas'].includes(p.estado??'todas'),400,'INVALID_PARAMETER');
    add("filtros->>'data'>=?",p.inicio);add("filtros->>'data'<=?",p.fim);
    if((p.tipo_operacao??'S')!=='todas')add("filtros->>'tipo'=?",p.tipo_operacao??'S');
    if((p.estado??'todas')!=='todas')add("(filtros->>'cancelada')::boolean=?",p.estado==='canceladas');
   }
   if(p.busca!==undefined){exigir(p.busca.trim().length>=2&&p.busca.length<=100,400,'INVALID_SEARCH');add("strpos(filtros->>'busca',?)>0",p.busca.trim().toLocaleLowerCase('pt-BR'));}
   if(p.tipo_prod!==undefined){exigir(p.tipo_prod.length>0&&p.tipo_prod.length<=20,400,'INVALID_PARAMETER');add("filtros->>'tipo_prod'=?",p.tipo_prod);}
   if(recurso==='estoques'){
    exigir(p.incluir_ausentes===undefined||['true','false'].includes(p.incluir_ausentes),400,'INVALID_PARAMETER');
    if(p.incluir_ausentes!=='true')where.push("filtros->>'presente'='true'");
    if(p.produto_id!==undefined){exigir(ID.test(p.produto_id),400,'INVALID_PARAMETER');add("filtros->>'produto_id'=?",p.produto_id);}
    if(p.sku!==undefined){exigir(p.sku.length>0&&p.sku.length<=200,400,'INVALID_PARAMETER');add('chave=?',p.sku);}
    if(p.saldo!==undefined){exigir(['positivo','zero','negativo','desconhecido','todos'].includes(p.saldo),400,'INVALID_PARAMETER');const clauses={positivo:"(filtros->>'saldo')::numeric>0",zero:"(filtros->>'saldo')::numeric=0",negativo:"(filtros->>'saldo')::numeric<0",desconhecido:"filtros->>'saldo' IS NULL"};if(clauses[p.saldo])where.push(clauses[p.saldo]);}
   }
   const order=venda?"filtros->>'data',(split_part(chave,'_',4))::bigint,filtros->>'tipo'":recurso==='estoques'?'chave':'chave::bigint';
   return {body:await paginar(db,c,path,p,async()=>{
    const rows=(await db.query(`SELECT * FROM integration_resources WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 10001`,values)).rows;
    const data=[];for(const r of rows)data.push((venda?permitirPessoas(await ler(db,r),pessoas,true):await ler(db,r)).data);return data;
   },requestId)};
  }),
  alteracoes:async(c,params,requestId)=>transacao(pool,async db=>{
   const p=parametros(params,['recurso','filial_id','posicao','cursor','limite']);exigir(['vendas','filiais','produtos','estoques'].includes(p.recurso),400,'INVALID_RESOURCE');escopo(c,p.recurso+':ler',p.filial_id);exigir(filiais.includes(p.filial_id),403,'BRANCH_FORBIDDEN');
   const grant=concessao(c),digest=hash([p.recurso,p.filial_id]);let pos;
   if(p.cursor){exigir(!p.posicao,400,'INVALID_PARAMETER');const cur=cofre.verificar(p.cursor);exigir(cur.tipo==='changes'&&cur.cliente===c.id&&cur.concessao===grant&&cur.consulta===digest&&/^\d+$/.test(cur.posicao),400,'INVALID_CURSOR');exigir(cur.expira>Date.now(),410,'CURSOR_EXPIRED');pos=cur.posicao;}
   else{exigir(p.posicao==='atual',400,'POSITION_REQUIRED');pos=(await db.query('SELECT coalesce(max(posicao),0)::text n FROM integration_changes')).rows[0].n;}
   const limite=+(p.limite??100),rows=(await db.query("SELECT * FROM integration_changes WHERE recurso=$1 AND filial=$2 AND posicao>$3 AND registrado_em>now()-interval '30 days' ORDER BY posicao LIMIT $4",[p.recurso,p.filial_id,pos,limite+1])).rows,mais=rows.length>limite;
   rows.length=Math.min(rows.length,limite);if(rows.length)pos=rows.at(-1).posicao;
   return {data:rows.map(r=>({id:r.id,recurso:r.recurso,recurso_id:r.recurso==='estoques'?'est_'+hash([r.filial,r.chave]).slice(0,40):r.chave,filial_id:r.filial,acao:r.acao,versao:r.versao,registrado_em:r.registrado_em.toISOString(),consulta_url:r.consulta_url})),paginacao:{limite,quantidade:rows.length,tem_mais:mais,cursor_proximo:cofre.assinar({tipo:'changes',cliente:c.id,concessao:grant,consulta:digest,posicao:pos,expira:Date.now()+30*86400000})},meta:{request_id:requestId,gerado_em:new Date().toISOString(),retencao_dias:30}};
  }),
 };
}
