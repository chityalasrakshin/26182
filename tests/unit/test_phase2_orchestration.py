"""
Unit and Integration Tests for Phase 2: Trace Orchestration (Multi-Hop, Async, Streaming).

Verifies:
1. BlockchainCache & RateLimiter (cache hits, deserialization, in-memory fallback).
2. TraceOrchestrator multi-hop BFS traversal and early stopping on known VASP match.
3. Graceful handling of unresolved leaf nodes when no VASP is found within max_depth.
4. TraceJobManager asynchronous execution, event streaming (SSE/PubSub), and event history replay.
5. FastAPI /api/v1/trace and /trace REST endpoints.
"""

import pytest
import asyncio
from datetime import datetime, timezone
import httpx
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.blockchain.cache import BlockchainCache, RateLimiter, blockchain_cache
from backend.app.services.blockchain.base import BlockchainProvider
from backend.app.services.blockchain.factory import BlockchainProviderFactory
from backend.app.services.labels.store import label_store
from backend.app.services.trace.orchestrator import TraceOrchestrator
from backend.app.services.trace.job_manager import TraceJobManager, trace_job_manager


# ------------------------------------------------------------------------------
# 1. Test BlockchainCache & Rate Limiting
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_blockchain_cache_set_and_get():
    """Test caching and deserialization of NormalizedTransaction lists."""
    cache = BlockchainCache(redis_url="redis://invalid-host-to-force-fallback:9999/0")
    test_key = "test:ethereum:0x123:outgoing"

    txs = [
        NormalizedTransaction(
            tx_hash="0x1111",
            chain="ethereum",
            block_number=1000,
            timestamp=datetime.now(timezone.utc),
            from_address="0x123",
            to_address="0x456",
            asset_type="ETH",
            amount=1.5
        )
    ]

    await cache.set_transactions(test_key, txs, ttl=60)
    cached = await cache.get_transactions(test_key)

    assert cached is not None
    assert len(cached) == 1
    assert cached[0].tx_hash == "0x1111"
    assert cached[0].amount == 1.5
    assert cached[0].from_address == "0x123"


@pytest.mark.asyncio
async def test_rate_limiter_throttling():
    """Test that RateLimiter enforces minimum intervals between calls."""
    limiter = RateLimiter(default_delay=0.1)
    t0 = asyncio.get_event_loop().time()
    await limiter.throttle("test_chain")
    await limiter.throttle("test_chain")
    t1 = asyncio.get_event_loop().time()
    # Second call should have waited ~0.1s
    assert (t1 - t0) >= 0.08


# ------------------------------------------------------------------------------
# 2. Test Multi-Hop Traversal with Early VASP Termination
# ------------------------------------------------------------------------------

class MockMultiHopProvider(BlockchainProvider):
    """Synthetic provider simulating a 2-hop path to Binance Hot Wallet 14."""

    @property
    def chain(self) -> str:
        return "ethereum"

    async def get_native_transactions(self, address, page=1, offset=50):
        return []

    async def get_token_transfers(self, address, page=1, offset=50):
        return []

    async def get_address_activity(self, address, max_tx=50):
        addr = address.lower()
        now = datetime.now(timezone.utc)

        # Hop 0: Suspect wallet sends to intermediary
        if addr == "0xaaaa00000000000000000000000000000000aaaa":
            return [
                NormalizedTransaction(
                    tx_hash="0xhash1",
                    chain="ethereum",
                    block_number=101,
                    timestamp=now,
                    from_address="0xaaaa00000000000000000000000000000000aaaa",
                    to_address="0xbbbb00000000000000000000000000000000bbbb",
                    asset_type="ETH",
                    amount=10.0
                )
            ]
        # Hop 1: Intermediary sends to Binance Hot Wallet 14 (from demo_labels.json)
        elif addr == "0xbbbb00000000000000000000000000000000bbbb":
            return [
                NormalizedTransaction(
                    tx_hash="0xhash2",
                    chain="ethereum",
                    block_number=102,
                    timestamp=now,
                    from_address="0xbbbb00000000000000000000000000000000bbbb",
                    to_address="0x28c6c06298d514db089934071355e5743bf21d60",  # Binance Hot Wallet 14
                    asset_type="ETH",
                    amount=9.8
                ),
                # Also sends to an unknown address (branch should continue)
                NormalizedTransaction(
                    tx_hash="0xhash3",
                    chain="ethereum",
                    block_number=102,
                    timestamp=now,
                    from_address="0xbbbb00000000000000000000000000000000bbbb",
                    to_address="0xcccc00000000000000000000000000000000cccc",
                    asset_type="ETH",
                    amount=0.2
                )
            ]
        # Hop 2 for Binance: MUST NOT BE CALLED because early termination stops crawling at VASP
        elif addr == "0x28c6c06298d514db089934071355e5743bf21d60":
            raise AssertionError("Orchestrator expanded past terminal VASP node!")
        
        return []


@pytest.mark.asyncio
async def test_trace_orchestrator_early_vasp_termination(monkeypatch):
    """Test that multi-hop BFS terminates branch on VASP hit without expanding further."""
    mock_provider = MockMultiHopProvider()
    monkeypatch.setattr(BlockchainProviderFactory, "get_provider", lambda chain: mock_provider)

    events = []
    async def capture_event(ev):
        events.append(ev)

    seed = "0xaaaa00000000000000000000000000000000aaaa"
    orchestrator = TraceOrchestrator(
        seed_address=seed,
        chain="ethereum",
        max_depth=4,
        job_id="test_job_vasp",
        event_callback=capture_event
    )

    result = await orchestrator.run_trace()

    assert result["status"] == "COMPLETED"
    assert result["vasp_found"] is True
    assert len(result["matched_vasps"]) >= 1

    # Check matched VASP details
    matched = result["matched_vasps"][0]
    assert matched["entity"] == "Binance"
    assert matched["hop"] == 2
    assert matched["address"] == "0x28c6c06298d514db089934071355e5743bf21d60"

    # Verify shortest path
    assert result["shortest_path"] is not None
    assert result["shortest_path"]["hop_count"] == 2

    # Verify event stream
    event_names = [e.event for e in events]
    assert "JOB_STARTED" in event_names
    assert "NODE_DISCOVERED" in event_names
    assert "EDGE_ADDED" in event_names
    assert "VASP_REACHED" in event_names
    assert "TRACE_COMPLETED" in event_names


