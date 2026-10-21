# Session Start & Git Sync Protocol

## Two-Agent Local Setup
This repository is developed by two AI assistants on this machine from separate checkouts:
- **Antigravity (This agent)**: `c:\Users\barne\Documents\AG -BrewMate`
- **Claude Code**: `c:\Users\barne\Documents\Claude Code\brewmate`
- **Remote Hub**: `https://github.com/BernieBallz/brewmate.git`

Because both agents work on the same project in separate local directories, **all sync happens through Git / GitHub**.

---

## Mandatory Rule: Always Pull the Latest Code First

Before starting any task, code change, testing, or analysis at the start of a session, the agent **MUST** synchronize with the remote Git repository so changes made in the other folder are immediately present.

### Procedure

1. **Check Local Status**:
   - Run `git status` to verify the working tree is clean.
   - Run `git branch --show-current` to identify the active branch.

2. **Fetch and Pull Remote Changes**:
   - Run `git fetch origin` to retrieve any branches, tags, or commits pushed by Claude or remote.
   - `dev-2` is the only branch. If it tracks `origin/dev-2`, run:
     ```bash
     git pull --ff-only
     ```
   - If Claude pushed a new remote branch or tag, notify the user and confirm whether to switch to or merge that branch.

3. **Confirm Current Version to User**:
   - Briefly state the current branch name, latest commit hash, and that the workspace is synchronized with remote before proceeding with the user's request.

4. **Push Work When Finished**:
   - Always push committed work to GitHub so the Claude checkout can pull it.

---

## History Reset (2026-10-21)

The repository history was replaced with a single fresh commit to remove a personal recipe that had been committed. All old branches (`main`, `archive/*`, `chore/*`) and the archive tag were deleted; `dev-2` is the only branch.

- Any checkout made before this date still holds the old history. Do **not** push from it. Re-clone, or run `git fetch origin && git reset --hard origin/dev-2` after saving any uncommitted work.
- Never commit a real recipe. Tests use the fictional `src/__tests__/fixtures/testRecipe.json`.
