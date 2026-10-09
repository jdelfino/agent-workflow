import html

B = {
    "A": (10, 20, 170, 64, "ARTICLES", ["news, posts, filings"], 1),
    "R": (200, 20, 170, 64, "READER", ["finds names in text", "matches by spelling"], 1),
    "N": (390, 20, 170, 64, "NEWS RECORD", ["Kevin Warsh", "816 articles"], 1),
    "W": (200, 130, 170, 64, "WIKIDATA COPY", ["kept on our side", "checked at creation"], 2),
    "G": (390, 130, 170, 56, "MACHINE GUESS", ["Warsh: Q6397725"], 2),
    "O": (390, 206, 170, 56, "OLD ID COLUMN", ["Warsh: blank"], 3),
    "C": (390, 282, 170, 56, "CONFIRMED IDS", ["Warsh: none yet"], 3),
    "S": (580, 190, 170, 80, "SHARED ID RULE", ["1 confirmed", "2 else old column", "3 else machine guess"], 4),
    "P": (580, 20, 170, 64, "PROFILING LIST", ["Warsh = Q6397725", "picked by a person"], 5),
}
# x1,y1,x2,y2,layer,style(None|'today'|'fix'),label
AR = [
    (180, 52, 198, 52, 1, None, None),
    (370, 52, 388, 52, 1, None, None),
    (475, 84, 475, 128, 2, None, None),
    (370, 158, 388, 158, 2, None, None),
    (560, 158, 578, 205, 4, None, None),
    (560, 234, 578, 230, 4, None, None),
    (560, 310, 578, 255, 4, None, None),
    (600, 84, 562, 226, 5, "today", None),
    (690, 84, 690, 188, 5, "fix", None),
]
CAPS = {
    2: [(214, 216, "makes the record and")],
}
CAPS = {
    5: [(604, 120, "today", True), (698, 140, "fix", True)],
}


def svg(layer, aria):
    mid = f"ahL{layer}"
    out = [f'<svg viewBox="0 0 760 350" role="img" aria-label="{html.escape(aria)}">',
           f'<defs><marker id="{mid}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" style="fill:var(--ink-faint)"/></marker></defs>']
    for k, (x, y, w, h, lb, lines, L) in B.items():
        if L > layer:
            continue
        a = " acc" if L == layer else ""
        out.append(f'<rect class="bx{a}" x="{x}" y="{y}" width="{w}" height="{h}" rx="6"/>')
        out.append(f'<text class="lb{a}" x="{x+12}" y="{y+22}">{lb}</text>')
        for i, t in enumerate(lines):
            red = " acc" if (L == layer or (layer >= 3 and k == "O" and False)) else ""
            out.append(f'<text class="it{red}" x="{x+12}" y="{y+42+i*17}">{html.escape(t)}</text>')
    for x1, y1, x2, y2, L, st, _ in AR:
        if L > layer:
            continue
        a = " acc" if L == layer else ""
        dash = ' stroke-dasharray="4 3"' if st == "fix" else ""
        out.append(f'<line class="ar{a}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}"{dash} marker-end="url(#{mid})"/>')
    if layer >= 5:
        out.append('<text class="cap acc" x="600" y="118">today:</text>')
        out.append('<text class="cap acc" x="600" y="131">old only</text>')
        out.append('<text class="cap acc" x="698" y="130">fix: ask</text>')
        out.append('<text class="cap acc" x="698" y="143">the rule</text>')
    out.append("</svg>")
    return "\n        ".join(out)


if __name__ == "__main__":
    import sys
    print(svg(int(sys.argv[1]), "x"))


# ── PR tags (SKILL.md §4 "Pin every PR to the boxes it changes, on every layer") ──
# One row per (box, PR). dx = offset of the 50-wide pill from the box's right edge
# (-56 for one tag, -110 for a second tag on the same box). merged=True draws it grey.
PR = [
    # ("N", -56, "#3184", False),
]
PR_LEGEND = {  # PR number -> one plain line of what it changes
    # "#3184": "the quote check runs inside every read",
}


def pr_tags(layer, boxes=B, tags=PR, legend=PR_LEGEND, legend_y=350):
    """SVG fragments for the PR pills on every box drawn at this layer, plus one
    legend line per PR that has a pill on this layer. Grow the viewBox height by
    22 px per legend line. Pills use fill:var(--canvas) so they sit on the box edge."""
    out, shown = [], []
    for key, dx, num, merged in tags:
        x, y, w, _h, _lb, _lines, L = boxes[key]
        if L > layer:
            continue
        a = "" if merged else " acc"
        out.append(f'<rect class="bx{a}" x="{x + w + dx}" y="{y - 9}" width="50" height="18" rx="9" style="fill:var(--canvas)"/>')
        out.append(f'<text class="lb{a}" x="{x + w + dx + 7}" y="{y + 4}">{html.escape(num)}</text>')
        if num not in [n for n, _ in shown]:
            shown.append((num, merged))
    for i, (num, merged) in enumerate(shown):
        a = "" if merged else " acc"
        state = " (merged)" if merged else ""
        out.append(f'<text class="it{a}" x="10" y="{legend_y + 18 + i * 22}">{html.escape(num + state + ": " + legend.get(num, ""))}</text>')
    return out, len(shown)
