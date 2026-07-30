# Changelog

## [0.1.0] - Source release candidate

Curare remains a private source application. This version is not published to
npm, and the unscoped registry name belongs to an unrelated package.

### Added

- Raw Lync input with stable source identities and separate standard
  `lync/annotation` cluster events.
- Provider-free local embedding and deterministic seeded clustering.
- Structured-message and preserved-tweet-text support for the corpus loop.

### Changed

- Raw Lync clustering consumes the checksum-pinned Lync presentation candidate
  instead of maintaining shallow payload-text heuristics. All presented content
  retains its source event id; structural and unclaimed records are not
  embedded.
- The supported Lync range is `>=0.3.0 <0.5.0`; the canonical corpus rehearsal
  tests the unpublished 0.4 source candidate without pretending it is already
  registry-installable.
- Raw Lync clustering canonicalizes source events by id, so physical line
  order, identical duplicates, existing annotations, and Lync merge output do
  not change seeded cluster membership. Pre-canonical-order cluster artifacts
  must be regenerated from the raw source union rather than combined with the
  new projection.
- The maintained Transformers.js 3.8.1 runtime and patched Sharp 0.35.3 chain
  replace the former vulnerable embedding stack.

### Release boundary

Keep `private: true`. Any future package release requires a scoped name, a new
distribution contract, and a fresh production security audit.
