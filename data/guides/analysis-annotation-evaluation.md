# Chapter 1: Overview and Objectives

## 1.1. Scope and Audience

This guide describes a structured workflow for analysing chess games using a graphical user interface (GUI) such as ChessBase or Hiarcs in conjunction with modern engines such as Stockfish or Dragon. It assumes that the reader is comfortable with algebraic notation and has experience playing tournament or online chess, but it does not assume professional-level expertise.

The emphasis throughout is on producing annotated portable game notation (PGN) files that are useful for long-term study, publication, and instruction. The guide is tool-agnostic: concrete examples may reference particular GUIs, but the procedures and principles are intended to transfer across platforms. You should feel confident that the habits you build here will work whether you use a commercial database, a lightweight UCI front end, or a cloud analysis board.

## 1.2. Key Concepts

This guide uses three interlocking concepts:

- **Analysis**: The systematic examination of a game or position to identify better moves, plans, and critical moments. A good analyst alternates between calculation and evaluation, pausing to mark critical junctions.
- **Annotation**: The process of embedding information in a PGN file, including text comments, Numeric Annotation Glyphs (NAGs), and variations. Annotation forces clarity: every note should either explain *why* or provide a *reference* line.
- **Evaluation**: The assignment of a numerical or verbal judgment to a position, informed by both human reasoning and engine output. A solid evaluation framework prevents you from chasing ghosts or over-valuing one-off tactics.

These concepts are interdependent. Evaluation informs annotation, and annotation captures analysis in a durable and reusable form. By looping through these phases deliberately, you create a repeatable workflow that resists bias and maintains clarity.

## 1.3. Human and Engine Roles

Engines excel at calculating tactical sequences and providing accurate numerical evaluations. Humans excel at identifying practical difficulties, explaining plans, and conveying ideas in a way that is meaningful to other players. The best annotated games show both voices: the engine ensures correctness; the human gives context, story, and pedagogy.

A well-designed workflow alternates between:

- **Human-led phases**: Identifying critical moments, proposing candidate moves, and articulating plans in natural language.
- **Engine-led phases**: Verifying or correcting human impressions, refining candidate moves, and detecting tactical oversights.

## 1.4. Target Outcomes

By the end of the guide, you should be able to:

- Configure an analysis environment with one or more engines and a suitable GUI.
- Read, interpret, and modify PGN files containing comments, NAGs, and variations.
- Perform an initial manual analysis of a game without engine assistance.
- Incorporate engine analysis in a disciplined manner that avoids over-reliance.
- Produce clear, readable annotated games with consistent symbols and evaluations.
- Export, store, and catalogue annotated games for later use.

---

# Chapter 2: Analysis Environment and Tooling

## 2.1. Requirements for an Analysis GUI

A suitable analysis GUI should support at minimum:

- Import and export of PGN files with comments, variations, and NAGs.
- Integration with one or more UCI-compatible engines.
- A variation tree or similar interface for exploring alternative lines.
- Search and filtering over collections of games.
- Basic visual aids (highlighted squares, arrows, and evaluation bars).

A pleasant workflow depends on small comforts: keyboard shortcuts for navigation, easy toggles for move/variation promotion, and straightforward engine management. Test these before committing to a platform.

## 2.2. Engine Integration Basics

Most modern engines communicate through the **Universal Chess Interface (UCI)** protocol. The GUI launches the engine as an external process and exchanges commands and analysis results. Knowing a few core UCI options helps you tune engines without drowning in settings.

Critical configuration parameters include:

- **Threads**: CPU cores allocated to the engine. Reserve some cores for your GUI and other background tasks if the machine feels sluggish.
- **Hash**: Memory reserved for the transposition table, influencing search depth and speed. Raising hash is most helpful in long sessions on stable positions.
- **MultiPV (Multiple Principal Variations)**: Number of top lines reported. MultiPV > 1 is invaluable for teaching and comparing plans, but it slows search.
- **Syzygy or other tablebases**: Precomputed endgame databases that yield perfect play in certain material configurations. Point the engine to the directory where your tablebases live.

## 2.3. Performance–Quality Trade-offs

Engine settings influence both the depth of analysis and the responsiveness of the interface:

- Higher thread counts and larger hash settings yield deeper search but may reduce interactivity.
- MultiPV settings above three lines often yield diminishing returns in practical work.
- Infinite analysis modes should be used selectively, especially when investigating critical positions.

