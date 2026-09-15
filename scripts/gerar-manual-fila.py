#!/usr/bin/env python3
"""Gera HTML offline e PDF do manual a partir de um único Markdown.

Uso: python3 scripts/gerar-manual-fila.py
Requer reportlab (PDF). Para fonte alternativa, informe --font e --font-bold.
O Markdown usa títulos, parágrafos, listas, tabelas e <!-- pagina -->.
"""
import argparse
from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'docs/MANUAL_FILA_ATENDIMENTO.md'
HTML = ROOT / 'output/html/manual-fila-atendimento.html'
PDF = ROOT / 'output/pdf/manual-fila-atendimento.pdf'


def inline(text, pdf=False):
    text = re.sub(r'\*\*(.*?)\*\*', r'<b>\1</b>' if pdf else r'<strong>\1</strong>', escape(text))
    return text


def blocks(source):
    lines = source.strip().splitlines()
    result = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        i += 1
        if not line:
            continue
        if line.startswith('#'):
            match = re.fullmatch(r'(#{1,3}) (.+)', line)
            if not match:
                raise ValueError(f'Título não suportado: {line}')
            result.append(('h' + str(len(match[1])), match[2]))
        elif line.startswith('|'):
            rows = [line]
            while i < len(lines) and lines[i].startswith('|'):
                rows.append(lines[i].strip())
                i += 1
            result.append(('table', [[c.strip() for c in row.strip('|').split('|')]
                                     for row in rows if not re.fullmatch(r'[| :\-]+', row)]))
        elif line.startswith('- '):
            items = [line[2:]]
            while i < len(lines) and lines[i].startswith('- '):
                items.append(lines[i][2:])
                i += 1
            result.append(('ul', items))
        elif re.match(r'\d+\. ', line):
            items = [re.sub(r'^\d+\. ', '', line)]
            while i < len(lines) and re.match(r'\d+\. ', lines[i]):
                items.append(re.sub(r'^\d+\. ', '', lines[i]))
                i += 1
            result.append(('ol', items))
        elif line.startswith('> '):
            result.append(('quote', line[2:]))
        else:
            result.append(('p', line))
    return result


CSS = '''
:root{--ink:#192845;--muted:#536478;--accent:#b43c37;--line:#dce3ec;--paper:#f1f4f8}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:var(--paper);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
.layout{display:grid;grid-template-columns:275px minmax(0,1fr)}aside{background:var(--ink);color:white;padding:32px 24px;position:sticky;top:0;height:100vh;overflow:auto}
.brand{font-weight:800;font-size:22px}.edition{color:#c9d3e4;font-size:13px}nav{margin-top:28px}nav a{display:block;color:#e3e9f2;text-decoration:none;padding:10px 0;border-bottom:1px solid #394660;font-size:14px;line-height:1.45}nav a:hover{color:white;text-decoration:underline}
a:focus-visible,button:focus-visible{outline:3px solid #edb055;outline-offset:4px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}.actions a,.actions button{background:white;border:0;border-radius:6px;color:var(--ink);padding:10px 12px;text-decoration:none;font:600 13px/1.4 Arial;cursor:pointer}
main{min-width:0;max-width:1080px;padding:36px;margin:0 auto;width:100%}.page{background:white;border:1px solid var(--line);border-radius:12px;padding:36px 42px;margin-bottom:28px;scroll-margin-top:24px}.kicker{color:var(--accent);text-transform:uppercase;letter-spacing:1.5px;font-size:11px;font-weight:800}
h1{font-size:48px;line-height:1.08;letter-spacing:-1.8px;margin:18px 0}h2{font-size:28px;line-height:1.2;letter-spacing:-.6px;margin:18px 0 24px}h3{font-size:18px;margin:24px 0 8px}p{margin:10px 0 14px;overflow-wrap:anywhere}li{padding-left:4px;margin:8px 0}ul,ol{padding-left:24px}strong{font-weight:700}blockquote{border-left:4px solid var(--accent);background:#fff4ef;padding:15px 18px;margin:22px 0}
.table-wrap{max-width:100%;overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5;margin:12px 0 20px;table-layout:fixed}th,td{text-align:left;vertical-align:top;padding:11px 12px;border:1px solid var(--line);overflow-wrap:break-word}th{background:#edf1f7}tbody tr:nth-child(even){background:#f8fafc}.check{list-style:none;padding-left:0}.box{display:inline-block;width:13px;height:13px;border:1px solid #718095;margin-right:8px}.footer{color:var(--muted);font-size:12px;padding:0 8px 24px}
@media(max-width:850px){.layout{grid-template-columns:1fr}aside{position:static;height:auto;padding:22px}nav{margin-top:15px;display:grid;grid-template-columns:1fr 1fr;gap:0 18px}main{padding:16px}.page{padding:25px 20px}h1{font-size:40px}h2{font-size:25px}th,td{padding:8px;font-size:13px}}
@media(max-width:440px){nav{grid-template-columns:1fr}th,td{font-size:12px;padding:7px}.page{padding:22px 15px}main{padding:10px}}
@media print{@page{size:A4;margin:15mm}body{background:white;font-size:10pt;line-height:1.35}.layout{display:block}aside,.footer{display:none}main{padding:0;max-width:none}.page{border:0;border-radius:0;padding:0;margin:0;break-after:page}.page:last-child{break-after:auto}h1{font-size:34pt}h2{font-size:21pt}h3{font-size:12pt;margin:15px 0 5px}p,li{margin:6px 0}table{font-size:9pt;margin:8px 0}th,td{padding:7px}tr,blockquote{break-inside:avoid}blockquote{margin:12px 0;padding:10px}}
'''


