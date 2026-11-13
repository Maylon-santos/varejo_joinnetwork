#!/usr/bin/env python3
"""Portal HTML offline. Somente biblioteca padrão; sem CDN ou chamada à API."""
from pathlib import Path
import html
import json
import re
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
DOC=ROOT/'docs/integracoes'
PAGES=[('README','Visão geral','01'),('autenticacao','Acesso e segurança','02'),('consultas','Consultas REST','03'),('sincronizacao','Sincronização','04'),('webhooks','Webhooks','05'),('administracao','SuperAdmin e auditoria','06'),('dicionario','Dicionário de campos','07'),('implementacao','Arquitetura e aceite','08'),('operacao','Operação e ativação','09')]

def slug(text):
    return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()).strip('-')

def inline(text):
    tokens=[]
    def token(value):
        tokens.append(value);return '\x00'+str(len(tokens)-1)+'\x00'
    text=re.sub(r'`([^`]+)`',lambda m:token('<code>'+html.escape(m[1])+'</code>'),text)
    def link(m):
        label,url=m.groups()
        if url.endswith('.md') and '/' not in url:
            url='#'+url[:-3].lower().replace('readme','visao-geral')
        if re.match(r'(?i)(javascript|data):',url):return html.escape(label)
        return token('<a href="'+html.escape(url,quote=True)+'"'+(' target="_blank" rel="noopener noreferrer"' if url.startswith('https:') else '')+'>'+html.escape(label)+'</a>')
    text=re.sub(r'\[([^\]]+)\]\(([^)]+)\)',link,text)
    text=html.escape(text)
    text=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',text)
    return re.sub(r'\x00(\d+)\x00',lambda m:tokens[int(m[1])],text)