Treat configuration as a set of trade-offs rather than a race to "max out" hardware. A responsive session encourages exploration; a bogged-down session discourages curiosity.

## 2.4. Recommended Default Profiles

Define a few presets to avoid fiddling every session:

- **Quick blunder-check profile**  
  - Low depth, small hash, MultiPV = 1–2.  
  - Purpose: fast scan for outright tactics.

- **Standard post-game analysis profile**  
  - Moderate hash, MultiPV = 2–3, depth sufficient for reliable middlegame evaluations.  
  - Purpose: balanced quality and speed for full-game review.

- **Deep investigation profile**  
  - Larger hash, MultiPV = 1–2, generous time per move or infinite analysis.  
  - Purpose: slow, careful work on key positions.

Save these profiles and note them in your checklist so you can reproduce results later or share them with teammates.

---

# Chapter 3: PGN and Annotation Fundamentals

## 3.1. PGN Structure

A PGN file consists of two main components:

- **Tag pair section**: Key–value pairs enclosed in square brackets at the start of the file, specifying event, players, date, result, and other metadata.
- **Movetext section**: The sequence of moves, written in algebraic notation, followed by the result marker (for example, `1-0`, `0-1`, `1/2-1/2`).

Think of the tag section as the file header and the movetext as the data payload. Keep tags accurate; they are the anchor for later search and filtering.

## 3.2. Comments in PGN

Comments are delimited by curly braces `{}`. They typically contain natural-language explanations, evaluations, or notes such as:

- Explanations of plans or ideas.
- References to alternative lines not shown explicitly as variations.
- Verbal evaluations (for example, "White is clearly better").

Use comments to convey *why* and *how*, not just engine scores. A concise verbal note often outlives a centipawn number when theory changes.

## 3.3. Numeric Annotation Glyphs (NAGs)

NAGs are numeric codes prefixed by `$` that most GUIs display as symbolic annotations such as `!`, `?`, `!?`, and similar. They serve to:

- Provide a machine-readable representation of standard assessment symbols.
- Preserve compatibility across tools and platforms.
- Allow automated filtering and statistics (for example, locating all moves marked as `??`).

Common move-quality NAGs:

- `$1`: Good move (`!`)
- `$2`: Poor move (`?`)
- `$3`: Very good move (`!!`)
- `$4`: Very poor move (`??`)
- `$5`: Speculative move (`!?`)
- `$6`: Dubious move (`?!`)

Extend beyond these when helpful: positional NAGs capture initiative, compensation, or attack, and evaluative NAGs capture slight/clear/decisive advantages.

## 3.4. Variations and Branches

Variations in PGN are enclosed in parentheses `()`. They represent alternative sequences of moves branching from a given position. Variations may themselves contain nested sub-variations.

Conceptually, variations fall into three categories:

- **Main line**: The primary sequence of moves in the actual game.
- **Principal variation**: The engine's or analyst's preferred continuation in a hypothetical position.
- **Side variations**: Alternative lines illustrating traps, sidelines, or instructive possibilities.

Control both depth and branching. Excessive nesting makes a PGN unreadable. Prune aggressively and keep only lines that illustrate ideas, highlight traps, or correct misconceptions.

---

# Chapter 4: Manual Analysis Workflow (Pre-Engine)

## 4.1. Rationale for Engine-Free Passes

Conduct an initial analysis without engine assistance:

- Strengthen independent calculation and evaluation skills.
- Avoid premature convergence on engine suggestions.
- Expose discrepancies between intuition and objective evaluation.

This is not about rejecting engines; it is about capturing your thought process honestly before verification. That honesty is instructive for you and for readers.

## 4.2. First Pass: Narrative Overview

During the first pass:

- Replay the game at a moderate pace, without deep calculation.
- Identify turning points: blunders, missed wins, or shifts in initiative.
- Note practical factors (time pressure, psychological decisions) if known.

Keep comments brief and narrative: "Black equalises here," "White begins a kingside attack," or "This move launches an inferior plan." Resist the urge to open a side line yet; just mark the spot.

## 4.3. Second Pass: Candidate Moves and Critical Positions

The second pass focuses on positions where important decisions were made:

- For each critical position, record the move played and at least one plausible alternative.
- Formulate a qualitative evaluation (for example, "White is slightly better," "dynamic equality," "unclear") without engine assistance.
- Note reasoning: piece activity, king safety, pawn structure, or specific tactical ideas.

