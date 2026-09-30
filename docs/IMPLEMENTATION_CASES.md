# 📋 SETU 2.0: Master Implementation Cases & Vibe Coding Playbook

> **Target Project:** Real-Time Cross-Chain VASP Attribution & Forensic Engine for Indian Law Enforcement
> **Repository Location:** `setu/`
> **Target Problem Statement:** SIH PS 26182 (Automated Attribution of Unknown Wallets to Nearest VASPs)
> **Development Environment:** Dual Lenovo Laptops (AMD Ryzen 7 / Intel Core i5 HX + Dual RTX 3050 6GB)

---

## 🧭 How to Use This Playbook

Each **Case** below is an independent, end-to-end engineering sprint. You can prompt the AI agent case-by-case:

> *"Let's do Case 1 now."* $\rightarrow$ The agent executes Case 1, runs tests, and confirms completion before moving to Case 2.

Every Case specifies:

1. **Objective & Forensic Purpose**
2. **Open-Source Datasets / Free APIs to Ingest**
3. **Vibe Coding Tasks (Backend, Database, Frontend)**
4. **Target Files to Modify or Create**
5. **Automated Verification & Test Commands**

---

## 📑 Summary of All Implementation Cases

|     Case ID     | Title                                                          | Primary Category         | Complexity | Target Files                                                      |
| :--------------: | :------------------------------------------------------------- | :----------------------- | :--------: | :---------------------------------------------------------------- |
| **CASE 1** | **VASP & Threat Intelligence Scaling (15k+ Labels)**     | Data & Memory Engine     |   Medium   | `data/labels/`, `backend/app/services/vasp/`                  |
| **CASE 2** | **Visual FIFO Taint Tracking (Chainalysis Taint Meter)** | Forensic Accounting      |   Medium   | `backend/app/services/attribution/`, `frontend/components/`   |
| **CASE 3** | **Active Cross-Chain Bridge Continuity**                 | Multi-Rail Routing       |    High    | `backend/app/services/bridge/`, `backend/app/services/trace/` |
| **CASE 4** | **Bulk NCRP 1930 CSV Batch Triage & Flight-Risk Queue**  | LEA Operational Portal   |   Medium   | `backend/app/api/v1/cases.py`, `frontend/components/`         |
| **CASE 5** | **One-Click Judicial Court Dossier (.ZIP Export)**       | Statutory Evidence & PDF |   Medium   | `backend/app/services/reporting/`, `frontend/components/`     |
| **CASE 6** | **Live INR Asset Valuation & Multi-Currency Engine**     | Financial Forensics      |  Low-Med  | `backend/app/services/valuation/`, `frontend/`                |

---