def build_html(pages):
    sections, nav = [], []
    for number, page in enumerate(pages, 1):
        title = next(value for kind, value in page if kind == 'h2')
        nav.append(f'<a href="#secao-{number}">{escape(title)}</a>')
        parts = [f'<section class="page" id="secao-{number}"><div class="kicker">Guia de treinamento / {number:02d}</div>']
        for kind, value in page:
            if kind in ('h1', 'h2', 'h3', 'p'):
                parts.append(f'<{kind}>{inline(value)}</{kind}>')
            elif kind == 'quote':
                parts.append(f'<blockquote>{inline(value)}</blockquote>')
            elif kind in ('ul', 'ol'):
                check = kind == 'ul' and all(item.startswith('[ ] ') for item in value)
                parts.append(f'<{kind}' + (' class="check"' if check else '') + '>')
                for item in value:
                    parts.append('<li>' + ('<span class="box" aria-label="A conferir"></span>' + inline(item[4:]) if check else inline(item)) + '</li>')
                parts.append(f'</{kind}>')
            elif kind == 'table':
                parts.append('<div class="table-wrap"><table><thead><tr>' + ''.join(f'<th scope="col">{inline(c)}</th>' for c in value[0]) + '</tr></thead><tbody>')
                parts.extend('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in row) + '</tr>' for row in value[1:])
                parts.append('</tbody></table></div>')
        sections.append(''.join(parts) + '</section>')
    HTML.parent.mkdir(parents=True, exist_ok=True)
    HTML.write_text('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lista da Vez | Manual de treinamento</title><style>' + CSS + '</style></head><body><div class="layout"><aside><div class="brand">JoinNetwork</div><p class="edition">Aeropostale<br>Lista da Vez · Manual v1.0<br>15 de setembro de 2026</p><nav aria-label="Seções do manual">' + ''.join(nav) + '</nav><div class="actions"><a href="../pdf/manual-fila-atendimento.pdf">Abrir PDF</a><button type="button" onclick="window.print()">Imprimir</button></div></aside><main>' + ''.join(sections) + '<p class="footer">Material de treinamento · Exemplos fictícios · Uso offline</p></main></div></body></html>', encoding='utf-8')


def build_pdf(pages, font, font_bold):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

    pdfmetrics.registerFont(TTFont('Manual', font))
    pdfmetrics.registerFont(TTFont('ManualBold', font_bold))
    pdfmetrics.registerFontFamily('Manual', normal='Manual', bold='ManualBold', italic='Manual', boldItalic='ManualBold')
    ink, muted, line = map(colors.HexColor, ['#192845', '#536478', '#dce3ec'])
    base = ParagraphStyle('body', fontName='Manual', fontSize=10.2, leading=14.1, textColor=ink, spaceAfter=8)
    styles = {'p': base}
    for kind, size, leading, before, after in [('h1', 40, 43, 8, 16), ('h2', 23, 27, 8, 15), ('h3', 12.5, 16, 11, 7)]:
        styles[kind] = ParagraphStyle(kind, parent=base, fontName='ManualBold', fontSize=size, leading=leading, spaceBefore=before, spaceAfter=after, keepWithNext=True)
    item_style = ParagraphStyle('item', parent=base, leftIndent=16, firstLineIndent=-14, spaceAfter=6)
    cell_style = ParagraphStyle('cell', parent=base, fontSize=9.2, leading=12.5, spaceAfter=0, alignment=TA_LEFT)
    quote_style = ParagraphStyle('quote', parent=base, spaceAfter=0)
    story = []
    width = A4[0] - 88
    for number, page in enumerate(pages, 1):
        if number > 1:
            story.append(PageBreak())
        for kind, value in page:
            if kind in styles:
                story.append(Paragraph(inline(value, True), styles[kind]))
            elif kind in ('ul', 'ol'):
                for n, item in enumerate(value, 1):
                    prefix = f'{n}.' if kind == 'ol' else '-'
                    if item.startswith('[ ] '):
                        prefix, item = '[ ]', item[4:]
                    story.append(Paragraph(prefix + '  ' + inline(item, True), item_style))
                story.append(Spacer(1, 3))
            elif kind == 'quote':
                box = Table([[Paragraph(inline(value, True), quote_style)]], colWidths=[width])
                box.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fff4ef')), ('LINEBEFORE', (0, 0), (0, -1), 3, colors.HexColor('#b43c37')), ('LEFTPADDING', (0, 0), (-1, -1), 12), ('RIGHTPADDING', (0, 0), (-1, -1), 12), ('TOPPADDING', (0, 0), (-1, -1), 10), ('BOTTOMPADDING', (0, 0), (-1, -1), 10)]))
                story.extend([Spacer(1, 5), box, Spacer(1, 12)])
            elif kind == 'table':
                data = [[Paragraph(('<b>' + inline(c, True) + '</b>') if row == 0 else inline(c, True), cell_style) for c in cells] for row, cells in enumerate(value)]
                count = len(value[0])
                ratios = [0.34, 0.66] if count == 2 else [0.31, 0.39, 0.30]
                table = Table(data, colWidths=[width * r for r in ratios], repeatRows=1, hAlign='LEFT')
                table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#edf1f7')), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]), ('GRID', (0, 0), (-1, -1), .4, line), ('LEFTPADDING', (0, 0), (-1, -1), 8), ('RIGHTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
                story.extend([table, Spacer(1, 11)])

    def decorate(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(ink)
        canvas.setFont('ManualBold', 9)
        canvas.drawString(44, A4[1] - 32, 'JOINNETWORK  /  AEROPOSTALE')
        canvas.setFont('Manual', 8)
        canvas.setFillColor(muted)
        canvas.drawRightString(A4[0] - 44, A4[1] - 32, 'TREINAMENTO DA EQUIPE')
        canvas.setStrokeColor(line)
        canvas.line(44, 40, A4[0] - 44, 40)
        canvas.drawString(44, 26, 'Lista da Vez  |  v1.0  |  15/09/2026')
        canvas.drawRightString(A4[0] - 44, 26, f'{doc.page:02d}')
        canvas.restoreState()

    PDF.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(PDF), pagesize=A4, rightMargin=44, leftMargin=44, topMargin=58, bottomMargin=54, title='Lista da Vez - Manual de boas práticas e treinamento', author='JoinNetwork', subject='Orientações para gerentes e vendedores - Aeropostale')
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--font', default='/System/Library/Fonts/Supplemental/Arial.ttf')
    parser.add_argument('--font-bold', default='/System/Library/Fonts/Supplemental/Arial Bold.ttf')
    args = parser.parse_args()
    pages = [blocks(page) for page in SOURCE.read_text(encoding='utf-8').split('<!-- pagina -->')]
    build_pdf(pages, args.font, args.font_bold)
    build_html(pages)
    print(f'PDF: {PDF.relative_to(ROOT)}\nHTML: {HTML.relative_to(ROOT)}')
