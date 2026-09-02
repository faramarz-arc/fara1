# fara1

A skills repository: it carries the Claude Code skills this account uses, plus
the reference data that backs them. There is no application code here.

## Installed skills — `.claude/skills/`

| Skill | Use it for |
|-------|-----------|
| `ui-ux-pro-max` | UI/UX decisions backed by searchable local data — styles, palettes, font pairings, UX guidelines, charts, per-stack guidance |
| `ui-styling` | shadcn/ui + Tailwind implementation, themes, dark mode, canvas visuals |
| `uiux-design` | Logos, corporate identity, icons, banners, social images (renamed from upstream `design` to keep Claude's built-in `design` canvas skill working) |
| `design-system` | Three-layer design tokens, component specs, slide generation |
| `brand` | Brand voice, messaging frameworks, asset management, consistency checks |
| `slides` | Strategic HTML presentations with Chart.js |
| `banner-design` | Banner art direction and platform sizing |
| `frontend-design` | Anthropic's frontend-design guidance — distinctive, non-templated visual direction |
| `agent-reach` | Web and platform research |

## Searchable data

`ui-ux-pro-max` reads CSV catalogues rather than guessing:

```
.claude/skills/ui-ux-pro-max/data/
├── styles.csv          79 styles (50 active)
├── colors.csv          192 product palettes with reasoning profiles
├── typography.csv      74 font pairings
├── ux-guidelines.csv   119 guidelines
├── icons.csv           105 icons
├── charts.csv          25 chart types
├── motion.csv          GSAP presets
└── stacks/*.csv        22 stacks (react, nextjs, vue, svelte, flutter, swiftui, …)
```

Query it through `.claude/skills/ui-ux-pro-max/scripts/search.py` rather than
reading the CSVs by hand.

`design-system` carries its own slide catalogues under
`.claude/skills/design-system/data/`, and `uiux-design` carries logo/CIP/icon
catalogues under `.claude/skills/uiux-design/data/`.

## Working in this repo

- **Any UI or visual work starts with `ui-ux-pro-max`** — search the catalogues
  for a direction before writing markup, then implement with `ui-styling`.
- Skills are also mirrored to `~/.claude/skills/` so they load outside this
  repo. That mirror is not persistent; this repository is the source of truth.
- `vendor/ui-ux-pro-max/` is upstream reference material, not active code. See
  `vendor/ui-ux-pro-max/VENDORED.md` for what was included and what was left out.

## Provenance

| Source | License | Commit |
|--------|---------|--------|
| [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT | `58c220f` |
| [anthropics/skills — frontend-design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | see its `LICENSE.txt` | — |

Third-party CI workflows are never vendored into this repository.
