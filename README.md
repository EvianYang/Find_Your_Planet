# Find Your Planet

The distance between two stars. The distance between two hearts.

**When we see the same question, do we imagine the same world?**

Find Your Planet is a two-player AI social mini-game. Two people answer the same open-ended questions. AI interprets the associations in their answers, explains where their thoughts resonate and where they diverge, and turns that “distance between wavelengths” into the distance between two little asteroids in space.

It responds to the theme **“Fly Me to the Moon”**: stepping away from everyday reality, entering our imaginations, and getting a little closer to someone else’s world.

## How to Play

Two players join the same room for three rounds of questions.

In each round, both players see the same question and write their answers privately. Neither can see the other’s answer until both have submitted. The answers are then revealed together, AI offers a brief interpretation, and the two asteroids representing the players move to show the distance for that round.

After three rounds, players see the overall distance for the game, along with the most interesting connections and differences.

**Every game is a new encounter.** Try different answers, different questions, or a different partner, and discover how close you are this time.

## What the Questions Are Like

The questions do not follow fixed categories. They have one guiding idea: **invite people to step outside everyday reality and let their imaginations wander.**

They can be absurd, tender, strange, or surprisingly simple. They do not test knowledge, have no right answers, and do not require everyone to explain their reasoning in full.

For example:

- If the world could have one more color, where would you want it to appear?
- You gain the ability to move anything two centimeters to the left. What do you do first?
- You can pack a moment of silence into a suitcase. Where would you take it?
- The Moon suddenly displays “Storage full.” What do you think is stored inside?
- A road that did not exist yesterday appears outside your home. Where does it lead?
- If you could add one instruction to the universe’s user manual, what would it say?

These are examples, not limits on the kinds of questions we can ask. We want answers that make someone say, “How did you think of that?” or “I can’t believe I thought the same thing.”

## What AI Does

AI goes beyond checking whether answers use the same words. It compares **the associations people make and how they develop their ideas**.

For example, consider the power to move something two centimeters to the left:

> One person wants to shift a friend’s umbrella just enough to keep the rain off their shoulder.
>
> The other wants to move a cup back from the edge of a table so it does not fall and break.

They chose different objects, but both imagined using a tiny change to quietly prevent something bad from happening.

Conversely, two people might both answer “go to the Moon,” but one wants to escape work while the other wants to open a late-night convenience store. The shared destination does not necessarily mean they think alike.

AI explains these similarities and differences. When the answers do not provide enough clues, it can acknowledge that there is not enough information to tell.

The distance represents **how closely these particular answers align**. It does not assign permanent labels to someone’s personality or relationship.

## The Visual Experience

Each player is represented by a little asteroid.

As answers are revealed, the asteroids move across the night sky. Changes in distance appear alongside the AI’s interpretation. The Moon, light, orbits, and stars form the game’s visual language.

The scene should feel like “our wavelengths just crossed somewhere in the universe.” Words explain the connection; animation makes the encounter memorable.

## Saving and Rankings

At the end of each game, each player independently chooses whether to save the result.

Saved results appear in a personal list of encounters, ranked by distance, so you can look back and ask:

**When—and with whom—were you most on the same wavelength?**

The same person can appear more than once. You might be close today and drift a little farther apart tomorrow; both encounters can be part of your collection. Multiple games are never automatically combined into a fixed measure of “how alike you are.”

Your personal star map becomes a collection of encounters: each point of light represents a game you chose to keep.

## Optional Second Mode: How Well Do You Know Me?

If time allows, we will add a prediction mode for people who already know each other.

Both players first write their own answers, then predict what the other person will say. AI compares each prediction with the actual answer and explains what it captured and what it missed.

Understanding can be asymmetric: you might understand the other person well even when they do not quite guess your answer.

**The first version prioritizes answering shared questions, visualizing the distance between perspectives, and saving and ranking results. The prediction mode can wait if time runs short.**

## What We Aim to Build in One Day

A team of three will build a small but complete experience:

