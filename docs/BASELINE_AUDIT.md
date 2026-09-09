# BASELINE AUDIT & ENVIRONMENT SPECIFICATION
### Cryptocurrency VASP Attribution Engine — Problem Statement 26182 (SAHYOG)
**Document Status:** Complete (Phase 0 Checkpoint)  
**Timestamp:** 2026-09-09  
**Specification Reference:** `docs/BUILD-PLAN.md` §0, §2, Phase 0

---

## 1. Executive Summary

This repository contains a mature, functional baseline prototype designed for automated cryptocurrency wallet-to-VASP attribution, fund-flow visualization, multi-signal risk analysis, and court-admissible law enforcement reporting.

Both backend and frontend services are containerized via Docker Compose, boot cleanly, and have been verified active and responding on their designated local ports:
- **Backend API:** `http://localhost:8000/api/v1/health` (HTTP 200 Healthy, 1,595 indexed VASP addresses loaded)
- **Frontend Dashboard:** `http://localhost:3000` (HTTP 200 OK, Next.js 14 App Router)

---

## 2. Inventory of Existing Codebase

### 2.1 Languages, Runtimes & Frameworks

| Layer | Technology | Version / Details | Role in Baseline |
|---|---|---|---|
| **Backend Core** | Python | 3.11 (Docker container) / 3.13 (host) | Primary API and intelligence engine |
| **Backend Framework** | FastAPI | >= 0.110.0 | High-performance asynchronous REST API |
| **Server Engine** | Uvicorn (standard) | >= 0.28.0 | ASGI web server |
| **Persistence (ORM)** | SQLAlchemy (asyncio) | >= 2.0.28 | Asynchronous relational data modeling |
| **Database Driver** | aiosqlite | >= 0.20.0 | Local SQLite async driver (`crypto_trace.db`) |
| **Graph Computing** | NetworkX | >= 3.2.1 | In-memory directed multi-graph BFS & topology |
| **Forensic PDF** | ReportLab | >= 4.1.0 | Court-admissible A4 PDF generation (Section 65B) |
| **Data Validation** | Pydantic / pydantic-settings | >= 2.6.0 | Request/response schemas & env config |
| **Machine Learning** | Scikit-Learn / Joblib | Custom pipeline in `app/ml` | Pre-trained VASP ranker (`vasp_ranker_v1.joblib`) |
| **Frontend Framework**| Next.js | 14.2.23 (App Router) | Client application & routing |
| **UI Library** | React | 18.3.1 | Component-driven user interface |
| **Graph Visualization**| Cytoscape.js + dagre | 3.28.1 / 2.5.0 | Interactive forensic directed graph layout |
| **Styling** | Tailwind CSS | 3.4.1 | Dark-mode intelligence styling |
| **Icons & QR** | Lucide React / qrcode | 0.359.0 / 1.5.4 | Visual icons and wallet QR code rendering |

---

### 2.2 Existing Database Schemas (`backend/app/models/database.py`)

The relational database is managed via asynchronous SQLAlchemy with SQLite (`./data/crypto_trace.db` in Docker, `./crypto_trace.db` locally), fully compatible with PostgreSQL via `DATABASE_URL`:

1. **`wallets` (`Wallet`)**:
   - `address` (PK, indexed), `chain`, `first_seen`, `last_seen`, `label`, `is_contract`, `created_at`.
2. **`transactions` (`Transaction`)**:
   - `id` (PK), `tx_hash`, `chain`, `block_number`, `timestamp`, `from_address`, `to_address`, `asset_type`, `token_address`, `token_symbol`, `token_decimals`, `amount`, `gas_used`, `is_error`, `source_api`, `ingested_at`.
   - Unique constraint: `(chain, tx_hash, token_address, from_address, to_address)`.
3. **`vasps` (`VASP`)**:
   - `id` (PK), `name` (unique), `category`, `website`, `jurisdiction`, `compliance_email`, `fiu_registered`, `risk_rating`, `notes`, `created_at`.
4. **`vasp_addresses` (`VASPAddress`)**:
   - `id` (PK), `vasp_id` (FK -> `vasps.id`), `address`, `chain`, `address_type` (hot_wallet, cold_storage, deposit, withdrawal, treasury), `source_name`, `source_url`, `source_type`, `verification_status`, `confidence`, `confidence_score`, `first_verified_at`, `last_verified_at`, `is_demo`.
   - Unique constraint: `(chain, address)`.