This is the phase where your chess vocabulary matters. Use it. Label motifs (outpost, minority attack, central break) so later engine checks have context.

## 4.4. Third Pass: Consolidating Manual Annotations

Before involving the engine:

- Convert informal notes into structured comments within the PGN.
- Assign preliminary NAGs to moves that appear clearly strong or weak.
- Mark positions for engine verification (for example, "ENGINE CHECK").

The goal is a coherent manual annotation that captures your understanding independently. If two candidate lines feel equally strong, mark that uncertainty; later engine work should resolve or document it.

---

# Chapter 5: Engine-Assisted Analysis Workflow

## 5.1. Selecting Positions for Engine Use

Apply engines selectively:

- Critical positions identified during manual analysis.
- Complex tactical situations where human calculation may err.
- Endgames where tablebases or deep search clarify outcomes.

Use your "ENGINE CHECK" markers as a to-do list. Avoid leaving the engine running on every move; that wastes time and hides your own thinking.

## 5.2. Interpreting Engine Scores and Outputs

Engine outputs typically include:

- **Evaluation** in centipawns: positive values favour White, negative values favour Black.
- **Mate indications**: special values denoting forced mate in a specified number of moves.
- **Principal variations**: sequences of best moves from the engine's perspective.

Interpret with caution:

- Small centipawn differences may not reflect practical difficulty.
- A +0.80 evaluation may be trivial or nearly impossible to convert, depending on the position.
- Translate mate scores into human language ("mate in 5 after ...") to keep notes readable.

## 5.3. MultiPV and Alternative Lines

Using MultiPV exposes several candidate lines:

- Note the evaluation and strategic features of each candidate.
- Separate lines that represent different plans from those that are mere move-order tweaks.
- Carry forward only a small number of alternatives to avoid bloat.

MultiPV is a tool for exploration, not transcription. Keep only what supports the story of the game.

## 5.4. Revising Manual Conclusions

After engine analysis:

- Compare engine evaluations with earlier human evaluations.
- Identify whether divergences stem from missed tactics, endgame nuances, or bias.
- Revise NAGs and textual comments as needed, documenting where insight changed.

Explicitly note changes: "Initial impression: White is winning. Engine shows Black holds due to perpetual check motif." That record is gold for training.

---

# Chapter 6: Building and Managing Variations

## 6.1. Criteria for Including a Variation

Include a variation when it:

- Illustrates a tactical motif (sacrifice, deflection, mating net).
- Presents a plausible alternative plan a player might actually consider.
- Corrects a misconception or refutes a natural but flawed move.

Skip lines that merely confirm obvious inferiority. Readers value signal over completeness.

## 6.2. Depth and Breadth of Variations

Readability constraints:

- Do not extend beyond the point where evaluation stabilises and the strategic outcome is clear.
- Truncate forced lines with a verbal note when the rest is routine.
- Keep branching narrow—only a few main alternatives per critical position.

Think of each variation as an illustration, not an encyclopedia entry.

## 6.3. Structural Organisation in the GUI

Most GUIs allow:

- Promoting or demoting variations between main and side lines.
- Collapsing or expanding branches.
- Deleting redundant or uninteresting lines.

Enforce hierarchy:

- The game's moves form the main line.
- The engine's preferred improvement (if any) is the principal side line.
- Additional explanatory lines nest as sub-variations and stay short.

## 6.4. Naming and Labeling Variations

In extensive analyses, label key variations:

- "Line A: Safe consolidation"
- "Line B: Pawn sacrifice for activity"
- "Line C: Endgame transition"

Labels help readers and your future self navigate dense trees quickly.

---

# Chapter 7: Using NAGs and Symbols Systematically

## 7.1. Move-Quality NAGs

Move-quality NAGs encode judgments:

- `$3` (`!!`): Non-obvious and objectively very strong.
- `$1` (`!`): Clearly best or significantly better than alternatives.
- `$2` (`?`) and `$4` (`??`): Mistakes that worsen or lose the game.
- `$5` (`!?`) and `$6` (`?!`): Playable but risky or strategically suspect.

Use sparingly. Overuse dulls impact and misleads readers about severity.

## 7.2. Positional and Evaluative NAGs

Beyond move quality, NAGs capture:

- Advantage assessments (slight/clear/decisive).
- Positional elements (initiative, attack, compensation, time advantage).
- Structural features (weak squares, passed pawns, bishop pair).

