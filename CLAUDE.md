# ReRouted (fork)

Fork of [gitcommit90/rerouted](https://github.com/gitcommit90/rerouted). We maintain our own trunk. Upstream does not accept external PRs, so nothing here goes back to them.

## Remotes and branches

| Ref | Role |
| --- | --- |
| `develop` | Our trunk. Work lands here. |
| `origin/main` | Mirrors upstream. Do not commit to it. |
| `upstream` | `https://github.com/gitcommit90/rerouted.git` |

Sync by merging `upstream/main` into `develop`.

## Licensing position

Upstream is **MIT**, © 2026 Joseph Yaksich. Verified in-repo: `LICENSE` has a single commit in its history (`7a0dda6`), always MIT; no CLA, no DCO, no `NOTICE`, no trademark assertion anywhere.

MIT grants use, copy, modify, merge, publish, distribute, sublicense, and sell. Forking and rebranding is squarely inside the grant.

**What we owe, and where the grant stops:**

1. Keep the copyright notice and permission notice in all copies and substantial portions. Never delete or rewrite `LICENSE` — add our copyright line alongside theirs, not instead of it.
2. Ship `LICENSE` inside distributed builds. The packaged `.app` already carries it.
3. **Name, domain, and icon are not licensed.** MIT is copyright-only and says nothing about trademarks. "ReRouted" and `rerouted.dev` remain theirs. A public rebrand needs our own name; note `package.json` still reads `@gitcommit90/rerouted`.
4. **The grant is per-commit, not perpetual over the project.** Code already merged is permanently ours to use — MIT is irrevocable once released. But future upstream commits could ship under different terms. See the hook below.

`CONTRIBUTING.md` says external PRs are not accepted. That is upstream's policy for their repo, not a license term, and it restricts what they merge — not what we may do. It restates MIT in the same paragraph.

Not legal advice; this is what the license text says.

## Hooks

`.githooks/post-merge` warns when a merge changed `LICENSE` or the `license` field in `package.json`.

Every fresh clone must opt in once:

```sh
git config core.hooksPath .githooks
```

Git has **no fetch hook**, so this fires at merge time, not download time. It also does not run on a conflicted merge or on rebase. Treat it as a safety net under reading the diff, not a replacement for it.

## Known traps

- `src/lib/updater.js` hardcodes the update feed to `gitcommit90/rerouted`. Fork builds will be offered upstream releases, and installing one replaces our build with a version that has none of our changes. Left as-is deliberately.
- `scripts/capture-ui.js` hand-duplicates the `app:get-state` projection from `src/lib/control-plane.js`. Any new model field must be added in both or the capture harness silently renders stale UI.
- `electron-packager` stamps bundles with 1979 mtimes. With an unchanged version string, Finder calls a fresh build "older" than the installed one. Bump `package.json` per build to avoid the confusion.