```
                                  SYSTEM ARCHITECTURE & CASE DEPENDENCIES
                                
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                   CASE 1: VASP & Threat Intelligence Master Registry                   │
   │           (15,000+ Verified Clusters: CEXs, Instant Swaps, Phishing Blacklists)        │
   └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                               │
                                               ▼
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                  CASE 2: FIFO Taint Engine & Forensic Balance Accounting               │
   │               (Calculates exact dirty/stolen funds vs clean balances per hop)          │
   └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                               │
                                               ▼
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                  CASE 3: Active Cross-Chain Bridge Continuity Engine                   │
   │              (Follows stolen funds across Wormhole, Stargate, and Across rails)        │
   └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                               │
                                               ▼
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                  CASE 4: Bulk NCRP 1930 Helpline Batch Ingestion & Triage              │
   │                 (Automated flight-risk sorting of 50 complaints in seconds)            │
   └───────────────────────────────────────────┬────────────────────────────────────────────┘
                                               │
                                               ▼
   ┌────────────────────────────────────────────────────────────────────────────────────────┐
   │                  CASE 5: One-Click Judicial Court Dossier (.ZIP Package)               │
   │        (Section 91 CrPC Order PDF + Section 65B Cert + SVG Graph + INR Ledger CSV)     │
   └────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📂 CASE 1: VASP & Threat Intelligence Scaling (15k+ Labels)

### 1. Objective & Forensic Purpose

Expand the system's detection capability from 1,600 addresses to over **15,000+ verified addresses**, enabling instant $O(1)$ identification of:

- Major global and Indian centralized exchanges (Binance, WazirX, CoinDCX, Coinbase, Kraken, OKX).
- **Non-KYC Instant Swap Desks** (FixedFloat, ChangeNOW, SimpleSwap, SideShift) — the #1 evasion tool used by Indian cyber fraudsters.
- **ScamSniffer Web3 Blacklist** (phishing drainers and known scammer infrastructure).

### 2. Open-Source Datasets to Ingest

- **`scamsniffer/scam-database` (GitHub raw):** `blacklist/address.json` (1,300+ phishing drainers).
- **`brianleect/etherscan-labels` (GitHub raw):** High-confidence exchange deposit and hot wallet lists.
- **Instant Non-KYC Swap Registry:**
  - **FixedFloat** (`compliance@fixedfloat.com`, `support@fixedfloat.com`)
  - **ChangeNOW** (`compliance@changenow.io`, `support@changenow.io`)
  - **SimpleSwap** (`support@simpleswap.io`)
  - **SideShift.ai** (`compliance@sideshift.ai`)

### 3. Vibe Coding Tasks

- [ ] Create `scripts/ingest_open_threat_intel.py` to stream and parse raw GitHub datasets without memory leaks.
- [ ] Normalize all addresses using `backend.app.core.address_validator` (EIP-55 checksumming for ETH, Base58Check for Tron).
- [ ] Update `backend/app/services/vasp/matcher.py` with multi-category indexing (`CENTRALIZED_EXCHANGE`, `INSTANT_SWAP_NON_KYC`, `SANCTIONED_ENTITY`, `PHISHING_DRAINER`).
- [ ] Extend `data/vasp/vasp_addresses_master.csv` with source provenance and confidence scores.
- [ ] Ensure in-memory lookup takes $< 1\text{ ms}$ and consumes $< 60\text{ MB}$ of RAM.

### 4. Target Files

- `scripts/ingest_open_threat_intel.py` (New)
- `data/labels/scamsniffer_blacklist.json` (New)
- `data/vasp/vasp_addresses_master.csv` (Modify)
- `backend/app/services/vasp/matcher.py` (Modify)
- `tests/unit/test_vasp_expansion.py` (New)

### 5. Verification Command

```bash
pytest tests/unit/test_vasp_expansion.py -v
```

---

## 📂 CASE 2: Visual FIFO Taint Tracking (Chainalysis Taint Meter)

### 1. Objective & Forensic Purpose

Solve the classic criminal defense: *"My client's wallet had legitimate funds; he didn't send the victim's money."*
Implement **First-In, First-Out (FIFO) Taint Accounting** to mathematically prove the exact percentage of dirty stolen money on every transaction edge and destination exchange deposit.

### 2. Open-Source Concepts Used

- Traditional financial forensics FIFO ledger balancing adapted to directed acyclic blockchain transaction graphs (DAGs).

### 3. Vibe Coding Tasks

- [ ] Integrate existing `backend/app/services/attribution/fifo_taint.py` into the main API trace pipeline (`/api/v1/trace` & `/api/v1/analyze`).
- [ ] Annotate every graph edge in the response payload with:
  - `traceable_amount` (volume of proven victim funds)
  - `unclassified_amount` (clean/co-mingled funds)
  - `taint_ratio` (percentage from $0.0$ to $1.0$)
- [ ] Update Next.js Frontend Cytoscape Canvas:
  - Color-code edges: Red = High Taint ($> 70\%$), Amber = Moderate Taint, Grey = Clean.
  - Show Edge Tooltip with exact breakdown: `Stolen Funds: 4.25 ETH (85%) | Clean Funds: 0.75 ETH (15%)`.
- [ ] Add a **Forensic Taint Summary Card** to the UI:
  - Total Victim Outflow vs. Total Proven Funds Reaching VASP.

### 4. Target Files

- `backend/app/api/v1/router.py` (Modify)
- `backend/app/schemas/analysis.py` (Modify)
- `frontend/components/GraphCanvas.tsx` (Modify)
- `frontend/components/AttributionCard.tsx` (Modify)
- `tests/unit/test_fifo_taint_integration.py` (New)

### 5. Verification Command

```bash
pytest tests/unit/test_fifo_taint_integration.py -v
```

---

## 📂 CASE 3: Active Cross-Chain Bridge Continuity

### 1. Objective & Forensic Purpose

Break through the biggest barrier in crypto investigation: **DeFi Bridges**.
When criminals swap funds from Ethereum to Tron or Polygon via **Stargate (LayerZero)**, **Across Protocol**, or **Wormhole**, other tools stop at the smart contract. SETU automatically identifies the bridge event, extracts the recipient address on the destination chain, and continues tracing across rails seamlessly.

### 2. Open-Source APIs & Contract Registries

- Verified bridge contract registry in `backend/app/services/bridge/detector.py`:
  - Wormhole Portal (`0x3ee18b22...`)
  - Stargate Finance Router (`0x8731d54e...`)
  - Across Protocol SpokePool (`0x5c7bc363...`)
- DefiLlama Free Bridges API (`https://bridges.llama.fi`) for live protocol telemetry.

