import {randomUUID} from 'node:crypto';
export async function semearRelatorioFila(e){
 const inicio=new Date(Date.parse(e.dia+'T12:00:00Z')-2*86400000).toISOString().slice(0,10),fim=new Date(Date.parse(e.dia+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 const autor=(await e.auth.autenticar(e.tokens.admin)).id;
 async function dia(d,segundo=false){
  const hora=t=>d+'T'+t+':00Z';
  await e.pool.query("INSERT INTO fila_jornadas(filial,dia,estado,aberta_em,fechada_em) VALUES(5,$1,'fechada',$2,$3)",[d,hora('08:00'),hora(segundo?'09:00':'10:00')]);
  for(const [i,c,n] of [[1,'10','Ana Exemplo'],...(segundo?[]:[[2,'20','Bruno Exemplo'],[3,'30','Carla Exemplo']])])await e.pool.query("INSERT INTO fila_participantes(filial,dia,vendedor_codigo,nome,posicao,estado) VALUES(5,$1,$2,$3,$4,'disponivel')",[d,c,n,i]);
  let versao=0;
  const evento=async(acao,t,extra={})=>e.pool.query('INSERT INTO fila_eventos(requisicao,filial,dia,autor,acao,criado_em,fingerprint,dados) VALUES($1,5,$2,$3,$4,$5,$6,$7)',[randomUUID(),d,autor,acao,hora(t),'sintetico',JSON.stringify({pedido:{acao,dia:d,filial:'5',versao:versao++,...extra}})]);
  await evento('abrir','08:00',{vendedores:segundo?['10']:['10','20']});
  async function atendimento(c,abordagem,inicio,fim,resultado,motivo=null,intenso=false){
   const id=randomUUID();
   await e.pool.query("INSERT INTO fila_atendimentos(id,filial,dia,vendedor_codigo,modalidade,abordado_em,iniciado_em,finalizado_em,resultado,motivo,movimento_intenso) VALUES($1,5,$2,$3,'vez',$4,$5,$6,$7,$8,$9)",[id,d,c,hora(abordagem),inicio?hora(inicio):null,hora(fim),resultado,motivo,intenso]);
   await evento('abordar',abordagem,{vendedor:c,modalidade:'vez'});if(inicio)await evento('iniciar',inicio,{atendimento:id});await evento('concluir',fim,{atendimento:id,resultado,motivo});
  }
  if(segundo){await atendimento('10','08:05','08:05','08:10','com_venda');return;}
  await atendimento('10','08:10','08:15','08:25','com_venda');
  await atendimento('10','08:30',null,'08:35','nao_iniciado','Cliente preferiu olhar sozinho');
  await evento('pausar','08:10',{vendedor:'20',motivo:'Almoço'});await evento('retornar','08:40',{vendedor:'20'});
  await evento('movimento_intenso','08:45',{ativo:true,motivo:'Pico de clientes'});
  await atendimento('20','08:50','08:50','09:20','sem_venda','Tamanho indisponível',true);
  await evento('movimento_intenso','09:25',{ativo:false,motivo:'Movimento normalizado'});
  await evento('ausente','09:30',{vendedor:'20',motivo:'Saída'});await evento('chegada','09:30',{vendedor:'30'});
 }
 await dia(inicio);await dia(fim,true);return {inicio,fim};
}
