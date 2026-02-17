---
"@ghx-dev/benchmark": patch
---

Add set-by-set verification orchestration and harden benchmark/report CLI behavior.

- add `verify:set` orchestration and `verify:mini:by-set` script flow
- support explicit provider/model/output and repeated scenario filters in benchmark CLI
- support explicit suite JSONL inputs and summary output paths in report CLI
- preserve rerun results correctly across iterations and enforce row-count validation
- add fixture cleanup support for ordered verification runs
