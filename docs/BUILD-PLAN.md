# BUILD PLAN — Automated VASP Attribution Engine
### Agent execution spec — Problem Statement 26182 (SAHYOG blockchain intelligence)

> **Read this whole file before writing any code.** This is a phased build plan for an autonomous coding agent. Work phase by phase, in order. Do not skip Phase 0. At the end of each phase, produce a short status note (what was built, what was skipped, what's stubbed) before moving to the next phase — treat each phase as a checkpoint, not a suggestion.

---

## 0. Operating Instructions for the Agent

- **This is a hackathon build**, not production software. Prioritize a working end-to-end demo over completeness in any one layer. A thin, connected pipeline beats one perfect module and four missing ones.
- **A baseline project already exists** in this workspace/repo. Before building anything:
  1. Inventory the existing repo structure, package manifests, framework choices, and any already-implemented modules.
  2. Map what exists against the architecture below. Reuse and extend existing code wherever it's compatible; do not rewrite working code to match this doc's stack preferences exactly if the baseline already made a reasonable equivalent choice (e.g. if the baseline already uses Express instead of FastAPI, or Postgres+Prisma instead of raw SQL — adapt this plan to that stack rather than forcing a rewrite).
  3. Flag any hard incompatibilities (e.g., baseline has no async job support and the trace pipeline requires it) as a decision point, and pick the lowest-effort path to compatibility rather than a rip-and-replace.
  4. Only after this audit, produce a short `BASELINE_AUDIT.md` summarizing what exists, what will be reused, what will be added, and which phases below are already partially done.
- Work in small, runnable increments. After every phase, the app should still boot and the demo path should still work end-to-end (even if later phases are stubbed/mocked).
- Prefer free/open data sources and free-tier APIs throughout (see §8). Never assume paid API keys are available; always build a mock/fallback data path so the demo works with zero external network access if needed.
- Seed a small, curated demo dataset early (Phase 1) and keep using it throughout development — don't wait until the end to make the demo reliable.
- Commit after each phase with a clear message (`phase-1: chain adapters + graph ingestion`, etc.) so progress is checkpointed and reviewable.

---

## 1. System Summary (context for the agent)

A tool for law-enforcement investigators: given a suspect crypto wallet address, trace its transaction graph across chains, hop by hop, until it hits an address attributable to a known exchange/VASP ("nearest VASP" = shortest labeled path). Tag intermediate hops (exchange, mixer, DeFi bridge, unknown), score risk, and generate an investigation-ready report. See `architecture.md` (§2 below) for the full component diagram if not already present in the repo.

**Core technical shape:** wallets = graph nodes, transactions = graph edges, "nearest VASP" = shortest-path-to-labeled-node graph query. Everything else (clustering heuristics, risk scoring, LLM narrative) enriches that core graph operation.

---

## 2. Target Architecture (for reference — adapt to baseline where it differs)

```
Frontend (React/TS)
  → Case intake, live trace graph (React Flow / Cytoscape), risk panel, report viewer, case list

Backend API (FastAPI or baseline's existing framework)
  → Auth (JWT/RBAC), Trace Orchestrator, Risk Scoring, Report Generator, Mock VASP Directory

Async Layer
  → Job queue (Celery+Redis, or baseline equivalent) running hop-expansion workers
  → WebSocket/SSE pushing partial trace results to frontend as hops resolve

Chain Data Adapters
  → BTC (Blockchair / mempool.space), EVM (Etherscan-family), Tron (TronGrid)
  → Optional aggregator fallback: Bitquery GraphQL

Intelligence Layer
  → Neo4j graph DB (wallets/nodes, tx/edges, shortestPath queries)
  → Label store (OFAC SDN crypto list + GraphSense TagPacks + curated demo labels)
  → Heuristic clustering (common-input-ownership, peeling chain, sweep detection)
  → Risk classifier (XGBoost on engineered features; rule-based fallback is acceptable MVP)
  → LLM narrative generator (Claude API) — report text + disclosure-request draft only, never the core attribution logic

Persistence
  → Postgres (cases, users, audit log, VASP directory)
  → Redis (cache, queue, session)
  → Object storage / local disk (generated PDF/DOCX reports)
```

---

## PHASE 0 — Baseline Audit & Environment Setup
**Goal:** Know exactly what exists before adding anything.

Tasks:
- [ ] Inventory repo: languages, frameworks, existing DB schemas, existing endpoints, existing UI screens.
- [ ] Identify what from §2 already exists in some form (auth? a DB? any blockchain calls already wired up?).
- [ ] Write `BASELINE_AUDIT.md`: what's reused as-is, what's extended, what's net-new, and a phase-by-phase "already done / partially done / not started" checklist mapped to Phases 1-7 below.
- [ ] Confirm the dev environment boots (`docker-compose up` or equivalent) before changing anything.
- [ ] Set up `.env.example` with placeholders for all external API keys used later (Etherscan, Blockchair, TronGrid, Bitquery, Claude API, Neo4j creds) so the rest of the build never blocks on secrets.

**Definition of done:** `BASELINE_AUDIT.md` exists; app boots; env var contract defined.

---

## PHASE 1 — Data Foundations: Chain Adapters + Graph Ingestion + Seed Labels
**Goal:** Given one wallet address, pull its real transactions from at least 2 chains and load them into a graph DB, with a seeded label set to tag known addresses.

Tasks:
- [ ] Stand up Neo4j (Community, Docker) if not already present in baseline. Define schema: `(:Wallet {address, chain})-[:SENT {tx_hash, amount, timestamp, block}]->(:Wallet)`.
- [ ] Build chain adapter interface (`ChainAdapter.get_outgoing_txs(address)`, `get_incoming_txs(address)`) with implementations for:
  - [ ] Bitcoin (mempool.space or Blockchair REST — no key required for basic tier)
  - [ ] Ethereum/EVM (Etherscan V2 unified API)
  - [ ] Tron (TronGrid API) — prioritize this; Tron/USDT is the dominant rail for the scam typologies this problem targets
  - [ ] Optional: Bitquery GraphQL as a unified fallback adapter covering all of the above with one client
- [ ] Build a `LabelStore` (Postgres table or Neo4j node property) seeded from:
  - [ ] OFAC SDN crypto address list (free, public, official — direct download)
  - [ ] GraphSense open TagPacks (free, open-source labeled address dataset)
  - [ ] A hand-curated `demo_labels.json` of 10-20 addresses covering: 2-3 real major exchange hot wallets (publicly known, e.g. from block explorers' verified labels), 1-2 known mixer/tumbler addresses, 2-3 publicly-documented ransomware/scam payment addresses (from public incident reports) — this becomes your reliable demo dataset
- [ ] Write an ingestion script: given a seed address, pull its direct transactions, write nodes+edges into Neo4j, apply labels from `LabelStore` to any matching addresses.
- [ ] Basic Cypher query working: `MATCH (a:Wallet {address:$addr}), (v:Wallet {tagged:true}) MATCH p=shortestPath((a)-[:SENT*1..6]->(v)) RETURN p`.

**Definition of done:** Can run one script/endpoint with a real address (use one from `demo_labels.json`) and see resulting nodes/edges + at least one labeled hop in Neo4j.

---

## PHASE 2 — Trace Orchestration (Multi-Hop, Async)
**Goal:** Turn the single-hop ingestion from Phase 1 into a real multi-hop trace that stops at the nearest labeled node or a depth limit.

Tasks:
- [ ] Implement BFS/DFS hop expansion: from seed wallet, expand outward, check each new address against `LabelStore` after every hop, stop that branch on first match or at max depth (default 6, configurable).
- [ ] Move trace execution into an async job (Celery+Redis, or baseline's existing job system). Expose `POST /trace {address, chain, max_depth}` → returns `job_id`.
- [ ] Add `GET /trace/{job_id}/status` and stream partial results via WebSocket/SSE as each hop resolves (don't make the frontend wait for the whole trace before showing anything).
- [ ] Add basic rate-limit-aware caching (Redis) in front of every chain adapter call — you will hit free-tier rate limits fast during dev/demo without this.
- [ ] Handle the "no path found within depth limit" case gracefully — return the partial graph and the nearest-but-unlabeled leaf nodes, not an error.

**Definition of done:** Submitting a demo address returns a job that completes with a multi-hop path in Neo4j, streamed to a client (can be tested via a simple script/Postman before the real frontend exists).

---

## PHASE 3 — Clustering Heuristics & Risk Scoring
**Goal:** Move beyond "exact label match" to actual blockchain-forensics intelligence.

Tasks:
- [ ] Implement common-input-ownership heuristic for Bitcoin (multiple inputs to one tx ⇒ same owner) to expand clusters beyond single addresses.
- [ ] Implement sweep-transaction detection (many small inputs → one output, common for exchange hot-wallet consolidation) as a signal that a node is likely an exchange even without an exact label match.
- [ ] Implement peeling-chain detection (one output keeps most value, other is "change") as a laundering-pattern signal.
- [ ] Engineer risk features per wallet/path: fan-in ratio, fan-out ratio, hop depth to any label, count of unlabeled hops, presence of known-mixer ancestor, transaction velocity.
- [ ] Build risk scorer: start with a transparent rule-based scorer (fast, explainable, safe MVP) — e.g. weighted sum of features → Low/Medium/High/Critical.
- [ ] Stretch: train an XGBoost classifier on the seeded labels (sanctioned vs. exchange vs. unknown) using the engineered features, as an upgrade path from the rule-based scorer. Only attempt after rule-based version works end-to-end.

**Definition of done:** Every traced path returns a risk score + a human-readable list of the signals that drove it (needed for Phase 5's report).

---

## PHASE 4 — Case Management, Auth, Audit Trail
**Goal:** Make this feel like an investigator tool, not a script.

Tasks:
- [ ] Postgres schema: `users`, `cases` (linked to a suspect address/trace job), `audit_log` (append-only: user_id, action, timestamp, case_id).
- [ ] JWT auth with at least two roles: `investigator` (create/view own cases) and `supervisor` (view all cases).
- [ ] Every trace/report/export action writes an audit log row — no exceptions, this is a cheap and high-value detail.
- [ ] `GET /cases`, `POST /cases`, `GET /cases/{id}` (includes linked trace jobs and reports).

**Definition of done:** Can log in, create a case, run a trace against it, and see the action reflected in the audit log.

---

## PHASE 5 — LLM Narrative & Report Generation
**Goal:** Turn a completed trace + risk score into an investigation-ready deliverable.

Tasks:
- [ ] Claude API integration: given the trace path (nodes, labels, risk signals), generate a plain-English investigation narrative ("Funds moved from the suspect wallet through 3 intermediate addresses exhibiting peeling-chain behavior before reaching a deposit wallet clustered with Exchange X, with high confidence...").
- [ ] Generate a draft "lawful disclosure request" text block addressed to the identified VASP, using the mock VASP directory (Phase 6) for contact/jurisdiction placeholders.
- [ ] Render a PDF/DOCX report: trace graph image (can be a static export from the frontend graph, or a server-side rendered graph image), entity table, risk score breakdown, narrative, draft disclosure text.
- [ ] Keep the LLM strictly in the "narrative writer" role — it must never be the thing deciding risk scores or labels; it only explains and drafts. Pass it structured data, not raw blockchain data, to keep this boundary clean and reduce hallucination risk.

**Definition of done:** One click on a completed trace produces a downloadable report file with real content pulled from that trace's actual graph/risk data.

---

## PHASE 6 — Mock SAHYOG / VASP Directory
**Goal:** Simulate the government-integration angle without needing real access.

Tasks:
- [ ] Seed a `vasp_directory` table: name, jurisdiction/country, known deposit-cluster labels, mock contact endpoint, mock response SLA.
- [ ] `POST /cases/{id}/disclosure-request` — a clearly-labeled **simulated** action: logs the "request" to the audit trail and returns a mock acknowledgment (e.g., "Request logged — SAHYOG production integration would route this to {VASP} via the SAHYOG lawful-disclosure API").
- [ ] Label this feature explicitly as simulated in the UI (a small "Simulated Integration" badge) — do not present it as a real government connection.

**Definition of done:** From a case with a resolved VASP, one action produces a mock disclosure-request record visible in the case timeline.

---

## PHASE 7 — Frontend Dashboard
**Goal:** The demo surface. This is what judges actually watch.

Tasks:
- [ ] Case intake screen: paste address / upload CSV of addresses, pick chain(s), start trace.
- [ ] Live trace graph view (React Flow or Cytoscape.js): nodes colored by tag (exchange/mixer/unknown/sanctioned), streamed in as hops resolve via WebSocket, not a static final-state dump.
- [ ] Risk panel: score, contributing signals, nearest labeled VASP with confidence.
- [ ] Report viewer/download.
- [ ] Case list + audit trail view (supervisor role sees all cases).
- [ ] Optional: simple risk heatmap / stats dashboard across cases (volume traced, top risk categories) — good for the "scalable, dashboard for LEAs" requirement in the problem statement, low effort if charts library is already in baseline.

**Definition of done:** Full flow works clicking through the UI only, no API tool required: login → new case → paste demo address → watch trace stream in → see risk + tags → download report → see it in audit log.

---

## PHASE 8 — Demo Hardening & Polish
**Goal:** Make the live demo bulletproof.

Tasks:
- [ ] Pre-warm/cache all API responses for the 3-5 curated `demo_labels.json` addresses so the live demo never depends on live rate limits or network flakiness.
- [ ] Add a visible "Demo Mode" toggle if using cached data, and a genuine "Live Mode" for judges who want to paste an arbitrary real address (accept it may be slower/less complete — that's fine and honest).
- [ ] Write a 5-8 line `DEMO_SCRIPT.md`: exact addresses to paste, expected outputs, talking points tying each screen back to problem-statement requirements (multi-chain, confidence scoring, investigation-ready report, VASP routing).
- [ ] Final pass: error states don't crash the UI, loading states exist everywhere, README has one-command startup instructions.

**Definition of done:** Someone unfamiliar with the codebase can run one command, follow `DEMO_SCRIPT.md`, and see the full flow work without touching code.

---

## 3. Explicit Non-Goals (do not build these — say so if asked)

- No Monero/privacy-coin deanonymization.
- No real Chainalysis/Elliptic/TRM Labs API integration (not self-serve available; not expected).
- No production Kubernetes deployment — docker-compose + a single cheap cloud instance is sufficient; mention K8s only as a stated future scaling path in the README/slides.
- No claim that the mock SAHYOG/VASP integration is a real government connection.

---

## 4. Tech Stack Quick Reference (use baseline's equivalents where they already exist)

| Layer | Default choice | Acceptable baseline substitute |
|---|---|---|
| Frontend | React + TS + Tailwind + React Flow | Any modern SPA framework + any graph-viz lib (Cytoscape, vis-network) |
| Backend | FastAPI (Python) | Express/Nest (Node), Django — whatever baseline already has |
| Async jobs | Celery + Redis | BullMQ (Node), Sidekiq, or baseline's existing queue |
| Graph DB | Neo4j Community | Any graph DB with shortest-path support; if truly unavailable, NetworkX in-memory graph is an acceptable fallback for hackathon scale |
| Relational DB | PostgreSQL | Whatever baseline uses (MySQL, SQLite for pure demo) |
| Cache | Redis | In-memory cache acceptable for demo scale |
| ML | XGBoost / scikit-learn | Any equivalent; rule-based scoring is an acceptable substitute if ML time runs out |
| LLM | Claude API | — |
| Auth | JWT / RBAC | Baseline's existing auth if present |

---

## 5. Free Data Sources Reference

| Source | Use | Notes |
|---|---|---|
| OFAC SDN crypto address list | Sanctioned-wallet ground truth | Free, public, official government dataset |
| GraphSense TagPacks | Open-source labeled address dataset (exchanges, services) | Free, open-source, academically citable |
| mempool.space API | BTC transaction/UTXO data | Free, no key required |
| Blockchair API | Multi-chain explorer data | Free tier available |
| Etherscan V2 (unified multichain) API | EVM chain transaction history | Free tier, key required |
| TronGrid API | Tron chain reads | Free, key required |
| Bitquery GraphQL | Unified multi-chain fallback/aggregator | Free dev tier |
| Publicly reported ransomware/scam addresses | Curated demo dataset | Pull 2-3 from public incident-response reports/news, cite sources in `demo_labels.json` |

---

**End of build plan. Start at Phase 0.**