### 3. Vibe Coding Tasks

- [ ] Wire `BridgeDetector` into `backend/app/services/trace/` graph construction worker.
- [ ] When an outgoing transaction interacts with a known bridge contract:
  - Decode transaction input logs to extract: `destination_chain` and `recipient_address`.
  - Create a distinctive `BRIDGE_NODE` on the graph with a bridge icon.
- [ ] If the destination chain is supported (Ethereum, Tron, Bitcoin, Polygon), spawn an automatic child trace on the destination rail.
- [ ] Surface a **Cross-Chain Bridge Alert Banner** in the UI with source tx, destination tx, and target recipient.

### 4. Target Files

- `backend/app/services/bridge/detector.py` (Modify)
- `backend/app/services/trace/orchestrator.py` (Modify)
- `frontend/components/GraphCanvas.tsx` (Modify)
- `tests/unit/test_bridge_continuity.py` (New)

### 5. Verification Command

```bash
pytest tests/unit/test_bridge_continuity.py -v
```

---

## 📂 CASE 4: Bulk NCRP 1930 CSV Batch Triage & Flight-Risk Queue

### 1. Objective & Forensic Purpose

Equip Cyber Police Stations with an operational command center to handle 50+ fraud complaints simultaneously from the National Cyber Crime Reporting Portal (NCRP Helpline 1930) and prioritize wallets based on **flight risk**.

### 2. Open-Source Reference

- Official NCRP / I4C CSV complaint export format:
  - `Acknowledgement_Number`
  - `Complainant_Name`
  - `Incident_Date`
  - `Defrauded_Amount_INR`
  - `Suspect_Crypto_Address`
  - `Crime_Subcategory` (e.g. Digital Arrest, Part-time Task Fraud, Fake Trading App)

### 3. Vibe Coding Tasks

- [ ] Build backend endpoint `POST /api/v1/ncrp/batch-triage` accepting CSV file uploads.
- [ ] Implement an asynchronous background worker evaluating complaints in parallel:
  - Trace each address to Hop 1 & Hop 2.
  - Compute **Flight-Risk Priority Score ($0 - 100$)**:
    - **CRITICAL (Score $\ge 80$):** Funds moved into an Indian FIU-registered VASP (WazirX, CoinDCX) within the last 48 hours $\rightarrow$ Immediate asset freeze possible!
    - **HIGH (Score $60 - 79$):** Funds deposited into international CEX or instant swap desk.
    - **MEDIUM (Score $40 - 59$):** Funds still sitting in unhosted intermediate wallets.
    - **COLD (Score $< 40$):** Inactive or dead wallet.
- [ ] Build a frontend **"NCRP Triage Center"** tab:
  - Drag-and-drop CSV upload zone.
  - Sortable, filterable priority table with urgency badges (🔴 Urgent Freeze, 🟡 Active Trace, ⚪ Cold).
  - One-click **"Escalate to Live Canvas"** button loading the suspect wallet directly into the interactive graph.

### 4. Target Files

- `backend/app/api/v1/cases.py` (Modify)
- `backend/app/schemas/cases.py` (Modify)
- `frontend/app/app/page.tsx` (Modify)
- `frontend/components/NcrpBatchTriage.tsx` (New)
- `tests/unit/test_ncrp_batch_triage.py` (New)

### 5. Verification Command

```bash
pytest tests/unit/test_ncrp_batch_triage.py -v
```

---

## 📂 CASE 5: One-Click Judicial Court Dossier (.ZIP Export)

