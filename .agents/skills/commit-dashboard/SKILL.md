---
name: commit-dashboard
description: Commit VenoDashboard changes with small conventional commits, local CI verification, and DanielDanielsson GitHub safety checks
---

# Commit Dashboard

Use this skill when the user asks to commit changes in `VenoDashboard`.

## Overview

This skill standardizes the VenoDashboard commit flow.

It requires:

1. small scoped commits
2. conventional commit messages
3. local CI verification
4. DanielDanielsson as the only GitHub identity for write actions
5. a final commit list and GitHub account report

## Repository Selection

Commit in:

1. `/Users/danieldanielsson/code/privat/PulseGlucose/VenoDashboard`

Do not redirect note, Quartz, or other repo changes from this skill. This skill is only for VenoDashboard.

## GitHub Safety

Before any `git commit`, `git push`, or GitHub write action, run:

```bash
/Users/danieldanielsson/code/privat/dotfiles/agents/scripts/verify-privat-github-safety.sh /Users/danieldanielsson/code/privat/PulseGlucose/VenoDashboard
```

If the active `gh` account is not `DanielDanielsson`, run:

```bash
gh auth switch -u DanielDanielsson
```

Then rerun the safety script.

If the safety script fails, stop. Do not commit, push, create branches, open PRs, edit issues, comment, label, release, or perform any GitHub write action until the mismatch is fixed.

If the repo remote points to a GitHub owner other than `DanielDanielsson`, stop and ask the user before writing anything.

## Workflow

1. Inspect current repo state before staging.
2. Summarize all current changes into logical commit units.
3. Prefer many small commits over one large commit.
4. Run the GitHub safety script before the first commit.
5. Stage only files for one unit at a time.
6. Check staged diff with `git diff --staged`.
7. Confirm there is no accidental file in the index.
8. Write a conventional commit message that matches the staged unit.
9. Commit and repeat until all intended units are committed.
10. After each commit, show the commit summary with `git show --stat --oneline -1`.
11. After all commits are created, run `npm run ci:local` once.
12. If `npm run ci:local` fails, report the failure and do not claim the branch is ready to push.
13. After all commits, clearly list the commits that were made.
14. Show the active GitHub account that would be used for push.

## Commit Message Rules

1. Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `perf:`, `ci:`, `build:`.
2. Keep the subject line short and specific.
3. No `Co-Authored-By` lines.
4. Prefer one concern per commit.
5. Scope when useful, for example `fix(dashboard): preserve view panel`.

## Staging Rules

1. Do not stage unrelated files.
2. If the work mixes concerns, split it into multiple commits.
3. Leave user owned unrelated modifications untouched.
4. Do not commit generated contract snapshots unless the user explicitly intended a contract refresh.
5. Treat these files as generated noise unless explicitly requested:
   1. `content/contracts/agent-context.snapshot.json`
   2. `content/contracts/openapi.snapshot.json`

## Required Verification

Before the first commit:

1. Run the GitHub safety script.

Before each commit:

1. Check staged diff with `git diff --staged`.
2. Ensure the commit message type matches the staged change.
3. Confirm there is no accidental file in the index.

After all commits are created:

1. Run `npm run ci:local` once.
2. If CI fails, report the failure and do not claim the branch is ready to push.
3. Show the final commit list.
4. Show the active GitHub account from `gh auth status` when available.

If `gh` is unavailable, show:

1. `git config user.name`
2. `git config user.email`
3. `git remote -v`

## Final Report Requirements

After the last commit, always show:

1. `Commits created`
2. one line per commit, hash plus subject
3. `GitHub account for push`
4. active account only from `gh auth status` when available

Never include inactive accounts in the summarized final message.

## Critical Rules

1. Always verify the active GitHub account is `DanielDanielsson` before commit or any GitHub write action.
2. Never skip the privat GitHub safety script.
3. Never commit if the safety script fails.
4. Never skip `npm run ci:local` after the commit set is created and before declaring it ready to push.
5. Prefer multiple small commits over one big commit.
6. Use conventional commits format.
7. Never add `Co-Authored-By` lines.
8. Never skip the final commit list.
9. Never show inactive GitHub accounts in the final summary.
10. Do not rewrite history unless the user explicitly asks.
