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

MIT grants use, copy, modify, merge, publish, distribute, sublicense, and sell. So we may fork the code and ship it under a name of our own — the grant covers the code, and our name is ours because it is not theirs, not because MIT hands it to us. See point 3.

**What we owe, and where the grant stops:**

1. Keep the copyright notice and permission notice in all copies and substantial portions. Never delete or rewrite `LICENSE` — add our copyright line alongside theirs, not instead of it.
2. Ship `LICENSE` inside distributed builds. The packaged `.app` already carries it — as it does `LICENSES.chromium.html`, which satisfies Electron's and Chromium's own attribution terms. Those ride along with any Electron app we distribute, independent of upstream. `electron-packager` includes both automatically; a hand-assembled release is where they get dropped.
3. **Name, domain, and icon are not licensed.** MIT is copyright-only and says nothing about trademarks. "ReRouted" and `rerouted.dev` remain theirs. A public rebrand needs our own name; note `package.json` still reads `@gitcommit90/rerouted`.
4. **The grant is per-commit, not perpetual over the project.** Nothing binds upstream to keep publishing under MIT, so a future commit could arrive under different terms. What is observable about code already merged: the license text grants its permissions with no revocation clause and no expiry, and it is widely read as irrevocable once released — but that reading is legal interpretation, not something the text states. Do not treat it as settled if real money rides on it. See the hook below.

`CONTRIBUTING.md` says external PRs are not accepted. That is upstream's policy for their repo, not a license term, and it restricts what they merge — not what we may do. It restates MIT in the same paragraph.

Not legal advice; this is what the license text says.

## Hooks

`.githooks/post-merge` warns when a merge changed `LICENSE` or the `license` field in `package.json`.

Every fresh clone must opt in once:

```sh
git config core.hooksPath .githooks
```

Verified against regular merges and squash merges (`--squash` stages without moving `HEAD`, so the hook diffs the index in that mode), both warning correctly and staying silent on unrelated merges.

Gaps, in order of how much they should worry you:

- Git has **no fetch hook**. This fires at merge time, not download time.
- It does not run on a **conflicted merge** or on **rebase**. This gap tightens exactly when it matters most: once we add our own copyright line to `LICENSE` during rebrand, every upstream merge touching `LICENSE` will conflict — and conflicts skip the hook. A conflict is loud on its own, so this is acceptable, but do not read the hook as steady-state coverage of `LICENSE` after rebrand.

Treat it as a safety net under reading the diff, not a replacement for it.

## Known traps

- `src/lib/updater.js` hardcodes the update feed to `gitcommit90/rerouted`. Fork builds will be offered upstream releases, and installing one replaces our build with a version that has none of our changes. Left as-is deliberately.
- `scripts/capture-ui.js` hand-duplicates the `app:get-state` projection from `src/lib/control-plane.js`. Any new model field must be added in both or the capture harness silently renders stale UI.
- `electron-packager` stamps bundles with 1979 mtimes. With an unchanged version string, Finder calls a fresh build "older" than the installed one. Bump `package.json` per build to avoid the confusion.