### 1. Objective & Forensic Purpose

Transform forensic graph data into a complete, legally admissible **Judicial Evidence Package** that a police officer can immediately print, sign, and present before a Magistrate under Indian Law (**Section 91 CrPC / Section 94 BNSS** and **Section 65B Indian Evidence Act**).

### 2. Open-Source Libraries Used

- **`reportlab` (Python):** Already installed! Vector PDF canvas generation with table layouts.
- **`zipfile` (Python Standard Library):** In-memory multi-file archive compilation.

### 3. Vibe Coding Tasks

- [ ] Build endpoint `GET /api/v1/cases/{id}/export-dossier` returning a comprehensive `.zip` archive containing 5 synchronized assets:
  1. **`01_CrPC_Section_91_Seizure_Notice.pdf`**:
     - Formal statutory requisition addressed to the designated VASP Nodal Grievance Officer.
     - Auto-populated FIR number, Police Station header, Investigating Officer name, and exact wallet deposit parameters.
  2. **`02_Section_65B_Evidence_Certificate.pdf`**:
     - Formal digital evidence certificate under Section 65B Indian Evidence Act / Section 63 BSA 2023.
     - Embedded SHA-256 integrity hash and dynamic QR verification code.
  3. **`03_Forensic_Graph_Topography.svg`**:
     - Vector visualization of the multi-hop fund flow suitable for courtroom projection.
  4. **`04_Transaction_Ledger_Audit.csv`**:
     - Complete tabular ledger of all crawled hops, block timestamps, tx hashes, and converted INR / USD valuations.
  5. **`05_Case_Diary_Investigative_Narrative.txt`**:
     - Plain-English legal narrative ready to copy-paste into the official Police Case Diary.
- [ ] Add a **"Download Court Dossier (.ZIP)"** button with loading progress in the Next.js header and legal action drawer.

### 4. Target Files

- `backend/app/services/reporting/dossier_service.py` (New)
- `backend/app/api/v1/cases.py` (Modify)
- `frontend/components/LegalNoticeModal.tsx` (Modify)
- `tests/unit/test_dossier_export.py` (New)

### 5. Verification Command

```bash
pytest tests/unit/test_dossier_export.py -v
```

---

## 📂 CASE 6: Live INR Asset Valuation & Multi-Currency Engine

### 1. Objective & Forensic Purpose

In Indian courtrooms, judges and police officers do not think in "Gwei" or "0.045 ETH". They need to know: **"How many Indian Rupees (₹) were stolen, and how much is sitting in the suspect wallet right now?"**

### 2. Open-Source Free API

- **CoinGecko Simple Price API:** Free endpoint `https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,tether&vs_currencies=usd,inr`.

### 3. Vibe Coding Tasks

- [ ] Connect existing `backend/app/services/valuation/price_service.py` with in-memory 15-minute price caching.
- [ ] Automatically calculate live **₹ INR** and **$ USD** amounts for all wallet balances and transaction edges.
- [ ] Surface INR values prominently across the UI (e.g. `12.5 USDT (₹1,098.50 INR)`).
- [ ] Include total defrauded amount and recoverable amount in INR directly on the Section 91 CrPC legal notice.

### 4. Target Files

- `backend/app/services/valuation/price_service.py` (Modify)
- `backend/app/schemas/analysis.py` (Modify)
- `frontend/components/WalletOverview.tsx` (Modify)
- `tests/unit/test_price_service.py` (New)

### 5. Verification Command

```bash
pytest tests/unit/test_price_service.py -v
```

---

## 🏁 Execution Protocol

Whenever you are ready to begin, simply tell me:

- **`"Let's execute Case 1"`** $\rightarrow$ Starts VASP & Threat Intelligence Scaling.
- **`"Let's execute Case 2"`** $\rightarrow$ Starts FIFO Taint Engine integration.
- **`"Let's execute Case 3"`** $\rightarrow$ Starts Cross-Chain Bridge Continuity.
- **`"Let's execute Case 4"`** $\rightarrow$ Starts NCRP 1930 Bulk Triage Queue.
- **`"Let's execute Case 5"`** $\rightarrow$ Starts One-Click Judicial Court Dossier (.ZIP).
- **`"Let's execute Case 6"`** $\rightarrow$ Starts Live INR Asset Valuation.
