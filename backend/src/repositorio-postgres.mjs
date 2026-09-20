import {associarItensComplementares} from './complementos-venda.mjs';
import { aplicarCancelamentos, chaveOperacao } from './cancelamentos.mjs';
import { validarDia } from './sincronizar-cancelamentos.mjs';

export class RepositorioPostgres {
  constructor(pool, tenant) { this.pool = pool; this.tenant = tenant; }

  async transacao({ tenant, filial }, executar) {
    if (tenant !== this.tenant || !tenant) throw new Error('Tenant fora do escopo');
    chaveOperacao('0', 'S', filial);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL lock_timeout = '5s'");
      await client.query("SET LOCAL statement_timeout = '40s'");
      const identidade = await client.query('SELECT tenant_key FROM tenant_identity WHERE singleton');
      if (identidade.rows[0]?.tenant_key !== tenant) throw new Error('Banco pertence a outro tenant');
      // Mesmo lock para importação de operações e cancelamentos desta filial.
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':' || $1,0))", [String(filial)]);
      const tx = {
        lerCheckpoint: async (recurso = 'cancelamentos') => {
          const r = await client.query("SELECT ate::text FROM sync_checkpoints WHERE filial=$1 AND recurso=$2", [filial, recurso]);
          return r.rows[0]?.ate ?? null;
        },
        salvarCheckpoint: async (fim, recurso = 'cancelamentos') => {
          validarDia(fim);
          await client.query(`INSERT INTO sync_checkpoints(filial,recurso,ate) VALUES($1,$3,$2)
            ON CONFLICT(filial,recurso) DO UPDATE SET ate=GREATEST(sync_checkpoints.ate,EXCLUDED.ate),atualizado_em=now()`, [filial, fim, recurso]);
        },
        salvarCancelamentos: async eventos => {
          const validos = [...aplicarCancelamentos(new Map(), eventos, filial).values()];
          for (const evento of validos) {
            const timestamp = Number(/^\/Date\((-?\d+)/.exec(evento.data_cancelou)[1]);
            if (!Number.isSafeInteger(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) throw new Error('Data inválida');
            await client.query(`INSERT INTO cancelamentos(cod_operacao,tipo_operacao,filial,data_cancelou)
              VALUES($1,$2,$3,$4) ON CONFLICT(cod_operacao,tipo_operacao,filial)
              DO UPDATE SET data_cancelou=GREATEST(cancelamentos.data_cancelou,EXCLUDED.data_cancelou),atualizado_em=now()`,
            [evento.cod_operacao, evento.tipo_operacao, filial, new Date(timestamp)]);
            await client.query(`UPDATE operacoes SET cancelada=true,atualizado_em=now()
              WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3`, [evento.cod_operacao, evento.tipo_operacao, filial]);
          }
        },
        preencherClientes: async operacoes => {
          let atualizadas=0;
          for(const op of operacoes){
            chaveOperacao(op.cod_operacao,op.tipo_operacao,op.filial);
            if(String(op.filial)!==String(filial)||!Array.isArray(op.clientes))throw new Error('CLIENTES_INVALIDOS');
            const r=await client.query(`UPDATE operacoes SET clientes=$4::jsonb,clientes_importados_em=now()
              WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 AND data_operacao=$5 AND clientes IS NULL`,
              [op.cod_operacao,op.tipo_operacao,filial,JSON.stringify(op.clientes),op.data_operacao]);
            atualizadas+=r.rowCount;
          }
          return atualizadas;
        },
        preencherIdentidadeClientes: async operacoes => {
          let atualizadas=0;
          for(const op of operacoes){
            chaveOperacao(op.cod_operacao,op.tipo_operacao,op.filial);
            if(String(op.filial)!==String(filial)||!Array.isArray(op.clientes))throw Error('CLIENTES_INVALIDOS');
            const r=await client.query(`UPDATE operacoes SET clientes=$4::jsonb,clientes_importados_em=now(),clientes_identidade_importada=true
              WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 AND data_operacao=$5 AND NOT clientes_identidade_importada`,
              [op.cod_operacao,op.tipo_operacao,filial,JSON.stringify(op.clientes),op.data_operacao]);
            atualizadas+=r.rowCount;
          }
          return atualizadas;
        },
        preencherComplementos: async operacoes => {
          let atualizadas=0;
          for(const op of operacoes){
            chaveOperacao(op.cod_operacao,op.tipo_operacao,op.filial);
            if(String(op.filial)!==String(filial)||!op.complementos||!Array.isArray(op.produtos))throw new Error('COMPLEMENTOS_INVALIDOS');
            const key=[op.cod_operacao,op.tipo_operacao,filial];
            const target=await client.query('SELECT 1 FROM operacoes WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 AND complementos IS NULL',key);
            if(!target.rowCount)continue;
            const existing=(await client.query('SELECT ordem,sku,cod_produto,quantidade,preco_centavos FROM operacao_itens WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 ORDER BY ordem',key)).rows;
            const associados=associarItensComplementares(existing,op.produtos);
            for(const item of associados)await client.query('UPDATE operacao_itens SET preco_tabela_centavos=$5,desconto_informado=$6,preco_aplicado_centavos=$7 WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 AND ordem=$4',[...key,item.ordem,item.preco_tabela_centavos,item.desconto_informado,item.preco_aplicado_centavos]);
            await client.query('UPDATE operacoes SET complementos=$4::jsonb,complementos_importados_em=now() WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3',[...key,JSON.stringify(op.complementos)]);atualizadas++;
          }
          return atualizadas;
        },
        reprocessarVenda: async (id,op) => {
          const key=[op.cod_operacao,op.tipo_operacao,filial];
          const job=(await client.query("SELECT 1 FROM reprocessamentos_venda WHERE id=$1 AND cod_operacao=$2 AND tipo_operacao=$3 AND filial=$4 AND estado='processando' FOR UPDATE",[id,...key])).rowCount;
          if(!job)throw Error('REPROCESSAMENTO_DESATUALIZADO');
          const snapshot=async()=> (await client.query(`SELECT jsonb_build_object('operacao',to_jsonb(o),'itens',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.ordem) FROM operacao_itens i WHERE i.cod_operacao=o.cod_operacao AND i.tipo_operacao=o.tipo_operacao AND i.filial=o.filial),'[]'::jsonb))::text AS dados FROM operacoes o WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3 FOR UPDATE`,key)).rows[0]?.dados;
          const antes=await snapshot();if(!antes)throw Error('OPERACAO_NAO_ENCONTRADA');
          await tx.salvarOperacoes([op]);
          await client.query('UPDATE operacoes SET erro_erp_confirmado_por=NULL,erro_erp_confirmado_em=NULL WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3',key);
          const depois=await snapshot(),v=(await client.query('SELECT conciliacao,cancelada,quantidade,valor_final_centavos::text FROM operacoes WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3',key)).rows[0];
          await client.query("UPDATE reprocessamentos_venda SET estado='concluido',finalizado_em=now(),antes=$2::jsonb,depois=$3::jsonb,resultado=$4::jsonb WHERE id=$1",[id,antes,depois,JSON.stringify({conciliacao:v.conciliacao,cancelada:v.cancelada,quantidade:v.quantidade,valor_final_centavos:String(v.valor_final_centavos)})]);
        },
        salvarOperacoes: async operacoes => {
          for (const op of operacoes) {
            chaveOperacao(op.cod_operacao, op.tipo_operacao, op.filial);
            if (String(op.filial) !== String(filial)) throw new Error('Filial fora do escopo');
            validarDia(op.data_operacao);
            if (!Number.isSafeInteger(op.quantidade) || op.quantidade < 0 || typeof op.cancelada !== 'boolean'
              || !/^-?\d+$/.test(String(op.valor_final_centavos))) throw new Error('Operação inválida');
            await client.query(`INSERT INTO operacoes(cod_operacao,tipo_operacao,filial,data_operacao,quantidade,valor_final_centavos,cancelada)
              VALUES($1,$2,$3,$4,$5,$6,$7 OR EXISTS(SELECT 1 FROM cancelamentos WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3))
              ON CONFLICT(cod_operacao,tipo_operacao,filial) DO UPDATE SET
                data_operacao=EXCLUDED.data_operacao,quantidade=EXCLUDED.quantidade,
                valor_final_centavos=EXCLUDED.valor_final_centavos,
                cancelada=operacoes.cancelada OR EXCLUDED.cancelada,atualizado_em=now()`,
            [String(op.cod_operacao), op.tipo_operacao, filial, op.data_operacao, op.quantidade, String(op.valor_final_centavos), op.cancelada]);
            if (Array.isArray(op.clientes)) {
              await client.query(`UPDATE operacoes SET clientes=$4::jsonb,clientes_importados_em=now(),clientes_identidade_importada=true
                WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3`,
              [op.cod_operacao,op.tipo_operacao,filial,JSON.stringify(op.clientes)]);
            }
            if (op.complementos) await client.query('UPDATE operacoes SET complementos=$4::jsonb,complementos_importados_em=now() WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3',[op.cod_operacao,op.tipo_operacao,filial,JSON.stringify(op.complementos)]);
            if (op.produtos) {
              await client.query(`UPDATE operacoes SET ajuste_centavos=$4,subtotal_itens_centavos=$5,conciliacao=$6,
                vendedor_codigo=$7,vendedor_nome=$8,evento_codigo=$9 WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3`,
              [op.cod_operacao,op.tipo_operacao,filial,op.ajuste_centavos,op.subtotal_itens_centavos,op.conciliacao,op.vendedor_codigo,op.vendedor_nome,op.evento_codigo]);
              await client.query('DELETE FROM operacao_itens WHERE cod_operacao=$1 AND tipo_operacao=$2 AND filial=$3',[op.cod_operacao,op.tipo_operacao,filial]);
              for (const item of op.produtos) {
                await client.query(`INSERT INTO operacao_itens(cod_operacao,tipo_operacao,filial,ordem,sku,cod_produto,descricao,quantidade,preco_centavos,imagem_url,preco_tabela_centavos,desconto_informado,preco_aplicado_centavos)
                  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,[op.cod_operacao,op.tipo_operacao,filial,item.ordem,item.sku,item.cod_produto,item.descricao,item.quantidade,item.preco_centavos,item.imagem_url??null,item.preco_tabela_centavos??null,item.desconto_informado??null,item.preco_aplicado_centavos??null]);
              }
            }
          }
        },
      };
      const resultado = await executar(tx);
      await client.query('COMMIT');
      return resultado;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
}
