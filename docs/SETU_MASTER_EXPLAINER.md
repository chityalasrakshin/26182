# 🔍 SETU (SETU) — Master Project Guide & Forensic Blueprint
> **A Comprehensive, Beginner-Friendly, Deep-Dive Explainer for Problem Statement 26182**  
> *Target Problem: Automated Attribution of Unknown Cryptocurrency Wallets to Nearest Virtual Asset Service Providers (VASPs) through Blockchain Intelligence APIs*

---

## 📑 Table of Contents
1. [The Real-World Story: What Is Happening in Reality?](#1-the-real-world-story-what-is-happening-in-reality)
2. [Crypto & Blockchain 101: Zero-Jargon Fundamentals](#2-crypto--blockchain-101-zero-jargon-fundamentals)
3. [What Was Happening Before? (The Police Nightmare)](#3-what-was-happening-before-the-police-nightmare)
4. [Deconstructing Problem Statement 26182: What Did They Ask?](#4-deconstructing-problem-statement-26182-what-did-they-ask)
5. [What We Built: SETU (The Target & The Core Solution)](#5-what-we-built-setu-the-target--the-core-solution)
6. [How We Solve It: Step-by-Step Under the Hood](#6-how-we-solve-it-step-by-step-under-the-hood)
7. [The 5-Pillar Attribution Mathematical Formula](#7-the-5-pillar-attribution-mathematical-formula)
8. [The Legal Weapon: CrPC Section 91 & Section 65B Evidence](#8-the-legal-weapon-crpc-section-91--section-65b-evidence)
9. [Summary of Deliverables: What Are We Providing Them?](#9-summary-of-deliverables-what-are-we-providing-them)
10. [Quick Pitch Cheat Sheet: How to Explain This to Anyone in 2 Minutes](#10-quick-pitch-cheat-sheet-how-to-explain-this-to-anyone-in-2-minutes)

---

## 1. The Real-World Story: What Is Happening in Reality?

Imagine this everyday crime happening in India right now:

### The Scam
A school teacher in Lucknow gets a call on WhatsApp: *"We are from Mumbai Cyber Crime Branch. A parcel in your name was seized with illegal passports and narcotics. You are under Digital Arrest. Transfer ₹10 Lakhs immediately to this RBI security clearance account for verification, or we will arrest you."*

Panicked, the teacher transfers ₹10,00,000 via UPI / IMPS.

### The Crypto Laundering Loophole
1. The cyber criminals receive the ₹10 Lakhs in Indian bank accounts ("mule accounts" opened using fake IDs or bought from poor laborers).
2. The scammers quickly use that Indian money to buy cryptocurrency (like Tether USDT or Bitcoin) on peer-to-peer (P2P) markets or quick swap services.
3. Now, the money has left the Indian banking system (RBI) and is floating on the **Blockchain** as cryptocurrency in an anonymous crypto wallet.
4. The criminal knows that police might try to track them. So they don't leave the crypto sitting in one place. They immediately send it through 3 or 4 different wallets:
   - Wallet A sends to Wallet B.
   - Wallet B sends small cuts to 5 different wallets (peeling chain).
   - Some passes through a crypto mixer (a digital washing machine).
   - Finally, the clean crypto is deposited into an account at a major crypto exchange like **Binance**, **WazirX**, or **CoinDCX**.
5. Once inside the exchange, the criminal sells the crypto for cash (US Dollars, Dirhams, or Indian Rupees) and withdraws it to a foreign bank account in Dubai, Southeast Asia, or China.

**Total time taken by the criminal: 30 to 45 minutes.**

---

## 2. Crypto & Blockchain 101: Zero-Jargon Fundamentals

To understand our project, you only need to understand 4 basic concepts:

### Concept 1: What is a Blockchain?
Think of a blockchain as a **giant public digital ledger (notebook)** that is shared across thousands of computers in the world.
- Every single transaction that ever happened since day 1 is recorded in this notebook.
- Anyone can read it. It is completely public.
- **The catch:** In this notebook, people don't use names like "Ramesh Kumar" or "John Doe". They use random alphanumeric strings called **wallet addresses** (e.g., `0x7a3F9...` on Ethereum, or `TMuA6Y...` on Tron).
- This is called **pseudonymity**. You can see the money moving, but you don't know who owns the hands moving the money!

### Concept 2: What is an "Unhosted Wallet" vs. a "VASP"?
This is the single most important distinction in the entire project:

| Feature | **Unhosted (Private) Wallet** | **VASP (Centralized Exchange)** |
| :--- | :--- | :--- |
| **Everyday Analogy** | Cash hidden in a secret drawer in your bedroom. | A bank account at State Bank of India or HDFC. |
| **Examples** | MetaMask, Trust Wallet, Ledger hardware wallet. | Binance, WazirX, CoinDCX, Coinbase, Kraken. |
| **Who owns it?** | Just a user with a secret 12-word seed phrase. | A registered corporation with servers and offices. |
| **KYC (Identity)** | **Zero.** No Aadhaar, no PAN, no email, no passport. | **Mandatory KYC.** To open an account, you MUST submit PAN, Aadhaar, selfie, bank details. |
| **Can Police freeze it?**| **No!** Nobody has the password except the criminal. | **YES!** Police can send a legal order to the exchange: *"Freeze User Account #12345!"* |

> 💡 **The Revelation:**  
> Criminals love unhosted wallets because they are anonymous. But criminals cannot buy food, cars, or luxury goods using pure raw blockchain code. Eventually, to convert crypto into real spending money (Fiat currency), **they MUST deposit it into a VASP (Exchange)!**  
> **The VASP is the "Choke Point" where anonymity dies!**

### Concept 3: What is a "Hop"?
A **hop** simply means a transfer from one wallet to another:
- **0 Hops**: The suspect's starting wallet (`Wallet A`).
- **1 Hop**: `Wallet A` sends money to `Wallet B`. (Distance = 1).
- **2 Hops**: `Wallet B` sends money to `Wallet C`. (Distance = 2).
- **3 Hops**: `Wallet C` deposits money into `Binance`. (Distance = 3).

### Concept 4: What are the different "Chains" (Rails)?
Just like Indian Railways has broad gauge and metro tracks, crypto has different blockchains:
1. **Ethereum (ETH / ERC-20):** Smart contracts, addresses start with `0x...`.
2. **Tron (TRC-20):** Extremely popular in cyber scams because USDT transfer fees are almost zero. Addresses start with `T...`.
3. **Bitcoin (BTC / UTXO):** The original cryptocurrency. Uses "UTXO" (Unspent Transaction Output), which works like physical currency notes where you combine multiple bills to pay.

---

## 3. What Was Happening Before? (The Police Nightmare)

### The Old Workflow:
1. The victim files a complaint on **NCRP (Helpline 1930 / cybercrime.gov.in)**.
2. The Investigating Officer (IO) at the Cyber Crime Police Station looks at the complaint.
3. The victim provides the criminal's wallet address: e.g., `0x3d0246a49591A5462D42fF025b6a3F2169E66e2c`.
4. **The Dead End:**  
   The IO opens the Indian Government's **SAHYOG Portal**. The SAHYOG portal allows police to send notices to companies (like Binance, WazirX, WhatsApp, etc.).  
   *But which company should the IO send the notice to?*  
   The wallet address is an unhosted private wallet! There is no company called "0x3d02...". If police send a notice to WazirX asking "is this your wallet?", WazirX replies "No, we don't know this address."
5. **The Manual Agony:**  
   - The IO had to open public blockchain explorers (Etherscan, Tronscan).
   - Manually click through 50 to 200 outgoing transactions.
   - Trace each branch on a piece of paper or Excel sheet.
   - Try to guess which random address belongs to Binance, Bybit, or KuCoin.
   - Or, the police department had to wait for expensive foreign tools (Chainalysis / TRM Labs) which cost ₹40 Lakhs to ₹1 Crore a year and are not integrated with Indian police systems.
6. **The Result:**  
   By the time the police officer figured out that the money reached Binance 3 hops later, **3 weeks had passed**. The criminal had already cashed out, closed the account, and left the country. The victim's money was gone forever.

---

## 4. Deconstructing Problem Statement 26182: What Did They Ask?

The Ministry of Home Affairs (MHA) / Indian Cyber Crime Coordination Centre (I4C) released **Problem Statement 26182**:

> *"Develop an Automated Blockchain Intelligence & VASP Attribution Engine integrated with the SAHYOG Portal through APIs to automatically trace suspect cryptocurrency wallets to the nearest direct-deposit-accepting VASP / exchange, calculate confidence scores, and generate investigation-ready legal notices."*

### The Exact Requirements from the Document:
1. **Automated Analysis:** Analyze suspect wallets reported on the Sahyog / NCRP platform automatically.
2. **Nearest VASP Discovery:** Trace through intermediary hops to find the nearest centralized exchange receiving deposits.
3. **Multi-Chain Support:** Ethereum, Tron, Bitcoin, BNB, Solana, Polygon.
4. **Typology Detection:** Detect peeling chains, exchange clusters, hot/cold wallets, mixers/tumblers (Tornado Cash), bridges.
5. **Explainable Confidence Scoring:** Tell the police officer *why* we believe an address belongs to Binance (e.g., 94% confidence).
6. **Statutory LEA Reports:** Generate legal notices ready to send through the SAHYOG portal to freeze funds.

---

## 5. What We Built: SETU (The Target & The Core Solution)

We built **SETU** (codename **SETU**): an automated, real-time blockchain forensic workstation tailored specifically for Indian Law Enforcement.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                   CRIME REPORTED                        │
                    │        Victim loses ₹10 Lakhs -> Calls 1930             │
                    │       NCRP Complaint: Suspect Wallet 0x3d02...          │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SETU ENGINE                                      │
│                                                                                           │
│  1. Multi-Rail Ingestion        2. Graph Traversal             3. VASP Matching           │
│     ETH / TRON / BTC               Breadth-First Search (BFS)     1,595+ Exchange Clusters │
│     Native & Token APIs            Traces 1, 2, and 3 Hops        O(1) Instant Hash Lookup│
│                                                                                           │
│  4. AML Heuristics & ML         5. 5-Pillar Math Formula       6. Legal Generation        │
│     Peeling Chain Detection        Proximity (35%)                CrPC §91 Freeze Notice  │
│     Mixer Flagging (OFAC)          Flow Volume (25%)              IEA §65B Digital Cert   │
│     Flight Velocity Calculation    Frequency + Behav + Recency    SAHYOG Routing Codes    │
└────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                             │
                                             ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │                    ACTION IN SECONDS                    │
                    │   • Interactive Visual Graph on Screen                  │
                    │   • Attribution: "BINANCE (100% Confidence)"            │
                    │   • Pre-drafted Legal Notice to Binance Nodal Officer   │
                    │   • Funds Frozen Before Criminal Can Cash Out!          │
                    └─────────────────────────────────────────────────────────┘
```

### Who is the Target User?
1. **Cyber Police Stations (SHOs & Investigating Officers):** Non-crypto experts who need answers in 1 click.
2. **Supervisory Officers (DSPs, SPs, Cyber Commissioners):** Authorized officers who sign formal legal seizure orders.
3. **FIU-IND (Financial Intelligence Unit - India):** Tracking money laundering and black money transit across international borders.

---

## 6. How We Solve It: Step-by-Step Under the Hood

Here is the exact pipeline our software runs every time an address is investigated:

### Step 1: Input Validation & Checksum Verification
- Takes an address: Ethereum (`0x...`), Tron (`T...`), or Bitcoin (`1...`, `3...`, `bc1...`).
- Checks if the address is valid using cryptographic checksums (EIP-55 for Ethereum, Base58Check for Tron).
- Prevents typos and SQL injection attacks.

### Step 2: Multi-Rail Ingestion (Live RPC & Pre-warmed Benchmark Mode)
- **Live Mode:** Queries on-chain nodes and block explorers (Etherscan, TronGrid, Mempool.space) to fetch raw transaction history: sender, receiver, amount, timestamp, gas, token contract.
- **Demo / Evaluator Mode:** We pre-loaded **77,447 real historical transactions** across 353 verified on-chain cases. This guarantees **0ms latency** during live demos without depending on slow external internet or API rate limits.

### Step 3: Graph Traversal Engine (Breadth-First Search - BFS)
- Starting at the suspect wallet (**Hop 0**), the engine looks at all wallets it sent money to (**Hop 1**).
- Then it looks at where those wallets sent money (**Hop 2**).
- Then where those sent money (**Hop 3**).
- **Cycle Protection:** If criminals send money in circles between Wallets A, B, and C to confuse police, our visited-set algorithm detects the loop and doesn't get trapped.
- **Explosion Cap:** Limits branching to the top 50 transactions per hop so the graph doesn't explode into millions of nodes.

### Step 4: VASP Attribution & Master Directory Matching
- We compiled a curated master database of **1,595+ verified on-chain addresses** across 14 major global & Indian exchanges (Binance, WazirX, CoinDCX, ZebPay, Mudrex, Coinbase, Kraken, OKX, Huobi, Bybit, KuCoin, MEXC, Gate.io, Bitfinex).
- As the graph is built, every node is checked in $O(1)$ constant time against our VASP database.
- The moment a node matches an exchange deposit address or hot wallet, it identifies the exchange!

### Step 5: Laundering Typology & Heuristic Detection
Our system doesn't just look at addresses; it analyzes criminal behaviors:
1. **Peeling Chains (`peel_detector.py`):**  
   Criminals take 100 ETH, send 2 ETH to an exchange, and 98 ETH to a new wallet. Then from the 98 ETH, they send 2 ETH to an exchange and 96 ETH to another wallet. This looks like "peeling an onion." Our heuristic automatically detects and flags this pattern!
2. **Deposit Sweeps (`sweep_detector.py`):**  
   Exchanges assign a unique deposit address to every user. Once the user deposits money, an automated exchange script "sweeps" all user deposits into one giant central "Hot Wallet". Our engine recognizes this signature exchange behavior.
3. **UTXO Common-Input Clustering (`common_input.py`):**  
   In Bitcoin, if a transaction spends multiple input coins simultaneously, cryptographic game theory proves that all those inputs are controlled by the same person/wallet. We cluster them into a single identity.
4. **Mixer & Sanctions Detection (`ofac_sdn.json`):**  
   Cross-references US Treasury OFAC sanctions lists and known smart contracts for mixers like **Tornado Cash**. If the suspect touched a mixer, risk score jumps to **CRITICAL (88+ / 100)**.

---

## 7. The 5-Pillar Attribution Mathematical Formula

Instead of guessing or using an unreliable "black box" AI, SETU uses a transparent, explainable **5-Pillar Mathematical Formula** to calculate the Attribution Score ($S_{total}$ from $0$ to $100$):

$$S_{total} = (S_{prox} \times 0.35) + (S_{flow} \times 0.25) + (S_{freq} \times 0.20) + (S_{behav} \times 0.10) + (S_{rec} \times 0.10)$$

| Pillar | Weight | What It Measures | Why It Matters |
| :--- | :---: | :--- | :--- |
| **1. Graph Proximity ($S_{prox}$)** | **35%** | Distance in hops to the exchange: <br>• Hop 1 = 100 pts<br>• Hop 2 = 60 pts<br>• Hop 3 = 30 pts | Direct deposit to an exchange is much stronger evidence than a 3-hop distant transfer. |
| **2. Fund Flow Ratio ($S_{flow}$)** | **25%** | Percentage of the total stolen money that ended up in this exchange. | If 90% of the stolen money went to Binance and only 10% to Kraken, Binance is the primary destination. |
| **3. Interaction Frequency ($S_{freq}$)** | **20%** | Number of repeated transactions between the suspect and the exchange. | A single transfer could be an accident; 15 repeated transfers prove an active trading account. |
| **4. Behavioral Pattern ($S_{behav}$)** | **10%** | Structural consistency (e.g., sweep consolidation, hot wallet fan-out). | Verifies that the destination wallet acts like an exchange infrastructure, not an individual. |
| **5. Temporal Recency ($S_{rec}$)** | **10%** | How recent the transactions are. | Fresh transactions mean the money is likely still sitting in the exchange ready to be frozen. |

---

## 8. The Legal Weapon: CrPC Section 91 & Section 65B Evidence

Most technical tools stop at drawing pretty graph nodes. **SETU goes all the way to legal enforcement.**

In the Indian legal system, evidence must follow strict statutory procedures to be accepted in court:

### 1. Section 91 CrPC (and Section 94 BNSS 2023) — Summon to Produce Documents / Freeze
- Under **Section 91 of the Code of Criminal Procedure, 1973** (now **Section 94 of Bharatiya Nagarik Suraksha Sanhita, 2023**), an Investigating Officer has the legal power to issue a written summons to any entity demanding information or seizure of property.
- **What our system does:**  
  The moment the nearest VASP is attributed (e.g., Binance or WazirX), our system auto-populates a formal legal seizure notice addressed to:
  - The exchange's registered corporate entity name.
  - The designated **Nodal Grievance Officer** name and email.
  - The official **SAHYOG Routing Code** (e.g., `SAHYOG-VASP-BINANCE-GLB`).
  - The exact transaction hash, deposit timestamp, token amount, and target deposit address.
  - A formal statutory directive: *"Freeze all withdrawals on the account associated with deposit address `0x...` immediately under Section 91 CrPC."*

### 2. Section 65B Indian Evidence Act (and Section 63 BSA 2023) — Electronic Certificate
- In Indian courts, digital printouts or computer records are **inadmissible** unless accompanied by a certificate signed by the person in charge of the computer system, stating that the computer was operating properly and the data has not been tampered with.
- **What our system does:**  
  Every graph snapshot, transaction trace, and attribution report is hashed with **SHA-256**. The system generates a formal **Section 65B Certificate** (under the new **Bharatiya Sakshya Adhiniyam, 2023**) complete with timestamp, system hash, and verification QR code.
  Judges can admit this report in court without defense lawyers arguing evidence tampering!

### 3. Role-Based Access Control (RBAC)
- **Investigating Officer (`investigator`)**: Can trace wallets, analyze graphs, and draft notices.
- **Cyber Crime Supervisor (`supervisor`)**: Only a Gazetted Police Officer / DSP / Inspector can legally sign and authorize a seizure order under Section 91 CrPC. The supervisor logs in and cryptographically approves the order.

---

## 9. Summary of Deliverables: What Are We Providing Them?

| # | What We Built | How It Helps Law Enforcement |
| :--- | :--- | :--- |
| **1** | **Automated Multi-Hop Graph Traversal** | Replaces 2 weeks of manual clicking with a 1-second automated scan up to 3 hops deep. |
| **2** | **Multi-Rail Normalization** | Handles Ethereum (ETH/ERC-20), Tron (TRC-20 USDT), and Bitcoin (UTXO) in one unified screen. |
| **3** | **1,595+ Master VASP Registry** | Instant identification of 14 top exchanges with FIU-IND registration numbers and compliance emails. |
| **4** | **Mathematical 5-Pillar Attribution** | 100% transparent, explainable confidence score admissible in court (no AI hallucination). |
| **5** | **Forensic Typology Detection** | Automatically flags Peeling Chains, Deposit Sweeps, OFAC Sanctioned Mixers, and High Velocity. |
| **6** | **NCRP 1930 Cyber Fraud Triage** | Ingests bulk fraud tickets from the national cyber portal (Digital Arrest, Job Scams) and prioritizes high-flight-risk wallets. |
| **7** | **One-Click CrPC §91 Freeze Orders** | Ready-to-send legal notices with SAHYOG routing codes and Section 65B electronic evidence certificates. |
| **8** | **Interactive Visualization Suite** | 2D interactive Cytoscape physics graph, Sankey fund-flow waterfall, and step-by-step Time-Machine Scrubber. |
| **9** | **Zero-Failure Benchmark Mode** | 77,447 real on-chain transactions cached for instantaneous, flawless demo execution. |

---

## 10. Quick Pitch Cheat Sheet: How to Explain This to Anyone in 2 Minutes

If an evaluator, teacher, or police officer asks: *"What did you build and why does it matter?"*, say this:

> *"Sir/Madam, today in India, when cyber scammers steal money in Digital Arrest or task scams, they immediately convert it into cryptocurrency and bounce it across multiple anonymous private wallets before dumping it into an exchange like Binance or WazirX to cash out.*  
>  
> *Under the current police workflow, officers on the SAHYOG portal hit a brick wall because they don't know which exchange to send legal notices to. Tracing it manually takes weeks, and by then the money is gone.*  
>  
> *We built **SETU** — an automated forensic intelligence engine. An officer enters an anonymous wallet address. In less than 2 seconds, our engine crawls up to 3 hops across Ethereum, Tron, and Bitcoin, matches transactions against 1,595+ exchange cluster signatures, computes a transparent 5-pillar mathematical confidence score, and instantly generates a court-admissible Section 91 CrPC asset freeze notice addressed directly to the exchange's Nodal Officer via the SAHYOG portal.*  
>  
> *We take what used to take 2 weeks of manual work down to 2 seconds, allowing police to freeze stolen assets before criminals can cash out."*

---

*Authored for the SETU / SETU Forensic Project Repository*  
*Compliant with SIH Problem Statement 26182 | CrPC §91 | BNSS 2023 | IEA §65B*