5. **`analysis_runs` (`AnalysisRun`)**:
   - `id` (PK, UUID), `wallet_address`, `max_hops`, `status` (QUEUED, FETCHING_DATA, BUILDING_GRAPH, ANALYZING, COMPLETED, FAILED), `error_message`, `started_at`, `completed_at`, `num_transactions`, `num_nodes`, `num_edges`.
6. **`attributions` (`Attribution`)**:
   - `id` (PK), `analysis_id` (FK -> `analysis_runs.id`), `vasp_id` (FK), `vasp_name`, `score` (0.0–100.0), `evidence_strength`, `rank`, `summary`, `metrics_json`.
7. **`evidence` (`Evidence`)**:
   - `id` (PK), `analysis_id` (FK -> `analysis_runs.id`), `evidence_type`, `source_address`, `target_address`, `tx_hash`, `hop_distance`, `amount`, `asset_symbol`, `explanation`, `strength`.
8. **`risk_assessments` (`RiskAssessment`)**:
   - `id` (PK), `analysis_id` (FK -> `analysis_runs.id`, unique), `risk_level` (LOW, MEDIUM, HIGH), `score`, `indicators_json`, `explanation`.
9. **`candidate_wallets` (`CandidateWallet`)**:
   - `id` (PK), `address`, `chain`, `discovery_source`, `discovery_vasp_name`, `discovery_vasp_address`, `discovered_from_tx_hash`, `transaction_count`, `token_transfers_count`, `unique_counterparties_count`, `usdt_volume`, `usdc_volume`, `total_volume_usd`, `first_activity`, `latest_activity`, `active_days`, `reachable_vasps_json`, `min_hop_to_vasp`, `candidate_quality_score`, `status`, `rejection_reason`.

*Note for Phase 4:* Schemas for `users`, `cases`, and append-only `audit_log` are not yet declared and will be added during Phase 4.

---

### 2.3 Existing API Endpoints (`backend/app/api/v1/router.py`)

| Method | Path | Summary / Description |
|---|---|---|
| `POST` | `/api/v1/analyze` | Initiates asynchronous 3-hop VASP attribution analysis on suspect wallet |
| `GET` | `/api/v1/analysis/{analysis_id}` | Polls status of active analysis run (QUEUED, ANALYZING, COMPLETED) |
| `GET` | `/api/v1/analysis/{analysis_id}/graph` | Retrieves Cytoscape-formatted nodes and edges for graph visualization |
| `GET` | `/api/v1/analysis/{analysis_id}/attributions` | Returns ranked VASP attribution candidate scores and confidence levels |
| `GET` | `/api/v1/analysis/{analysis_id}/evidence` | Returns structured chain-of-custody evidence items with hop distances |
| `GET` | `/api/v1/analysis/{analysis_id}/transactions` | Returns normalized transactions with FIFO taint annotations |
| `GET` | `/api/v1/analysis/{analysis_id}/report` | Generates standardized Section 65B court-admissible JSON report |
| `GET` | `/api/v1/analysis/{analysis_id}/freeze-notice` | Generates legal freeze notice under Section 91 CrPC / Section 94 BNSS |
| `GET` | `/api/v1/analysis/{analysis_id}/pdf` | Downloads formal publication-quality A4 PDF investigation dossier |
| `GET` | `/api/v1/ncrp/cases` | Fetches simulated NCRP (National Cyber Crime Reporting Portal) complaints |
| `GET` | `/api/v1/vasps/stats` | High-level statistics on indexed VASP clusters (1,595 addresses, 14 VASPs) |
| `GET` | `/api/v1/vasps/addresses` | Paginated search of verified VASP address registry |
| `GET` | `/api/v1/vasps` | List of supported VASP entities with FIU-IND registration status |
| `GET` | `/api/v1/recent` | Recent investigation analysis runs |
| `GET` | `/api/v1/health` | Service health status and supported blockchain networks |
| `GET` | `/api/v1/ml/evaluation` | Model accuracy, precision, recall, ROC-AUC metrics |
| `GET` | `/api/v1/ml/status` | Current ML inference model status and training metadata |
| `GET` | `/api/v1/ml/data-readiness` | Audit metrics for ML feature dataset readiness |
| `GET` | `/api/v1/data/ingestion-status` | Real-time status of continuous blockchain data ingestion |
| `GET` | `/api/v1/data/quality-report` | Data completeness and validation audit report |
| `POST` | `/api/v1/data/start-ingestion` | Starts background VASP counterparty transaction miner |
| `POST` | `/api/v1/data/stop-ingestion` | Stops background ingestion worker |
| `GET` | `/api/v1/candidates` | Paginated candidate suspect wallets discovered from VASP flows |
| `GET` | `/api/v1/candidates/stats` | Aggregate candidate wallet discovery metrics |
| `POST` | `/api/v1/candidates/discover` | Triggers on-demand candidate discovery run |

