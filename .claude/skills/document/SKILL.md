---
name: document
description: Build and keep updating Long's living HTML working document for a session's topic — a local editable page in ~/Downloads with short plain-language sections for Long (why, how it works, diagrams, backlog) and a collapsed "For agents" section holding the thorough notes, decisions, verified facts, file paths and discover-KB links. Only the latest update is highlighted, in one color; older text is plain. Use when Long says "document", "put this in the HTML", "update the HTML/doc/tracker/page", "write this up as a page", or asks to keep a running page for a piece of work. Invoked via /document [topic or path].
---

# document

A single HTML page that grows through a session. Two readers use it:

- **Long** reads the main sections: short, plain, first principles, the decisions and brainstorming in brief.
- **Agents** read the collapsed "For agents" section to learn what was decided, what was verified, and where everything lives, so a fresh session can pick the work up cold.

## 1. Find or create the page

`<skill-dir>` below is this skill's folder: the "Base directory for this skill" shown when it loads (usually `.claude/skills/document` in the repo, or `~/.claude/skills/document`).

- If Long names a page or one exists for this topic in `~/Downloads/`, update that file. Never start a second page for the same topic.
- Otherwise copy the template and fill in the title, date and standfirst:
  ```bash
  cp <skill-dir>/template.html ~/Downloads/<topic-slug>-<YYYY-MM-DD>.html
  ```
  The date is the creation date and stays in the filename across updates.
- The template is the shared page shell: Inter, the Conspectus tokens, dither background, Edit/Save buttons (Save rewrites the file via the file picker; Cmd+S works). Keep all of that as is.

**Before every edit**, check whether Long changed the page since your last write (he edits in the browser and saves). Compare the file's modified time with your last write. If it changed, read it and keep his edits; never overwrite them from a copy you held.

## 2. Structure

