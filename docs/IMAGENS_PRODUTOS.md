# Imagens de produtos: fonte principal e alternativa

O painel mantém a imagem recebida na importação como primeira opção. Se a URL estiver ausente, retornar erro, exceder os limites ou não contiver uma imagem decodificável, o servidor consulta a base alternativa. O mesmo fluxo atende miniaturas e ampliação no catálogo, nos rankings e nos detalhes das vendas.

## Correção das cores publicada em 28/11/2026

O código comercial da cor é obtido de `cod_cor` nos itens de `MILLENIUM!JOINNETWORK.VAREJO.LISTAVENDAS`; `desc_cor` fornece a descrição. A associação ao ID interno do estoque só é registrada quando filial, SKU e código do produto coincidem. A tabela auxiliar `produto_cores_imagem` guarda a origem da confirmação. Outros tamanhos do mesmo produto/cor podem usar essa equivalência; produtos e cores diferentes não a compartilham. Códigos conflitantes bloqueiam o uso automático e não são substituídos pela observação mais recente.

Na amostra de 14 variantes que antes não combinavam com a segunda base, as 14 imagens foram recuperadas. Todas abriram como WebP pelo HTTPS do painel: sete SKUs tinham URL principal e sete não tinham. Quatro referências de vendas retornadas pelo catálogo também abriram corretamente; três fotos reais foram inspecionadas visualmente. A verificação não mede a cobertura integral do catálogo. [Evidência da correção](validacao-cores-imagens.json).

A releitura visual processou 182 janelas diárias em dois lotes, sem reimportar valores, itens, saldos ou checkpoints. Na conferência posterior, 628 dos 2.258 SKUs atuais da BAW-001 tinham cor comercial confirmada, sem conflitos. Esse número representa correspondência de cor, não quantidade de fotos disponíveis. Ainda havia 158 grupos produto/cor com venda histórica sem correspondência; em dois exemplos consultados, o SKU histórico não reapareceu no retorno atual do ERP. O histórico gravado foi preservado. SKUs sem confirmação continuam sem foto alternativa da variante.

O coletor regular passou a registrar as confirmações nas importações normais. Para reler o histórico de uma filial já autorizada, executar no servidor:

```sh
bash deploy/integracoes-hostgator.sh exec -T sync-worker node scripts/preencher-cores-imagens.mjs FILIAL 60
```

O segundo argumento limita as datas consultadas (1 a 366; padrão 60). A rotina tem lock próprio, valida tenant/filial e escreve somente a tabela visual; não executa outro coletor de vendas. Repetir uma releitura não resolve SKUs que a origem deixou de retornar. O worker local permanece desativado.

## Verificação da BAW-001 em 27/11/2026

O estoque estava atualizado, mas as fotos permanecem incompletas. Das 452 URLs principais distintas encontradas no histórico elegível do estoque atual, 27 produziram imagem válida. Oito exemplos amostrados pelo painel retornaram 404; dois exemplos positivos conhecidos abriram por HTTPS e foram inspecionados visualmente. Isso não mede a percentagem de todos os SKUs com foto.

A segunda base foi consultada parcialmente: houve HTTP 429 e o teste foi interrompido, depois retomado com intervalo mínimo de 1.100 ms. Foram obtidas respostas finais 200/404 para 142 códigos. Na retomada de 53 grupos produto/cor, 35 tinham imagens sem cor compatível; sete retornaram cadastro sem fotos e 11 retornaram 404. Não declarar que os demais produtos não possuem imagens.

Três exemplos confirmaram a diferença de identificadores: `estoque_atual.cor` guarda o ID interno do saldo do Millennium; a segunda base fornece código comercial e descrição da cor. O carregador comparava diretamente esses valores. A análise originou a R40, corrigida e validada em 28/11 conforme a seção acima. Não foi usada remoção de zeros nem seleção arbitrária de outra cor. [Evidência do diagnóstico](validacao-fotos-baw.json).

## Correspondência

