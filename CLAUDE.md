# CLAUDE.md — AI Agent Operating Rules

> This file tells AI assistants (Claude, Cursor, Copilot, etc.) HOW to work on this project.
> Load this file at the start of every session.

---

## Thinking Style

- **Ask before assuming.** If a requirement is ambiguous (e.g., scoring weights, persona behavior, turn limits), ask the human — don't guess.
- **Name your tradeoffs.** Before proposing a solution, state what you're trading off (e.g., "This adds latency but simplifies state management").
- **Bias toward the boring solution.** Pick the well-understood approach over the clever one. No novel architectures unless the problem demands it.
- **Think in user sessions.** Every change should be reasoned about in the context of: advisor opens app → picks persona → talks → gets scorecard → reviews history.

---

## Simplicity Rules

- **No feature creep.** If it's not in `PROJECT.md` must-haves, it doesn't exist yet. Period.
- **No premature abstractions.** Don't build a "generic persona engine" when we need 4 hardcoded personas. Abstract only after the third duplication.
- **One way to do things.** Don't introduce a second state management pattern, a second API style, or a second way to handle errors. Pick one, commit.
- **Flat over nested.** Prefer flat folder structures and flat component trees. Nesting is a code smell until proven otherwise.
- **Delete > Comment out.** Dead code gets deleted. Git remembers.

---

## Surgical Changes Only

- **Smallest diff that works.** Every PR should do ONE thing. If you're touching 8 files, pause and split.
- **Don't refactor while fixing.** Fix the bug. Ship it. Then refactor in a separate commit.
- **Read before writing.** Before editing a file, read the whole file. Understand the existing patterns before introducing new ones.
- **Respect existing conventions.** If the codebase uses `camelCase`, you use `camelCase`. Match what's there.

---

## Verification Habits

### Before Every Commit
 - [ ] **Frontend:** `npm run lint` & `npm run typecheck` pass
 - [ ] **Backend:** `ruff check .` (or flake8) passes
 - [ ] **Tests:** `npm run test` (Frontend) & `pytest` (Backend) pass
- [ ] Manually tested the happy path: start call → 5 turns → scorecard renders
- [ ] Manually tested one sad path: e.g., user disconnects mid-call, API timeout

### Before Every PR
- [ ] Tested with ElevenLabs voice end-to-end (not just text mock)
- [ ] Scorecard renders correctly with real Anthropic output
- [ ] Session persists in Blaxel — close tab, reopen, history is there
- [ ] No `console.log` left behind
- [ ] No hardcoded API keys or secrets
- [ ] Environment variables documented in `.env.example`

### Run Commands
```bash
# Backend (Terminal 1)
cd backend && uvicorn app.main:app --reload

# Frontend (Terminal 2)
cd frontend && npm run dev

# Deployment
bl deploy            # Deploy backend agent to Blaxel
```

---

## PR & Review Behavior

- **"Grill me" mode.** When reviewing my own output, I will actively try to break it. I'll ask: What happens if the API is slow? What if the user says nothing? What if the persona data is missing?
- **"Prove it works" rule.** Every PR description includes:
  1. What changed and why (one sentence)
  2. How to test it (exact steps)
  3. Screenshot or terminal output proving it works
- **No "LGTM" reviews.** If reviewing code, leave at least one substantive comment — even if it's "I verified X works by doing Y."
- **Flag scope creep.** If a PR introduces something not in the must-haves, call it out immediately.

---

## Communication Style

- Be direct. "This will break because X" > "You might want to consider..."
- Use code references. "See `lib/scoring.ts:42`" > "somewhere in the scoring logic"
- When stuck, say so. "I don't know the best approach here — here are two options and their tradeoffs."
- Never say "it should work." Say "I tested it and here's the output."

---

## Slash Commands (Optional — for Claude/Cursor)

| Command | Behavior |
|---|---|
| `/scope-check` | Re-read PROJECT.md and flag anything in the current diff that's out of scope |
| `/scorecard-audit` | Review the scoring rubric logic for edge cases and bias |
| `/persona-test <name>` | Simulate a 5-turn conversation with the named persona and print the transcript |
| `/pre-pr` | Run the full verification checklist and report pass/fail |
| `/simplify` | Look at the current file and suggest what to delete or inline |
