# -*- coding: utf-8 -*-
"""
九州厚生局の「保険薬局 指定状況」Excel(ZIP)から、薬局名オートコンプリート用の
軽量JSONマスタを生成する。

出力: data/yakkyoku/<romaji>.json  (県ごと)
      data/yakkyoku/index.json     (基準日・県→ファイル対応・件数)

使い方:
  1) scripts/yakkyoku-sources.json の zip URL を最新月のものに更新
     (index_00006.html から各県の Excel(zip) 番号を取り直す)
  2) python scripts/build-yakkyoku-master.py
  3) git add data/yakkyoku && git commit && git push

依存: openpyxl (pip install openpyxl)
※ 数字・集計・localStorage・Firebase には一切触れない。静的マスタJSONを作るだけ。
"""
import os, io, re, json, zipfile, urllib.request, ssl

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC  = os.path.join(HERE, 'yakkyoku-sources.json')
OUT  = os.path.join(ROOT, 'data', 'yakkyoku')

def log(*a): print(*a, flush=True)

def fetch(url):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 eigyo-pro-master-builder'})
    with urllib.request.urlopen(req, context=ctx, timeout=120) as r:
        return r.read()

def strip_postal(addr):
    # 先頭の 〒812－0053 / 〒812-0053 等を除去(市区町村以降を残す)
    return re.sub(r'^〒?\s*\d{3}[\-−ー－]?\s*\d{0,4}\s*', '', (addr or '').strip())

def clean_name(s):
    return re.sub(r'\s+', ' ', (s or '').replace('　', ' ')).strip()

def parse_yakkyoku_xlsx(data):
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    ws = wb.active
    items = []
    seen = set()
    for row in ws.iter_rows(values_only=True):
        c0 = row[0] if len(row) > 0 else None
        # 連番(col0)が数字の行 = 薬局レコードのメイン行
        if c0 is None or not str(c0).strip().isdigit():
            continue
        name = clean_name(row[2] if len(row) > 2 else '')
        addr = strip_postal(row[3] if len(row) > 3 else '')
        if not name:
            continue
        key = name + '|' + addr
        if key in seen:
            continue
        seen.add(key)
        items.append({'n': name, 'a': addr})
    wb.close()
    return items

def main():
    with open(SRC, 'r', encoding='utf-8') as f:
        cfg = json.load(f)
    os.makedirs(OUT, exist_ok=True)
    base = cfg['base']
    as_of = cfg['asOf']
    index = {'asOf': as_of, 'source': cfg.get('indexUrl',''), 'prefs': {}}
    total = 0
    for s in cfg['sources']:
        url = base + s['zip']
        log('▼ %s  %s' % (s['pref'], url))
        raw = fetch(url)
        zf = zipfile.ZipFile(io.BytesIO(raw))
        # 薬局ファイル(yakkyoku)を探す
        target = None
        for nm in zf.namelist():
            if 'yakkyoku' in nm.lower() and nm.lower().endswith('.xlsx'):
                target = nm
                break
        if not target:
            log('  ⚠ yakkyoku xlsx が見つかりません: %s' % zf.namelist())
            continue
        items = parse_yakkyoku_xlsx(zf.read(target))
        out_path = os.path.join(OUT, s['romaji'] + '.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump({'pref': s['pref'], 'asOf': as_of, 'count': len(items), 'items': items},
                      f, ensure_ascii=False, separators=(',', ':'))
        index['prefs'][s['pref']] = {'file': s['romaji'] + '.json', 'count': len(items)}
        total += len(items)
        log('  ✓ %d件 → data/yakkyoku/%s.json (%.0f KB)' % (len(items), s['romaji'], os.path.getsize(out_path)/1024))
    with open(os.path.join(OUT, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    log('━━ 合計 %d件 / 基準日 %s ━━' % (total, as_of))

if __name__ == '__main__':
    main()
