---
id: Hac-obtw
status: open
deps: []
links: []
created: 2026-07-25T17:56:47Z
type: bug
priority: 1
assignee: deepfates
tags: [corpus, curare, splice, importer, glowfic, twitter]
---
# Curare: cluster every readable Splice raw-Lync source kind

A verifier-clean 37-event Splice union contained 3 Twitter archive events, 31 Glowfic events (30 posts), and 3 tweet-embed events. Curare's raw-Lync adapter only recognizes payload.text/full_text/fullText/message, so Glowfic payload.content and tweet-embed payload.embed.html were skipped; requesting k=5 then failed because fewer than five points remained. The Twitter-only corpus loop concealed this heterogeneous importer gap.

## Acceptance Criteria

Curare extracts useful normalized text from every readable raw-Lync kind currently emitted by Splice, including Glowfic posts and tweet embeds, while ignoring non-content containers explicitly; cluster input counts reconcile by kind with named skip reasons; source event ids remain annotation parents; deterministic replay and the full corpus loop pass on a checked-in heterogeneous fixture.

## Notes

**2026-07-30**

The shared Lync presentation seam now supplies exact readable text for Twitter,
Bluesky, Glowfic, tweet embeds, OCR, and structured messages; the heterogeneous
adapter regression preserves all source IDs and proves private incidental
fields do not become embedding text. This ticket remains open because its
separate per-kind reconciliation and named skip-report requirement is not yet a
Curare CLI surface; the presentation repair alone does not satisfy that clause.
