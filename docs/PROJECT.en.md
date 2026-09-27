# Find Your Planet

**The distance between two stars. The distance between two hearts.**

> English edition of [PROJECT.md](PROJECT.md), translated on 2026-09-27. The team edits the Chinese file; if the two ever disagree, the Chinese one is newer.

Status (2026-09-27): this is the product plan. The game itself is built and playable; what the current build does is listed in the README under [What's in this build](../README.md#whats-in-this-build). Not built yet: saving results and the personal ranking (planned for later). AI-written questions are finished on the `production` branch but not yet tested. Day-to-day progress is tracked in the [Notion: Find Your Planet — Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204); don't read a plan in this document as a finished feature.

## What we're making

When we see the same question, do we imagine the same world?

Find Your Planet is a two-player AI social mini-game. Two people answer the same open-ended questions. The AI compares the associations in their answers, explains where they resonate and where they head in different directions, and turns this game's "distance between wavelengths" into the distance between two little asteroids.

It responds to the theme "Fly Me to the Moon": stepping away from everyday reality for a while, into the imagination, and getting closer to someone else's world along the way. Su Shi's line “但愿人长久，千里共婵娟” (may we all live long, and share the same bright moon though a thousand miles apart) is the emotional backdrop. The product is called Find Your Planet; Same Moon is no longer its name.

It works for friends, partners and classmates, and two people who barely know each other can play too; nobody needs to know the other beforehand. It should feel light, fun and worth looking back on. It isn't a validated psychological test, and it isn't a contest over who answers better.

## How a game works

1. Enter a nickname, then create a room or join by invitation. Two people per room.
2. A game has three rounds. In each round both players see the same question and answer on their own, without seeing the other's text first.
3. Once both have submitted, the AI compares the two real answers and reveals them together with what they share and where they differ.
4. The two asteroids move according to this round's result to show the distance.
5. Both continue. After three rounds they see the game's overall distance and can look back at each round.
6. Each player decides alone whether to save the game. Saved games go into their own list of records, sorted by distance.

Every game is answered and scored from scratch: answers aren't reused across games, and neither anyone's answers nor the question set is fixed. Answers can't be changed after submitting so that the reveal rests on one fixed input; nothing is locked across games. There's no countdown penalty.

The main mode compares only A's answer with B's answer. It doesn't ask anyone to predict the other, and doesn't distinguish A→B from B→A.

## Questions: stepping out of reality

Questions are in English. The core idea fits in one Chinese idiom, 天马行空 (a heavenly horse galloping across the sky): let the imagination run free. There are no limits on style. Absurd, tender, strange, funny and everyday all work, and simple is fine. Not every question needs a twist, and players are never forced to explain "why". Every question should spark association and abstract thinking, and still let people start answering on instinct within ten seconds, so they want to answer.

The hand-written bank currently has 45 questions (curated-v3) in 15 directions, 2–5 per direction. Two of the directions, Big Debates (classic arguments about life with no right answer) and Would You, Really? (value trade-offs with a real cost), make it easier for the reading to show how people think and what they value. While the room waits, the server tries to write 2 new AI questions; after checks they join this game's pool, and three different questions are drawn at random. There is no quota for AI questions: if the new ones aren't ready when the game starts, hand-written ones are used and the start isn't delayed. Once the game starts, its questions don't change.

First drafts of hand-written questions (for A and C to adjust after play-testing; they don't limit what kinds of questions we ask):

1. If the world could have one more color, where would you want it to appear?
2. Once a day, you can move anything two centimeters to the left. What would you move first?
3. A moment of silence can fit inside a suitcase. Where would you take it?
4. The Moon suddenly displays “Storage full.” What do you think is stored inside?
5. A road that did not exist yesterday appears outside your home. Where does it lead?
6. If you could add one instruction to the universe’s manual, what would it say?
7. Tomorrow, everyone’s shadow can take the day off. Where would your shadow go?
8. You receive a receipt from the future with only one item on it. What is it?
9. If a sound could grow into a plant, which sound would you plant?
10. The world suddenly gains a holiday that belongs only to you. What does everyone do that day?
11. You can place a window on anything. Where would you put it?
12. An animal that has never seen a human mistakes you for a kind of weather. How would it describe you?

These are early drafts, not the live bank, and not templates: new questions shouldn't copy their imagery or phrasing. The live 45 questions are in `supabase/functions/_shared/content/prompts.ts`. Directions, writing standards, counter-examples and generation rules are in [the question rules of START_AI.md](START_AI.md#出题规则) (in Chinese).

## Why it needs AI

The same word can hide different lines of thought, and different answers can follow a similar path of association.

Take the question "Once a day, you can move anything two centimeters to the left." One person shifts an umbrella to keep the rain off a friend; the other moves a cup back from the edge of the table so it doesn't break. The objects differ, but both use a tiny change to stop something bad from happening.

The AI explains shared imagery, ways of associating, and the purposes or feelings the answers express. It works only from the text. It doesn't force every wild idea to carry a value or a psychological meaning, and it doesn't mark answers down for being short or odd. When the evidence isn't enough, it can say it can't tell. The reading players see is subjective: it looks at where the ways of thinking and the values that show in this round's two answers meet and where they part (for example "You both …" / "One of you …, while the other …"), rather than retelling the answers. It can borrow the kind of dimension language used by Jung's eight cognitive functions or MBTI, but it never outputs type codes, never pins people down, and never judges the relationship.

The overall distance describes only this game's answers. Saved games with different questions can be ranked together; that's a playful ordering of game records, not a validated personality match. Don't market it as a permanent relationship score.

## Saving and personal ranking

Nothing is saved by default. Each player taps save on their own, and one player saving doesn't save for the other. A record keeps the partner's nickname as it was, the time, the questions, the distance and the short AI reading. It doesn't keep either player's full answers or the evidence quotes long term.

Different games with the same partner are separate records: they aren't averaged or overwritten. Measured distances go from closest to farthest, and ties share a rank. A game without an overall distance can be saved too, but it shows as "unranked". Players can delete their own records, but not the other player's.

A personal star map is an optional way to show the records; the first version must have a clear list. If the star map is built, each point is one encounter, and its distance from "me" at the center is the record's distance. The spacing between other points is only layout and says nothing about how similar those people are to each other.

## Nickname and recovery

Enter a nickname to start; a separate identity sits behind it, and the same nickname doesn't mean the same person. When the identity is first created, a private recovery code is shown. It can be copied and kept in this browser, and the server stores only a hash of it. On a new device, entering the recovery code restores the records; the nickname doesn't need to be remembered.

After a recovery, a new code is issued and the old identity loses access to the profile. There is no email, password reset, support-assisted recovery or friends system. If both the recovery code and the browser identity are lost, the nickname alone can't restore anything.

## Visual direction

The two asteroids are the main characters, with the Moon as a shared backdrop; the night sky, orbits and points of light support them. The screen should first let people understand the reading, and then let the change in distance land emotionally.

Use CSS/SVG: no WebGL, 3D physics or images generated at runtime. Suggested palette: deep blue background #0B1020, body text #F7F4EE, and #91D8F7 / #D1B3FA for the two asteroids, paired with nicknames and shapes so that color is never the only cue.

The reveal goes answers → short reading → asteroids move, in about 1.5–2 seconds, and can be skipped. An unknown result uses a dashed line and words, and is never placed at the maximum distance. Everything must still make sense with animation off, and after a refresh the finished state shows directly.

Mobile first: a 390px design baseline, with no horizontal overflow at 320px; on desktop, content is at most about 960px wide. Long nicknames, long answers, the on-screen keyboard and failure states all need design. Touch targets are at least 44px, focus is clearly visible, and contrast is checked for real.

Baseline for design-tool work: make the home, waiting, answering, reveal, summary, personal records and recovery screens; drive them all from one shared set of fixtures; the two asteroids express one symmetric distance. Don't write explanations yourself, and don't add psychological labels, chat or guessing features. State wiring and evaluation data come from the people who own them.

## Scope for a one-day build

P0: two-player rooms, three rounds of questions, AI comparison, the distance animation, the summary, independent saving, personal ranking and deletion, nickname identity and recovery, a mixed question pool with a fallback when generation fails, and basic reconnect recovery and permission checks.

Later: a guessing mode for people who know each other, one-tap sharing, a richer personal star map, chat, a public leaderboard and full account management. The guessing mode may never be built; don't pre-build a prediction phase or two-way scoring for it.

If time runs short, simplify decoration, extra transitions and the star-map layout first, and keep the playable loop plus saving and ranking. Three people have about a day: first get one round working on two devices, then three rounds, saving and polish. Run at least two full play-tests with real people, one of them on a phone.

## Docs and progress

- [CONTRACTS](CONTRACTS.en.md): the behavior and interfaces all three workstreams must agree on.
- [AGENTS.md](../AGENTS.md) (in Chinese): what each person may change and how work is delivered.
- [Notion: Find Your Planet — Development Checklist](https://app.notion.com/p/3e7d830fac0481c8bf0ef203ac15c27e?pvs=204): the single day-to-day source for tasks and acceptance.

The first questions, numeric thresholds and visual parameters in this document are a development baseline, not tested values. The repository keeps the team's existing name, Find_Your_Planet, and isn't renamed after the product.
