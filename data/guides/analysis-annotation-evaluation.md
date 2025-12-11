# Analysis, Annotation, and Evaluation

## 1. Overview and Objectives

### 1.1. Scope and Audience

This guide describes a structured workflow for analysing chess games using a graphical user interface (GUI) such as ChessBase or Hiarcs in conjunction with modern engines such as Stockfish or Dragon. It assumes that the reader is comfortable with basic algebraic notation and has experience playing tournament or online chess, but does not assume professional-level expertise.

The emphasis throughout is on producing annotated portable game notation (PGN) files that are useful for long-term study, publication, and instruction. The guide is tool-agnostic: concrete examples may reference particular GUIs, but the procedures and principles are intended to transfer across platforms.

### 1.2. Key Concepts

This guide uses the following core concepts:

- **Analysis**: The systematic examination of a game or position to identify better moves, plans, and critical moments.
- **Annotation**: The process of embedding information in a PGN file, including text comments, Numeric Annotation Glyphs (NAGs), and variations.
- **Evaluation**: The assignment of a numerical or verbal judgment to a position, informed by both human reasoning and engine output.

These concepts are interdependent. Evaluation informs annotation, and annotation captures analysis in a durable and reusable form.

### 1.3. Human and Engine Roles

Engines excel at calculating tactical sequences and providing accurate numerical evaluations. Humans excel at identifying practical difficulties, explaining plans, and conveying ideas in a way that is meaningful to other players.

A well-designed workflow therefore alternates between:

- **Human-led phases**: Identifying critical moments, proposing candidate moves, and articulating plans in natural language.
- **Engine-led phases**: Verifying or correcting human impressions, refining candidate moves, and detecting tactical oversights.

The remainder of the guide formalises this alternation into reproducible steps.

### 1.4. Target Outcomes

By the end of the guide, the reader should be able to:

- Configure an analysis environment with one or more engines and a suitable GUI.
- Read, interpret, and modify PGN files containing comments, NAGs, and variations.
- Perform an initial manual analysis of a game without engine assistance.
- Incorporate engine analysis in a disciplined manner that avoids over-reliance.
- Produce clear, readable annotated games with consistent symbols and evaluations.
- Export, store, and catalogue annotated games for later use.

---

## 2. Analysis Environment and Tooling

### 2.1. Requirements for an Analysis GUI

A suitable analysis GUI should support at minimum:

- Import and export of PGN files with comments, variations, and NAGs.
- Integration with one or more UCI-compatible engines.
- A variation tree or similar interface for exploring alternative lines.
- Search and filtering over collections of games.
- Basic visual aids (highlighted squares, arrows, and evaluation bars).

The choice of GUI affects workflow details but does not alter the conceptual structure presented in this guide.

### 2.2. Engine Integration Basics

Most modern engines communicate through the **Universal Chess Interface (UCI)** protocol. The GUI launches the engine as an external process and exchanges commands and analysis results.

Critical configuration parameters include:

- **Threads**: The number of CPU cores allocated to the engine.
- **Hash**: Memory reserved for the transposition table, influencing search depth and speed.
- **MultiPV (Multiple Principal Variations)**: The number of top lines the engine will report.
- **Syzygy or other tablebases**: Precomputed endgame databases that yield perfect play in certain material configurations.

For practical analysis, moderate settings for threads and hash are sufficient on most modern hardware.

### 2.3. Performance-Quality Trade-offs

Engine settings influence both the depth of analysis and the responsiveness of the interface.

- Higher thread counts and larger hash settings yield deeper search but may reduce interactivity.
- MultiPV settings above three lines often yield diminishing returns in practical work.
- Infinite analysis modes should be used selectively, especially when investigating critical positions.

The analyst should treat configuration as a series of trade-offs rather than maximising every parameter.

### 2.4. Recommended Default Profiles

A practical approach is to define distinct "profiles" for common tasks:

- **Quick blunder-check profile**  
  - Relatively low depth, small hash, MultiPV = 1 or 2.  
  - Intended for rapid screening of gross tactical errors.

- **Standard post-game analysis profile**  
  - Moderate hash, MultiPV = 2 or 3, depth sufficient for reliable middlegame evaluations.  
  - Balanced between speed and accuracy.

- **Deep investigation profile**  
  - Larger hash, MultiPV = 1 or 2, generous time per move or infinite analysis.  
  - Reserved for key positions or high-value games.

Storing these configurations in the GUI streamlines future analysis sessions.

---

## 3. PGN and Annotation Fundamentals