- Creating and joining a room for two players.
- Three rounds of open-ended questions with shared reveals.
- AI interpretations of similarities and differences.
- Animated distance between two asteroids.
- A game summary, optional saving, and personal rankings by distance.

One person will focus on the interface and visuals, one on rooms, data, and integration, and one on AI, questions, and evaluation testing.

First, get two people through one complete round. Then expand to three rounds, saving, and rankings. Finally, polish the visuals and demo.

The moment we most want to create is:

**“So you think that way too.”**

Or:

**“So that’s what your world is like.”**


---

## What's in this build

A complete two-player game you can play on two phones:

- **Rooms.** Create a room and share its 8-character code; the second player joins with it. No sign-up: each browser gets an anonymous identity, and a private recovery code (shown once) moves it to another device.
- **Three private rounds.** Both players answer the same question. Answers stay sealed until both are in; neither side can read the other's text early.
- **AI reading of the two answers.** After each round the AI scores the pair and writes a short reading for both players: what they share and where they split, in how they think and what they value. The server turns the scores into a distance from 0 (closest) to 1000, and the two asteroids move to it.
- **Honest unknowns.** When the answers give too little to go on, the round says so ("Not enough to go on this round") instead of showing a made-up distance, and it is left out of the average. A technical failure is shown as a failure, never as a result, with a retry.
- **Game summary.** The overall distance averages the rounds that could be measured (at least two).
- **Questions.** 45 hand-written questions across 15 directions, three drawn at random for each game.
- **Live sync.** Both screens follow the same room state, recover after a refresh or a dropped connection, and never need a manual reload.

## What's next

Two features are finished on the `production` branch but not tested yet, so they are not in `main`:

- **Fresh AI questions.** While the room waits in the lobby, the server asks the model for up to two new questions, checks them, and mixes them at random with the hand-written ones. A slow or failed generation never holds up the start.
- **No quick repeats.** Questions either player saw in their last five games are left out of the draw.

Next steps:

1. From `production`, apply its two new migrations (`supabase db push`), deploy the `game` function, and run `npm run verify:prompts` plus the remote checks below.
2. Play a few real games on two phones.
3. If both go well, merge `production` into `main`.

Until then, deploy the backend from one branch only. Once `production`'s migrations are applied, `supabase db push` from `main` stops, because it finds migrations it doesn't have. Deploying `game` from `main` switches both features off.

Later, if time allows: saving results, the personal ranking and the star map. The prediction mode is out of scope for now.

## How it works

```text
Browser (React + TypeScript + Vite, hosted on Vercel)
   │  anonymous session, then Edge Function calls; Realtime only says "something changed"
   ▼
Supabase
   ├─ Edge Functions   identity · game · evaluate
   ├─ Postgres         rooms, rounds, sealed answers (row-level security;
   │                   the browser can read only a room's public state)
   └─ OpenAI Responses API (model set by LLM_MODEL)
        · compare two answers → structured scores and reading
```

- **Symmetric scoring (rubric fmp-v2).** The model rates two overlaps between the answers (imagery, focus) and profiles each answer on its own: how far it leaps from the obvious reading, four thinking-style axes (big picture ↔ detail, principles ↔ feelings, outward ↔ inward, settled ↔ open) and four value groups after Schwartz (openness, achievement, security, care for others). The server computes the distance from the gaps (association 30%, thinking 35%, values 35%). Answers are put in a canonical order first, so swapping players cannot change the result.
- **Grounded readings.** Every scored comparison must quote each answer; quotes are matched back to the original text on the server, and unsupported output is rejected rather than shown.
- **Race-safe rounds.** Starting, submitting, evaluating and continuing are single database transactions with row locks, so two phones pressing buttons at once cannot double-advance a round. Evaluation runs under a lease, with one automatic retry and two player retries.
- **Privacy.** Logs never contain answers, quotes, recovery codes or tokens. The model sees only the question and the two answers.

The full rules live in [CONTRACTS](docs/CONTRACTS.en.md): states, data and endpoints (sections 2–6), the scoring rubric (section 7), and concurrency and permissions (section 8).

## Run it locally

