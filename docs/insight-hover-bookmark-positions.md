# Insight hover: bookmark position repair and browser handoff

Date: 2026-10-27. Branch: `fix/insight-hover-bookmark-positions`.
Baseline: `8ad5a37aad218e18ae15f30dcac5f764fab5aa87` from draft PR #39.
The repair is prepared locally; PR #39 and its branch are preserved.

## Cause and repair

The source-scroll listener in `DocumentViewPanel` was installed before pins
finished loading. It retained the render's empty `pins` list. After a delayed
hover scroll, that listener scheduled its old `measurePinPositions`, which
replaced the position map with an empty object. Visible markers then fell back
to `top: 0`. Pin loading/refresh also scheduled a measurement from the render
that started the request. Scrolling or dragging through current handlers could
restore the correct positions.

- Measurement now reads the latest committed pin list through a ref. A layout
  effect updates the ref and schedules measurement after pins/highlighted text
  have rendered. Scroll events, source scrolling and resize observation use the
  same coalesced animation-frame scheduler.
- Queued source/target scrolls are cancelled during cleanup and verify the
  committed document ID before running. Pin fetches ignore responses after
  document switch/unmount and responses superseded by a newer refresh.
- Temporarily unmeasurable/actively dragged pins retain their last valid
  position. New, unmeasured markers remain hidden until valid measurement;
  there is no visible zero-position fallback. Pointer completion/cancellation
  schedules an automatic remeasurement.
- `ChatPanel` keeps one pending 280 ms hover scroll. Leave, another hover,
  collapse, changed analysis data/document/Situation or unmount cancel obsolete
  timers. Both insight render paths share the hover/leave handlers. Highlight
  events and source scrolling are preserved.

Hover, scrolling, measurement and pin refresh only update UI geometry. They do
not PATCH `start_offset`, `end_offset` or `visual_offset`. The existing actual
pointer-drag path still persists `visual_offset` on pointer-up. No AI/service,
dependency, schema, migration, user database or upload changes are included.

## Verification performed by Codex

Linux; Node `24.19.0`, npm `11.9.0`; existing lockfile installation reused.

| Check | Exit | Result |
| --- | --- | --- |
| `node scripts/insight-hover-bookmark-positions.test.cjs` | 0 | Nine subtests, ten tests including parent. |
| Same regression with the two baseline TSX components | 1, expected | Reproduces clustering and obsolete callbacks/responses. |
| `npm run typecheck -- --incremental false` | 0 | No diagnostics. |
| `npm run build` | 0 | Existing Turbopack/NFT warning remains. |
| Full diff whitespace check, including new files | 0 | Checked with a temporary index; actual staging unchanged. |

The regression loads the actual TSX component functions and invokes their real
event handlers, effect callbacks and fetch continuations. Controlled hooks,
clocks and DOM range geometry let it exercise first load, three expanded
insights, repeated >280 ms hover/leave, early leave, switching hovered insight,
scroll/resize, missing geometry, out-of-order refresh, document switch, unmount
and actual pointer-down/move/up handlers. It checks source highlighting/scroll,
distinct positions and absence of write requests before actual drag; pointer-up
must issue exactly one PATCH for the dragged pin's `visual_offset`.

This harness does not run React DOM or a browser layout engine. It is a focused
callback/timing regression, not browser acceptance. It uses mocked fetch only:
no server, AI, SQLite DB or uploaded file is accessed. Baseline's primary exact
diagnostic is:

```text
AssertionError [ERR_ASSERTION]: separate first/second pin: 0,0,0

0 !== 220
```

Other expected baseline failures include a hover scroll after leave, older
refresh overwriting newer offsets, a dragged pin losing its displayed position,
a queued old-document scroll, and visible unmeasured markers. Complete raw logs
are retained outside the repository under
`/workspace/work/insight-hover-bookmark-positions/checks/`.

The build reports the existing warning:

```text
Turbopack build encountered 1 warnings:
./next.config.ts
Encountered unexpected file in NFT list
```

Its trace goes through document conversion/services to the Situation-document
DELETE route. The generated `next-env.d.ts` path change is restored after build.

