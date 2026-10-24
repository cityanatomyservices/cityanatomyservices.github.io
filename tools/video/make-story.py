#!/usr/bin/env python3
"""make-story.py — the numbers and the narration draft for a shopping app's video.

    python3 tools/video/make-story.py austin-pizza        (from the repo root)

Reads apps/<id>/story.json (the beats the owner wants, each with how many
seconds it holds at least) and apps/<id>/data.geojson, and writes:

  C:/Dev/map-exports/<id>/story/beats.json   every number, row and label the
                                             cards show (render-cards.js reads it)
  docs/<id>-narration.md                     the narration draft: one line per
                                             beat with a word budget; the owner
                                             edits every line before any voice

Run it again whenever the data or story.json changes. The drafted lines are
plain statements of the counts, marked DRAFT; the owner's own words go in
story.json as `say` on a beat and are used as they are.

Beat types and their story.json keys:
  all        label                              the count of every place
  breakdown  property, title, [order], [skip],  counts per value of a property,
             [phrase]                           biggest first unless `order`;
                                                 `skip` values are counted but
                                                 not listed; the narration says
                                                 "{count} {value}" unless `phrase`
                                                 says otherwise
  top        title, sources, [top]              places with the most sources
                                                 behind them (a source = a
                                                 property that is not empty);
                                                 branches of one brand are
                                                 grouped (name before " - ",
                                                 " LLC" dropped, a longer name
                                                 that starts with a shorter one
                                                 is the same brand)
  end        lines                              the closing card
Every beat: hold (seconds, the least it stays up — a longer narration clip
stretches it, see compose.sh), [say].
"""
import json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXPORTS = '/mnt/c/Dev/map-exports'
WORDS_PER_SECOND = 2.4            # a calm reading pace, about 145 words a minute


def brand_of(name):
    b = name.split(' - ')[0].replace(' LLC', '')
    return re.sub(r'\s+', ' ', b).strip()


def group_brands(names):
    """name -> brand; a longer brand that starts with a shorter one is that brand."""
    canon = {}
    for b in sorted({brand_of(n) for n in names}, key=len):
        canon[b] = next((c for c in canon.values() if b.startswith(c + ' ')), b)
    return {n: canon[brand_of(n)] for n in names}


def words(text):
    return len(re.findall(r"[\w'’]+", text))


def list_words(items):
    items = [str(i) for i in items]
    return items[0] if len(items) == 1 else ', '.join(items[:-1]) + ' and ' + items[-1]


def app_title(folder):
    m = re.search(r'title:\s*"([^"]*)"', open(os.path.join(folder, 'config.js'), encoding='utf-8').read())
    return m.group(1) if m else os.path.basename(folder)


