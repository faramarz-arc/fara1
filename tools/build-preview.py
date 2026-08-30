#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file for a shareable preview.

    python3 tools/build-preview.py        # writes ./dizarch-preview.html

Inlines the stylesheet, both scripts, and every image as a data URI, and moves
what index.html sets on <html> into a small setup script, so the file drops
into a host that owns the document wrapper.

Preview only: inlining defeats the progressive loading the real site relies on,
so never ship this file as the site itself.
"""
import base64, os, re

SITE = 'site'
OUT = 'dizarch-preview.html'

def data_uri(rel):
    p = os.path.join(SITE, rel)
    mime = 'image/webp' if rel.endswith('.webp') else 'image/jpeg'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(p, 'rb').read()).decode())

html = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
css  = open(os.path.join(SITE, 'css/styles.css'), encoding='utf-8').read()
three = open(os.path.join(SITE, 'js/vendor/three.bundle.js'), encoding='utf-8').read()
app  = open(os.path.join(SITE, 'js/app.js'), encoding='utf-8').read()

# ---- asset map: every path app.js can build at runtime ----
assets = {}
for room in ['entry', 'living', 'kitchen', 'dining', 'corridor', 'bedroom']:
    for suffix in ['', '-sm', '-lqip']:
        rel = 'assets/panos/%s%s.webp' % (room, suffix)
        assets[rel] = data_uri(rel)

# ---- preview-only hook: resolve runtime paths through the map ----
old = """  var panoUrl = function (id, variant) {
    return 'assets/panos/' + id + (variant || '') + '.webp';
  };"""
new = """  var panoUrl = function (id, variant) {
    var path = 'assets/panos/' + id + (variant || '') + '.webp';
    return (window.__DZ_ASSETS && window.__DZ_ASSETS[path]) || path;
  };"""
assert old in app, 'panoUrl hook did not match'
app = app.replace(old, new)

# ---- body: strip the document wrapper the artifact host provides ----
body = html[html.index('<body'):]
body_open = body[:body.index('>') + 1]
body = body[body.index('>') + 1: body.rindex('</body>')]

# body carries the runtime config as data-* attributes; move them onto <html>
attrs = dict(re.findall(r'(data-[a-z-]+)="([^"]*)"', body_open))

# project card images -> data URIs
for m in set(re.findall(r'src="(assets/projects/[a-z]+\.webp)"', body)):
    body = body.replace('src="%s"' % m, 'src="%s"' % data_uri(m))

# the external stylesheet and scripts are inlined below
body = re.sub(r'\s*<script src="js/[^"]+"></script>', '', body)

fonts = ('<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
         '<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600'
         '&family=Cormorant+Garamond:wght@300;400;500;600&display=swap" rel="stylesheet">')

setup = """<script>
/* The artifact host owns <html>; carry over what index.html sets on it. */
(function () {
  var r = document.documentElement;
  r.lang = 'fa';
  r.dir = 'rtl';
  var cfg = %s;
  for (var k in cfg) document.body.setAttribute(k, cfg[k]);
})();
</script>""" % repr(attrs).replace("'", '"')

out = '\n'.join([
    '<title>DizArch 360 Tour</title>',
    fonts,
    '<style>\n' + css + '\n</style>',
    setup,
    body,
    '<script>window.__DZ_ASSETS = ' + repr(assets).replace("'", '"') + ';</script>',
    '<script>' + three + '</script>',
    '<script>' + app + '</script>',
])
open(OUT, 'w', encoding='utf-8').write(out)
print('wrote', OUT, round(os.path.getsize(OUT) / 1024 / 1024, 2), 'MB')
