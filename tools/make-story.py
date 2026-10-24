#!/usr/bin/env python3
"""make-story.py — a shopping app's video story from its data.

    python3 tools/make-story.py austin-pizza        (from the repo root)

Reads apps/<id>/story.json (the beats the owner wants: a count, breakdowns
by a property, the most-talked-about places, an end card — each with how
many seconds it holds) and apps/<id>/data.geojson, and writes:

  apps/<id>/story.js             window.SHOP_STORY — every number, row and
                                 colour the player (shopmap/play.js) shows
  docs/<id>-narration.md         the narration draft: one line per beat with
                                 its time range and a word budget; the owner
                                 edits every line before any voice is made

and makes sure apps/<id>/index.html loads story.js. Run it again whenever
the data or story.json changes. Nothing here is copy the owner has not seen:
the drafted lines are plain statements of the counts, marked DRAFT.

Beat types and their story.json keys:
  all        label                              the count of every place
  breakdown  property, title, [order], [skip],  counts per value of a property,
             [phrase]                           (narration: "{count} {value}" unless
                                                 `phrase` says otherwise, e.g.
                                                 "{count} scored {value}")
                                                 biggest first unless `order`;
                                                 `skip` values are counted but
                                                 not listed (they go grey)
  top        title, sources, [top]              places with the most sources
                                                 behind them (a source = a
                                                 property that is not empty);
                                                 branches of one brand are
                                                 grouped (name before " - ",
                                                 " LLC" dropped, a longer name
                                                 that starts with a shorter
                                                 one is the same brand)
  end        lines                              the closing card
Every beat: hold (seconds), [say] (the owner's narration line, used as is).
"""
import json, os, re, sys, time
from collections import Counter, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#86bcb6', '#d4a6c8', '#a0cbe8']
WORDS_PER_SECOND = 2.4            # a calm reading pace, about 145 words a minute
DRAFT = '<!-- DRAFT by Claude, from the counts in data.geojson; the owner edits every line -->'


def brand_of(name, strip=(' LLC',), split_on=' - '):
    b = name.split(split_on)[0]
    for s in strip:
        b = b.replace(s, '')
    return re.sub(r'\s+', ' ', b).strip()


def group_brands(names):
    """name -> brand; a longer name that starts with a shorter brand is that brand."""
    brands = sorted({brand_of(n) for n in names}, key=len)
    canon = {}
    for b in brands:
        canon[b] = next((c for c in canon.values() if b.startswith(c + ' ')), b)
    return {n: canon[brand_of(n)] for n in names}


def words(text):
    return len(re.findall(r"[\w'’]+", text))


def list_words(items):
    items = [str(i) for i in items]
    return items[0] if len(items) == 1 else ', '.join(items[:-1]) + ' and ' + items[-1]


