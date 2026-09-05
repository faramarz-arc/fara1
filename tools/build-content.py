#!/usr/bin/env python3
"""Render the content files into site/index.html.

    python3 tools/build-content.py

Projects and the process schedule live in content/*.json so the studio can add
a project or change a payment stage without touching markup. This writes them
into the regions of index.html marked

    <!-- BUILD:name --> ... <!-- /BUILD:name -->

and leaves the rest of the file alone, so the page stays readable and every
change still shows up as a normal diff.

Pricing is read by the page at runtime (content/pricing.json), not built in,
so a rate change needs no rebuild.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INDEX = os.path.join(HERE, 'site', 'index.html')


def load(name):
    with open(os.path.join(HERE, 'content', name), encoding='utf-8') as f:
        return json.load(f)


def e(v):
    return html.escape(str(v), quote=True)


def render_projects(data):
    cards = []
    for p in data['projects']:
        cards.append(
            '      <article class="card">\n'
            f'        <div class="card__media"><img src="assets/projects/{e(p["image"])}.webp"'
            ' width="800" height="600" loading="lazy" decoding="async"'
            f' alt="{e(p["alt"])}"></div>\n'
            '        <div class="card__body">\n'
            f'          <p class="card__k">{e(p["kicker"])}</p>\n'
            f'          <h3 class="card__t">{e(p["title"])}</h3>\n'
            f'          <p class="card__m">{e(p["meta"])}</p>\n'
            '        </div>\n'
            '      </article>')
    return '\n    <div class="grid">\n' + '\n'.join(cards) + '\n    </div>\n    '


def render_process(data):
    steps = []
    for s in data['steps']:
        steps.append(
            '          <div class="process__step">\n'
            f'            <p class="process__n">{e(s["n"])}</p>\n'
            f'            <p class="process__l">{e(s["title"])}</p>\n'
            f'            <p class="process__when">{e(s["duration"])}</p>\n'
            f'            <p class="process__d">{e(s["what"])}</p>\n'
            '            <dl class="process__terms">\n'
            f'              <div><dt>تحویل می‌گیرید</dt><dd>{e(s["gives"])}</dd></div>\n'
            f'              <div><dt>پرداخت</dt><dd>{e(s["pays"])}</dd></div>\n'
            '            </dl>\n'
            '          </div>')
    note = ''
    if not data.get('terms_confirmed'):
        note = ('\n        <p class="process__draft">زمان‌بندی و پرداخت‌های بالا نمونه‌اند '
                'و پیش از انتشار باید با شرایط واقعی استودیو جایگزین شوند.</p>')
    return ('\n        <div class="process">\n' + '\n'.join(steps)
            + '\n        </div>' + note + '\n        ')


def splice(text, name, body):
    pat = re.compile(r'(<!-- BUILD:%s -->).*?(<!-- /BUILD:%s -->)' % (name, name), re.S)
    if not pat.search(text):
        sys.exit(f'marker BUILD:{name} not found in index.html')
    return pat.sub(lambda m: m.group(1) + body + m.group(2), text)


def main():
    text = open(INDEX, encoding='utf-8').read()
    text = splice(text, 'projects', render_projects(load('projects.json')))
    text = splice(text, 'process', render_process(load('process.json')))
    open(INDEX, 'w', encoding='utf-8').write(text)
    print('built: projects, process -> site/index.html')


if __name__ == '__main__':
    main()