# ------------------------------------------------------------------------------
# 3. Test Graceful Unresolved Leaf Nodes (No VASP within Depth Limit)
# ------------------------------------------------------------------------------

class MockUnresolvedProvider(BlockchainProvider):
    """Synthetic provider where all counterparties are unknown/unlabeled."""

    @property
    def chain(self) -> str:
        return "ethereum"

    async def get_native_transactions(self, address, page=1, offset=50):
        return []

    async def get_token_transfers(self, address, page=1, offset=50):
        return []

    async def get_address_activity(self, address, max_tx=50):
        now = datetime.now(timezone.utc)
        addr = address.lower()
        if addr == "0x1111000000000000000000000000000000001111":
            return [
                NormalizedTransaction(
                    tx_hash="0xunres1",
                    chain="ethereum",
                    block_number=200,
                    timestamp=now,
                    from_address="0x1111000000000000000000000000000000001111",
                    to_address="0x2222000000000000000000000000000000002222",
                    asset_type="ETH",
                    amount=5.0
                )
            ]
        elif addr == "0x2222000000000000000000000000000000002222":
            return [
                NormalizedTransaction(
                    tx_hash="0xunres2",
                    chain="ethereum",
                    block_number=201,
                    timestamp=now,
                    from_address="0x2222000000000000000000000000000000002222",
                    to_address="0x3333000000000000000000000000000000003333",
                    asset_type="ETH",
                    amount=4.9
                )
            ]
        return []


@pytest.mark.asyncio
async def test_trace_orchestrator_unresolved_handling(monkeypatch):
    """Test that trace completes gracefully with leaf nodes when no VASP is found."""
    mock_provider = MockUnresolvedProvider()
    monkeypatch.setattr(BlockchainProviderFactory, "get_provider", lambda chain: mock_provider)

    seed = "0x1111000000000000000000000000000000001111"
    orchestrator = TraceOrchestrator(
        seed_address=seed,
        chain="ethereum",
        max_depth=2,
        job_id="test_job_unres"
    )

    result = await orchestrator.run_trace()

    assert result["status"] == "COMPLETED"
    assert result["vasp_found"] is False
    assert len(result["matched_vasps"]) == 0
    # Must contain frontier leaf nodes
    assert len(result["leaf_nodes"]) >= 1
    assert result["leaf_nodes"][0]["address"] == "0x3333000000000000000000000000000000003333"
    assert "within 2 hops" in result["summary"]


# ------------------------------------------------------------------------------
# 4. Test TraceJobManager Pub/Sub & History Replay
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_job_manager_lifecycle_and_streaming(monkeypatch):
    """Test TraceJobManager creates jobs, dispatches background tasks, and streams events."""
    mock_provider = MockMultiHopProvider()
    monkeypatch.setattr(BlockchainProviderFactory, "get_provider", lambda chain: mock_provider)

    manager = TraceJobManager()
    seed = "0xaaaa00000000000000000000000000000000aaaa"
    job_id = manager.create_job(address=seed, chain="ethereum", max_depth=3)

    assert job_id.startswith("trace_")
    status_initial = manager.get_job(job_id)
    assert status_initial["status"] == "QUEUED"

    # Execute trace
    await manager.execute_trace(job_id)

    status_final = manager.get_job(job_id)
    assert status_final["status"] == "COMPLETED"
    assert status_final["vasp_found"] is True

    # Test event subscription with history replay
    collected = []
    async for event in manager.subscribe(job_id):
        collected.append(event)

    assert len(collected) > 0
    assert collected[0].event == "JOB_STARTED"
    assert any(e.event == "VASP_REACHED" for e in collected)
    assert collected[-1].event == "TRACE_COMPLETED"


# ------------------------------------------------------------------------------
# 5. Test REST Endpoints (/api/v1/trace and /trace)
# ------------------------------------------------------------------------------

def test_api_trace_endpoints(monkeypatch):
    """Test submitting trace via HTTP POST and polling status via GET."""
    mock_provider = MockMultiHopProvider()
    monkeypatch.setattr(BlockchainProviderFactory, "get_provider", lambda chain: mock_provider)

    client = TestClient(app)

    # 1. Test POST /api/v1/trace
    res = client.post(
        "/api/v1/trace",
        json={
            "address": "0xaaaa00000000000000000000000000000000aaaa",
            "chain": "ethereum",
            "max_depth": 3
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert "job_id" in data
    assert data["status"] == "QUEUED"
    job_id = data["job_id"]

    # 2. Test GET /api/v1/trace/{job_id}/status
    status_res = client.get(f"/api/v1/trace/{job_id}/status")
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["job_id"] == job_id
    assert status_data["address"] == "0xaaaa00000000000000000000000000000000aaaa"

    # 3. Test root alias POST /trace
    root_res = client.post(
        "/trace",
        json={
            "address": "0xaaaa00000000000000000000000000000000aaaa",
            "chain": "ethereum",
            "max_depth": 3
        }
    )
    assert root_res.status_code == 200
    assert "job_id" in root_res.json()