The template is a blanked copy of `example-firehose.html` (in this skill's folder), a finished page frozen as the reference for this shape. The example is about 35,000 tokens: never Read it whole. When unsure how a section should look, pull just that section by its heading:

```bash
awk '/<h2>Backlog/,/<\/section>/' <skill-dir>/example-firehose.html | head -60
```

Swap `Backlog` for `Why`, `How it works` or `For agents` as needed. Start the page on day one of a project, even with little known: keep every section and mark the empty ones `To do`.

Every new finding goes in exactly one place: **Why / How it works** if it rarely changes, **Open questions** if it waits on Long, **Backlog** if it is a piece of work or its status, **For agents** (or its linked notes file) for everything else. When unsure, For agents.

Main sections, in this order:

1. **Hero**: kicker (`Draft N · date · owner · internal working document`), title, one-sentence standfirst, legend (status tags plus one swatch for the latest update).
2. **Why**: the problem from first principles, at most two short paragraphs.
3. **How it works**: one architecture diagram that grows layer by layer, with short text around each version of it. Use this shape from draft 1, not after Long asks for it (section 4, "The default shape").
4. **Open questions** (optional), just before the Backlog: only the questions waiting on Long right now, each with its answer or recommendation in bold, then a few short bullets. Once a question is answered, take it off the main page: the decision goes in the Decisions table, and any lasting explanation moves into Why / How it works. Topic sections for one-off answers follow the same rule. They don't stay on the main page after the question is settled.
5. **Backlog**, in this order: the plan (one bold "Done means" sentence a script can check, then build order); Progress, DATE (state in one bold sentence, then a PR table: item, PR, merge after, what merging turns on); Waiting on an answer (by person); What we're not sure of yet; then the work items grouped by the layer they change, each with **What it is / Why we need it / Without it / Done when** and a status tag.
6. **For agents** (`<details class="agents">`, closed by default), holding everything thorough:
   - **Build state** table: bead, branch tip, PR and base, evidence; plus worktree and log paths.
   - **Decisions** table: `D1…Dn`, the decision, who and when. Proposed decisions say "proposed".
   - **Background**: detail moved down from the main sections, in plain text.
   - **Verified facts** with `path/file.ts:line`, commit hash or query, and the date checked.
   - **Files and locations**: absolute paths for every input file, script, output.
   - **Knowledge base and memory**: link every relevant discover-KB file. Find them with
     `grep -ril "<keyword>" <repo-root>/.claude/discover-kb/*/` and each repo's `INDEX.md`. Also link the memory file for this work.
   - **Research sources**: URLs with the sentence that mattered.
   - Detail tables, schemas, numbers, and a **Reproduce** block of commands.

No worklog section. What happened lives in the decisions and facts, and in git.

Noise goes down, not out: when Long says a main section is too long, move the detail into "For agents" instead of deleting it.

**Keep the main page current.** The highlight shows what changed, but it doesn't make old text true. On every update, reread the main sections and prune them:
- **Keep** what still explains the problem and how the system works (the Why, and the first-principles parts of How it works), updated to match what was built.
- **Move down** anything that has served its purpose: discovery findings, corrections, a one-off test plan, answered questions, superseded plans. Put it in "For agents" (Background or Verified facts), or, when it is long, in a markdown notes file beside the page (`<page-name>.notes.md` in `~/Downloads/`) that "For agents" links to. That keeps the HTML small enough for an agent to read.
- **Fix or delete** text that is no longer true, such as "nothing is built yet" or a status tag that changed. Don't leave a stale claim on the page next to newer text that contradicts it.

The main page reads top to bottom as: what the problem is and why it exists (with diagrams), how it works in first principles, the open questions for Long (if any), the Backlog, then the collapsed "For agents". Nothing else sits between those.

**Only this turn is open.** Long reads the page to see what this turn added, not to reread the whole history. On every update:
- The new section for this turn sits open, right after Why, and is short: one bold sentence, a why, one diagram, then numbered or lettered steps of one line each. Aim to fit it in two screens.
- Every earlier topic section collapses into a closed `<details class="block">` with a summary line ("How we got here", "Still to discuss"). Don't wait for Long to ask; he has had to ask twice ("there's just too much to hold in my brain").
- When a whole earlier draft gets too long, freeze it as `<page>.draftN.html` (a copy with a red "frozen copy" kicker line) and link it, instead of deleting anything.
- When Long says a section must be handed to another agent, end it with a compact `<pre>` brief (BUILD / READ / PARTS / ROUND or STEPS / RULES / WHEN / NEEDS / DONE) so it can be pasted on its own.

<!-- few-shot: document-collapse-earlier-turns -->
```html
<section class="block new"><h2 id="harness-loop">The harness loop, in four parts</h2> ... this turn, open ... </section>
<details class="block"><summary><span class="tri">&#9654;</span><h2>How we got here: the picture in 8 steps</h2><span class="hint">earlier turns; closed by default</span></summary> ... </details>
```

A filled topic section (the latest update), then one "For agents" decision row and fact:

<!-- few-shot: document-section-filled -->
```html
<section class="block new">
  <h2 id="risky-task">Test 3: is this /work task risky?</h2>
  <p class="new"><b>Jev ties Opus: 65 of 69 right, 7 of 8 risky tasks caught, 3 false alarms, for $0.00006.</b> <span class="st live">Have</span></p>
  <ul class="plain">
    <li class="new">Jev read only the ticket, before any code existed, so it could not peek at the answer.</li>
    <li class="new">The keyword rule never misses but cries wolf on a third of tasks, so keep it as the backstop.</li>
  </ul>
</section>
<!-- inside details.agents -->
<tr class="new"><td class="mono">D3</td><td>Proposed: Jev scores /quick eligibility as advice; keyword rule is the backstop.</td><td class="nw">proposed</td></tr>
<li class="new">Routing test, 69 beads, strict key = PR adds <code class="mono">packages/db/drizzle/*.sql</code> or edits <code class="mono">.github/workflows/</code>: Jev 65/69, Opus 65/69, keyword 48/69 (checked 30 Sep).</li>
```

## 3. Update color (one color, latest update only)

Only the latest update is colored. Everything older is plain text in the normal ink, with no color class. (Long, 5 Oct: one color for the new update; previous colors go away.)

On every update:
1. **Strip the previous highlight first.** Remove the `new` class everywhere it appears (`class="new"` → no class; `class="block new"` → `class="block"`; `<span class="new">x</span>` → `x`). Do this before adding anything, so the only colored text on the page is this turn's.
2. **Wrap this update's new or changed text in `new`**: a whole `<section class="block new">`, a `<p class="new">`, a `<tr class="new">`, or a `<span class="new">` inside a sentence.
3. **Legend: one swatch only**, replaced each time: `<span class="new"><span class="sw"></span> update N, DATE: what changed</span>`. Keep the update number counting up so Long can tell which turn it is.
4. In chat, say "new text is in the highlight color" and summarise what changed.

- **Legacy pages** with `u1`…`uN` classes: on the first update under this rule, neutralise them, either by deleting the `.uN` color rules from the page's style block or by removing the classes, so old text turns black. Then add the `.new` rules from the template if the page lacks them.
- Diagrams are separate: `acc` red still marks the newest part of a growing diagram.
- Specificity trap: `ol.steps p` beats a bare `.new` parent. The template has rules for `ol.steps p.new` and `.new p`; if some new element renders grey, add a rule instead of inline styles.

## 4. Diagrams

Inline SVG in the `figure.dia.ent` convention (commented example in the template): monospace, hairline boxes (`bx`), small caps labels (`lb`), item lines (`it`), arrows (`ar`) with a marker whose id is unique per SVG, captions (`cap`), and `acc` to highlight the one box the page is about. Draw the real mechanism with real names, not a generic flowchart. Keep box text short enough to fit: about 23 characters per line in a 170-wide box.

**Diagrams over tables, and one picture that grows.** On the main page, explain with diagrams, not tables (tables are fine inside "For agents"). Start with one high-level diagram and redraw the same diagram as each idea adds to it, with the new part in `acc` red, rather than drawing a new unrelated figure each time. A zoom diagram is fine for detail inside one box. Paper or field terms go in brackets after a plain name, e.g. "improver (paper: proposer)"; don't add a glossary. Red highlights on arrows and captions need `.ent .ar.acc` and `.ent .cap.acc` rules; add them if the page lacks them.

**The explanation before the Backlog is the page's goal state: high level, layered, diagrams kept.** (Long, 6 Oct: "I want it high lv with the diagrams still there.") Work every update toward one section, just before the Backlog, that explains the whole system in layers: layer 1 is one simple diagram, and each later layer redraws that same diagram with what it adds in the orange accent (`acc`), so reading top to bottom shows the picture growing. Keep each layer to a short heading, two or three plain sentences and its diagram. When a turn changes how the system works, update the layers (add one, or redraw the affected ones) instead of explaining it in the turn's own section; the turn's section then only says what happened and points at the layer. Never delete these diagrams to shorten the page; move prose detail to "For agents" instead.

**The default shape: less text, more architecture.** (Long, 9 Oct, after a draft of numbered paragraphs: "what I'd like instead of just a bunch of paragraphs explaining it is one architecture diagram that's slowly built out after every layer, and your paragraphs should wrap around that." He approved the result as the format for all pages from then on.) Every page's How it works uses this from draft 1:
- **Draw one diagram of the real system.** Use real component names with one real example running through it, e.g. "NEWS RECORD / Kevin Warsh / 816 articles" rather than "Entity". Each box should answer what it is and what it holds for the example.
- **Each layer adds boxes; existing boxes never move.** Fix every box's coordinates once. Layer N draws only the boxes and arrows introduced at layer ≤ N, and the ones new at N are `acc`. Crop the early layers' `viewBox` height so they don't sit on empty space.
- **Generate the layers from one script.** Write a small Python file in the scratchpad that holds each box as (x, y, w, h, label, lines, layer) and each arrow as (x1, y1, x2, y2, layer, style), and prints the SVG for a given layer. Splice its output into the page. Hand-copying five SVGs drifts.
- **Text per layer:** a heading that states the layer's point as a sentence ("Our news lookup skips the rule"), then at most three or four plain sentences, then the diagram. A term gets explained in the layer where its box first appears, not in a glossary.
- **Order layers from the data's origin to the problem.** The last layer shows the path that breaks today as a solid red arrow labelled "today" and the fix as a dashed arrow labelled "fix".
- **Conclusions go after the layers,** in one short section (a few bullets) of what the picture means for the work, then Open questions, then Backlog. Backlog items are one line each for What / Why / Done when, not four paragraphs.
- **Reference page:** `<skill-dir>/example-layered.html` is a finished example of this shape (a frozen copy of the 9 Oct entity-identity page, draft 2). Its generator is `<skill-dir>/example-layered-svg.py`: a table of boxes and arrows plus a `svg(layer)` function. Copy and adapt the generator; don't start from scratch. Pull one layer with `awk '/Layer 2\./,/<\/figure>/' <page> | head -60` instead of reading it whole.

## 5. Writing

- Invoke `anti-slop-writing` before drafting. No em dashes in page copy:

<!-- few-shot: document-no-em-dash -->
  BAD: `Jev ties Opus — 65 of 69 right — at a sliver of the cost.`
  GOOD: `Jev ties Opus: 65 of 69 right, at a sliver of the cost.`

- Plain language for Long; exact names, paths and numbers go in "For agents".
- State what is checked versus assumed. Numbers carry their source.
- Use the status tags: `<span class="st live">Have</span>`, `<span class="st soon">To do</span>`, `<span class="st">Ask</span>`.

## 6. Verify, then send

The browser pane cannot screenshot `file://` pages. Render headless and look at it:

```bash
C="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$C" --headless=new --disable-gpu --hide-scrollbars --window-size=900,6000 \
  --screenshot=<scratchpad>/page.png file://<page>
```

Crop to 900×1600 slices with PIL and Read them. To check the agents section, render a copy with `<details class="agents" open>`. Look for grey text that should be colored, overflowing table notes, and SVG text spilling out of boxes.

Then send it with `SendUserFile` (`display: "render"`), and in chat give a short summary of what changed and that new text is in the highlight color. This is a local file; do not publish it as an Artifact unless Long asks.