### 3.1. PGN Structure

A PGN file consists of two main components:

- **Tag pair section**: Key-value pairs enclosed in square brackets at the start of the file, specifying event, players, date, result, and other metadata.
- **Movetext section**: The sequence of moves, written in algebraic notation, and the final result marker (for example, `1-0`, `0-1`, `1/2-1/2`).

Annotations augment the movetext section without altering the underlying game score.

### 3.2. Comments in PGN

Comments are delimited by curly braces `{}` in PGN. They typically contain natural-language explanations, evaluations, or notes, such as:

- Explanations of plans or ideas.
- References to alternative lines not shown explicitly as variations.
- Verbal evaluations (for example, "White is clearly better").

Most GUIs present comments in a separate pane or interleaved with moves, while preserving the underlying PGN syntax.

### 3.3. Numeric Annotation Glyphs (NAGs)

NAGs are numeric codes prefixed by a dollar sign (for example, `$1`, `$2`) that most GUIs display as symbolic annotations such as `!`, `?`, `!?`, and similar. They serve several purposes:

- Provide a machine-readable representation of standard assessment symbols.
- Preserve compatibility across tools and platforms.
- Allow automated filtering and statistics (for example, locating all moves marked as `??`).

A subset of NAGs covers commonly used move-quality judgments:

- `$1`: Good move (`!`)
- `$2`: Poor move (`?`)
- `$3`: Very good move (`!!`)
- `$4`: Very poor move (`??`)
- `$5`: Speculative move (`!?`)
- `$6`: Dubious move (`?!`)

Additional NAGs encode positional features and evaluations, discussed later in the guide.

### 3.4. Variations and Branches

Variations in PGN are enclosed in parentheses `()`. They represent alternative sequences of moves branching from a given position. Variations may themselves contain nested sub-variations.

Conceptually, variations fall into three categories:

- **Main line**: The primary sequence of moves in the actual game.
- **Principal variation**: The engine's or analyst's preferred continuation in a hypothetical position.
- **Side variations**: Alternative lines illustrating traps, sidelines, or instructive possibilities.

Effective annotation requires controlling the depth and branching factor of variations to preserve readability.

---

## 4. Manual Analysis Workflow (Pre-Engine)

### 4.1. Rationale for Engine-Free Passes

Conducting an initial analysis without engine assistance offers several benefits:

- It strengthens independent calculation and evaluation skills.
- It prevents premature convergence on engine suggestions.
- It exposes discrepancies between human intuition and objective evaluation, which are themselves instructive.

The engine is treated as a later-stage tool for verification and refinement, not as a primary driver.

### 4.2. First Pass: Narrative Overview

During the first pass:

- Replay the game at a moderate pace, without deep calculation.
- Identify and mark obvious turning points, such as blunders, missed wins, or dramatic shifts in initiative.
- Note practical factors such as time pressure or psychological decisions, if known.

At this stage, comments can be brief and largely descriptive: "Black equalises here," "White begins a kingside attack," or "This move initiates an inferior plan."

### 4.3. Second Pass: Candidate Moves and Critical Positions

The second pass focuses on positions where important decisions were made:

- For each critical position, record the move played and at least one plausible alternative.
- Formulate a qualitative evaluation (for example, "White is slightly better," "dynamic equality," "unclear") without engine assistance.
- Indicate the reasoning behind each candidate: piece activity, king safety, pawn structure, or specific tactical ideas.

These observations are recorded as comments in the PGN or in a separate note that will later be integrated.

### 4.4. Third Pass: Consolidating Manual Annotations

Before involving the engine:

- Convert informal notes into structured comments within the PGN.
- Assign preliminary NAGs to moves that appear clearly strong or weak based on human judgment.
- Mark positions for engine verification (for example, by using GUI markers or simple textual tags such as "ENGINE CHECK").

The goal is to produce a coherent manual annotation that captures the analyst's understanding independently.

---

## 5. Engine-Assisted Analysis Workflow

### 5.1. Selecting Positions for Engine Use

Engines are most valuable when applied selectively:

- Critical positions identified during manual analysis.
- Complex tactical situations where human calculation is likely to err.
- Endgames where tablebases or deep search can reveal accurate conclusions.

Systematically working through the "ENGINE CHECK" markers ensures that the engine is applied where it yields maximum value.

### 5.2. Interpreting Engine Scores and Outputs

Engine outputs typically include:

