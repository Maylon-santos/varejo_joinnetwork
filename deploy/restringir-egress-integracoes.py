#!/usr/bin/env python3
"""Aplica regras próprias aos IPs fixos das integrações, preservando outros serviços."""
import argparse
import ipaddress
import json
from pathlib import Path
import subprocess


def executar(args, obrigatorio=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=15)
    if obrigatorio and result.returncode:
        raise RuntimeError('Falha ao aplicar a política de rede das integrações')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default='/etc/aeropostale-integracoes-egress.json')
    parser.add_argument('--verificar', action='store_true', help='Valida o destino e mostra o plano sem alterar regras.')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text())
    if set(config) != {'rede', 'api_ipv4', 'worker_ipv4', 'permitir_https_publico'} or type(config['permitir_https_publico']) is not bool:
        raise ValueError('Configuração de rede inválida')
    if config['rede'] != 'aeropostale-varejo_default':
        raise ValueError('A política é exclusiva da rede do Aeropostale Varejo')
    network = json.loads(executar(['docker', 'network', 'inspect', config['rede']]).stdout)[0]
    if network['EnableIPv6']:
        raise ValueError('Esta política requer rede Docker somente IPv4')
    subnet = ipaddress.ip_network(network['IPAM']['Config'][0]['Subnet'])
    sources = [str(ipaddress.IPv4Address(config[k])) for k in ('api_ipv4', 'worker_ipv4')]
    if len(set(sources)) != 2 or any(ipaddress.ip_address(s) not in subnet for s in sources):
        raise ValueError('IPs fixos inválidos para a rede configurada')
    expected = dict(zip(sources, ('aeropostale-varejo-integracoes-api-1', 'aeropostale-varejo-integracoes-worker-1')))
    database = None
    for container in network['Containers'].values():
        address = container['IPv4Address'].split('/')[0]
        if address in expected and container['Name'] != expected[address]:
            raise ValueError('IP reservado ocupado por outro serviço')
        if container['Name'] == 'aeropostale-varejo-postgres-1':
            database = address
    if database is None:
        raise ValueError('PostgreSQL do projeto não encontrado na rede')
    if '-j DOCKER-USER' not in executar(['iptables', '-S', 'FORWARD']).stdout:
        raise ValueError('Docker não encaminha tráfego pela chain DOCKER-USER')
    if Path('/proc/sys/net/bridge/bridge-nf-call-iptables').read_text().strip() != '1':
        raise ValueError('Filtragem de tráfego da bridge não está ativa')
    plan = {'origens': sources, 'postgres': database, 'portaPostgres': 5432,
            'httpsPublicoWorker': config['permitir_https_publico'], 'outrosServicosPreservados': True}
    if args.verificar:
        print(json.dumps(plan))
        return
    # Cada salto é limitado aos dois IPs fixos; nunca limpar chains gerais do Docker.
    for chain in ('AERO-INT-FWD', 'AERO-INT-HOST'):
        executar(['iptables', '-w', '-N', chain], obrigatorio=False)
        executar(['iptables', '-w', '-F', chain])
        executar(['iptables', '-w', '-A', chain, '-m', 'conntrack', '--ctstate', 'ESTABLISHED,RELATED', '-j', 'RETURN'])
    executar(['iptables', '-w', '-A', 'AERO-INT-FWD', '-d', database, '-p', 'tcp', '--dport', '5432', '-j', 'RETURN'])
    if config['permitir_https_publico']:
        worker = config['worker_ipv4']
        for resolver in ('1.1.1.1', '8.8.8.8'):
            for protocol in ('udp', 'tcp'):
                executar(['iptables', '-w', '-A', 'AERO-INT-FWD', '-s', worker, '-d', resolver, '-p', protocol, '--dport', '53', '-j', 'RETURN'])
        for blocked in ('0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
                        '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
                        '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24',
                        '224.0.0.0/4', '240.0.0.0/4'):
            executar(['iptables', '-w', '-A', 'AERO-INT-FWD', '-d', blocked, '-j', 'REJECT'])
        executar(['iptables', '-w', '-A', 'AERO-INT-FWD', '-s', worker, '-p', 'tcp', '--dport', '443', '-j', 'RETURN'])
    executar(['iptables', '-w', '-A', 'AERO-INT-FWD', '-j', 'REJECT'])
    executar(['iptables', '-w', '-A', 'AERO-INT-HOST', '-j', 'REJECT'])
    for source in sources:
        for parent, chain in (('DOCKER-USER', 'AERO-INT-FWD'), ('INPUT', 'AERO-INT-HOST')):
            jump = ['-s', source, '-j', chain]
            if executar(['iptables', '-w', '-C', parent] + jump, obrigatorio=False).returncode:
                executar(['iptables', '-w', '-I', parent, '1'] + jump)
    print(json.dumps({**plan, 'aplicado': True}))


if __name__ == '__main__':
    main()
