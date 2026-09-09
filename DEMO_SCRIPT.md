# Evaluator Walkthrough & Live Demo Script

**Project:** CryptoTrace — Real-Time Cross-Chain VASP Attribution & Forensic Engine  
**Target Audience:** Hackathon Evaluators, Jury Panels, Law Enforcement Cyber Cells  
**Total Run Time:** 3 – 5 Minutes

---

## ⚡ Zero-Failure Evaluator Guarantee
- **Demo Mode Active by Default:** When `DEMO MODE` is enabled in the top navigation bar, all benchmark queries execute in **< 150ms** using pre-warmed verified on-chain data (77,447 real transactions across Ethereum, Bitcoin, and Tron). No external API keys or network latency can fail the demo.
- **Toggle Live RPC Anytime:** Switch the top bar toggle to `🌐 LIVE RPC` to demonstrate live, on-the-fly multi-rail blockchain queries against Ethereum Mainnet, TronGrid, and Bitcoin Mempool.

---

## 🧭 Step-by-Step Live Demo (5-Minute Script)

### Step 1: Launch the Workspace & Authenticate
1. Open the investigation console at [http://localhost:3000/app](http://localhost:3000/app).
2. The UI automatically authenticates as **Cyber Crime Investigating Officer** (`investigator`).
3. **Talking Point:** *"Notice the Role-Based Access Control badge at the top right. Investigating Officers can trace wallets, triage NCRP complaints, and generate draft seizure notices. Supervisors have sole statutory authority to sign and issue Section 91 CrPC freeze orders."*

---

### Step 2: Test Case 1 — Direct VASP Deposit (Binance Hot Wallet)
1. Click the **"Binance Hot Wallet"** benchmark pill above the search bar:
   - Address: `0x28C6c06298d514Db089934071355E5743bf21d60`
2. Click **"Run Multi-Hop Trace"**.
3. **Expected Output:**
   - **Attribution Card:** Identifies `Binance` with **100.0% Confidence** (Tier-1 FIU-IND Registered VASP).
   - **Clustering Heuristic:** Sweep consolidation pattern detected; direct counterparty clustering.
   - **Interactive Graph:** Visualizes deposit fan-in and hot wallet consolidation nodes.
4. **Talking Point:** *"In less than a second, our clustering engine correlates multi-hop transactions against our curated 16-entity FIU-IND VASP directory and identifies the exchange jurisdiction."*

---

### Step 3: Test Case 2 — High-Risk Peeling Chain & Mixer (WazirX $230M Exploit)
1. Click the **"WazirX $230M Hacker"** benchmark pill:
   - Address: `0x3d0246a49591A5462D42fF025b6a3F2169E66e2c`
2. Set Max Hops to **3** and click **"Run Multi-Hop Trace"**.
3. **Expected Output:**
   - **Risk Score:** **88.5 / 100 (CRITICAL RISK)** with red pulsing badge.
   - **Evidence Feed:** Flags `OFAC Sanctioned Entity / Mixer Interaction`, `Peeling Chain Pattern`, and `Rapid Liquidation`.
   - **Interactive Graph:** Demonstrates multi-hop fund dispersal toward Tornado Cash and unhosted intermediary hops.
4. **Talking Point:** *"The engine flags peeling chains where small chunks are systematically peeled off before mixing. This triggers automatic risk elevation under our ML and rule-based hybrid scoring model."*

---

### Step 4: Test Case 3 — Cross-Chain Multi-Rail Ingestion (Tron TRC-20 & Bitcoin UTXO)
1. Click the **"Binance Tron Hot Wallet"** benchmark pill:
   - Address: `TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR` (Tron TRC-20 USDT)
   - Demonstrates Tron multi-hop tracing and TRC-20 smart contract transfer normalization.
2. Click the **"Binance Cold Storage BTC"** benchmark pill:
   - Address: `34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo` (Bitcoin UTXO)
   - Demonstrates multi-input UTXO clustering heuristic grouping common co-spenders into a single entity.
3. **Talking Point:** *"Most forensic tools are single-rail. CryptoTrace seamlessly normalizes account-based Ethereum/Tron transactions and UTXO-based Bitcoin spends into a unified forensic graph."*

---

### Step 5: Statutory Compliance & Legal Action (CrPC Section 91 / BSA 2023)
1. From the investigation workspace, click **"Legal Action (CrPC 91)"**.
2. Review the auto-populated formal legal notice addressed to the Nodal Grievance Officer of the attributed VASP (Binance India / WazirX).
3. Switch role to **Supervisor** (`supervisor:supervisor123`) using the top right role badge.
4. Click **"Sign & Issue Seizure Order"** — the notice receives a SHA-256 cryptographic signature, audit trail entry, and exportable Court Evidence PDF.
5. **Talking Point:** *"Our notices strictly adhere to Section 91 of the Code of Criminal Procedure (and Bharatiya Nagarik Suraksha Sanhita 2023), complete with digital chain of custody certificates under Section 65B of the Indian Evidence Act."*

---

### Step 6: NCRP 1930 Cyber Fraud Triage & Bulk Intake
1. Click the **"NCRP Triage"** tab in the top navigation bar.
2. Select a simulated NCRP fraud ticket (e.g., *Part-time Task Fraud* or *Digital Arrest Impersonation*).
3. Click **"Escalate & Trace Suspect Wallet"** — instantly loads the suspect wallet into the live forensic canvas with case cross-referencing.
4. **Talking Point:** *"Investigating officers receive thousands of complaints via the National Cyber Crime Reporting Portal (1930). CryptoTrace can ingest NCRP CSV batches and triage highest-risk flight-risk wallets within seconds."*

---

## 📊 Summary of Benchmark Test Targets

| Target Preset | Address | Chain | Key Forensic Discovery |
| :--- | :--- | :--- | :--- |
| **Binance Hot Wallet** | `0x28C6c06298d514Db089934071355E5743bf21d60` | Ethereum | 100% VASP Attribution, Hot Wallet fan-out |
| **Coinbase Hot Wallet 2**| `0xA090e606E30bD747d4E6245a1517EbE430F0057e` | Ethereum | US-domiciled VASP clustering, Settlement Node |
| **Tornado Cash Router**| `0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b` | Ethereum | OFAC Sanctioned Mixer, 95.0 Critical Risk |
| **WazirX $230M Hacker** | `0x3d0246a49591A5462D42fF025b6a3F2169E66e2c` | Ethereum | 88.5 Risk, Exploit Peeling Chain, Mixer Path |
| **Binance Tron Hot** | `TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR` | Tron | TRC-20 USDT Sweep Consolidation |
| **Binance Cold BTC** | `34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo` | Bitcoin | UTXO Multi-Input Co-Spending Heuristic |

---

## ⚖️ Hackathon Ethics & Technical Boundaries
- **No Fabricated Data:** Every transaction in the demo cache represents real historical data mined directly from public blockchain ledgers.
- **No Mock SAHYOG Claims:** Clearly marked as an architectural reference implementation aligned with Indian LEA operational workflows.
- **Zero Privacy Violation:** Does not claim impossible deanonymization of zero-knowledge privacy coins (e.g. Monero) or unhosted sovereign keys.