A consulta usa exatamente o `cod_produto` do cadastro/item em `GET https://ragabesh.joinnetwork.com.br/api/integrations/products/{codigo}/images`. Não usa o identificador interno numérico do cadastro, SKU ou código de barras como substituto. A resposta precisa confirmar o mesmo código.

Para uma variante identificada por SKU ou ID interno de cor, a seleção exige correspondência comercial confirmada. O ID interno não é enviado como código comercial. Havendo código confirmado, ele precisa corresponder a exatamente uma cor na segunda base, preservando zeros; uma descrição semelhante não substitui um código divergente. O carregador também aceita descrição confirmada quando não existe código. Sem confirmação, ou com resposta ambígua, não escolhe outra cor. Uma consulta genérica sem SKU/cor pode retornar imagem representativa do produto, sem comprovar variante histórica. Até três imagens candidatas da cor escolhida são tentadas.

O catálogo também pode consultar um produto sem venda com foto, a partir de seu registro de estoque atual. As permissões existentes continuam obrigatórias: produtos, vendas e imagens, filial autorizada e restrição por vendedor. Um vendedor restrito precisa ter venda elegível do mesmo SKU/produto; não recebe acesso a fotos de produtos sem vínculo com suas vendas.

## Configuração e proteção

`PASSWORD_JOINKEY` contém somente o token Bearer. O Compose o fornece exclusivamente ao serviço `api`. O navegador usa a sessão do painel nas rotas de imagem e recebe somente bytes WebP. A chave não integra URLs, assets, respostas, logs ou arquivos versionados. Sem essa configuração, a segunda base fica desativada.

Metadados e downloads privados usam HTTPS no host exato `ragabesh.joinnetwork.com.br`, sem redirecionamentos. O token acompanha apenas as rotas de integração validadas. URLs públicas em `/uploads/` são baixadas sem esse token; outros hosts e caminhos privados são recusados. A origem principal mantém sua lista de URLs permitidas.

Arquivos aceitos: JPEG, PNG, WebP, GIF e AVIF, com até 5 MiB e 25 milhões de pixels. O servidor decodifica, remove metadados e gera WebP de até 1600 × 1600, preservando a proporção e sem ampliar. Metadados JSON ficam limitados a 512 KiB. Até quatro operações de rede coexistem; a decodificação ocorre uma imagem por vez para limitar o consumo de memória.

O cache em memória dura seis horas para resultados válidos e um minuto para falhas, com até 256 entradas/32 MiB. A identidade do cache inclui a cor comercial confirmada e o SKU. Solicitações simultâneas iguais compartilham a consulta. Após HTTP 429, novas chamadas à alternativa ficam suspensas conforme o `Retry-After`, com intervalo de segurança de 60 segundos a uma hora; a fonte principal continua disponível. Reiniciar a API limpa esse cache. As permissões são verificadas antes de servir qualquer imagem, inclusive quando ela está em cache. Valores de vendas e estoque são preservados; a tabela auxiliar recebe somente metadados visuais, sem cópias das fotos.

## Cobertura e verificação

Uma resposta bem-sucedida da segunda API não garante que o produto possua imagens. Na verificação inicial, a imagem do código de exemplo foi baixada e decodificada; o código não constava no estoque atual. Em uma amostra de oito produtos do catálogo sem URL principal, dois foram encontrados na segunda base, ambos sem fotos, e seis retornaram 404. Uma segunda amostra de doze códigos retornou 404 para todos. Essas amostras não medem a cobertura de todo o catálogo.

Produtos sem imagem válida em ambas as fontes continuam com a indicação de foto indisponível. Para esses casos, é preciso cadastrar imagens na base de origem ou confirmar uma correspondência de códigos diferente antes de implementar outra regra de busca.

Testes automatizados cobrem prioridade da origem principal, erro/ausência/conteúdo corrompido, cor e código divergentes, cache, concorrência, limites, proteção da chave, permissões e interface de computador/celular. Evidência da publicação: [validação das imagens alternativas](validacao-imagens-alternativas.json).
