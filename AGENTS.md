<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow: worktree, then merge to main

Never commit on `main` in the primary checkout. Do every change in its own git worktree on its own branch, merge that branch into `main`, then push `main`. This keeps parallel agents (Claude, Codex, Cursor) from stepping on each other.

1. **Start**: from the primary checkout, `git fetch origin` and `git worktree add ../brenraphaels-ecommerce-worktrees/<branch> -b <branch> origin/main`. Branch names: `issue-<number>-<short-slug>` (e.g. `issue-2-tooling-app-shell`). Work only inside that worktree.
2. **Set up the worktree**: run `npm install` there (`node_modules` is not shared) and copy or re-pull the git-ignored env files (`vercel env pull`). Never commit env files.
3. **Commit** on the branch as often as you like. One issue per branch; reference it in the commit message (`Refs #<number>`).
4. **Before merging**: `git fetch origin && git rebase origin/main` on the branch, then run the tests, `npm run lint` and `npm run build`. All must pass. If the rebase conflicts, resolve them in the worktree, not on `main`.
5. **Merge**: in the primary checkout, `git switch main && git pull --ff-only origin main`, then `git merge --ff-only <branch>` (after the rebase this is always a fast-forward; if it is not, go back to step 4). Do not use `--no-verify`, and do not force-push.
6. **Push**: `git push origin main`, only after step 5 succeeds and only when the user has asked you to push. Close the issue with a comment that links the commit.
7. **Clean up**: `git worktree remove ../brenraphaels-ecommerce-worktrees/<branch>` and `git branch -d <branch>`.

Rules that hold throughout:
- Do not run destructive database migrations on the shared Neon `dev` branch while another agent might be using it; if you need isolation, create a Neon branch for your worktree and point that worktree's `DATABASE_URL` at it.
- Do not edit files inside another agent's worktree.
- If `main` moved while you worked, rebase again rather than merging `main` into your branch.
