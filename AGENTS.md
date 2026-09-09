# AGENTS.md — VASP Attribution Engine

This file is auto-loaded by Antigravity at the start of every session in this workspace. Keep it short — it's the *always-on* layer. Detailed phase-by-phase instructions live in `docs/BUILD-PLAN.md`; domain conventions live in `.agents/rules/`; a reusable tracing-domain skill lives in `skills/blockchain-tracing/SKILL.md`. This file should never be edited to contain full task detail — if you find yourself pasting a long explanation here, it belongs in one of those other files instead.

## Project in one sentence
Given a suspect crypto wallet, trace its transaction graph across chains hop-by-hop until it hits an address attributable to a known exchange/VASP, tag intermediate hops, score risk, and generate an investigation-ready report for law-enforcement investigators.

## Non-negotiable operating rules

1. **A baseline project already exists in this directory.** Before writing any new code in a session, check whether the relevant module/screen/table already exists and extend it rather than rewriting it. If `docs/BASELINE_AUDIT.md` doesn't exist yet, your first task is to create it (see `docs/BUILD-PLAN.md` Phase 0).
2. **Work phase-by-phase**, per `docs/BUILD-PLAN.md`. Do not jump ahead to a later phase's features while an earlier phase's "Definition of done" is unmet, unless I explicitly tell you to.
3. **After every phase**, stop and give me a short status note: what was built, what was stubbed/mocked, what's left. Don't silently keep going into the next phase.
4. **Never fabricate blockchain data, addresses, or API responses.** If a live API call fails or a key is missing, fall back to the cached `demo_labels.json` dataset and say so explicitly — do not invent transaction data to make a feature "look done."
5. **The LLM (Claude/Gemini) narrative layer never decides risk scores or entity labels.** It only explains/summarizes structured data that the graph + heuristics + classifier already produced. If you catch yourself asking the LLM "is this address a mixer?", stop — that's a labeling decision and belongs in the Label Store / clustering engine, not a prompt.
6. **Every trace, report export, and disclosure-request action must write an audit log row.** This is cheap to do and is treated as a correctness requirement, not a nice-to-have.
7. **Do not build**: Monero/privacy-coin deanonymization, real Chainalysis/Elliptic/TRM API integration (not self-serve available), a real SAHYOG government integration (must stay clearly labeled "simulated" in the UI), or Kubernetes deployment. If asked to work on any of these, push back and point to this rule.
8. **Prefer free/open data sources** listed in `.agents/rules/blockchain-conventions.md`. Never assume a paid API key exists; always design a graceful fallback.
9. **Commit after each completed phase or meaningful checkpoint** with a message describing what changed, not "wip".

## Where to look for more detail
- Full phased build plan, tech stack, acceptance criteria: `docs/BUILD_PLAN.md`
- Project-specific technical conventions not covered by installed skills (label taxonomy enum, chain adapter interface contract, Neo4j schema): `.agents/rules/blockchain-conventions.md`
- General code quality rules: `.agents/rules/coding-standards.md`
- Original architecture rationale (why Neo4j, why this stack): `docs/SOLUTION-ARCHITECTURE.md`

## Installed skills — use these, don't reinvent them

This workspace already has domain skills installed (see `skills-lock.json`, source `useosint/skills`). Use them actively:

- **`follow-the-crypto`** — attribution methodology and epistemics. Load this before writing any clustering/labeling logic (Phase 1, 3). Its core stance — trace confidently, attribute carefully; a clustering match is a probabilistic inference, not a fact — is the standard this project holds itself to. Every confidence score in this system should reflect that discipline.
- **`graph-the-network`** — schema-first, sourced-edge graph construction. Load this before designing the Neo4j schema or any labeling logic (Phase 1). Its rule that every edge needs a traceable source maps directly to this project's `source_url` requirement in the Label Store.
- **`write-the-intel-brief`** — report-writing methodology. Use this for Phase 5 (report/narrative generation) instead of designing report structure from scratch.
- **`cybersecurity`** — general security posture; consult if a security question comes up, not part of the core build loop.

**Scope boundary:** these skills come from a broader OSINT pack (`useosint/osint-skills`, 28 skills covering general person-OSINT: breach checks, photo geolocation, social-graph pivots on individuals). Only the four installed skills above are in scope. Do not fetch or apply additional skills from that source for identifying or profiling individuals — this project traces wallets to VASPs, not people, and stays within lawful-disclosure-request territory, not personal investigation.

## Current status
(Keep this section updated as phases complete — Antigravity should edit this section directly at the end of each phase rather than leaving it stale.)

- [x] Phase 0 — Baseline audit
- [x] Phase 1 — Chain adapters + graph ingestion + seed labels
- [x] Phase 2 — Trace orchestration (async, multi-hop)
- [ ] Phase 3 — Clustering heuristics + risk scoring
- [ ] Phase 4 — Case management, auth, audit trail
- [ ] Phase 5 — LLM narrative + report generation
- [ ] Phase 6 — Mock SAHYOG/VASP directory
- [ ] Phase 7 — Frontend dashboard
- [ ] Phase 8 — Demo hardening