---

### 2.4 Existing UI Screens & Components (`frontend`)

#### Pages
1. **`/` (Landing Page)**: Full-featured law-enforcement presentation landing page with technical architecture, problem statement alignment, and direct "Launch Investigation Console" CTA.
2. **`/app` (Investigation Workbench)**: Unified multi-panel forensic workstation supporting address search, live graph visualization, attribution breakdown, risk score analysis, transaction ledger, and statutory reporting modals.
3. **`/docs` (Technical Documentation)**: In-browser reference for architecture, APIs, and methodology.

#### Key Interactive Components (19 Components in `frontend/components/`)
- `WalletSearch.tsx`: Multi-chain address input, automatic format detection (ETH, Tron, BTC), demo wallet presets.
- `GraphCanvas.tsx`: Cytoscape.js directed graph renderer with Dagre hierarchical layout, node risk coloring, cluster expansion, and zoom/fit controls.
- `AttributionCard.tsx`: Ranked candidate VASPs, attribution score progress bars, confidence tags (High, Medium, Low).
- `RiskCard.tsx`: Multi-signal risk gauge, threat tier (Low, Medium, High, Critical), contributing signal breakdown.
- `TimelineReplayBar.tsx`: Interactive time-slider enabling step-by-step replay of transaction propagation.
- `SankeyFlowView.tsx`: Fund-flow volume distribution diagram from suspect to intermediaries to VASP deposit wallets.
- `TransactionLedger.tsx`: Tabular ledger with transaction hash, block, timestamp, asset, amount, and FIFO taint tracking metadata.
- `ReportModal.tsx`: In-browser viewer for formal investigation intelligence reports with one-click PDF download.
- `FreezeNoticeModal.tsx`: Law enforcement asset preservation draft generator under Section 91 CrPC / Section 94 BNSS.
- `VASPRegistryModal.tsx`: Searchable database of 1,595 verified VASP addresses with FIU status and jurisdiction.
- `NCRPTriageView.tsx`: National Cyber Crime Reporting Portal complaint intake and prioritization queue.
- `CandidateDiscoveryView.tsx`: Counterparty wallet mining console with quality scores.
- `MLEvaluationModal.tsx`: Model performance dashboard (Confusion Matrix, Precision/Recall, Feature Importance).
- `DatasetStatusModal.tsx`: Data ingestion and cache quality monitoring modal.

---

## 3. Mapping Against Target Architecture (§2 of BUILD-PLAN.md)

| Target Architecture Component | Status in Baseline | Baseline Implementation Details |
|---|---|---|
| **Frontend (React/TS, React Flow / Cytoscape)** | **Fully Implemented** | Next.js 14 + Cytoscape.js + dagre layout. Includes Sankey view, timeline replay, and 19 custom components. |
| **Backend API (FastAPI)** | **Fully Implemented** | FastAPI with Pydantic validation, structured routing (`/api/v1`), CORS, and lifespan management. |
| **Async Layer (Queue + Worker)** | **Partially Implemented** | Implemented using FastAPI `BackgroundTasks` + in-memory cache. Celery/Redis queue from §2 not yet wired; in-memory background worker handles trace execution. |
| **Streaming Updates (WebSocket/SSE)** | **Partially Implemented** | Polling via `GET /analysis/{id}` is active; SSE/WebSocket streaming of partial hops is ready to be added in Phase 2. |
| **Chain Adapters (BTC, EVM, Tron)** | **Substantially Implemented** | `EtherscanProvider` (EVM v2 unified), `TronProvider` (TronGrid Pro), `BitcoinProvider` (Blockstream.info), and `BlockchainProviderFactory` (supports ETH, Tron, BTC, Polygon, BSC, Arbitrum). |
| **Graph DB (Neo4j)** | **Alternative in Baseline** | In-memory NetworkX `MultiDiGraph` is currently used for BFS and shortest-path calculation. Neo4j Community instance and Cypher queries can be layered alongside. |
| **Label Store** | **Substantially Implemented** | Curated master VASP registry (1,595 verified addresses across 14 exchanges). OFAC SDN and GraphSense open TagPacks can be ingested as additional seed feeds. |
| **Clustering & Heuristics** | **Substantially Implemented** | 11 formal typology signals in `RiskClassifier` with 4 bounded category caps and anti-double-counting; deterministic FIFO taint tracking engine in `FIFOTaintEngine`. |
| **Risk Scoring Engine** | **Substantially Implemented** | Rule-based explainable multi-signal risk scorer + trained Scikit-Learn model (`vasp_ranker_v1.joblib`). |
| **LLM Narrative Generator** | **Partially Implemented** | Rule-based report generation and Section 65B certificate generation implemented; direct Claude API prompt integration for free-text narrative drafting pending (Phase 5). |
| **Persistence (Relational DB)** | **Substantially Implemented** | SQLite via SQLAlchemy async (`crypto_trace.db`), easily switchable to PostgreSQL via `DATABASE_URL`. |
| **Case Management & Auth** | **Not Started** | Database tables for `users`, `cases`, and append-only `audit_log` to be created in Phase 4. |
| **Mock SAHYOG / VASP Directory** | **Substantially Implemented** | 14 VASPs with compliance contacts, FIU-IND registration numbers, and Section 91 CrPC notice generator implemented; mock dispatch endpoint to be added in Phase 6. |

