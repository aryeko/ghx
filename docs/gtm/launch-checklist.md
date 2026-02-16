# Launch Checklist

## Pre-Launch Gate
1. Confirm benchmark sign-off is complete on branch `plan/benchmark-scenarios-ghx-fixtures`.
2. Confirm snapshot file exists and validates against `docs/gtm/benchmark-snapshot-schema.md`.
3. Confirm no benchmark commands were run from this worktree.

## Metric Import
1. Open finalized snapshot from benchmark worktree reports directory.
2. Replace placeholders in all GTM drafts.
3. Record import details below.

## Claim Review
1. Verify each numeric claim includes model id and sample size context.
2. Verify no ad hoc numbers exist outside imported snapshot values.
3. Verify messaging still centers installed-user adoption.

## Channel Sequence
1. Medium post publish.
2. LinkedIn publish.
3. X launch thread publish.
4. Integration PR wave one opens.

## Post-Launch Measurement
1. Capture first successful run confirmations.
2. Track docs click-through and referral source.
3. Track integration PR status and maintainers' feedback.

## Import Log
| Imported at | Snapshot path | Model id | Sample size | Operator |
| --- | --- | --- | --- | --- |
| <IMPORT_TIMESTAMP> | <SNAPSHOT_PATH> | <MODEL_ID> | <N_RUNS> | <NAME> |