- **Evaluation** in centipawns: positive values favour White, negative values favour Black.
- **Mate indications**: special values denoting forced mate in a specified number of moves.
- **Principal variations**: sequences of best moves from the engine's perspective.

Interpreting these outputs requires care:

- Small centipawn differences may not reflect practical difficulty.
- An evaluation such as +0.80 may be easy or extremely difficult to convert, depending on the position.
- Mate scores should be translated into clear human language in the annotations.

### 5.3. MultiPV and Alternative Lines

Using MultiPV allows the engine to produce several candidate lines:

- For each candidate, note the evaluation and any distinctive strategic features.
- Identify whether different lines represent genuinely different plans or only minor move-order changes.
- Select at most a small number of alternatives to carry into the final annotation to avoid excessive branching.

MultiPV is a tool for exploring options, not for reproducing every engine line in the final PGN.

### 5.4. Revising Manual Conclusions

After engine analysis:

- Compare engine evaluations with earlier human evaluations.
- When human and engine conclusions diverge, determine whether the difference is due to missed tactics, mis-evaluated endgames, or subjective biases.
- Revise NAGs and textual comments as needed, documenting the change where it is instructive.

Recording such revisions explicitly can be valuable for training: "Initial impression was that White is winning; engine reveals drawing resources based on activity of the king."

---

## 6. Building and Managing Variations

### 6.1. Criteria for Including a Variation

Not every engine line warrants inclusion. A variation should typically satisfy at least one of the following:

- It illustrates a clear tactical motif (for example, a sacrifice, a deflection, or a mating net).
- It presents a plausible alternative plan that a player might reasonably consider.
- It corrects a common misconception or refutes a natural but flawed move.

Variations that merely confirm that an obviously inferior move remains inferior may be omitted.

### 6.2. Depth and Breadth of Variations

Readability imposes constraints on both the **depth** and **breadth** of variations:

- Variations should generally not extend beyond the point where the evaluation stabilises and the strategic outcome is clear.
- Excessively long forced lines may be truncated with a verbal indication such as "with a clear advantage for White."
- Branching should be kept narrow; only a few main alternatives per critical position should be presented.

This discipline maintains a balance between thoroughness and pedagogical clarity.

### 6.3. Structural Organisation in the GUI

Most GUIs allow manipulation of variations:

- Promoting or demoting variations between main line and side lines.
- Collapsing or expanding branches in the variation tree.
- Deleting redundant or uninteresting lines.

The analyst should enforce a hierarchical structure where:

- The game's actual moves constitute the main line.
- The engine's preferred improvement (if any) becomes the principal side variation.
- Additional explanatory lines are nested as sub-variations, used sparingly.

### 6.4. Naming and Labeling Variations

In extensive analyses, it can be useful to assign informal labels to key variations, either within comments or as local headings:

- "Line A: Safe consolidation"
- "Line B: Pawn sacrifice for activity"
- "Line C: Endgame transition"

Such labels help readers navigate complex branches, particularly in long games.

---

## 7. Using NAGs and Symbols Systematically

### 7.1. Move-Quality NAGs

Move-quality NAGs encode judgments such as:

- Excellent, good, or strong moves.
- Weak or clearly erroneous moves.
- Speculative or dubious choices.

The analyst should adopt consistent criteria, for example:

- `$3` (`!!`): Only for moves that are both non-obvious and objectively very strong.
- `$1` (`!`): For moves that are clearly best or significantly better than alternatives.
- `$2` (`?`) and `$4` (`??`): For mistakes that respectively worsen the position or lose material or the game.
- `$5` (`!?`) and `$6` (`?!`): For moves that are playable but risky or strategically suspect.

Overuse of extreme symbols reduces their impact and should be avoided.

### 7.2. Positional and Evaluative NAGs

Beyond move quality, NAGs exist for:

- Advantage assessments (for example, slight, moderate, decisive).
- Positional elements such as initiative, attack, compensation, or time advantage.
- Structural features such as weak squares or passed pawns.

Using these NAGs:

- Summarises complex evaluations in compact form.
- Facilitates searching for specific themes.
- Reinforces verbal commentary.

A limited, well-chosen subset is usually sufficient in everyday analysis.

### 7.3. Combining NAGs with Text and Engine Scores

An effective annotation format integrates three layers:

1. **Symbolic layer**: NAGs indicating quality and characteristics of moves.
2. **Verbal layer**: Text comments explaining ideas, plans, and strategic context.
3. **Numerical layer**: Engine evaluations in centipawns or mate distances, where informative.

For example:

