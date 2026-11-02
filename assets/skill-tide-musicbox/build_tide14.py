import hashlib
import json
from pathlib import Path

from extract_tide_14day import validate


root = Path(__file__).resolve().parent
raw = (root / 'recovered-14day-from-pdf.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '4c3a9eeda76ad2484326b7380f0aed4ddfdb8fd929964f8dd1c78f64562fd379', 'source snapshot changed'
assert hashlib.sha256((root / 'source-14day-browser-print.pdf').read_bytes()).hexdigest() == '7263feafed630b808a2e52d3e404ea680549653f96693cbaba95cac46a8813f3', 'source PDF changed'
document = json.loads(raw)
assert validate(document)['count'] == 3360
model = (root / 'tide14-model.js').read_text().replace('</script', '<\\/script')
source = json.dumps(document['data'], ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
template = (root / 'tide14.template.html').read_text()
assert template.count('__MODEL__') == 1 and template.count('__SOURCE__') == 1
(root / 'tide14-studio.html').write_text(template.replace('__MODEL__', model).replace('__SOURCE__', source), encoding='utf-8')
print('Built tide14-studio.html with 3360 PDF-recovered verified records (fully offline)')
