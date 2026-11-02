import hashlib
import json
from pathlib import Path


root = Path(__file__).resolve().parent
parent = root.parent
source_bytes = (parent / 'recovered-14day-from-pdf.json').read_bytes()
assert hashlib.sha256(source_bytes).hexdigest() == '4c3a9eeda76ad2484326b7380f0aed4ddfdb8fd929964f8dd1c78f64562fd379'
assert hashlib.sha256((parent / 'source-14day-browser-print.pdf').read_bytes()).hexdigest() == '7263feafed630b808a2e52d3e404ea680549653f96693cbaba95cac46a8813f3'
source = json.loads(source_bytes)['data']
assert len(source) == 3360 and all(row['q'] == 'v' for row in source)
template = (root / 'prototype14-logic.template.html').read_text(encoding='utf-8')
assert template.count('__PURE__') == 1 and template.count('__SOURCE__') == 1
pure = (parent / 'tide14-model.js').read_text(encoding='utf-8') + '\n' + (root / 'prototype14-logic-core.js').read_text(encoding='utf-8')
assert 'document.' not in pure and 'window.' not in pure
source_text = json.dumps(source, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
html = template.replace('__PURE__', pure.replace('</script', '<\\/script')).replace('__SOURCE__', source_text)
(root / 'prototype14-logic.html').write_text(html, encoding='utf-8')
print('Built one-file, offline 14-day LOGIC prototype with 3360 observations')