def main(app_id):
    folder = os.path.join(ROOT, 'apps', app_id)
    story = json.load(open(os.path.join(folder, 'story.json'), encoding='utf-8'))
    data = json.load(open(os.path.join(folder, 'data.geojson'), encoding='utf-8'))
    props = [f['properties'] for f in data['features'] if f.get('geometry') and f['geometry']['type'] == 'Point']
    name_field = story.get('nameField', 'name')
    total = len(props)
    beats, lines, t = [], [], 0.0

    for beat in story['beats']:
        kind, hold = beat['type'], float(beat['hold'])
        b = {'type': kind, 'hold': hold}
        if kind == 'all':
            b.update(count=total, label=beat['label'])
            draft = f"This map holds {total} {beat['label']}."
        elif kind == 'breakdown':
            prop = beat['property']
            counts = Counter(str(p.get(prop) or '') for p in props)
            skip = set(beat.get('skip', []))
            if beat.get('order'):
                values = [v for v in beat['order'] if v in counts] + [v for v, _ in counts.most_common() if v not in beat['order']]
            else:
                values = [v for v, _ in counts.most_common()]
            rows = [{'value': v, 'count': counts[v]} for v in values if v not in skip]
            skipped = sum(counts[v] for v in skip)
            b.update(property=prop, title=beat['title'], rows=rows)
            if skipped:
                b['note'] = f"{skipped} of {total}: {list_words(sorted(skip)).lower()}"
            phrase = beat.get('phrase', '{count} {value}')
            parts = [phrase.format(count=r['count'], value=r['value']) for r in rows[:4]]
            lead = f"{total - skipped} of them name a style: " if skipped else f"{beat['title']}: "
            draft = lead + list_words(parts) + '.'
        elif kind == 'top':
            sources = beat['sources']
            score = {}
            for p in props:
                n = sum(1 for s in sources if str(p.get(s['property']) or '').strip())
                score[p[name_field]] = max(score.get(p[name_field], 0), n)
            brand = group_brands([p[name_field] for p in props])
            per_brand = {}
            for p in props:
                e = per_brand.setdefault(brand[p[name_field]], {'score': 0, 'locations': 0})
                e['score'] = max(e['score'], score[p[name_field]])
                e['locations'] += 1
            ranked = sorted((k for k, v in per_brand.items() if v['score'] > 0),
                            key=lambda k: (-per_brand[k]['score'], -per_brand[k]['locations'], k))
            best = per_brand[ranked[0]]['score'] if ranked else 0
            at_best = sum(1 for k in ranked if per_brand[k]['score'] == best)
            chosen = [k for k in ranked if per_brand[k]['score'] == best][:int(beat.get('top', 8))]
            rows = [{'name': k, 'detail': f"{per_brand[k]['locations']} locations" if per_brand[k]['locations'] > 1 else ''} for k in chosen]
            b.update(title=beat['title'], rows=rows)
            if at_best > len(chosen):
                b['note'] = f"{at_best} brands appear in both; the {len(chosen)} with the most locations are shown"
            labels = [s['label'] for s in sources]
            where = ' and '.join(labels) if best == len(sources) else f"{best} of {len(sources)} sources"
            draft = f"{at_best} are talked about in both {where}, among them {list_words(chosen[:5])}."
        elif kind == 'end':
            b.update(lines=beat['lines'])
            draft = ' '.join(beat['lines']).replace('austin.chat', 'austin dot chat').replace('/', ' slash ') + '.'
        else:
            sys.exit(f'unknown beat type {kind}')
        beats.append(b)
        text = beat.get('say') or draft
        lines.append((t, t + hold, b, text, words(text), int(hold * WORDS_PER_SECOND), bool(beat.get('say'))))
        t += hold

    out_dir = os.path.join(EXPORTS, app_id, 'story')
    os.makedirs(out_dir, exist_ok=True)
    out = {'app': app_id, 'title': app_title(folder), 'site': story.get('site', 'austin.chat'), 'credit': story.get('credit', ''), 'beats': beats}
    with open(os.path.join(out_dir, 'beats.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write('\n')

    mmss = lambda s: f"{int(s) // 60}:{int(s) % 60:02d}"
    doc = os.path.join(ROOT, 'docs', f'{app_id}-narration.md')
    with open(doc, 'w', encoding='utf-8') as f:
        f.write(f"# {out['title']} — video narration (at least {mmss(t)})\n\n")
        f.write(f"Written by `tools/video/make-story.py` from `apps/{app_id}/story.json` and the\n"
                f"app's data.geojson. One line per beat (one card each). A card stays up for\n"
                f"its hold or as long as its narration clip needs, whichever is longer, so\n"
                f"the times below are the shortest the video can be. The word budget is\n"
                f"{WORDS_PER_SECOND} words a second for the hold. The owner edits every line, or\n"
                f"puts the final words in story.json as `say`; then one voice clip is made\n"
                f"per line.\n\n<!-- DRAFT lines are Claude's, from the counts in data.geojson -->\n\n")
        f.write('| # | From | Card | Narration | Words |\n|---|---|---|---|---|\n')
        for i, (a, z, b, text, n, budget, owner) in enumerate(lines, 1):
            card = {'all': f"the count, {b.get('count')}", 'breakdown': f"{b.get('title')}, bars",
                    'top': b.get('title'), 'end': 'end card'}[b['type']]
            flag = '' if n <= budget else ' **over**'
            f.write(f"| {i} | {mmss(a)} | {card} | {'' if owner else 'DRAFT: '}{text} | {n}/{budget}{flag} |\n")
        f.write('\nEvery count is computed; the brand grouping on the "top" beat is by name\nand should be read once by a person.\n')
    print(f"{out_dir}/beats.json\n{doc}\nat least {mmss(t)} ({t:.0f} s)")
    for i, (a, z, b, text, n, budget, owner) in enumerate(lines, 1):
        print(f"  {i}. {mmss(a)} {b['type']:9} {n:2}/{budget} words  {text}")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: python3 tools/video/make-story.py <app id>')
    main(sys.argv[1])
