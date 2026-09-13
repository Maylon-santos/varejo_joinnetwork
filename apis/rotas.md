Para listar as filiais que serao carrgadas as vendas 

para buscars as filiais podemos usar sem parametros para uma carga total 

curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/millenium!joinnetwork/varejo/listafiliais' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'

  podendo listar por cod_filial ou por filial 

  e por trans_id quando for uma busca incremental para atualizacao ou uma nova filial 

  curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/millenium!joinnetwork/varejo/listafiliais?cod_filial=ITUPEVA&trans_id=57360828&filial=30098297' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'

  o resultado vai ser 

  {
	"odata.count": 1,
	"value": [
		{
			"filial": 30098297,
			"cod_filial": "ITUPEVA",
			"nome": "EXEMPLO ANONIMIZADO",
			"fantasia": "EXEMPLO ANONIMIZADO",
			"cnpj": "37.657.349/0001-00",
			"uf": "SP",
			"e_mail": "COMERCIAL.ADM@RAGABESH.COM.BR",
			"metro_quadrado": 200,
			"contatos": [
				{
					"whatsapp": "EXEMPLO ANONIMIZADO",
					"ddd_celular": "11",
					"celular": null
				}
			],
			"gerador": 30149202,
			"trans_id": 57360829
		}
	]
}


com as filiais podemos consultar as vendas.


para consultar as vendas o unico requisito obrigatorio e passar a filial os demais sao opcionais 

curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS?cod_filial=ITUPEVA&data_inicial=2026-08-01&data_final=2026-08-01&cod_operacao=30830052&tipo_operacao=S&cancelada=F&filial=30098297' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'


response 

{
	"odata.count": 3,
	"value": [
		{
			"cod_produto": "9881422",
			"descricao": "CALÇA MOLETOM FEMININO",
			"descricao_traduzida": "Calça-Moletom-Feminino-Aeropostale",
			"cod_cor": "36046",
			"desc_cor": "ROSA",
			"tamanho": "P",
			"barra": "789859938641",
			"quantidade": 1,
			"preco_tabela": 329.9,
			"desconto": 55,
			"preco": 197.96,
			"preco_aplicado": 197.96,
			"preco_promocional": null,
			"imagem_01": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Calça-Moletom-Feminino-Aeropostale_9881422_36046-1.jpg",
			"imagem_02": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Calça-Moletom-Feminino-Aeropostale_9881422_36046-2.jpg",
			"imagem_03": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Calça-Moletom-Feminino-Aeropostale_9881422_36046-3.jpg",
			"sku": "30257709_30127006_0_P"
		},
		{
			"cod_produto": "9886001-1",
			"descricao": "MOLETOM FECHADO FEMININO",
			"descricao_traduzida": "Moletom-Fechado-Aeropostale-Feminino",
			"cod_cor": "36046",
			"desc_cor": "ROSA",
			"tamanho": "P",
			"barra": "789859938529",
			"quantidade": 1,
			"preco_tabela": 299.9,
			"desconto": 55,
			"preco": 180,
			"preco_aplicado": 180,
			"preco_promocional": null,
			"imagem_01": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Moletom-Fechado-Aeropostale-Feminino_9886001-1_36046-1.jpg",
			"imagem_02": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Moletom-Fechado-Aeropostale-Feminino_9886001-1_36046-2.jpg",
			"imagem_03": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Moletom-Fechado-Aeropostale-Feminino_9886001-1_36046-3.jpg",
			"sku": "30257736_30127006_0_P"
		},
		{
			"cod_produto": "87101413",
			"descricao": "CALÇA MOLETOM MASCULINO",
			"descricao_traduzida": "Calça-Moletom-Masculino-Aeropostale",
			"cod_cor": "000400",
			"desc_cor": "PRETO",
			"tamanho": "M",
			"barra": "7908725774851",
			"quantidade": 1,
			"preco_tabela": 329.99,
			"desconto": 55,
			"preco": 198,
			"preco_aplicado": 198,
			"preco_promocional": null,
			"imagem_01": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Calça-Moletom-Masculino-Aeropostale_87101413_000400-1.jpg",
			"imagem_02": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Calça-Moletom-Masculino-Aeropostale_87101413_000400-2.jpg",
			"imagem_03": "http://aeropostale1.hospedagemdesites.ws/fotosaero/Calça-Moletom-Masculino-Aeropostale_87101413_000400-3.jpg",
			"sku": "30298764_30098445_0_M"
		}
	]
}

Temos a opcao de consulatr o produto para enriquecer o cadastro de produtos 


curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS?cod_produto=87150101-6' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'

  podendo ser usado o cod_produto e o produto 


  curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAPRODUTOS?produto=30338805' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'



  a resposta 


  {
	"odata.count": 1,
	"value": [
		{
			"data_cadastro": "/Date(1771470000000-180)/",
			"trans_id": 48485669,
			"cod_produto": "87150101-6",
			"produto": 30338805,
			"descricao": "CAMISETA M/C MASCULINO A87",
			"descricao_traduzida": "Camiseta-Manga-Curta-Masculino-Aeropostale",
			"colecao": 30099016,
			"cod_colecao": "84",
			"desc_colecao": "VERÃO 2027",
			"departamento": 30098185,
			"cod_departamento": "10",
			"desc_departamento": "ADULTO MASCULINO",
			"grupo": 30098331,
			"cod_grupo": "101",
			"desc_grupo": "CAMISETA M/C",
			"categoria": 30098432,
			"cod_categoria": "04",
			"desc_categoria": "TÊXTIL",
			"grade": 2000013,
			"cod_grade": "231",
			"desc_grade": "P AO GG",
			"marca": 30098327,
			"cod_marca": "AER",
			"desc_marca": "AEROPOSTALE"
		}
	]
}

