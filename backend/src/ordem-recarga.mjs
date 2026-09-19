export function opcoesRecarga(args){
 const completa=args.includes('--completa'),prioridades=args.filter(a=>a.startsWith('--primeira='));
 if(args.some(a=>a!=='--completa'&&!a.startsWith('--primeira='))||args.filter(a=>a==='--completa').length>1||prioridades.length>1)throw Error('ARGUMENTO_INVALIDO');
 const primeira=prioridades[0]?.slice('--primeira='.length)??null;
 if(primeira&&(!completa||!/^[-A-Z0-9]{1,200}$/.test(primeira)))throw Error('PRIORIDADE_INVALIDA');
 if(prioridades.length&&!primeira)throw Error('PRIORIDADE_INVALIDA');
 return {completa,primeira};
}
export function ordenarRecarga(filiais,cadastros,primeira){
 if(!primeira)return [...filiais];
 const candidatos=cadastros.filter(c=>c.cod_filial===primeira&&filiais.includes(String(c.filial)));
 if(candidatos.length!==1)throw Error('FILIAL_PRIORITARIA_INVALIDA');
 const id=String(candidatos[0].filial);return [id,...filiais.filter(f=>f!==id)];
}
