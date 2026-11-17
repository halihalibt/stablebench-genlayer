# StableBench

A standalone GenLayer primitive for **stable one-to-one test-bench assignment from independently signed, natural-language ordinal preferences**.

A workload coordinator and a lab coordinator may agree that every resource is suitable yet disagree about who should receive which bench. A greedy allocator can produce an assignment where a workload and a bench both prefer each other over their assigned partners. StableBench makes that blocking-pair objection explicit: GenLayer independently interprets each side's declared preferences, and deterministic code enumerates every individually rational partial assignment, certifies all stable assignments and exhibits a blocking pair for every rejected candidate. Both coordinators must sign the same chosen assignment digest before it becomes committed.

No frontend, money transfer, hardware scheduler or private model service is required. Other contracts or clients can consume the committed record and certificate.

## Mechanism

1. A workload coordinator creates a market containing 1–4 workload descriptions and the same number of bench descriptions, plus a distinct lab-coordinator address.
2. Each coordinator separately seals one natural-language preference statement per item on its side. Statements and roster cannot be edited.
3. Either coordinator requests each side's compilation. The leader and validators independently derive the full strict ranked/excluded partition over the opposite roster. Validators require identical ordinal decisions and separately audit the leader's supporting quotations. Missing acceptability, unspecified ordering or ties remain UNKNOWN; they never become permission to match.
4. When every row is known, the exact solver enumerates all mutually acceptable partial injections. It records every stable assignment, all forced pairs and a concrete blocking pair for each rejected assignment. Being unmatched is allowed and is worse than every acceptable partner; unacceptable pairings are never candidates.
5. Either coordinator selects a stable solution under the exact certificate hash. The two coordinator addresses separately approve its digest. Only the second distinct approval produces COMMITTED. Either can cancel before commitment; no approval can revive a cancelled market or replay a committed result.

At four per side, at most **209** partial injections exist before acceptability filtering. No solver or model chooses a hidden social-welfare objective. Stability does not imply fairness, global optimality or truthful preferences. The selection remains a transparent, jointly signed choice.

## Why GenLayer matters

Ordinary deterministic contracts cannot infer that “the low-noise Quiet bench before the high-speed Fast bench” names and ranks the declared bench IDs. A single model could silently invent an exclusion or break a tie. Here each accepting validator independently reconstructs **every** row, including preferences unrelated to the final chosen matching. Exact ordinal equivalence and evidence auditing control whether deterministic allocation is permitted. The model never generates matching solutions or mathematical certificates.

## Deployment

- Network: **Stable Studionet 61999**. RPC `https://studio.genlayer.com/api`.
- Contract: [`0x07C2779514414A96cA3c9359Ff21bbd5810aC183`](https://explorer-studio.genlayer.com/address/0x07C2779514414A96cA3c9359Ff21bbd5810aC183).
- Deployment transaction: [`0x2f510cc23b81f7e50c92364cde83d991a917fa0794d669a542981ca0b04159ad`](https://explorer-studio.genlayer.com/tx/0x2f510cc23b81f7e50c92364cde83d991a917fa0794d669a542981ca0b04159ad).
- Source SHA-256: `9cb6018582f9dc947ffbc4b5f77ce4b75b966a2c3957a4b885006e3f7511e309`.

## Run and inspect

```sh
npm ci
npm test
npm run verify
node scripts/call.mjs read get_protocol '[]'
```

Node.js 22+ and Python 3.12+ are recommended. The only JavaScript dependencies are pinned `genlayer-js` and `viem`. Python contract tests use a clearly labelled mocked host, not a fake network. The live evidence and independent readback are separate.

- [Readable contract](contracts/contract.py)
- [Method schema](schema.json) · [Deployment metadata](deployment.json)
- [Signed preference example](examples/preferences.json)
- [Protocol, API and trust boundaries](PROTOCOL.md)
- [Deployment and actual calls](DEPLOYMENT.md)
- [Real transaction journal](evidence/live.json)

## Recorded transaction evidence

10 local mocked-host unit tests passed. The stored real Studionet journal contains 9 FINALIZED/SUCCESS transactions and 4 FINALIZED expected contract rejections, with 1 submitted transaction still awaiting a terminal observation. The deployment was observed FINALIZED/SUCCESS and deployed source bytes matched the recorded SHA-256. **The full live acceptance run is not complete; this evidence is not a completed acceptance claim.**

- Pending observation: `right-approval`, transaction `0xe8650d4fdc8a1a072e3597b48d6bf69b5f2c6851e76e9daa2020b90d989ee891`.

`node scripts/check-journal.mjs` validates the integrity and identity of stored receipts offline; it is not a fresh chain read. `npm run live` resumes the original journal and signers without re-submitting recorded hashes. `npm run verify` deliberately refuses an incomplete journal; after completion it independently re-fetches receipts and final state and writes `evidence/verification.json`. Local CI validates source tests and stored-record integrity; neither substitutes for completed live acceptance.

## Scope and limits

All inputs and results are public. Use non-confidential descriptions. The two addresses represent coordinators, not separately authenticated owners of every workload or physical bench. Preference statements are signed authority for this calculation, not independently proven hardware facts. There is no live external event to fetch: the authoritative inputs are the exact signed roster and preferences.

A commitment covers one market. It does not reserve real hardware or prevent the same bench name from appearing in another market. A downstream scheduler must enforce physical identity, availability and cross-market locking. This is a reusable allocation primitive, not a claim to have operated a lab.

A deployment stores at most 128 markets; each has 1–4 entries per side. Strict preferences only: ties are not arbitrarily resolved. UNKNOWN markets require clearer statements in a new market. There are no amendments or unilateral reassignment after commitment. Models can disagree, fail or make semantic mistakes; consensus is not a proof of real-world truth. Failed consensus cannot be manually overridden into a result.

MIT. GenLayer identifies its respective project; this contract is independent.
