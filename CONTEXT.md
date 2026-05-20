\# Pokerbook — Project Context for AI Coding Agents



Read this file before making any changes to the codebase.



\## Stack

Next.js + TypeScript + Tailwind + Supabase + Vercel + Framer Motion



\## Project status

A full UI/UX redesign was completed in May 2026. All five pages are 

redesigned and approved. Do NOT redesign or restructure anything 

unless explicitly asked. You are working on top of a finished design.



\## Design system

\- Theme: "Felt Night" — dark mode only, NOT a toggle

\- Background: deep forest green / near-black with green undertone

\- Text: warm cream/off-white on dark surfaces. NEVER use cream as a 

&#x20; surface fill in dark mode — this is the most common mistake.

\- Accent: coral/salmon (#E8896A or similar) for headings, labels, 

&#x20; negative P\&L, COOKED pill

\- Semantic green: for positive P\&L, BIG WIN pill, success states

\- Typography: editorial serif italic for page heroes and player names, 

&#x20; clean sans-serif for body, small uppercase tracked for labels

\- Design tokens live in src/app/globals.css — use them, don't 

&#x20; hardcode colors



\## Shared components (src/components/ui/)

\- app-header.tsx — top bar with POKERBOOK wordmark + right action

\- eyebrow.tsx — small uppercase coral section labels

\- suit-row.tsx — decorative suit icons (NOT for player names)



\## Page-by-page notes



\### Home (src/app/page.tsx)

Hero: "settle the night, not the math." Coral italic + cream serif.

Dark felt background. Suit icons used as decorative ornament only.



\### /new (src/app/new/)

"new session." title: "new" in cream serif, "session." in coral 

italic. Dark form inputs. No suit icons next to player names.



\### Active session (src/app/session/\[id]/)

Session name in large cream serif italic. Dark stat cards + dark 

player cards with chip dot animations. Ghost +1 BUY-IN buttons. 

Atomic increment RPC for buy-in updates — do NOT replace with 

non-atomic updates.



\### /end (src/app/session/\[id]/end/ or similar)

Title: "final" (cream serif) + "count." (coral italic) on two lines.

Player cards: dark surface, BUY-INS uses a three-box control 

(\[-]\[number]\[+] — all three are bordered cells side by side). 

FINAL CHIPS input to the right.

+/- buttons are PIN-gated (host only), atomic via 

adjust\_player\_buy\_in RPC, minimum buy-in count is 1.

Sticky bottom bar handles delta detection and SAVE action. 

visualViewport detection hides bar when keyboard opens — do NOT 

break this.



\### /summary (src/app/session/\[id]/summary/ or similar)

Title: "from chaos," (coral italic) + "to clarity." (cream serif).

Status pills: BIG WIN ▲ (top winner), COOKED ▼ (bottom loser), 

EVEN (₹0). All others get no pill.

P\&L colors: green if positive, coral if negative, muted if zero.

Left accent bar on player rows: green/coral/neutral matching P\&L.

Desktop layout: two-column — THE STANDING (left \~65%) + SETTLE UP 

(right \~35%). Mobile: stacked vertically.



\## Database / Backend

\- Supabase with RLS enabled

\- Key RPCs: increment\_player\_buy\_in (atomic +1), 

&#x20; adjust\_player\_buy\_in (atomic +/- with PIN auth and minimum-1 floor)

\- Migration files in supabase/migrations/

\- After adding any new RPC: user must manually run the migration in 

&#x20; Supabase SQL Editor — agent should NOT run migrations automatically



\## Working patterns

\- Manual git commits — agent should NOT auto-commit or auto-push

\- No TypeScript strict mode issues — keep types clean

\- Test mobile at \~380px viewport width

\- Use env(safe-area-inset-bottom) for any bottom-fixed elements on 

&#x20; mobile (iOS Safari safe area)

\- When fixing mobile layout issues, do NOT change desktop layout

\- If a fix requires restructuring components or large changes, 

&#x20; explain why before proceeding



\## What NOT to do

\- Do NOT redesign or restructure approved pages

\- Do NOT use cream as a surface fill in dark mode

\- Do NOT add suit icons next to player names

\- Do NOT make non-atomic Supabase updates where atomic RPCs exist

\- Do NOT auto-commit or auto-push

\- Do NOT change design tokens in globals.css unless explicitly asked

\- Do NOT touch the visualViewport detection logic in the sticky bar

