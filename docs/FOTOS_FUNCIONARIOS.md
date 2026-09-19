# Fotos dos funcionários

## Uso pelo administrador

1. Abra **Funcionários** e selecione a filial pelo código e Fantasia.
2. Localize o vendedor pelo nome ou código ERP.
3. Selecione uma foto JPG, PNG ou WebP de até 2 MB (até 20 megapixels) e clique em **Salvar foto**.
4. A foto aparecerá no cadastro e no ranking. Para substituir, envie outra foto; para excluir, use **Remover foto** e confirme.

O cadastro lista vendedores encontrados no histórico importado da filial. Não cria um novo vendedor no ERP nem exige criar um usuário de acesso. Sem foto, são exibidas as iniciais.

## Acesso e armazenamento

Somente Admin lista os cadastros e altera fotos. Leitura das imagens exige acesso à filial e a ranking ou fila; usuários limitados às próprias vendas recebem somente a própria foto. A chave é empresa/banco, filial e código ERP; vendedores de outras filiais não recebem a imagem automaticamente.

Imagens são validadas, convertidas para JPEG de até 512 pixels e armazenadas no banco do tenant, com autor e data da última alteração. Metadados do arquivo original não são preservados; não se utiliza o nome do arquivo para cadastrar CPF ou nascimento. Os backups existentes incluem as fotos. Nenhuma imagem pessoal é versionada no Git.

O limite do proxy é ampliado somente para `/api/v1/funcionarios/`; demais rotas conservam os limites anteriores. A API exige autenticação e verifica Admin antes de ler uploads. Fotos são servidas com `Cache-Control: no-store`.
