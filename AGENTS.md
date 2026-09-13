# Orientações do projeto

- Leia `COMECE_AQUI.md` e o mapa de progresso no início de `ROADMAP_MVP.md`. As atualizações recentes prevalecem sobre registros históricos.
- Maylon pediu que as alterações concluídas sejam registradas em commits. Valide o escopo alterado, atualize o progresso e faça commit ao concluir. Use o remoto configurado; não force push nem inclua segredos.
- Correções pessoais ficam em `docs/central/correcoes/correcao.md`. Marque `[x]` somente após implementação e verificação. Preserve os pedidos originais e adicione a evidência de conclusão.
- `docs/central/` é uma central pessoal ignorada pelo Git. Use `python3 scripts/gerar-central.py` para atualizar o HTML; o gerador preserva edições incorporadas e guarda a versão anterior em `artifacts/central/`. Não force a inclusão de arquivos ignorados.
- `.env`, backups, dumps, amostras pessoais e capturas com dados comerciais ficam fora do Git. Nunca exiba credenciais ou conteúdos pessoais em logs de verificação.
- O piloto de produção é `https://aeropostale.joinnetwork.com.br`, em `/opt/aeropostale-varejo` via alias SSH `localweb`. Leia `deploy/README.md` antes de implantar. Preserve os outros serviços do servidor.
- O worker local deve continuar desativado enquanto o worker remoto estiver ativo. Homologação do ERP, outras filiais, cargos e SaaS não são implicitamente concluídos pela publicação do piloto.
