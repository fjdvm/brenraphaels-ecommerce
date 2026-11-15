<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Git workflow: worktree and pull request

1. **Start**: from the primary checkout, run `git fetch origin` and `git worktree add ../brenraphaels-ecommerce-worktrees/<branch> -b <branch> origin/main --no-track`. Use `issue-<number>-<short-slug>` for the branch. Work only in your own worktree, including for instruction-file changes; leave the primary checkout's changes untouched.
2. **Set up**: run `npm ci` in the worktree. Copy or re-pull git-ignored env files when needed. Never commit env files.
3. **Commit** on the worktree branch, one ticket at a time. Reference the ticket's repository and issue number when it lives elsewhere. End each commit message with:
   ```
   Co-Authored-By: Claude <noreply@anthropic.com>
   Co-Authored-By: Codex <noreply@openai.com>
   ```
4. **Before every push**, run local typecheck (`npx next typegen` then `npx tsc --noEmit`) and unit tests (`npm test -- --maxWorkers=2`), because CI only builds and deploys (`.github/workflows/container.yml`) and runs no tests. Also run `npm run lint` when you touched lint-relevant code. Push only when they pass. Push the ticket branch and open or update its PR against `main`.
5. **Complete**: enable squash auto-merge with `gh pr merge <PR> --auto --squash`. Stop when GitHub accepts auto-merge; implementation is done at that point, without waiting for merge or deployment. Keep the worktree while the PR is pending.

### Checks and PR completion

- If waiting for PR checks is unavoidable, use one blocking `gh pr checks <PR> --watch --fail-fast` command. Never loop on status commands.
- Never wait for the production deploy. GitHub's failed-workflow notification emails the owner; Azure retains the previous revision if deployment fails.
- Track any required live-production check in a separate verification ticket (`ready-for-human` or its own ticket), rather than waiting as part of implementation.

### Shared worktree safety

- For schema-changing tickets, apply required production Drizzle migrations with `npm run db:migrate` before enabling auto-merge, using the production `DATABASE_URL_UNPOOLED` read from the Azure Container App's settings (`az containerapp show`, after `az login`). Never commit env files.

- Do not run destructive database migrations on the shared Neon `dev` branch while another agent might be using it; use an isolated Neon branch when needed.
- Do not edit files inside another agent's worktree or force-push.
- Branch protection does not require an up-to-date branch; `main` checks the merged code. Rebase only when needed to resolve conflicts.

## Hosting: Azure, not Vercel

Production runs on Azure (Container Apps, deployed by `.github/workflows/container.yml`), with the database on Neon. Do not use Vercel tools, the Vercel CLI or `vercel env pull` for anything in this repo; they are not linked. Environment variables and secrets live in the Azure Container App and GitHub Actions secrets. Pulling or reading production secrets, and applying production migrations, need the owner's explicit approval for that exact command.

## Input validation

Every user-facing input field is sanitized, normalized, and validated before it is persisted or used. Build its schema on `lib/validators/fields.ts` (`emailField`, `passwordField`, `nameTextField`, `optionalNameField`, `textField`, `optionalTextField`, `phoneField`) and `lib/validators/sanitize.ts` (`cleanText`, `cleanName`, `cleanEmail`, `cleanPhone`) — never a raw `z.string()`. A field accepts only the characters that belong to it (letters for a name, digits for a phone number, and so on); anything else is rejected with a clear message, not silently stripped. Add a new helper to `lib/validators/` when an existing one doesn't fit rather than inlining ad hoc sanitization.

## Instant navigation

Navigating to a page must feel instant, even while its data is still loading. A page never blocks the whole route on data: render the static shell (headings, back links, layout) immediately and put everything that awaits data (session, database, fields, lists, forms) in an async component behind `<Suspense>` with a skeleton fallback built from `components/ui/skeleton.tsx`, sized to match the real content so nothing shifts when it resolves. Every dynamic route also gets a `loading.tsx` with the same skeleton, so Next can partially prefetch it and switch to it on click. Reuse one skeleton component for both the `loading.tsx` and the `<Suspense>` fallback. A new page is not done until it navigates instantly. See `app/(site)/(protected)/support/` for the pattern.

## Square containers

Containers are square: cards, tiles, panels, modals, sheets, dropdowns, toasts, inputs, photos and skeletons use no rounded corners (the container radius token is `--radius-container: 0` in `app/globals.css`). Only pills, buttons, badges, avatars and circular icon buttons stay round, with `rounded-full`. Never add `rounded`, `rounded-lg`, `rounded-[24px]` or similar to a container. Any entrance animation or overlay transition must be disabled under `prefers-reduced-motion`. Figma's Foundations labels (card "40", input "3") are stale; the rendered screens are the source of truth. Guard: `__tests__/square-containers.test.ts` fails on a rounded container outside its allowlist; remove a file's entry once it is square.

## No polling

No app polls (ADR-0005 in the Portal repo, `docs/adr/0005-no-polling-anywhere.md`). Never repeat a data request on a timer, window focus or tab visibility; use the WebSocket, refetch on (re)connect, or refetch on a user action. A 30–60 second in-memory heartbeat is a keepalive, not polling, and timers that never touch the network (clocks, countdowns) are fine. Idle-tab check: `__tests__/no-polling.test.ts`.
