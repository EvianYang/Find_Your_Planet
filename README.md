# Find_Your_Planet

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

## Developer starting points / 开发入口

The repository now contains documentation and tracked scaffold placeholders, **not a runnable application**. No dependencies, backend, database or deployment have been configured. Existing source placeholders export nothing and must be implemented before use.

| Role | Start here | First handoff |
|---|---|---|
| A — Frontend & experience | [START_FRONTEND](docs/START_FRONTEND.md) | Fixture-driven reveal and planet distance UI |
| B — Backend & integration | [START_BACKEND](docs/START_BACKEND.md) | Bootstrap Vite/React, shared contracts, then two-player room |
| C — AI & questions | [START_AI](docs/START_AI.md) | Question bank, evaluation schema and validated fixtures |

Read [AGENTS.md](AGENTS.md), [PROJECT.md](docs/PROJECT.md), and [CONTRACTS.md](docs/CONTRACTS.md) before coding. Track progress in the [Notion Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204).

**Start order:** B establishes the runtime and shared contracts → C provides fixtures → A builds the reveal UI while B/C implement services → integrate one real round before expanding.

**Current setup:** there is no package.json yet, so `npm install` / `npm run dev` are not available. B's first task is to configure these in this repository root without overwriting the existing files. Do not create a second nested application.

```text
Find_Your_Planet/
├── AGENTS.md
├── docs/                 PROJECT, CONTRACTS, three role guides
├── src/
│   ├── App.tsx           B: flow integration (placeholder)
│   ├── main.tsx          B: startup (placeholder)
│   ├── screens/          A: six screen placeholders
│   ├── components/       A: four component placeholders
│   ├── styles/           A: CSS placeholders
│   ├── services/         B: client placeholders
│   ├── hooks/            B: session placeholder
│   └── fixtures/         C: sample-data placeholder
├── supabase/
│   ├── migrations/
│   └── functions/
│       ├── game/
│       ├── evaluate/
│       ├── records/
│       ├── identity/
│       └── _shared/
│           ├── contracts/   B/C: client-safe definitions
│           ├── ai/          C: server-only evaluation
│           └── content/     C: question bank
└── tests/
    ├── ai/
    └── integration/
```

Empty backend/test directories contain `.gitkeep` so they are retained by Git. There are no deployable function entrypoints or migrations yet. Role guides link to the existing checklist task numbers; no tasks were automatically marked complete.

The existing repository name `Find_Your_Planet` and English introduction are retained; the current product-planning name is **Find my planet**. Do not rename the remote or rewrite the introduction as part of scaffolding.