Pick a small, consistent subset and document it at the end of the guide to keep your annotations uniform.

## 7.3. Combining NAGs with Text and Engine Scores

Integrate three layers:

1. **Symbolic**: NAGs for move quality and positional traits.
2. **Verbal**: Comments explaining ideas, plans, and strategic context.
3. **Numerical**: Engine evaluations in centipawns or mate distances when they clarify practical chances.

Example:

> `23...Re8 $6?!`  
> `{Black chooses a passive plan. Engine prefers 23...c5 (≈ 0.00), keeping counterplay; after the text move White consolidates a space edge.}`

Omit numbers when they add little. Prioritise human readability.

---

# Chapter 8: Converting Engine Analysis into Human-Facing Commentary

## 8.1. Identifying the Game's Narrative

A useful annotated game conveys a coherent narrative. Key elements:

- The initial strategic direction of each player.
- Moments when that direction changed, succeeded, or failed.
- Tactical episodes that influenced the result.
- Phase transitions: opening → middlegame → endgame.

Readers should grasp the story even if they skim variations.

## 8.2. Explaining Ideas Rather than Moves

Engine lines list moves; humans explain *why*. Focus on:

- Recurring motifs (outposts, pawn breaks, king safety).
- Plans and counterplans.
- Why natural moves fail and why best moves may be counterintuitive.

Translate tactics into themes: "The e-file pin makes ...Re8 lethal," not just "...Re8! -1.8."

## 8.3. Adapting Depth to the Intended Audience

Adjust depth to readership:

- Advanced self-study: allow deeper lines and technical language.
- Students or general audiences: keep lines short and commentary concise.

Remain consistent within a single game to avoid whiplash between depths.

## 8.4. Using Diagrams and Position References (Optional)

If the medium supports diagrams:

- Insert diagrams at critical moments (before a decisive tactic or key plan).
- Refer to positions by move number and side to move.
- Align diagrams with comments so each diagram reinforces a point.

Even without diagrams, precise references ("after 18...Nc5, Black threatens ...b4") anchor the reader.

---

# Chapter 9: Exporting, Sharing, and Archiving Annotated Games

## 9.1. Ensuring PGN Integrity

Before exporting:

- Confirm comments, NAGs, and variations attach to correct moves.
- Verify result and basic tag information.
- Check for syntax errors (unbalanced braces or parentheses).

Validation prevents embarrassment when sharing databases or publishing.

## 9.2. Export Formats and Interoperability

Annotated games typically live as:

- **PGN files**: Human-readable and widely supported.
- **Database formats**: Proprietary binary formats used by specific GUIs.

Keep a PGN master copy. Use database formats for speed and indexing, but avoid lock-in. When sharing, PGN is the safest default.

## 9.3. Organising a Personal Annotated Library

Build a sustainable library:

- Consistent naming scheme (by player, opening, theme, or event).
- Tags for openings, themes, and training purposes.
- Regular backups to external or cloud storage.

Your future self will thank you when hunting for an example of "rook endgame with active king" years later.

---

# Chapter 10: Reference Tables and Checklists

## 10.1. Core NAG Reference

Maintain a concise reference of commonly used NAGs:

- Move quality: `!!`, `!`, `!?`, `?!`, `?`, `??`.
- Evaluations: slight, clear, decisive advantages for either side.
- Positional motifs: initiative, attack, compensation, time advantage, bishop pair, weak squares.

Documenting your exact codes keeps annotations consistent across sessions and collaborators.

## 10.2. Analysis Session Checklist

Before, during, and after an analysis session:

- **Preparation**  
  - Engine configuration matches intended depth and speed.  
  - PGN imports correctly; metadata is accurate.

- **Manual phase**  
  - At least one full pass completed without engine assistance.  
  - Critical moments and candidate moves identified and noted.

- **Engine phase**  
  - Engine applied selectively at critical positions.  
  - Discrepancies between engine and human evaluations reviewed and resolved.

- **Finalisation**  
  - Variations pruned and organised for readability.  
  - NAGs and comments consistent and non-contradictory.  
  - Annotated PGN validated and backed up.

## 10.3. Engine Configuration Reference

Maintain a short record of preferred configurations:

- Default thread and hash values for current hardware.
- MultiPV settings for quick checks versus deep investigations.
- Tablebase locations and settings, if available.

Documenting these preferences ensures reproducibility of analysis sessions and simplifies switching between machines or GUIs.

---
