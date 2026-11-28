// O saldo fornece o ID interno da cor; LISTAVENDAS fornece seu código comercial.
// Só associar os dois quando filial, SKU e código do produto coincidirem.
export function corDaImagem(item){
 const codigo=typeof item.cod_cor==='string'?item.cod_cor.trim():null;
 const descricao=typeof item.desc_cor==='string'?item.desc_cor.trim():null;
 return {cor_codigo:codigo&&/^[A-Za-z0-9._-]{1,100}$/.test(codigo)?codigo:null,
  cor_descricao:descricao&&descricao.length<=100?descricao:null};
}
export async function registrarCoresImagens(db,filial,itens){
 const cores=itens.filter(i=>typeof i.sku==='string'&&i.sku.length<=200&&typeof i.cod_produto==='string'&&i.cod_produto.length<=500&&i.cor_codigo&&/^[A-Za-z0-9._-]{1,100}$/.test(i.cor_codigo))
  .map(i=>({sku:i.sku,cod_produto:i.cod_produto,cor_codigo:i.cor_codigo,cor_descricao:typeof i.cor_descricao==='string'&&i.cor_descricao.length<=100?i.cor_descricao:null}));
 if(!cores.length)return 0;
 const r=await db.query(`INSERT INTO produto_cores_imagem(produto,cod_produto,cor,cor_codigo,cor_descricao,conflitante,filial_origem,sku_origem)
  SELECT e.produto,p.cod_produto,e.cor,min(x.cor_codigo),min(x.cor_descricao),count(DISTINCT x.cor_codigo)>1,$1,min(x.sku)
  FROM jsonb_to_recordset($2::jsonb) x(sku text,cod_produto text,cor_codigo text,cor_descricao text)
  JOIN estoque_atual e ON e.filial=$1 AND e.sku=x.sku AND e.presente_ultima_carga
  JOIN cadastro_produtos p ON p.produto=e.produto AND p.cod_produto=x.cod_produto
  WHERE NULLIF(e.cor,'') IS NOT NULL GROUP BY e.produto,p.cod_produto,e.cor ORDER BY e.produto,p.cod_produto,e.cor
  ON CONFLICT(produto,cod_produto,cor) DO UPDATE SET
   conflitante=produto_cores_imagem.conflitante OR EXCLUDED.conflitante OR produto_cores_imagem.cor_codigo<>EXCLUDED.cor_codigo,
   cor_descricao=CASE WHEN produto_cores_imagem.cor_codigo=EXCLUDED.cor_codigo THEN COALESCE(EXCLUDED.cor_descricao,produto_cores_imagem.cor_descricao) ELSE produto_cores_imagem.cor_descricao END,
   confirmado_em=now()`,[filial,JSON.stringify(cores)]);
 return r.rowCount;
}
