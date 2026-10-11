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
awk '/<h2>Why/,/<\/section>/' <skill-dir>/example-firehose.html | head -60
```

Swap `Why` for `How it works` or `For agents` as needed (the firehose example predates the per-layer to-do boxes of 11 Oct; follow section 2 for those). Start the page on day one of a project, even with little known: keep every section and mark the empty ones `To do`.

Every new finding goes in exactly one place: **Why / How it works** if it rarely changes, **Open questions** if it waits on Long, **the layer's to-do box** if it is a piece of work or its status, **For agents** (or its linked notes file) for everything else. When unsure, For agents.

Main sections, in this order:

1. **Hero**: kicker (`Draft N · date · owner · internal working document`), title, one-sentence standfirst, legend (status tags plus one swatch for the latest update).
2. **Why**: the problem from first principles, at most two short paragraphs.
3. **Done means** (the win condition), right under Why: one bold sentence per goal a script can check, with a status tag. When a goal moves to another epic or is dropped, say so here in one line.
4. **How it works, layer by layer**: one architecture diagram that grows layer by layer (section 4, "The default shape"). Each layer is the unit of the page and carries, in this order (Long, 11 Oct, "bucketing the backlog" into the layers):
   - the layer's heading, then a first paragraph `<p class="pain">` that opens with **Original pain point:**, always red (Long, 11 Oct: "make the original pain point red not blue"; the template's `p.pain` rule keeps it red even when it is new in this update) the concrete problem that made this layer matter, in one or two plain sentences with the real example (Long, 11 Oct: "mark what the original pain point was in each layer. That's how it should start in the first paragraph."), then the short how-it-works text and the diagram;
   - a **found/plan note** (`<div class="upd">`) with two parts: **Found:** what we know about this layer's problem, explained from first principles (what goes wrong, why it matters, the number that shows it); **Plan:** what we are doing about it and why. This note is a standing explanation that accumulates across updates, not a per-update report (Long, 11 Oct: "we don't have to replace that whole section every time... just highlight only the stuff that changed in blue. We can keep the explanations that motivate the understanding of the problem"). On each update, edit it in place: keep the sentences that still explain the original problem and the current approach, fix or drop sentences that became untrue, add the new finding where it fits the story, and wrap only the new or changed sentences in `<span class="new">`/`<p class="new">`. A layer this update did not touch keeps its note unchanged with no blue. Write it to the first-principles standard in section 5 (why before how, no jargon, a reader who has never seen the page);
   - a **to-do box** (`<div class="ltodo">`, heading "To-do for this layer") with one card per piece of work that changes this layer, finished and unfinished: bold id + name, status tag, then one sentence each for **What / Why / Without it / Done when**, then **Waits on:** the pieces it depends on (`.2 &#10003;` when done, `.3 (layer 1)` when it lives in another layer, or "nothing"). Take the dependencies from the tracker (`bd show` DEPENDS ON) plus any real logical ones. Later layers usually wait on earlier ones, but the "Waits on" line is the rule, not the order.
   Cards or parts of cards that changed this update are blue; the rest are plain. There is no separate Backlog, progress table, to-do list or one-line pieces list on the main page; PR tables and old backlogs go in For agents.
5. **Open questions** (optional), just before For agents: only the questions waiting on Long right now, written to the first-principles standard in section 5, recommendation in bold. Once answered, the decision goes in the Decisions table and the question leaves the page. One line at the end may list the reader's own small to-dos ("Also on you: ...").
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

The main page reads top to bottom as: Why, Done means, the layer-by-layer picture (each layer with its blue note and to-do box), Open questions, then the collapsed "For agents". Nothing else sits between those.

