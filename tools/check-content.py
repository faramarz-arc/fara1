#!/usr/bin/env python3
"""Fail if any placeholder or unverified claim is still in the site.

    python3 tools/check-content.py

Every value below was invented or carried over as a stand-in while the studio's
real material was unavailable. Each one reads on the page as a statement of
fact, so publishing with any of them still in place would put a claim in front
of clients that nobody has checked.

Fix a value in site/index.html, then delete its entry here. When this script
prints nothing and exits 0, the site makes no claim that has not been reviewed.
See CONTENT-TODO.md for the fuller notes.
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (needle, what it is, why it needs a human)
PLACEHOLDERS = [
    ('studio@dizarch.com',      'email address',        'stand-in, never verified'),
    ('dizarch.com',             'domain',               'used in canonical, og:url, sitemap, robots'),
    ('کوچه بیدار، شماره ۱۲',      'street address',       'stand-in from the original build'),
    ('شنبه تا چهارشنبه، ۱۰ تا ۱۸', 'opening hours',        'invented'),
    ('آپارتمان فرشته',           'project name',         'invented'),
    ('۱۸</',                    'years of experience',  'carried over from the original build'),
    ('۱۴۰+',                    'projects delivered',   'carried over from the original build'),
    ('۹۸٪',                     'client satisfaction',  'carried over from the original build'),
    ('۱۳۸۵',                    'year founded',         'invented'),
    ('۴ تا ۷ ماه',               'average build time',   'invented'),
    ('۸۰ متر مربع',              'minimum project size', 'invented'),
    ('۲۴ ماه',                   'workmanship warranty', 'invented'),
    ('عضو انجمن معماران داخلی',    'membership badge',     'no membership number or link to verify it'),
    ('از اولین جلسه تا تحویل',     'client testimonial',   'carried over; no attributable source'),
    ('https://instagram.com/',  'Instagram link',       'points at the service, not at a profile'),
    ('https://pinterest.com/',  'Pinterest link',       'points at the service, not at a profile'),
]

# Claims the current images cannot support at all — these must never come back.
FORBIDDEN = [
    ('از محل اجرا',  'says the panoramas are site photography'),
    ('نه رندر',      'says the panoramas are not renders'),
]


def check_content_files():
    """The estimator's rates and the process schedule are commercial terms.
    They ship as samples so the page can be seen working; nobody should be
    able to publish them by forgetting."""
    import json
    out = []
    for rel, flag, what in [
        ('site/content/pricing.json', 'rates_confirmed',
         'estimator rates — the page tells visitors they are unconfirmed'),
        ('content/process.json', 'terms_confirmed',
         'process durations, payments and deliverables'),
    ]:
        path = os.path.join(HERE, rel)
        if not os.path.exists(path):
            out.append((rel, 0, 'missing file', 'expected by the site'))
            continue
        if not json.load(open(path, encoding='utf-8')).get(flag):
            out.append((rel, 0, what, f'set "{flag}": true once real'))
    return out


def scan(path, rel):
    text = open(path, encoding='utf-8').read()
    lines = text.splitlines()
    found, banned = [], []
    for needle, what, why in PLACEHOLDERS:
        for n, line in enumerate(lines, 1):
            if needle in line:
                found.append((rel, n, what, why))
                break
    for needle, what in FORBIDDEN:
        for n, line in enumerate(lines, 1):
            if needle in line and not line.lstrip().startswith('<!--'):
                banned.append((rel, n, what))
    return found, banned


def main():
    targets = []
    for root, _, files in os.walk(os.path.join(HERE, 'site')):
        for f in files:
            if f.endswith(('.html', '.xml', '.txt')):
                p = os.path.join(root, f)
                targets.append((p, os.path.relpath(p, HERE)))

    found, banned = check_content_files(), []
    for p, rel in sorted(targets):
        a, b = scan(p, rel)
        found += a
        banned += b

    if banned:
        print('BLOCKED — the images cannot support these claims:\n')
        for rel, n, what in banned:
            print(f'  {rel}:{n}  {what}')
        print()

    if found:
        print(f'{len(found)} value(s) still unreviewed:\n')
        width = max(len(w) for _, _, w, _ in found)
        for rel, n, what, why in found:
            where = f'{rel}:{n}' if n else rel
            print(f'  {where}  {what.ljust(width)}  — {why}')
        print('\nReplace each with the studio\'s real value, then delete its entry')
        print('from PLACEHOLDERS in tools/check-content.py.')

    if not found and not banned:
        print('No placeholders left: every claim on the site has been reviewed.')
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())
