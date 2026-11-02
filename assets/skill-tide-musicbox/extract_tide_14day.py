import argparse
import hashlib
import json
import re
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse


EXPECTED = {
    'begin_date': '20250401', 'end_date': '20250414', 'station': '9414290',
    'product': 'water_level', 'datum': 'MLLW', 'time_zone': 'gmt',
    'units': 'metric', 'format': 'json', 'application': 'TideMusicStudio',
}


def parse_source_title(title):
    url = title if title.startswith('https://') else 'https://' + title
    parsed = urlparse(url)
    query = parse_qs(parsed.query, strict_parsing=True)
    if (parsed.scheme != 'https' or parsed.netloc != 'api.tidesandcurrents.noaa.gov'
            or parsed.path != '/api/prod/datagetter' or parsed.fragment
            or query != {key: [value] for key, value in EXPECTED.items()}):
        raise ValueError('PDF title does not match the required source query')
    return EXPECTED.copy()


def validate(document):
    if not isinstance(document, dict) or document.get('metadata', {}).get('id') != EXPECTED['station']:
        raise ValueError('station mismatch')
    rows = document.get('data')
    if not isinstance(rows, list) or len(rows) != 3360:
        raise ValueError('unexpected observation count')
    first = datetime(2025, 4, 1, tzinfo=timezone.utc)
    levels = []
    for index, row in enumerate(rows):
        if row.get('q') != 'v' or row.get('f') != '0,0,0,0':
            raise ValueError('unexpected quality or flags')
        if datetime.strptime(row['t'], '%Y-%m-%d %H:%M').replace(tzinfo=timezone.utc) != first + timedelta(minutes=6 * index):
            raise ValueError('non-contiguous observation interval')
        level = float(row['v'])
        if not -20 < level < 20:
            raise ValueError('invalid water level')
        levels.append(level)
    return {'count': len(rows), 'days': 14, 'start': rows[0]['t'], 'end': rows[-1]['t'],
            'min': min(levels), 'max': max(levels)}


def recover(pdf):
    if pdf.stat().st_size > 2_000_000:
        raise ValueError('PDF is too large')
    info = subprocess.run(['/usr/bin/pdfinfo', str(pdf)], capture_output=True, text=True, check=True, timeout=30).stdout
    title = re.search(r'^Title:\s*(\S+)', info, re.MULTILINE)
    if not title:
        raise ValueError('PDF has no source query in title')
    request_url = title.group(1)
    parse_source_title(request_url)
    documents = []
    for mode in ('-layout', '-raw'):
        text = subprocess.run(['/usr/bin/pdftotext', mode, str(pdf), '-'], capture_output=True, text=True, check=True, timeout=30).stdout
        if len(text) > 2_000_000:
            raise ValueError('extracted text is too large')
        documents.append(json.loads(text.replace('优质打印', '').replace('\f', '')))
    if documents[0] != documents[1]:
        raise ValueError('PDF extraction modes disagree')
    audit = validate(documents[0])
    audit.update({'pdf_sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(), 'request_url': request_url,
                  'provenance': 'recovered from browser-printed PDF; not original API JSON'})
    return documents[0], audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('pdf', type=Path)
    parser.add_argument('outdir', type=Path)
    args = parser.parse_args()
    document, audit = recover(args.pdf)
    args.outdir.mkdir(parents=True, exist_ok=True)
    (args.outdir / 'recovered-14day-from-pdf.json').write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    (args.outdir / 'extraction-14day-result.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(audit, ensure_ascii=False, indent=2))