---

## 4. Reusability & Extension Strategy

### 4.1 Reused As-Is
- **FastAPI Core Application:** Lifespan startup, configuration loading, database engine initialization.
- **Frontend Workbench:** The Cytoscape visualization, Sankey view, Timeline replay, and modals in `frontend/components/` will be preserved and wired directly to the evolving backend pipeline.
- **Master VASP Registry:** The 1,595 verified addresses across 14 exchanges (`data/vasp/vasp_addresses_master.csv`) and in-memory O(1) matcher (`VASPMatcher`).
- **Chain Adapters:** `EtherscanProvider`, `TronProvider`, and `BitcoinProvider` in `backend/app/services/blockchain/`.
- **Forensic PDF Generator:** Publication-grade ReportLab PDF generation in `backend/app/services/reporting/pdf_generator.py`.
- **FIFO Taint Engine:** Deterministic taint propagation accounting in `backend/app/services/attribution/fifo_taint.py`.

### 4.2 Extended
- **`backend/app/core/config.py` & `.env.example`:** Extended with placeholders for Neo4j, Claude API, Bitquery, Blockchair, and JWT auth to ensure no future phase blocks on missing environment variables.
- **Clustering & Heuristics:** Augment Bitcoin common-input-ownership clustering and transaction sweep detection.
- **Label Store:** Add automated parsers for OFAC SDN crypto address list and GraphSense TagPacks.
- **Trace Orchestration:** Add Server-Sent Events (SSE) or WebSocket push for real-time hop streaming.

### 4.3 Net-New (To Build in Later Phases)
- **Phase 1:** Stand up Neo4j Community (Docker) schema and Cypher shortest-path ingestion script as an optional alternative graph engine alongside NetworkX.
- **Phase 2:** Multi-hop trace async streaming endpoint (`GET /api/v1/trace/{id}/stream`).
- **Phase 4:** User authentication (JWT/RBAC), Case Management schema (`cases`, `users`), and append-only `audit_log` table and middleware.
- **Phase 5:** Anthropic Claude API prompt pipeline for automated plain-English narrative drafting.
- **Phase 6:** `POST /cases/{id}/disclosure-request` mock SAHYOG dispatch action and UI status indicator.
- **Phase 8:** Curated demo script (`DEMO_SCRIPT.md`) and pre-warmed offline cache hardening.

---

## 5. Phase-by-Phase Readiness Checklist

- [x] **Phase 0 — Baseline Audit & Environment Setup**
  - [x] Repo inventory completed.
  - [x] Target architecture §2 mapped.
  - [x] Baseline boot verified (Docker compose healthy on ports 8000 & 3000).
  - [x] `.env.example` contract defined with all external API keys.
  - [x] `docs/BASELINE_AUDIT.md` created.
- [ ] **Phase 1 — Data Foundations: Chain Adapters + Graph Ingestion + Seed Labels**
  - [x] Chain adapters for EVM, Tron, Bitcoin implemented.
  - [x] 1,595 VASP seed labels indexed.
  - [ ] Stand up Neo4j Community instance and Cypher shortestPath query.
  - [ ] Ingestion script connecting seed address -> live adapters -> graph DB -> label matching.
