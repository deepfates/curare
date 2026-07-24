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

- The supported Lync range is `>=0.3.0 <0.5.0`; the canonical corpus rehearsal
  tests the unpublished 0.4 source candidate without pretending it is already
  registry-installable.
- The maintained Transformers.js 3.8.1 runtime and patched Sharp 0.35.3 chain
  replace the former vulnerable embedding stack.

### Release boundary

Keep `private: true`. Any future package release requires a scoped name, a new
distribution contract, and a fresh production security audit.
