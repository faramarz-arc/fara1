# DizArch — 360 tour

Static site. No build step: serve `site/` as-is.

```
site/
  index.html            markup, metadata, JSON-LD
  css/styles.css        all styling
  js/app.js             tour runtime, look control, nav, form
  js/vendor/            three.js (minified subset, MIT)
  assets/panos/         six equirectangular rooms
      <room>.webp       full frame, desktop
      <room>-sm.webp    1440px, phones
      <room>-lqip.webp  ~0.5 KB placeholder, loaded up front
  assets/projects/      rectilinear card crops, reprojected from the panoramas
```

## Local

```sh
cd site && python3 -m http.server 8000
```

## Serving notes

- Enable gzip/brotli. `js/vendor/three.bundle.js` is 480 KB raw and compresses hard.
- Cache `assets/` and `js/vendor/` long (they are content-stable); keep `index.html` short.

## Rebuilding the images

`tools/build-images.py` regenerates every `.webp` from a directory of source
equirectangular JPEGs — the panorama variants, the project-card crops, and the
Open Graph cover.

```sh
python3 tools/build-images.py path/to/source-panoramas
```

## Single-file preview

`tools/build-preview.py` bundles the whole site into one HTML file with every
image and script inlined, for sharing a running preview where a static host
isn't available. It is a preview build only — it throws away the progressive
loading the real site depends on.

```sh
python3 tools/build-preview.py
```

## Configuration

Contact details and the form endpoint are `data-*` attributes on `<body>`.
See `../CONTENT-TODO.md`.
