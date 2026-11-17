# Imagens de produtos: fonte principal e alternativa

O painel mantém a imagem recebida na importação como primeira opção. Se a URL estiver ausente, retornar erro, exceder os limites ou não contiver uma imagem decodificável, o servidor consulta a base alternativa. O mesmo fluxo atende miniaturas e ampliação no catálogo, nos rankings e nos detalhes das vendas.

## Correspondência

A consulta usa exatamente o `cod_produto` do cadastro/item em `GET https://ragabesh.joinnetwork.com.br/api/integrations/products/{codigo}/images`. Não usa o identificador interno numérico do cadastro, SKU ou código de barras como substituto. A resposta precisa confirmar o mesmo código.

Quando o estoque atual informa uma cor para o SKU e produto correspondentes, a seleção exige igualdade com o código ou nome da cor da segunda base, ignorando acentos e maiúsculas. Sem correspondência, não escolhe outra cor. Sem cor disponível, usa a primeira imagem por posição do produto. Isso não comprova que a foto representa uma variante histórica específica. Até três imagens candidatas são tentadas.

O catálogo também pode consultar um produto sem venda com foto, a partir de seu registro de estoque atual. As permissões existentes continuam obrigatórias: produtos, vendas e imagens, filial autorizada e restrição por vendedor. Um vendedor restrito precisa ter venda elegível do mesmo SKU/produto; não recebe acesso a fotos de produtos sem vínculo com suas vendas.

## Configuração e proteção

`PASSWORD_JOINKEY` contém somente o token Bearer. O Compose o fornece exclusivamente ao serviço `api`. O navegador usa a sessão do painel nas rotas de imagem e recebe somente bytes WebP. A chave não integra URLs, assets, respostas, logs ou arquivos versionados. Sem essa configuração, a segunda base fica desativada.

Metadados e downloads privados usam HTTPS no host exato `ragabesh.joinnetwork.com.br`, sem redirecionamentos. O token acompanha apenas as rotas de integração validadas. URLs públicas em `/uploads/` são baixadas sem esse token; outros hosts e caminhos privados são recusados. A origem principal mantém sua lista de URLs permitidas.

Arquivos aceitos: JPEG, PNG, WebP, GIF e AVIF, com até 5 MiB e 25 milhões de pixels. O servidor decodifica, remove metadados e gera WebP de até 1600 × 1600, preservando a proporção e sem ampliar. Metadados JSON ficam limitados a 512 KiB. Até quatro operações de rede coexistem; a decodificação ocorre uma imagem por vez para limitar o consumo de memória.

O cache em memória dura seis horas para resultados válidos e um minuto para falhas, com até 256 entradas/32 MiB. Solicitações simultâneas iguais compartilham a consulta. Reiniciar a API limpa esse cache. As permissões são verificadas antes de servir qualquer imagem, inclusive quando ela está em cache. O banco comercial não é alterado nem recebe cópias das fotos.

## Cobertura e verificação

Uma resposta bem-sucedida da segunda API não garante que o produto possua imagens. Na verificação inicial, a imagem do código de exemplo foi baixada e decodificada; o código não constava no estoque atual. Em uma amostra de oito produtos do catálogo sem URL principal, dois foram encontrados na segunda base, ambos sem fotos, e seis retornaram 404. Uma segunda amostra de doze códigos retornou 404 para todos. Essas amostras não medem a cobertura de todo o catálogo.

Produtos sem imagem válida em ambas as fontes continuam com a indicação de foto indisponível. Para esses casos, é preciso cadastrar imagens na base de origem ou confirmar uma correspondência de códigos diferente antes de implementar outra regra de busca.

Testes automatizados cobrem prioridade da origem principal, erro/ausência/conteúdo corrompido, cor e código divergentes, cache, concorrência, limites, proteção da chave, permissões e interface de computador/celular. Evidência da publicação: [validação das imagens alternativas](validacao-imagens-alternativas.json).