- [ ] **Phase 2 — Trace Orchestration (Multi-Hop, Async)**
  - [x] 3-hop bounded BFS implemented with node explosion caps.
  - [ ] Async job queue (Celery/Redis or enhanced background runner) with `job_id`.
  - [ ] WebSocket / SSE streaming of partial hops as they resolve.
  - [ ] Rate-limit caching layer in front of explorer APIs.
- [ ] **Phase 3 — Clustering Heuristics & Risk Scoring**
  - [x] 11 formal risk typology signals implemented with 4 bounded category caps.
  - [x] Anti-double-counting architecture.
  - [x] FIFO taint tracking engine implemented.
  - [x] Scikit-learn VASP ranker trained.
  - [ ] Bitcoin common-input-ownership cluster expansion.
- [ ] **Phase 4 — Case Management, Auth, Audit Trail**
  - [ ] Postgres/SQLite schema for `users`, `cases`, `audit_log`.
  - [ ] JWT authentication with `investigator` and `supervisor` roles.
  - [ ] Audit log middleware recording every trace, export, and notice action.
  - [ ] Case CRUD API endpoints (`/cases`, `/cases/{id}`).
- [ ] **Phase 5 — LLM Narrative & Report Generation**
  - [x] ReportLab publication-quality PDF generator with Section 65B certificate.
  - [x] Standardized Section 91 CrPC / Section 94 BNSS freeze notice template.
  - [ ] Claude API integration for dynamic plain-English investigative narrative.
  - [ ] LLM draft lawful disclosure request generator.
- [ ] **Phase 6 — Mock SAHYOG / VASP Directory**
  - [x] VASP directory with 14 exchanges, FIU registrations, compliance contacts.
  - [ ] `POST /cases/{id}/disclosure-request` simulated routing action.
  - [ ] Explicit "Simulated Integration" UI badge.
- [ ] **Phase 7 — Frontend Dashboard**
  - [x] Next.js 14 dashboard with Cytoscape.js interactive graph.
  - [x] Multi-panel layout: Search, Attribution Card, Risk Card, Sankey, Ledger.
  - [x] Report, Freeze Notice, VASP Registry, and ML Evaluation modals.
  - [ ] End-to-end integration with Case Management and live streaming hops.
- [ ] **Phase 8 — Demo Hardening & Polish**
  - [x] Pre-cached transactions in `data/cache/transactions` for offline fallback.
  - [ ] Curated `DEMO_SCRIPT.md` with tested demo addresses.
  - [ ] Explicit "Demo Mode" vs "Live Mode" toggle.

---

## 6. Environment Boot Verification Log

```bash
$ docker compose ps
NAME                 IMAGE                  COMMAND                  SERVICE    CREATED       STATUS                 PORTS
sudarshan-backend    cryptotrace-backend    "uvicorn backend.app…"   backend    4 hours ago   Up 4 hours (healthy)   0.0.0.0:8000->8000/tcp, [::]:8000->8000/tcp
sudarshan-frontend   cryptotrace-frontend   "docker-entrypoint.s…"   frontend   4 hours ago   Up 4 hours             0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp

$ curl.exe -s http://localhost:8000/api/v1/health
{"status":"healthy","service":"SIH VASP Attribution Intelligence Backend","supported_chains":["Ethereum Mainnet","Tron Network (TRC-20)","Bitcoin (BTC)","Polygon (MATIC)","BSC (BNB)","Arbitrum"],"indexed_vasp_addresses":1595,"max_hops":3}

$ curl.exe -I -s http://localhost:3000
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

---

## 7. Definition of Done Evaluation (Phase 0)

| Requirement | Acceptance Criterion | Verification Status |
|---|---|---|
| 1. Baseline Audit Document | `docs/BASELINE_AUDIT.md` created with inventory & mapping | **PASS** (Created) |
| 2. Development Environment | App boots and responds on HTTP endpoints | **PASS** (Backend healthy on :8000, Frontend on :3000) |
| 3. Environment Variable Contract | `.env.example` contains placeholders for all external keys | **PASS** (Defined for Etherscan, TronGrid, Blockchair, Bitquery, Neo4j, Claude, JWT) |

**Phase 0 is complete.** Checkpointed per `docs/BUILD-PLAN.md` and `AGENTS.md`.
