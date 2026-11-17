# StableBench protocol and API

## State machine

`COLLECTING` → both sides seal → `SEALED` → both known compilations → `READY` → solve → `SOLVED` → select → `SELECTED` → two distinct coordinator approvals → `COMMITTED`.

Any compiled UNKNOWN row produces `NEEDS_CLARIFICATION` instead of READY. The other side can still be compiled for inspection, but solving stays blocked. Either coordinator may cancel any nonterminal market into `CANCELLED`. There are no changes to the immutable roster or sealed statements, no reselection and no amendments after cancellation or commitment. Create a new market if a different input or choice is required.

Every mutation after creation requires the current **market revision**. Rejected calls revert without increasing it. The sender is taken from `gl.message.sender_address`; a caller cannot supply another coordinator's signature as a role field.

## Consensus and certificate

`compile_preferences` calls `gl.vm.run_nondet_unsafe`. The leader returns one row per subject: status KNOWN/UNKNOWN, acceptable candidate IDs in strict preference order, excluded IDs and an exact contiguous quote. KNOWN requires a duplicate-free complete partition of the opposite roster. UNKNOWN requires both arrays empty. Validators independently compile without the leader's answer, compare the whole ordered preference signature (excluded-set order is irrelevant), then separately audit candidate quotations against the complete input and fixed rules. Schema checks alone are never enough. Commands embedded in preference text are untrusted data.

The solver evaluates only mutually acceptable, injective assignments; `-1` means unmatched. A blocking pair consists of an unpaired workload and bench for which each strictly prefers the other to its existing partner, or to being unmatched. A stable assignment has no blocking pair. The certificate includes `left_ranks`, `right_ranks` (zero-based indices), `matchings`, `forced_pairs`, `rejected:[{assignment,blocking_pair}]` and `checked`. It is a complete finite certificate for declared preferences, not a factual or fairness certificate.

`roster_hash` binds market ID, both coordinator addresses and roster. `certificate_hash` binds roster hash, both original statement arrays and the full deterministic certificate. `selection.digest` binds market ID, certificate hash and the selected vector. Hashes are SHA-256 of compact sorted-key UTF-8 JSON, with no ASCII escaping. Both approvals must name the same digest.

## Methods

| Write | Positional arguments | Caller |
|---|---|---|
| create_market | reference, bench_coordinator, payload | Workload coordinator |
| seal_preferences | mid, expected_revision, side, payload | Owner of that side |
| compile_side | mid, expected_revision, side | Either coordinator |
| solve | mid, expected_revision | Either coordinator |
| select | mid, expected_revision, index, certificate_hash | Either coordinator |
| approve | mid, expected_revision, selection_digest | Each coordinator once |
| cancel | mid, expected_revision | Either coordinator before terminal state |

Public views: `get_protocol()`, `list_markets()`, `get_market(mid)`. They return JSON strings. Writes return a market ID except `select`, which returns the selected digest; always read finalized state after confirming execution.

`create_market.payload` is JSON `{left:[{id,description}],right:[{id,description}]}` with equal nonempty counts up to four. IDs and references use lowercase `[a-z0-9-]{3,40}`; IDs must be unique within a side. Descriptions are 5–400 characters. `seal_preferences.payload` is a JSON string array in the exact roster order; each statement is 5–1000 characters. `side` is left or right. Duplicate JSON object keys, duplicate candidate IDs, forged quotes and incomplete KNOWN partitions are rejected.

Inspect `examples/preferences.json` for a two-stable-solution example. With the real market ID from evidence:

```sh
node scripts/call.mjs read get_market '["MARKET_ID"]'
```

Use `scripts/call.mjs write` with the exact positional array from `schema.json` and a separately provisioned authorized key. No view signs a transaction. All writes attach zero value.

## Validation coverage

Local tests include all 625 combinations of incomplete strict two-by-two preferences, checking that the independent deferred-acceptance result occurs in the exhaustive stable set, every rejected candidate's witness is genuine and the enumeration is complete. A full four-by-four example checks the 209-candidate bound. Lifecycle tests cover separate side authority, input immutability, unknown gating, digest binding, duplicate approval, stale revisions and terminal states. Mock-host tests do not establish live consensus; real journals identify actual FINALIZED receipts and readbacks.

## GenLayer references

- [Equivalence Principle and substantive independent validators](https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle)
- [Stable network configuration](https://docs.genlayer.com/developers/intelligent-contracts/deploying/network-configuration)