**No per-update section on the main page** (Long, 11 Oct: "remember this should be integrated in the layer by layer"). An update is written INTO the layers it touches: the found/plan notes (edited in place, new sentences blue) and the changed to-do cards. On every update:
- Strip last update's blue first (section 3), then edit each layer's found/plan note in place: keep what still explains the problem, correct what changed, add the new finding, and color only the new or changed sentences. Never replace a note wholesale with "what this update found", and never write "Nothing new here" over an existing explanation.
- A finding that needs a new box goes into the diagram as a new layer, not into a free-standing section.
- Earlier update notes and any older free-standing sections move INTO the "For agents" `<details class="agents">` block (an "Earlier turns" sub-section, newest first). The main page has no collapsed "How we got here" blocks: everything outside For agents is open. (Long, 10 Oct: "We should never see these... everything should be uncollapsed if it does not fall into the for agents bucket.")
- When a whole earlier draft gets too long, freeze it as `<page>.draftN.html` (a copy with a red "frozen copy" kicker line) and link it, instead of deleting anything.
- When Long says a part must be handed to another agent, write a handoff file and point to it from that layer's blue plan line.

<!-- few-shot: document-layer-note-and-todo -->
```html
<h3>Layer 2. A topic filter keeps articles that clearly match one charter</h3>
<p>...</p><figure class="dia ent">...</figure>
<div class="upd"><p><b>Found:</b> a filter decides which articles reach a room; reading an article costs money, so a loose filter wastes it. <span class="new">On 600 past articles, 85% pass, mostly by matching a room (Iran 324); only 48 on the Fed description.</span></p>
<p><b>Plan:</b> tighten the filter per room. <span class="new">Your call (open question 2): Fed news flowing into the Iran room needs its own fix.</span></p></div>
<div class="ltodo"><h4>To-do for this layer</h4>
<p class="new"><b>.18 Fed news review</b> <span class="st">Your call</span><br>What: a look at how many Fed articles arrive and what they cost. Why: each article read costs money. Without it: we pay to read market noise. Done when: numbers per step, a recommendation and your decision are on the piece. Waits on: .3 (layer 1).</p>
<p><b>.2 Fed description for the filter</b> <span class="st live">Done</span> #3254<br>What: ... Why: ... Without it: ... Done when: ... Waits on: nothing.</p></div>
```

<!-- few-shot: document-collapse-earlier-turns -->
```html
<section class="block new"><h2 id="harness-loop">The harness loop, in four parts</h2> ... this turn, open ... </section>
<!-- inside <details class="agents">: -->
<h3>Earlier turns</h3>
<h4>The picture in 8 steps (update 3)</h4> ... the old section's content, as written ...
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

**The layer-by-layer explanation is the page's goal state: high level, layered, diagrams kept.** (Long, 6 Oct: "I want it high lv with the diagrams still there.") Work every update toward one section, just before Open questions, that explains the whole system in layers: layer 1 is one simple diagram, and each later layer redraws that same diagram with what it adds in the orange accent (`acc`), so reading top to bottom shows the picture growing. Keep each layer to a short heading, two or three plain sentences and its diagram. When an update changes how the system works, update the layers (add one, or redraw the affected ones) and say what changed in that layer's blue note. Never delete these diagrams to shorten the page; move prose detail to "For agents" instead.

**The default shape: less text, more architecture.** (Long, 9 Oct, after a draft of numbered paragraphs: "what I'd like instead of just a bunch of paragraphs explaining it is one architecture diagram that's slowly built out after every layer, and your paragraphs should wrap around that." He approved the result as the format for all pages from then on.) Every page's How it works uses this from draft 1:
- **Draw one diagram of the real system.** Use real component names with one real example running through it, e.g. "NEWS RECORD / Kevin Warsh / 816 articles" rather than "Entity". Each box should answer what it is and what it holds for the example.
- **Each layer adds boxes; existing boxes never move.** Fix every box's coordinates once. Layer N draws only the boxes and arrows introduced at layer ≤ N, and the ones new at N are `acc`. Crop the early layers' `viewBox` height so they don't sit on empty space.
- **Generate the layers from one script.** Write a small Python file in the scratchpad that holds each box as (x, y, w, h, label, lines, layer) and each arrow as (x1, y1, x2, y2, layer, style), and prints the SVG for a given layer. Splice its output into the page. Hand-copying five SVGs drifts.
- **Text per layer:** a heading that states the layer's point as a sentence ("Our news lookup skips the rule"), then at most three or four plain sentences, then the diagram. A term gets explained in the layer where its box first appears, not in a glossary.
- **Order layers from the data's origin to the problem.** The last layer shows the path that breaks today as a solid red arrow labelled "today" and the fix as a dashed arrow labelled "fix".
- **Pin every PR to the boxes it changes, on every layer.** (Long, 9 Oct: "when we mentioned PRs being made, I just want to relate it back to the architecture"; then "every layer has its PR marked in the components in the layer.") Once a page's work has PRs, each box a PR changes carries a small pill tag with the PR number (`#3184`) on its top edge, in every layer where that box is drawn, not only the last one. Orange (`acc`) = open, grey = merged. Under each layer's diagram, one legend line per PR whose box is in that layer: number, then what it changes, in plain words. When a PR changes something the picture has no box for (a cache, a queue), add that box in a new layer rather than leaving the PR off the picture. The turn section that reports the PRs reuses the same tagged picture, not a separate PR-stack chart, and states the merge order in its caption. The generator holds the tags as a table, `PR = [(box_key, dx, "#NNNN", merged)]`, next to the boxes; `example-layered-svg.py` has the code.