Requirements: Node.js 20.19 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to play against a Supabase project. Without them, the home page says the build is not connected, and these demos still work with sample data:

| URL | What it shows |
|---|---|
| `/?preview=game` | A whole game with a simulated partner and server, including failures and retries |
| `/?preview=reveal` | The reveal: answers, reading, and the asteroids moving to a distance |
| `/?preview=screens` | Every other screen and its edge cases |
| `/?preview=intro` | The opening scene |
| `/?preview=contracts`, `/?preview=supabase` | Contract validation and an anonymous-session check |

Type check and production build:

```bash
npm run typecheck
npm run build
```

Unit tests (Node.js with built-in TypeScript support, 22.18+ or 23.6+):

```bash
node --test tests/ai/*.test.ts tests/content/*.test.ts tests/contracts/*.test.ts tests/fixtures/*.test.ts
```

## Deploy the backend

```bash
supabase link --project-ref <project-ref>
supabase secrets set LLM_API_KEY=<key> LLM_MODEL=<model>
supabase db push
supabase functions deploy identity
supabase functions deploy game
supabase functions deploy evaluate
```

Deploy `game` and the web app before `evaluate` when the result format changes. Secrets stay in Supabase; never put them in `VITE_*` variables.

## Remote acceptance checks

These run against the project in `.env.local` and create throwaway test identities and rooms there.

| Command | What it checks | Model calls |
|---|---|---|
| `npm run verify:identity` | Anonymous identities, stable profile mapping, denied direct reads | No |
| `npm run verify:rooms` | Room creation, concurrent joins (exactly one second player), room codes | No |
| `npm run verify:start` | Only a full room's host can start; prompts are frozen | No |
| `npm run verify:submit` | Sealed answers, replay and conflict handling, pre-reveal privacy | No |
| `npm run verify:evaluate` | A real comparison and its stored result | Yes |
| `npm run verify:continue` | Both players continue; three rounds finish | Yes |
| `npm run verify:recovery` | Recovery-code transfer, rotation and rate limiting | No |

`scripts/check-explanations.ts` runs the comparison prompt on synthetic cases for manual review (`node --env-file=supabase/functions/.env.local scripts/check-explanations.ts`).

## Repository layout

```text
Find_Your_Planet/
├── AGENTS.md                 rules for everyone working in the repo
├── docs/                     PROJECT and CONTRACTS (English in *.en.md), role guides
├── src/
│   ├── App.tsx, GameApp.tsx  routes and the player flow
│   ├── screens/              welcome, lobby, answer, reveal, result, records (+ demos)
│   ├── components/           asteroids, answer cards, intro, loaders, shared UI
│   ├── styles/               tokens and screen styles
│   ├── services/, hooks/     Supabase clients and live room sync
│   └── fixtures/             labeled demo results
├── supabase/
│   ├── migrations/           schema, row-level security and transactional functions
│   └── functions/
│       ├── identity/, game/, evaluate/
│       └── _shared/
│           ├── contracts/    Zod schemas shared by browser and server
│           ├── ai/           comparison and question-generation prompts, scoring, evidence checks
│           └── content/      question bank and pool selection
├── scripts/                  live model checks
└── tests/                    ai, content, contracts, fixtures, hooks, integration
```

## Team

| Role | Owns | Start here |
|---|---|---|
| A — Frontend & experience | Screens, motion, mobile experience | [START_FRONTEND](docs/START_FRONTEND.md) |
| B — Backend & integration | Rooms, sync, identity, deployment | [START_BACKEND](docs/START_BACKEND.md) |
| C — AI & questions | Questions, prompts, scoring and evaluation tests | [START_AI](docs/START_AI.md) |

Read [AGENTS.md](AGENTS.md), [PROJECT](docs/PROJECT.en.md) and [CONTRACTS](docs/CONTRACTS.en.md) before changing code. PROJECT and CONTRACTS have English editions next to the Chinese originals, which are the copies the team edits; AGENTS.md and the START guides are in Chinese. Progress is tracked in the [Notion Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204).

The repository name `Find_Your_Planet` and the English introduction above are kept as the team wrote them.