> `23...Re8 $6?!`  
> `{Black chooses a passive plan. The engine suggests 23...c5 (approx 0.00), maintaining dynamic counterplay, whereas after the text move White gradually consolidates a space advantage.}`

The analyst should avoid clutter by omitting numbers when they add little insight.

---

## 8. Converting Engine Analysis into Human-Facing Commentary

### 8.1. Identifying the Game's Narrative

A useful annotated game conveys a coherent narrative. Key elements include:

- The initial strategic direction chosen by each player.
- The moments when that direction changed, succeeded, or failed.
- The tactical episodes that decisively influenced the result.
- The transformation of the position across opening, middlegame, and endgame phases.

The narrative should be visible even to readers who do not follow every variation in detail.

### 8.2. Explaining Ideas Rather than Moves

Engine lines tend to enumerate moves without explanation. The analyst's role is to:

- Identify recurring motifs (for example, knight outposts, pawn breaks, king safety).
- Translate these motifs into statements about plans and counterplans.
- Highlight why certain moves are natural but flawed, and why the best move may be counterintuitive.

Text comments should prioritise ideas and plans over exhaustive recounting of move sequences.

### 8.3. Adapting Depth to the Intended Audience

The level of detail should match the intended readership:

- For self-study at an advanced level, more technical language and deeper variations may be appropriate.
- For students or general audiences, concise explanations and fewer variations are usually preferable.

In either case, the commentary should remain internally consistent and avoid abrupt changes in technical depth.

### 8.4. Using Diagrams and Position References (Optional)

If the presentation medium allows diagrams:

- Insert diagrams at critical moments, such as before a decisive tactical blow or a key strategic decision.
- Refer to positions by move number and indicate side to move unambiguously.
- Synchronise diagrams with textual commentary so that each diagram supports a clearly stated point.

Although diagrams lie outside the core PGN specification, many GUIs and publishing tools support them as an overlay.

---

## 9. Exporting, Sharing, and Archiving Annotated Games

### 9.1. Ensuring PGN Integrity

Before exporting:

- Confirm that comments, NAGs, and variations are correctly attached to the intended moves.
- Verify that the game result and basic tag information are accurate.
- Check for syntax errors (for example, unbalanced braces or parentheses) that may disrupt other tools.

Several GUIs provide built-in PGN validation; otherwise, external tools can be used.

### 9.2. Export Formats and Interoperability

Annotated games are typically stored as:

- **PGN files**: Human-readable and widely supported.
- **Database formats**: Proprietary binary formats used by specific GUIs.

For maximum interoperability:

- Maintain a PGN master copy of critical annotated games.
- Use database formats to support fast search and indexing within a particular tool, but avoid lock-in.

When sharing with others, PGN is usually the safest default format.

### 9.3. Organising a Personal Annotated Library

A sustainable library requires:

- A consistent naming scheme for files and databases (for example, by player, opening, or theme).
- Tagging of games with metadata such as opening codes, themes, and training purposes.
- Regular backups to external drives or cloud storage to protect against data loss.

The goal is to make annotated games easy to locate and reuse months or years later.

---

## 10. Reference Tables and Checklists

### 10.1. Core NAG Reference

Maintain a concise reference of the most-used NAGs, including:

- Codes for move quality (`!!`, `!`, `!?`, `?!`, `?`, `??`).
- Codes for evaluations (for example, slight advantage, clear advantage, decisive advantage).
- Codes for key positional themes relevant to your own work.

Including this table at the end of the guide or as a separate appendix aids consistency.

### 10.2. Analysis Session Checklist

Before, during, and after an analysis session, the following checklist is useful:

- **Preparation**  
  - Engine configuration matches the intended depth and speed.  
  - PGN imports correctly and metadata is accurate.

- **Manual phase**  
  - At least one full pass has been made without engine assistance.  
  - Critical moments and candidate moves are identified and noted.

- **Engine phase**  
  - Engine is applied selectively at critical positions.  
  - Discrepancies between engine and human evaluations are reviewed and resolved.

- **Finalisation**  
  - Variations are pruned and organised for readability.  
  - NAGs and comments are consistent and free from contradictions.  
  - The annotated PGN is validated and backed up.

### 10.3. Engine Configuration Reference

Maintain a short record of preferred configurations:

- Default thread and hash values for the current hardware.
- MultiPV settings for quick checks versus deep investigations.
- Tablebase locations and settings, if available.

Documenting these preferences ensures reproducibility of analysis sessions and simplifies switching between machines or GUIs.

---
