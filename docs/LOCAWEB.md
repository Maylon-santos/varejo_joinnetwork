# Preparação da implantação — 11/09/2026

## Publicação — 12/09/2026

- Piloto publicado em **https://aeropostale.joinnetwork.com.br** na Locaweb.
- Banco restaurado e conferido: 3.991 operações, 9.541 itens e 75 cancelamentos; hashes, totais e checkpoints iguais à origem antes de ativar o worker.
- HTTPS, login, indicadores, detalhes, logout e restrições de acesso verificados. Evidência: `docs/validacao-producao.json`.
- Worker remoto ativo; worker local parado e desabilitado no `.env`.
- Backup diário configurado; cópia inicial também preservada localmente. Retenção e cópia externa recorrente pendentes.
- Operação: [guia de implantação](../deploy/README.md). Homologação dos números permanece pendente.

Esta publicação prevalece sobre referências históricas a implantação ou HTTPS pendentes abaixo.

## Limpeza concluída — 12/09/2026

Autorização de Maylon: apagar `lab/api-aeropostale-painel` e seguir com a limpeza proposta.

- Pasta `/home/joinnetwork/lab/api-aeropostale-painel` removida; ausência verificada.
- Domínio antigo `appjoinnetwork.com.br` configurado para responder HTTP 410; resposta conferida localmente por HTTPS. Configuração anterior preservada em `/root/backups/retirada-aeropostale-Lbq6lv/appjoinnetwork`. Esse backup é somente da configuração Nginx, não dos arquivos excluídos.
- Journals antigos: 1,5 GB liberados; tamanho final informado de 256 MB. Limpeza pontual, sem mudança da política de retenção.
- Cache de build Docker: 345,8 MB liberados.
- Disco: de 97% ocupado e 543 MB livres imediatamente antes da limpeza para 73% ocupado e 4,8 GB livres.
- Os 12 containers existentes permaneceram ativos, sem reinício. Nginx validado e recarregado com sucesso. Bancos, volumes e imagens das aplicações preservados.
- Configuração antiga não habilitada `/etc/nginx/sites-available/aeropostale` não foi alterada.

O bloqueio imediato de espaço foi resolvido. A implantação ainda requer definição do domínio do novo piloto, preparação e teste de backup/restauração e configuração de produção. O diagnóstico abaixo documenta o estado anterior à limpeza.


## Diagnóstico observado

Consulta por SSH usando o alias local `localweb`, sem alterações remotas.

| Item | Resultado |
| --- | --- |
| Sistema | Ubuntu 20.04.6 LTS, x86_64 |
| Docker / Compose | 26.1.3 / 2.27.1 |
| Memória | 3.908 MiB totais; 2.672 MiB disponíveis na consulta |
| Partição raiz | 19 GB; 97% ocupada; 554 MB disponíveis |
| Aplicações | 12 containers ativos, incluindo bancos e outros projetos |
| Proxy | Nginx com sites existentes; portas 80 e 443 ocupadas |
| Porta prevista do piloto | 3100 em loopback, livre na consulta |

O piloto ainda não foi copiado nem publicado no servidor. A implantação está impedida pelo pouco espaço disponível; a memória observada não representa um teste de carga.

## Espaço e ação proposta

- Journals ativos e arquivados: 1,8 GB. Proposta sujeita à autorização: `journalctl --rotate --vacuum-size=300M`. Remove journals arquivados mais antigos; o limite não é garantia do tamanho total dos arquivos ativos.
- Cache de build Docker: 345,8 MB recuperáveis na consulta. Proposta sujeita à autorização: `docker builder prune --force`. Remove cache de builds sem uso; builds futuros podem demorar mais.
- Imagens: 1,749 GB classificados como recuperáveis pelo Docker. Não há proposta de remoção: podem ser necessárias para rollback de outros projetos.
- Volumes: 731,4 MB classificados como recuperáveis pelo Docker. Não remover; ausência de vínculo com container não comprova que os dados são descartáveis.

Após eventual limpeza autorizada, medir novamente o espaço antes de transferir imagens, banco ou backups. Expansão de disco permanece uma alternativa caso a folga seja insuficiente. Não foi executada nenhuma limpeza.

## Sequência restante

1. Resolver capacidade de armazenamento e confirmar o domínio específico do piloto.
2. Preparar backup dos bancos central e do tenant, verificar restauração isolada e definir armazenamento externo e retenção.
3. Preparar diretório próprio e configuração de produção, mantendo o PostgreSQL e a API em loopback. As imagens atuais não incluem os scripts de migrations e criação de Admin; preparar uma rotina administrativa antes do primeiro deploy.
4. Transferir e restaurar o histórico validado, aplicar migrations e conferir identidade do tenant, contagens, cancelamentos e operações confirmadas como erro do ERP.
5. Configurar o site próprio no Nginx e HTTPS para o domínio confirmado; validar login, filtros, detalhes e isolamento. Preservar as configurações das aplicações existentes.
6. Definir o momento de parar o worker local e ativar o remoto. Bancos separados não compartilham o bloqueio de exclusividade do worker.
7. Homologar indicadores com Maylon e registrar backup, procedimento de recuperação e operação do piloto.

## Verificação local nesta retomada

API e PostgreSQL saudáveis no Docker; worker em execução. `npm test`: 26 aprovados. `npm run test:integration`: 19 aprovados, incluindo preservação do cabeçalho e da confirmação de erro ERP após reimportação. Não houve nova verificação visual nesta rodada.
