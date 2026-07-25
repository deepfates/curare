---
id: cur-0u5w
status: closed
deps: []
links: []
created: 2026-07-25T19:57:13Z
type: bug
priority: 1
assignee: deepfates
tags: [lync, determinism, clustering]
---
# Make raw-Lync identity enumeration locale-independent

Raw-Lync clustering canonicalizes set-like input with id.localeCompare. Lync ids are opaque decoded strings, so host locale collation is not a specified cross-environment enumeration. The focused regression orders A/a/z/ä differently under locale collation than UTF-8 byte order.

## Acceptance Criteria

Curare specifies and shares one explicit UTF-8 byte comparator for raw-Lync input enumeration, cluster annotation parent canonicalization, and serialized annotation ordering; Unicode opaque-id coverage fails under localeCompare and passes under the explicit comparator; existing permutation invariance and the full suite pass. The order is documented as identity enumeration, never chronology.


## Notes

**2026-07-25T19:59:15Z**

Reproduced before the fix: opaque ids [ä,z,a,A] loaded as [a,A,ä,z] under host locale collation instead of the specified UTF-8 enumeration [A,a,z,ä]. Added one shared comparator across raw intake, annotation parents, and serialized annotations; README explicitly says the order is identity enumeration, not chronology. Full tests pass 56/56 and TypeScript build passes.
