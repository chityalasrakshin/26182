# AGENTS.md — SETU VASP Attribution Engine

## Project Overview
Given a suspect cryptocurrency wallet, SETU traces its transaction graph across multiple blockchains (Ethereum, Tron, Bitcoin, Solana) hop-by-hop until it hits an address attributable to a known exchange/Virtual Asset Service Provider (VASP), tags intermediate hops, scores risk, and generates investigation-ready reports and Section 91 CrPC freeze notices for law-enforcement investigators.

## Core Architectural Specifications
- Complete Architecture Specification: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- REST API Reference & Endpoints: [docs/API.md](docs/API.md)
- Production Deployment Guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- VASP Registry & Address Clustering: [docs/VASP_REGISTRY.md](docs/VASP_REGISTRY.md)
- Data Sources & Explorer Fallbacks: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)
- Attribution Methodology & Scoring: [docs/METHODOLOGY.md](docs/METHODOLOGY.md)
- ML Model Card & Forensic Evaluation: [docs/MODEL_CARD.md](docs/MODEL_CARD.md)
- System Boundaries & Assumptions: [docs/LIMITATIONS.md](docs/LIMITATIONS.md)
- UI Design & Operations Dashboard Specification: [docs/UI_SPECIFICATION.md](docs/UI_SPECIFICATION.md)

## Non-Negotiable Operating Rules
1. **Preserve Production Integrations:** Maintain compatibility across FastAPI backend, Next.js dashboard, Neo4j/NetworkX graph analysis, and SQLite/PostgreSQL persistence.
2. **Never Fabricate On-Chain Data:** Use real blockchain APIs (Etherscan, TronGrid, Mempool, Solana RPC) with deterministic fallbacks to verified offline cache (`data/cache/transactions/` and `data/labels/demo_labels.json`).
3. **Forensic Integrity:** The LLM narrative layer never decides risk scores or entity labels; it strictly explains and summarizes structured intelligence produced by the graph traversal, heuristics engine, and classifier.
4. **Audit Logging:** Every trace execution, case management action, and statutory notice dispatch writes an immutable audit record to the `audit_log` table.
5. **Scope Boundaries:** This system performs lawful attribution of wallets to VASPs for law enforcement compliance; it does not profile individuals or attempt privacy-coin deanonymization.

## Implementation Status
- [x] Multi-rail blockchain adapters (Ethereum, Tron, Bitcoin, Solana)
- [x] Bounded multi-hop graph traversal engine (BFS, fan-out throttling)
- [x] LabelStore & 1,595+ verified VASP cluster address dataset
- [x] Heuristic clustering (sweep consolidation, peeling chains, common-input-ownership)
- [x] Hybrid ML and mathematical risk scoring engine
- [x] Case management, JWT/RBAC security, and statutory audit logging
- [x] Section 91 CrPC legal freeze notice & PDF dossier generator
- [x] Mock SAHYOG VASP directory & automated disclosure dispatch workflow
- [x] Interactive Next.js investigator console with Cytoscape graph canvas & Sankey flows
- [x] Pre-warmed offline benchmarks (77k+ transactions for 0ms demo latency)
