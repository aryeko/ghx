# Claim Contract

## Goal
Keep all external claims accurate while benchmark verification is in progress.

## Pre-Snapshot Allowed
1. Qualitative statements such as:
- "reduces token tax"
- "stabilizes GitHub agent workflows"
- "removes repetitive command discovery"
2. Architecture and workflow claims that are verifiable from source and docs.

## Pre-Snapshot Forbidden
1. Any explicit percentage claim.
2. Any phrasing equivalent to "faster by X".
3. Any claim of proven run count or statistical win.
4. Any numeric benchmark claim not tied to finalized snapshot artifacts.

## Post-Snapshot Allowed
1. Numeric claims copied directly from the finalized benchmark snapshot.
2. Numeric claims only when model id and sample size are included with the claim.

## Attribution Requirements
Every numeric claim must include:
1. `model_id`
2. `sample_size`
3. snapshot generation timestamp
4. source snapshot path
