# Vendored: ui-ux-pro-max-skill

Upstream: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Commit:   58c220ff9d02be80523b06c03471925c52e8ab5d (2026-09-02)
License:  MIT — see LICENSE

Reference material for the skills installed in `.claude/skills/`. Nothing here
runs on its own; the active skills live in `.claude/skills/`, not in this tree.

## What is here

| Path       | What it is |
|------------|------------|
| `docs/`    | Upstream documentation (agent guide, data schemas, contribution notes) |
| `stack/`   | Standalone design-review Action + `design-audit.mjs` and example audits |
| `gallery/` | Next.js app that browses the style catalogue |
| `projects/`, `preview/` | Finished HTML examples built with the skills |
| `cli/`, `src/` | Upstream packaging sources — these duplicate the skill payload already installed in `.claude/skills/` |
| `scripts/` | Catalogue refresh/validation scripts used by upstream maintainers |
| `screenshots/`, `.claude-plugin/`, READMEs | Assets and plugin metadata |

## Deliberately NOT vendored

- **`.github/workflows/`** — six CI workflows. Vendoring them at the repo root
  would make third-party CI run in this repository on push. Excluded on purpose.
  (`stack/.github/workflows/design-review.yml` is kept but is inert here: it is
  not at the repository root, so GitHub never schedules it.)
- `.git/`, `node_modules/`

## Local modifications

- All files are non-executable (`chmod 644`).
- Upstream `.gitignore` files were renamed to `gitignore.upstream` so their rules
  do not silently drop vendored content from this repository.