e podemos tambem consultar o estoque do produto passando o cod_produto e a filial

curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES?filial=30098297&cod_produto=87150101-6' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'

  responde 

  {
	"odata.count": 4,
	"value": [
		{
			"trans_id": 761527492,
			"primeira_entrada": "/Date(1787626800000-180)/",
			"data_atualizacao": "/Date(1787844925000-180)/",
			"sku": "30338805_30213893_0_P",
			"saldo": 5
		},
		{
			"trans_id": 762478698,
			"primeira_entrada": "/Date(1787626800000-180)/",
			"data_atualizacao": "/Date(1788098865000-180)/",
			"sku": "30338805_30213893_0_M",
			"saldo": 9
		},
		{
			"trans_id": 764479433,
			"primeira_entrada": "/Date(1787626800000-180)/",
			"data_atualizacao": "/Date(1788566168000-180)/",
			"sku": "30338805_30213893_0_GG",
			"saldo": 4
		},
		{
			"trans_id": 765982044,
			"primeira_entrada": "/Date(1787626800000-180)/",
			"data_atualizacao": "/Date(1788911313000-180)/",
			"sku": "30338805_30213893_0_G",
			"saldo": 7
		}
	]
}

ou passando a filial e o sku para ver somente o item especifico 

curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.CONSULTAESTOQUES?filial=30098297&sku=30338805_30213893_0_M' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'


resposta 

{
	"odata.count": 1,
	"value": [
		{
			"trans_id": 762478698,
			"primeira_entrada": "/Date(1787626800000-180)/",
			"data_atualizacao": "/Date(1788098865000-180)/",
			"sku": "30338805_30213893_0_M",
			"saldo": 9
		}
	]
}



para consultar um cliente 

curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/millenium!joinnetwork/varejo/clientes?cliente=10032718' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'


  {
	"odata.count": 1,
	"value": [
		{
			"cliente": 10032718,
			"nome": "EXEMPLO ANONIMIZADO",
			"fantasia": "EXEMPLO ANONIMIZADO",
			"cpf": null,
			"pf_pj": "PJ",
			"limite_desconto": null,
			"revisar_limite": false,
			"contatos": [
				{
					"whatsapp": null,
					"ddd_celular": "11",
					"celular": "EXEMPLO ANONIMIZADO"
				}
			],
			"enderecos": [
				{
					"estado": "SP",
					"cidade": "EXEMPLO ANONIMIZADO",
					"bairro": "EXEMPLO ANONIMIZADO",
					"logradouro": "EXEMPLO ANONIMIZADO",
					"numero": 370,
					"ddd": "011",
					"fone": "EXEMPLO ANONIMIZADO",
					"endereco_cobranca": true,
					"endereco_nota": true,
					"endereco_entrega": true
				}
			],
			"data_cadastro": "/Date(1122606000000-180)/",
			"data_aniversario": null
		}
	]
}


para consultar o estoque podemos usar a filial para uma busca geral e o trans_id para uma busca incremental 



curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/millenium_eco/produtos/saldodeestoque?filial=30098297&trans_id=721282762' \
  --header 'Authorization: Basic Token=' \
  --header 'Content-Type: application/json'


{
	"odata.count": 3888,
	"value": [
		{
			"sku": "30176727_30103940_0_8",
			"saldo": 0,
			"empenho": 0,
			"produto": 30176727,
			"cor": 30103940,
			"estampa": 0,
			"tamanho": "8",
			"data_atualizacao": "/Date(1775012400000-180)/",
			"vitrine_produto_sku": null,
			"reserva_vitrine": 0,
			"reserva_naovitrine": 0,
			"saldo_vitrine": 0,
			"saldo_naovitrine": 0,
			"data_compra": null,
			"saldo_compra": 0,
			"estoque_min": 0,
			"barra": "789999579783",
			"data_envio": null,
			"id_externo": null,
			"id": null,
			"filial": 30098297,
			"filial_externa": null,
			"kit": false,
			"componente_kit": null,
			"desc_produto": "MOLETOM ABERTO MASCULINO TEEN",
			"trans_id": 721282851,
			"permite_pedido_sem_estoque": "T",
			"saldo_vitrine_com_reserva": 0,
			"saldo_vitrine_sem_reserva": 0,
			"vitrine": null,
			"cod_produto": "0745T",
			"cod_filial": "ITUPEVA",
			"lote": null,
			"data_fabricacao": null,
			"data_validade": null,
			"revendedor_integrado": null,
			"id_externo_produto": "",
			"total_saldo_vitrine_sem_reserva": null,
			"pre_venda": "F",
			"preco_custo": null,
			"incluir": null,
			"barra_ref": "30176727_30103940_0_8"
		}]}




Para Listar vendas canceladas 

curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDASCANCELADAS?data_inicial=2026-09-09&data_final=2026-09-10&filial=30098297' \
  --header 'Authorization: Basic token' \
  --header 'Content-Type: application/json'

  opcoes de filtro 

  curl --request GET \
  --url 'http://app.aeropostale.com.br:6017/api/MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDASCANCELADAS?filial=30098297&data_caninicial=2026-09-09&data_canfinal=2026-09-09' \
  --header 'Authorization: Basic token' \
  --header 'Content-Type: application/json'

  resposta 



{
	"odata.count": 1,
	"value": [
		{
			"cod_operacao": 30836007,
			"tipo_operacao": "S",
			"data_cancelou": "/Date(1788922800000-180)/",
			"usuario_cancelou": "MAYLON",
			"obs_canc": null,
			"motivo": "TESTE"
		}
	]
}



Exemplos de cadastro anonimizados para versionamento; não usar como dados reais.