## VS agent: actual browser verification — pending

Test this branch plus its prepared diff, not just the earlier PR #39 commit.
Record the exact tested commit/diff, Windows/browser versions, Node/npm versions,
viewport, console/network diagnostics and screenshots or position samples.
Earlier Windows reports do not verify this repair.

1. Use an isolated disposable SQLite DB and synthetic source/analysis fixtures,
   preserving the user's database and uploads. Use the existing schema/migrations
   only. Start the bare Next CLI with an absolute temporary `DATABASE_URL`;
   repository `dev`/`start` scripts force the normal DB path and deploy migrations.
   No AI request or real file upload is needed: seed long processed source text,
   an analysis document and source-linked insights directly in the temporary DB.
2. Prepare source documents A and B, each with at least three bookmarks on
   clearly separated lines. Include a saved `visual_offset` different from its
   source offset. Analysis A should have at least three expandable insights
   linked to different source ranges/bookmarks. Open A and its analysis; keep
   several insights expanded simultaneously. Confirm highlighting still follows
   expanded/hovered insights and initial bookmark positions appear automatically.
3. Hover each expanded insight for at least 350 ms, leave and repeat at least
   five cycles in different orders. Wait for smooth scrolling to finish and
   remain idle for another second. Source scrolling must still work; markers
   must stay attached to their respective lines and must never cluster at top.
   Do not click or drag to recover positions. Also leave before 280 ms and
   rapidly move between two insights: obsolete delayed scrolls must not fire.
   Collapse an insight while its hover timer is pending and repeat.
4. Scroll the source with the wheel/scrollbar during and after these hovers.
   Resize the document panel or toggle fullscreen, then repeat. Positions must
   update automatically after the final layout/scroll event. Account for pins
   legitimately outside the visible scroll viewport; do not expect all pins to
   remain on screen or to have fixed viewport Y coordinates during a scroll.
5. Trigger `window.dispatchEvent(new Event("bureaucat:document-pins-refresh"))`
   while multiple insights are expanded, repeat hover and verify automatic
   recovery. Test first load with delayed `/pins` and repeated refreshes with
   reversed response order using existing browser request interception if
   available. The latest response wins; no old/zero positions should appear.
6. With a hover timer, source-scroll frame or pin request pending, switch A → B.
   Test both keeping analysis A open and replacing/closing it. B must retain its
   own markers; a delayed A response/event must not replace them or scroll B.
   Switch back to A and repeat. Close/unmount the document view with a request
   pending and check for late state updates, stray scrolls and console errors.
7. Snapshot stored offsets before hover/scroll/refresh and compare afterward,
   including after reload. Use the read-only snippet below and the Network tab:
   these actions must send no pin PATCH requests. Then perform a real drag,
   including while measurement/scroll is occurring: it must stay responsive,
   persist only the dragged pin's `visual_offset`, and retain the new position
   after refresh/reload. Source `start_offset`/`end_offset` and all other pins
   must stay unchanged. Test pointer cancellation too; it must not persist a move.

Read-only browser helpers (use the fixture document ID):

```js
async function bookmarkOffsets(documentId) {
  const response = await fetch(`/api/documents/${encodeURIComponent(documentId)}/pins`, { cache: "no-store" });
  const { pins } = await response.json();
  return pins.map(({ id, start_offset, end_offset, visual_offset }) =>
    ({ id, start_offset, end_offset, visual_offset })).sort((a, b) => a.id.localeCompare(b.id));
}
function bookmarkLayout() {
  return [...document.querySelectorAll(".document-pin-marker")].map((button) => ({
    number: button.querySelector(".document-pin-index")?.textContent,
    top: button.style.top,
    visibility: getComputedStyle(button).visibility,
    viewportY: button.getBoundingClientRect().top
  }));
}
```

Record pass/fail separately for every scenario. Actual browser/Windows acceptance
is pending. BC-015 remains In Progress; the earlier 544×234 navigation clipping
is outside this fix. No merge, deployment or Drive write is performed. The new
canonical changes affect mirrors 00 and 03; synchronization remains pending.
