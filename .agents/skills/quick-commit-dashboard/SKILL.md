---
name: quick-commit-dashboard
description: Quickly commit low risk VenoDashboard changes with one conventional commit and DanielDanielsson GitHub safety verification
---

# Quick Commit Dashboard

Use this skill when the user asks for a quick commit in `VenoDashboard`.

This is for low risk changes where the user explicitly wants speed, such as agent skills, docs, notes, comments, or small configuration updates.

For normal code changes, risky changes, or anything that should be CI verified before being called ready, use `commit-dashboard` instead.

## Overview

This skill creates one fast conventional commit.

It requires:

1. one commit only
2. one clear conventional commit message
3. DanielDanielsson as the only GitHub identity for write actions
4. no local CI verification
5. a final commit and GitHub account report

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
2. Confirm the change set is appropriate for a quick single commit.
3. Run the GitHub safety script once before committing.
4. Stage only the intended files.
5. Check staged diff with `git diff --staged`.
6. Confirm there is no accidental file in the index.
7. Write one conventional commit message that matches the whole staged change.
8. Commit once.
9. Show the commit summary with `git show --stat --oneline -1`.
10. Show the active GitHub account that would be used for push.

## Commit Message Rules

1. Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, `perf:`, `ci:`, `build:`.
2. Keep the subject line short and specific.
3. No `Co-Authored-By` lines.
4. Use one commit message for the whole quick change.
5. Scope when useful, for example `chore(agents): add quick commit skill`.

## Staging Rules

1. Do not stage unrelated files.
2. Leave user owned unrelated modifications untouched.
3. Do not commit generated contract snapshots unless the user explicitly intended a contract refresh.
4. Treat these files as generated noise unless explicitly requested:
   1. `content/contracts/agent-context.snapshot.json`
   2. `content/contracts/openapi.snapshot.json`

## Verification

Required:

1. Run the GitHub safety script before committing.
2. Check staged diff with `git diff --staged`.
3. Ensure the commit message type matches the staged change.
4. Confirm there is no accidental file in the index.

Skipped by design:

1. `npm run ci:local`
2. targeted lint, typecheck, test, build, and e2e commands

If the user asks for test verification, use `commit-dashboard` or run the requested checks before using this quick flow.

## Final Report Requirements

After the commit, always show:

1. `Commit created`
2. hash plus subject
3. `GitHub account for push`
4. active account only from `gh auth status` when available
5. note that local CI was intentionally skipped

If `gh` is unavailable, show:

1. `git config user.name`
2. `git config user.email`
3. `git remote -v`

Never include inactive GitHub accounts in the summarized final message.

## Critical Rules

1. Always verify the active GitHub account is `DanielDanielsson` before commit or any GitHub write action.
2. Never skip the privat GitHub safety script.
3. Never commit if the safety script fails.
4. Never run local CI unless the user asks for verification or switches to `commit-dashboard`.
5. Create exactly one commit.
6. Use conventional commits format.
7. Never add `Co-Authored-By` lines.
8. Never show inactive GitHub accounts in the final summary.
9. Do not rewrite history unless the user explicitly asks.
