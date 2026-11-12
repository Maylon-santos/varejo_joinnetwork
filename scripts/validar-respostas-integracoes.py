"""Confere respostas produzidas pelo teste HTTP/serviço contra os schemas OpenAPI reais."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker
root = Path(__file__).resolve().parents[1]
spec = json.loads((root/'apis/integracoes.openapi.json').read_text())
records = json.loads((root/'artifacts/integracoes-validacao/respostas-sinteticas.json').read_text())
for record in records:
    schema = {'$ref': '#/components/schemas/'+record['schema'], 'components': spec['components']}
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(record['body'])
print(f'{len(records)} respostas sintéticas compatíveis com OpenAPI.')