def main(app_id):
    folder = os.path.join(ROOT, 'apps', app_id)
    story = json.load(open(os.path.join(folder, 'story.json'), encoding='utf-8'))
    data = json.load(open(os.path.join(folder, 'data.geojson'), encoding='utf-8'))
    props = [f['properties'] for f in data['features'] if f.get('geometry') and f['geometry']['type'] == 'Point']
    name_field = story.get('nameField', 'name')
    total = len(props)
    out_beats, lines, t = [], [], 0.0

    for beat in story['beats']:
        kind, hold = beat['type'], float(beat['hold'])
        b = {'type': kind, 'hold': hold}
        say = beat.get('say')
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
            rows = [{'value': v, 'count': counts[v], 'color': PALETTE[i % len(PALETTE)]} for i, v in enumerate(v for v in values if v not in skip)]
            skipped = sum(counts[v] for v in skip)
            b.update(property=prop, title=beat['title'], rows=rows)
            if skipped:
                b['note'] = f"{skipped} of {total}: {list_words(sorted(skip)).lower()}"
            named = total - skipped
            phrase = beat.get('phrase', '{count} {value}')
            parts = [phrase.format(count=r['count'], value=r['value']) for r in rows[:4]]
            lead = f"{named} of them name a style: " if skipped else f"{beat['title']}: "
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
                br = brand[p[name_field]]
                e = per_brand.setdefault(br, {'score': 0, 'locations': 0, 'names': []})
                e['score'] = max(e['score'], score[p[name_field]])
                e['locations'] += 1
                e['names'].append(p[name_field])
            ranked = sorted((k for k, v in per_brand.items() if v['score'] > 0),
                            key=lambda k: (-per_brand[k]['score'], -per_brand[k]['locations'], k))
            best = per_brand[ranked[0]]['score'] if ranked else 0
            chosen = [k for k in ranked if per_brand[k]['score'] == best][:int(beat.get('top', 8))]
            at_best = sum(1 for k in ranked if per_brand[k]['score'] == best)
            labels = [s['label'] for s in sources]
            rows = []
            for k in chosen:
                e = per_brand[k]
                detail = f"{e['locations']} locations" if e['locations'] > 1 else ''
                rows.append({'name': k, 'detail': detail})
            b.update(title=beat['title'], rows=rows, names=[n for k in chosen for n in per_brand[k]['names']])
            if at_best > len(chosen):
                b['note'] = f"{at_best} brands appear in both; the {len(chosen)} with the most locations are shown"
            where = ' and '.join(labels) if best == len(sources) else f"{best} of {len(sources)} sources"
            draft = f"{at_best} are talked about in both {where}, among them {list_words(chosen[:5])}."
        elif kind == 'end':
            b.update(lines=beat['lines'])
            draft = ' '.join(beat['lines']).replace('austin.chat', 'austin dot chat').replace('/', ' slash ') + '.'
        else:
            sys.exit(f'unknown beat type {kind}')
        out_beats.append(b)
        text = say or draft
        budget = int(hold * WORDS_PER_SECOND)
        lines.append((t, t + hold, b, text, words(text), budget, bool(say)))
        t += hold

    story_js = os.path.join(folder, 'story.js')
    with open(story_js, 'w', encoding='utf-8') as f:
        f.write('// story.js — the beats of this app\'s video, WRITTEN BY tools/make-story.py\n'
                '// from story.json and data.geojson. Do not edit: change story.json or the\n'
                '// data and run the script again. Played by /shopmap/play.js with ?play.\n')
        f.write('window.SHOP_STORY = ' + json.dumps({'playDelay': story.get('playDelay', 1500), 'beats': out_beats}, indent=2, ensure_ascii=False) + ';\n')

    mmss = lambda s: f"{int(s) // 60}:{int(s) % 60:02d}"
    doc = os.path.join(ROOT, 'docs', f'{app_id}-narration.md')
    with open(doc, 'w', encoding='utf-8') as f:
        f.write(f"# {app_id} — video narration ({mmss(t)})\n\n")
        f.write(f"Written by `tools/make-story.py` from `apps/{app_id}/story.json` and the\n"
                f"app's data.geojson. One line per beat; the time range is when that beat is\n"
                f"on screen in the take (0:00 = the first beat, the curtain drop). The word\n"
                f"budget is {WORDS_PER_SECOND} words a second. The owner edits every line, or\n"
                f"puts the final words in story.json as `say`, then the script is read once\n"
                f"more and the voice is made per beat (one clip per line).\n\n{DRAFT}\n\n")
        f.write('| # | Time | On screen | Narration | Words |\n|---|---|---|---|---|\n')
        for i, (a, z, b, text, n, budget, owner) in enumerate(lines, 1):
            screen = {'all': f"all {b.get('count')} pins, the count", 'breakdown': f"pins coloured by {b.get('property')}, bars",
                      'top': 'only the chosen pins, named', 'end': 'end card'}[b['type']]
            flag = '' if n <= budget else ' **over**'
            f.write(f"| {i} | {mmss(a)}–{mmss(z)} | {screen} | {'' if owner else 'DRAFT: '}{text} | {n}/{budget}{flag} |\n")
        f.write('\nNumbers to check against the data before recording: every count above is\n'
                'computed, but the brand grouping on the "top" beat is by name and should be\n'
                'read once by a person.\n')

    # the page loads story.js (after config.js, before play.js); its ?v= is
    # the time of this run, so a visitor never keeps an old story
    page = os.path.join(folder, 'index.html')
    html = open(page, encoding='utf-8').read()
    tag = f'<script src="./story.js?v={time.strftime("%Y%m%d%H%M")}"></script>'
    if './story.js' in html:
        html = re.sub(r'<script src="\./story\.js[^"]*"></script>', tag, html, count=1)
    else:
        html = re.sub(r'(\n(\s*)<script src="\./config\.js[^"]*"></script>)', r'\1\n\2' + tag, html, count=1)
    open(page, 'w', encoding='utf-8').write(html)
    print(f"{story_js}\n{doc}\ntotal {mmss(t)} ({t:.0f} s)")
    for i, (a, z, b, text, n, budget, owner) in enumerate(lines, 1):
        print(f"  {i}. {mmss(a)}-{mmss(z)} {b['type']:9} {n:2}/{budget} words  {text}")


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: python3 tools/make-story.py <app id>')
    main(sys.argv[1])
