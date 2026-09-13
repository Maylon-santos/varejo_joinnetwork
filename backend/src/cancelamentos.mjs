// Estado puro para preparar a persistência: nunca subtrair totais como efeito
// de cada evento. Indicadores devem excluir operações com cancelamento ativo.
export function chaveOperacao(codigo, tipo, filial) {
  if (!/^\d+$/.test(String(codigo)) || !/^\d+$/.test(String(filial)) || !/^[A-Z]+$/.test(String(tipo))) {
    throw new TypeError('Chave de operação inválida');
  }
  return `${codigo}:${tipo}:${filial}`;
}

export function aplicarCancelamentos(estado, eventos, filialConsultada) {
  if (!Array.isArray(eventos)) throw new TypeError('Lista de cancelamentos inválida');
  const novo = new Map(estado);
  for (const evento of eventos) {
    if (evento.filial != null && String(evento.filial) !== String(filialConsultada)) {
      throw new TypeError('Filial retornada diverge da consultada');
    }
    if (!/^\/Date\(-?\d+(?:[+-]\d+)?\)\/$/.test(evento.data_cancelou ?? '')) {
      throw new TypeError('Data de cancelamento inválida');
    }
    const chave = chaveOperacao(evento.cod_operacao, evento.tipo_operacao, filialConsultada);
    // Guarda também cancelamentos de operações ainda não importadas.
    // A futura importação deve consultar este registro antes de ativar a venda.
    novo.set(chave, {
      cod_operacao: String(evento.cod_operacao),
      tipo_operacao: evento.tipo_operacao,
      filial: String(filialConsultada),
      cancelada: true,
      data_cancelou: evento.data_cancelou,
    });
  }
  return novo;
}