<!-- few-shot: document-pr-tags-on-layers -->
```text
BAD   A row of four boxes "#3177 MERGED -> #3184 GREEN -> #3189 -> #3194" beside the layers.
      Why: says the merge order, not what each PR changes in the system.
GOOD  Layer 1's FIRST PASS box wears #3177 (grey) and #3194 (orange); Layer 2's CHECKS box
      wears #3184; a new CACHE box in Layer 6 wears #3189; each layer's legend lists only
      the PRs drawn on it.
```
- **Work items live inside the layers** (section 2: blue note + to-do box per layer), not in a Backlog after them. A short conclusions section after the last layer is optional; then Open questions, then For agents.
- **Reference page:** `<skill-dir>/example-layered.html` is a finished example of this shape (a frozen copy of the 9 Oct entity-identity page, draft 2). Its generator is `<skill-dir>/example-layered-svg.py`: a table of boxes and arrows plus a `svg(layer)` function. Copy and adapt the generator; don't start from scratch. Pull one layer with `awk '/Layer 2\./,/<\/figure>/' <page> | head -60` instead of reading it whole.

## 5. Writing

- Invoke `anti-slop-writing` before drafting. No em dashes in page copy:

<!-- few-shot: document-no-em-dash -->
  BAD: `Jev ties Opus — 65 of 69 right — at a sliver of the cost.`
  GOOD: `Jev ties Opus: 65 of 69 right, at a sliver of the cost.`

- **Questions for Long and anything that changed the plan get written to this standard:** "Always explain from first principles, assuming no prior knowledge. Motivate WHY before HOW. Build understanding layer by layer. Be concise at each step. Explain without jargon." (Long, 11 Oct: "if I haven't seen a document in a while, I will not understand it.") The architecture diagrams carry the foundations; the risk is the small deviations and new findings during the work, which arrive without context. So every open question, plan change or new finding on the page gets, in order:
  1. **Background:** one or two plain sentences on the part of the system it touches, as if Long had never seen the page (point at the layer diagram it lives in).
  2. **Why it came up:** what we found or what changed, with the number that triggered it.
  3. **The choice:** the options in plain words, what each costs or risks.
  4. **The recommendation** in bold, and what happens next if he says yes.
  Never ask a bare question like "accept 830 a day or drop the three?" without steps 1-3 around it.

<!-- few-shot: document-question-with-context -->
```text
BAD   3. Should the Fed news feed take about 830 articles a day? Recommend: start with all 16.
GOOD  3. How big should the Fed news feed be?
      Background: profiles only get new articles a feed asks for, and a model reads each
      article to pull out facts, so every article costs money (layer 1).
      Why it came up: one count says the Fed search would bring about 830 a day; the plan
      assumed 136. Warsh, Powell and Bessent are most of it.
      The choice: take all 830, or leave those three out of this one search.
      Recommendation: take everyone for a few days, look at what arrives, then decide.
```
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