def render(source,prefix):
    lines=source.splitlines();out=[];i=0;in_list=None;sub=False
    def close_list():
        nonlocal in_list
        if in_list:out.append('</'+in_list+'>');in_list=None
    while i<len(lines):
        line=lines[i]
        if not line.strip():close_list();i+=1;continue
        if line.startswith('```'):
            close_list();language=line[3:].strip() or 'texto';body=[];i+=1
            while i<len(lines) and not lines[i].startswith('```'):body.append(lines[i]);i+=1
            out.append('<div class="code-block"><div class="code-head"><span>'+html.escape(language)+'</span><button class="copy-code" type="button" aria-label="Copiar exemplo">Copiar</button></div><pre><code>'+html.escape('\n'.join(body))+'</code></pre></div>');i+=1;continue
        heading=re.match(r'^(#{1,6}) (.+)$',line)
        if heading:
            close_list();level=len(heading[1]);title=heading[2]
            if level==2:
                if sub:out.append('</section>')
                out.append('<section class="doc-section" data-heading="'+html.escape(title,quote=True)+'">');sub=True
            anchor=prefix+'-'+slug(title)
            out.append(f'<h{level} id="{anchor}">{inline(title)}<a class="permalink" href="#{anchor}" aria-label="Link para esta seção">#</a></h{level}>');i+=1;continue
        if line.startswith('|'):
            close_list();rows=[]
            while i<len(lines) and lines[i].startswith('|'):
                rows.append([x.strip().replace('\\|','|') for x in re.split(r'(?<!\\)\|',lines[i].strip().strip('|'))]);i+=1
            if len(rows)>1 and all(re.fullmatch(r':?-+:?',x.strip()) for x in rows[1]):rows.pop(1)
            out.append('<div class="table-wrap" role="region" aria-label="Tabela de referência" tabindex="0"><table><thead><tr>'+''.join('<th>'+inline(x)+'</th>' for x in rows[0])+'</tr></thead><tbody>')
            for row in rows[1:]:out.append('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in row)+'</tr>')
            out.append('</tbody></table></div>');continue
        if line.startswith('>'):
            close_list();quote=[]
            while i<len(lines) and lines[i].startswith('>'):quote.append(lines[i].lstrip('> ').strip());i+=1
            out.append('<aside class="note">'+inline(' '.join(quote))+'</aside>');continue
        listing=re.match(r'^(?:([-*]) |(\d+)\. )(.+)$',line)
        if listing:
            kind='ul' if listing[1] else 'ol'
            if in_list!=kind:close_list();out.append('<'+kind+'>');in_list=kind
            out.append('<li>'+inline(listing[3])+'</li>');i+=1;continue
        close_list();paragraph=[line.strip()];i+=1
        while i<len(lines) and lines[i].strip() and not re.match(r'^(?:#|\||>|```|[-*] |\d+\. )',lines[i]):paragraph.append(lines[i].strip());i+=1
        out.append('<p>'+inline(' '.join(paragraph))+'</p>')
    close_list()
    if sub:out.append('</section>')
    return '\n'.join(out)

spec=json.loads((ROOT/'apis/integracoes.openapi.json').read_text())
fields=sum(len(s.get('properties',{})) for s in spec['components']['schemas'].values())
operations=sum(len(p) for p in spec['paths'].values())
nav=[];articles=[]
for filename,title,number in PAGES:
    key='visao-geral' if filename=='README' else filename
    nav.append(f'<a class="nav-link" href="#{key}"><span>{number}</span>{title}</a>')
    extra='<label class="field-search">Buscar campo ou objeto <input id="field-search" type="search" placeholder="Ex.: idnfe, saldo, NotaFiscal…" autocomplete="off"><small>As tabelas rolam horizontalmente para mostrar a origem e a descrição completa dos campos.</small></label>' if key=='dicionario' else ''
    content=render((DOC/(filename+'.md')).read_text(),key)
    if extra:content=content.replace('<section class="doc-section"',extra+'<section class="doc-section"',1)
    articles.append(f'<article id="{key}" class="doc-article" data-title="{title}"><div class="chapter">CAPÍTULO {number}</div>'+content+'</article>')

css=r'''
:root{--ink:#18283d;--muted:#61738a;--navy:#11243a;--paper:#f4f6fa;--line:#dce3ed;--teal:#007b78;--orange:#db713d;--mono:ui-monospace,SFMono-Regular,Consolas,monospace;font:15px/1.7 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--ink);scroll-behavior:smooth}*{box-sizing:border-box}body{margin:0;background:var(--paper)}a{color:#006b80;text-underline-offset:3px}a:hover{color:#c45a28}button,input{font:inherit}button{cursor:pointer}a:focus-visible,button:focus-visible,input:focus-visible,[tabindex]:focus-visible{outline:3px solid #df915b;outline-offset:4px}button{border:0}.skip{position:fixed;top:-70px;left:20px;z-index:30;background:white;padding:12px}.skip:focus{top:10px}[hidden]{display:none!important}.sidebar{position:fixed;inset:0 auto 0 0;width:264px;background:var(--navy);color:white;padding:34px 24px 24px;display:flex;flex-direction:column;z-index:10}.brand{font-weight:800;letter-spacing:-.7px;font-size:24px}.brand b{color:#73d7ca}.sidebar .caption{color:#a7b7cb;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:6px 0 30px}.version{display:flex;align-items:center;gap:8px;font-size:11px;color:#f5d0a1;background:#23364a;border:1px solid #425466;border-radius:6px;padding:8px 10px;margin-bottom:26px}.version i{width:6px;height:6px;background:#e6a76c;border-radius:100%}nav{display:flex;flex-direction:column;gap:5px}.nav-link{font-size:12px;display:flex;gap:12px;align-items:center;color:#bdc9d8;text-decoration:none;padding:12px 10px;border-radius:7px}.nav-link span{font-family:var(--mono);font-size:10px;color:#7089a5}.nav-link.active,.nav-link:hover{background:#243c54;color:white}.nav-link.active span{color:#6bd3c5}.sidebar-foot{margin-top:auto;border-top:1px solid #35465b;padding-top:22px;font-size:11px;color:#b7c5d7}.sidebar-foot a{display:block;color:#8ee1d3;margin-top:8px;text-decoration:none}.page{margin-left:264px;min-width:0}.topbar{position:sticky;top:0;z-index:9;height:72px;border-bottom:1px solid var(--line);background:#ffffffed;backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 42px}.breadcrumb{font-size:12px;color:var(--muted)}.breadcrumb b{color:var(--ink)}.tools{display:flex;align-items:center;gap:12px}.search{position:relative}.search input{padding:10px 13px;border:1px solid var(--line);border-radius:7px;width:260px;font-size:12px;background:#f8fafc}.print{background:white;border:1px solid var(--line);border-radius:7px;padding:9px 12px;font-size:11px;color:var(--ink)}main{max-width:1260px;padding:38px 42px 70px;margin:auto}.hero{position:relative;overflow:hidden;border:1px solid #cddbdc;background:linear-gradient(115deg,#e9f5f2,#f1f7f7 65%,#edf0f8);border-radius:16px;padding:36px 38px;margin-bottom:28px}.hero:after{content:'{}';position:absolute;right:18px;top:5px;font-family:var(--mono);font-size:150px;letter-spacing:-30px;font-weight:700;color:#bddbdc55;pointer-events:none}.eyebrow{position:relative;z-index:1;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:800;color:var(--teal)}.hero h1{position:relative;z-index:1;max-width:740px;font-size:clamp(28px,3.4vw,43px);letter-spacing:-1.8px;line-height:1.14;margin:13px 0 16px}.hero p{max-width:680px;color:#526b76;font-size:14px;margin:0 0 20px}.hero .base{display:inline-block;position:relative;z-index:1;max-width:100%;overflow-wrap:anywhere;color:#20444b;font:11px var(--mono);padding:11px 13px;background:#ffffffa8;border:1px solid #ccdfdf;border-radius:7px}.hero-actions{position:relative;z-index:1;display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.hero-actions a{padding:10px 15px;border-radius:7px;background:var(--navy);color:white;text-decoration:none;font-size:11px;font-weight:650}.hero-actions a.secondary{background:white;color:var(--ink);border:1px solid #c7d5dc}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:0 0 25px}.stat{border:1px solid var(--line);background:white;border-radius:10px;padding:18px 20px}.stat b{display:block;font-size:26px;line-height:1.3;letter-spacing:-.8px}.stat small{display:block;font-size:11px;color:var(--muted);margin-top:5px}.draft-banner{padding:15px 19px;background:#fff5e8;border:1px solid #f0ddc2;color:#75552f;border-radius:9px;font-size:12px;margin-bottom:25px}.flow{background:var(--navy);border-radius:12px;padding:24px;margin-bottom:26px;color:white;overflow:hidden}.flow-title{display:flex;justify-content:space-between;gap:10px;margin-bottom:20px;font-size:11px;letter-spacing:.2px}.flow-title span{color:#92cfc8}.flow-grid{display:grid;grid-template-columns:1fr 24px 1fr 24px 1fr;gap:8px;align-items:center}.flow-node{border:1px solid #46586b;border-radius:8px;padding:17px 12px;text-align:center;font-size:12px}.flow-node small{display:block;color:#a9bdd1;font-size:10px;margin-top:4px}.flow-node.focus{border-color:#4cae9e;background:#1f4349}.arrow{color:#73cdbf;text-align:center}.flow-note{color:#a7b8ca;font-size:11px;margin-top:15px}.doc-article{background:white;border:1px solid var(--line);border-radius:12px;padding:32px 34px;margin:25px 0;scroll-margin-top:95px;min-width:0;box-shadow:0 2px 6px #18283d03}.chapter{color:#7c8aa0;font:10px var(--mono);letter-spacing:1.5px;margin-bottom:8px}.doc-article h1{font-size:27px;letter-spacing:-.8px;line-height:1.25;margin:0 0 20px}.doc-article h2{font-size:19px;letter-spacing:-.4px;line-height:1.4;margin:0 0 15px;scroll-margin-top:95px}.doc-article h3{font-size:16px;scroll-margin-top:95px}.doc-section{border-top:1px solid #e8edf3;padding-top:26px;margin-top:28px;min-width:0}.doc-section h2 code{font-size:16px}.doc-article p,.doc-article li{font-size:13px;color:#465870;overflow-wrap:anywhere}.doc-article p{margin:12px 0 17px}.doc-article ul,.doc-article ol{padding-left:22px}.doc-article li{padding-left:3px;margin:8px 0}.doc-article strong{color:#233d55}.note{border-left:3px solid #d6964a;background:#fff9ef;padding:12px 16px;margin:17px 0 23px;color:#755b39;font-size:12px;border-radius:0 7px 7px 0}.permalink{font-size:13px;opacity:0;text-decoration:none;margin-left:10px;color:#8e9fb2}h1:hover .permalink,h2:hover .permalink,.permalink:focus{opacity:1}code{font-family:var(--mono);font-size:.9em;background:#edf3f7;color:#22556c;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}.code-block{background:#12263b;border:1px solid #263c50;border-radius:9px;overflow:hidden;margin:18px 0 23px}.code-head{display:flex;justify-content:space-between;align-items:center;background:#1e3348;border-bottom:1px solid #35485b;padding:7px 13px;color:#9ac8cd;font:10px var(--mono);text-transform:uppercase;letter-spacing:.8px}.copy-code{padding:4px 8px;background:#2b445d;color:#daebf4;border-radius:4px;font:10px var(--mono);text-transform:none;letter-spacing:0}.code-block pre{margin:0;padding:20px;overflow:auto;max-height:580px;line-height:1.8;font-size:11px;tab-size:2}.code-block code{background:none;color:#d0e4ef;padding:0;white-space:pre;overflow-wrap:normal;font-size:inherit}.table-wrap{max-width:100%;overflow:auto;border:1px solid var(--line);border-radius:8px;margin:18px 0 23px}table{border-collapse:collapse;width:100%;font-size:11px;min-width:640px}th{background:#f1f5f9;color:#456077;text-align:left;font-size:10px;font-weight:750;padding:12px 13px;border-bottom:1px solid var(--line)}td{padding:13px;border-bottom:1px solid #e9eef4;color:#53657b;vertical-align:top;line-height:1.65;overflow-wrap:anywhere}tbody tr:last-child td{border-bottom:0}tbody tr:nth-child(even){background:#fbfcfe}td:first-child{font-weight:650;color:#28465f}td code{font-size:10px}.field-search{display:block;font-size:11px;font-weight:650;color:var(--muted);margin:0 0 24px;padding:16px;background:#f0f6f8;border-radius:7px}.field-search input{display:block;width:100%;margin-top:8px;padding:10px 12px;background:white;border:1px solid #ccdbe1;border-radius:6px;font-size:12px}.search-status{font-size:12px;color:var(--muted);margin:14px 0;min-height:20px}.empty-search{border:1px dashed #a7b8c9;border-radius:10px;padding:30px;text-align:center;color:var(--muted);background:white}.footer{border-top:1px solid var(--line);padding-top:22px;color:#74849a;font-size:11px}.footer a{font-size:11px}.schema-hidden{display:none!important}
#dicionario table{min-width:1080px}#dicionario th:nth-child(1),#dicionario td:nth-child(1){min-width:150px}#dicionario th:nth-child(2),#dicionario td:nth-child(2){min-width:115px}#dicionario th:nth-child(3),#dicionario td:nth-child(3){min-width:110px}#dicionario th:nth-child(4),#dicionario td:nth-child(4){min-width:220px}#dicionario th:nth-child(5),#dicionario td:nth-child(5){min-width:390px}.field-search small{display:block;margin-top:10px;font-size:10px;font-weight:400}
@media(min-width:1600px){main{padding-left:60px;padding-right:60px}.doc-article{padding:40px 44px}}@media(max-width:1100px){.sidebar{width:220px;padding:28px 16px}.page{margin-left:220px}.topbar{padding:0 24px}.breadcrumb{display:none}main{padding:28px 24px}.hero{padding:28px}.doc-article{padding:27px 24px}.search input{width:250px}.stats{gap:10px}.stat{padding:14px}}@media(max-width:760px){.sidebar{position:relative;width:100%;padding:19px 20px 14px;height:auto}.brand{font-size:21px}.sidebar .caption{margin:1px 0 13px;font-size:9px}.version{position:absolute;right:16px;top:20px;font-size:9px;padding:5px 8px;margin:0}nav{flex-direction:row;overflow:auto;gap:5px}.nav-link{white-space:nowrap;font-size:10px;padding:9px 10px}.nav-link span{display:none}.sidebar-foot{display:none}.page{margin:0}.topbar{height:63px;padding:0 16px}.tools{width:100%;gap:8px}.search{flex:1;min-width:0}.search input{width:100%;font-size:12px}.print{font-size:10px;padding:10px}main{padding:21px 15px 40px}.hero{padding:24px 22px;border-radius:11px}.hero h1{font-size:30px;letter-spacing:-1px}.hero p{font-size:12px}.hero .base{font-size:9px;line-height:1.7}.hero:after{font-size:95px;right:9px;top:16px}.hero-actions a{font-size:10px}.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stat b{font-size:23px}.stat small{font-size:10px}.draft-banner{font-size:11px}.flow{padding:19px 15px}.flow-title{font-size:10px}.flow-title span{display:none}.flow-grid{grid-template-columns:1fr 14px 1fr;gap:5px}.flow-grid .extra{display:none}.flow-node{font-size:10px;padding:14px 7px}.flow-node small{font-size:9px}.flow-note{font-size:10px}.doc-article{padding:25px 19px;scroll-margin-top:80px}.doc-article h1{font-size:24px}.doc-article h2{font-size:18px}.doc-article p,.doc-article li{font-size:12px}.code-block pre{padding:15px;font-size:10px}.doc-section{margin-top:23px;padding-top:24px}.permalink{opacity:1;font-size:10px}.chapter{font-size:9px}table{font-size:10px;min-width:620px}td,th{padding:10px}.note{font-size:11px}.footer{font-size:10px}}@media(prefers-reduced-motion:reduce){:root{scroll-behavior:auto}}@media print{#dicionario table{min-width:0}#dicionario th,#dicionario td{min-width:0!important}.sidebar,.topbar,.hero-actions,.copy-code,.permalink,.field-search,.search-status,.empty-search{display:none!important}.page{margin:0}main{max-width:none;padding:0}.hero{break-inside:avoid;background:#f3f7f7;padding:22px}.hero:after{display:none}.doc-article{border:0;padding:20px 0;margin:0;box-shadow:none;break-before:page}.doc-section{break-inside:auto}body{background:white}.stats{break-inside:avoid}.table-wrap{overflow:visible;border-radius:0}table{min-width:0;font-size:8px}td,th{padding:7px;overflow-wrap:anywhere}.code-block{background:#f6f8fa!important}.code-head{background:#e9eef2;color:#233d55}.code-block pre{white-space:pre-wrap;overflow:visible;max-height:none;font-size:8px}.code-block code{white-space:pre-wrap;color:#20364d}.flow{display:none}.schema-hidden{display:block!important}[hidden].doc-article,[hidden].doc-section{display:block!important}a{color:#183f5a}.footer{margin-top:20px}}
'''
js=r'''
const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const search=document.getElementById('search'),fieldSearch=document.getElementById('field-search'),status=document.getElementById('search-status');
function filter(){
 const query=normalize(search.value.trim()),field=normalize(fieldSearch?.value.trim()||'');let visible=0;
 document.querySelectorAll('.doc-article').forEach(article=>{
  const dictionary=article.id==='dicionario';let matches=0;
  article.querySelectorAll('.doc-section').forEach(section=>{
   const match=(!query||normalize(section.textContent).includes(query))&&(!dictionary||!field||normalize(section.textContent).includes(field));
   section.hidden=!match;if(match)matches++;
  });
  article.hidden=!!query&&!matches&&!normalize(article.dataset.title).includes(query);
  if(dictionary&&field&&!matches)article.hidden=true;
  if(!article.hidden)visible++;
 });
 document.getElementById('no-results').hidden=visible>0;
 status.textContent=query||field?`${visible} capítulos com resultados. Limpe os filtros para voltar ao guia completo.`:'';
}
search.addEventListener('input',filter);fieldSearch?.addEventListener('input',filter);
document.querySelectorAll('.copy-code').forEach(button=>button.addEventListener('click',async()=>{
 const text=button.closest('.code-block').querySelector('code').textContent;
 try{await navigator.clipboard.writeText(text);button.textContent='Copiado';}
 catch{const t=document.createElement('textarea');t.value=text;document.body.append(t);t.select();document.execCommand('copy');t.remove();button.textContent='Copiado';}
 setTimeout(()=>button.textContent='Copiar',1800);
}));
document.getElementById('print').addEventListener('click',()=>window.print());
document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>{search.value='';fieldSearch.value='';filter();}));
const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.hash==='#'+entry.target.id));}},{rootMargin:'-10% 0px -65% 0px'});
document.querySelectorAll('.doc-article').forEach(a=>observer.observe(a));
document.addEventListener('keydown',event=>{if(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();search.focus();}if(event.key==='Escape'&&document.activeElement===search){search.value='';filter();search.blur();}});
'''
page='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Join Network · Developer Guide</title><style>CSS</style></head><body>
<a class="skip" href="#content">Ir para o conteúdo</a><aside class="sidebar"><div class="brand">Join <b>Network</b></div><div class="caption">Developer Guide</div><div class="version"><i></i>Implementação · v0.1</div><nav aria-label="Capítulos">NAV</nav><div class="sidebar-foot">API de integração · Varejo<a href="../../apis/integracoes.openapi.json" download>↗ Baixar OpenAPI 3.1</a><a href="README.md">↗ Guia em Markdown</a><p>Referência técnica<br>13 novembro 2026</p></div></aside>
<div class="page"><header class="topbar"><div class="breadcrumb">Developers <span aria-hidden="true">/</span> <b>Integrações de varejo</b></div><div class="tools"><label class="search"><span class="sr-only" hidden>Buscar na documentação</span><input id="search" aria-label="Buscar na documentação" type="search" placeholder="Buscar na documentação…  /" autocomplete="off"></label><button id="print" class="print" type="button">Imprimir / PDF</button></div></header>
<main id="content"><section class="hero"><div class="eyebrow">API + Webhooks · Integrações de varejo</div><h1>Seus dados, conectados<br>com segurança.</h1><p>Consulte vendas, filiais, produtos e estoque. Receba eventos de venda e mantenha sua integração consistente, mesmo com correções e cancelamentos.</p><div class="base">https://api-varejo.aeropostale.joinnetwork.com.br</div><div class="hero-actions"><a href="#autenticacao">Começar pelo acesso →</a><a class="secondary" href="../../apis/integracoes.openapi.json" download>Baixar OpenAPI</a><a class="secondary" href="#webhooks">Explorar webhooks</a></div></section>
<div class="stats"><div class="stat"><b>OPS</b><small>operações implementadas</small></div><div class="stat"><b>FIELDS</b><small>campos documentados</small></div><div class="stat"><b>4</b><small>recursos comerciais</small></div><div class="stat"><b>2</b><small>modelos de integração</small></div></div>
<div class="draft-banner"><strong>Implementado e testado em ambiente isolado.</strong> A publicação do domínio e a homologação com um consumidor ainda estão pendentes. Todos os dados de exemplo são fictícios.</div>
<section class="flow" aria-label="Fluxo: sistema integrador consulta API com GET e recebe notificações assinadas por webhook"><div class="flow-title"><b>Uma base de dados. Duas formas de conectar.</b><span>Consulta + notificação + reconciliação</span></div><div class="flow-grid"><div class="flow-node">Seu sistema<small>Token próprio · inbox durável</small></div><div class="arrow">⇄</div><div class="flow-node focus">API + Webhooks<small>GET protegido · POST assinado</small></div><div class="arrow extra">←</div><div class="flow-node extra">Projeção local<small>Dados importados · revisões</small></div></div><div class="flow-note">GET externo não consulta o ERP. Eventos podem repetir ou chegar fora de ordem: a revisão protege a consistência.</div></section>
<div id="search-status" class="search-status" aria-live="polite"></div><div id="no-results" class="empty-search" hidden>Nenhum resultado. Tente “nota fiscal”, “saldo” ou “assinatura”.</div>ARTICLES
<footer class="footer">Join Network · Documentação técnica para desenvolvedores · Contrato 0.1.0<br>OpenAPI, dicionário e exemplos compartilham o mesmo modelo. Este arquivo funciona offline e não faz chamadas à API.<br><a href="implementacao.md">Fontes, limites conhecidos e plano de implementação</a></footer></main></div><script>JS</script></body></html>'''
page=page.replace('<style>CSS</style>','<style>'+css+'</style>').replace('NAV',''.join(nav)).replace('ARTICLES','\n'.join(articles)).replace('<b>FIELDS</b>','<b>'+str(fields)+'</b>').replace('<b>OPS</b>','<b>'+str(operations)+'</b>').replace('<script>JS</script>','<script>'+js+'</script>')
(DOC/'index.html').write_text(page)
print(json.dumps({'portal':'docs/integracoes/index.html','capitulos':len(PAGES),'campos':fields,'bytes':len(page.encode())}))
