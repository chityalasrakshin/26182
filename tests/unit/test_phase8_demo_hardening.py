"""
Unit and Integration Tests for Dynamic Architecture & Elimination of Static Fallbacks.

Verifies:
1. Fake/Placeholder Endpoints are Eliminated:
   - `GET /api/v1/demo/status` returns 404 Not Found.
2. Dynamic Blockchain Cache:
   - Static disk fallback interceptor (`_get_from_disk`) is removed.
   - Cache operations rely purely on dynamic in-memory/Redis state.
3. Trace Pipeline Dynamic Execution:
   - `POST /api/v1/trace` queues dynamic trace jobs without offline demo interceptors.
   - `GET /api/v1/trace/{job_id}/status` retrieves active execution state.
4. Analysis Pipeline Dynamic Execution:
   - `POST /api/v1/analyze` initiates dynamic trace pipeline.
5. Multi-Chain Address Validation:
   - Accurately identifies Ethereum (0x...), Tron (T...), and Bitcoin (1/3/bc1...).
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.services.blockchain.cache import blockchain_cache
from backend.app.core.address_validator import (
    detect_blockchain,
    is_valid_crypto_address,
    is_valid_eth_address,
    is_valid_tron_address,
    is_valid_btc_address,
)
from backend.app.core.security import create_access_token
from backend.app.schemas.analysis import NormalizedTransaction
from datetime import datetime, timezone

client = TestClient(app)


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def auth_headers():
    token = create_access_token(
        data={"sub": "investigator", "role": "investigator", "id": "test-inv-id"}
    )
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Elimination of Fake / Placeholder Endpoints
# ==============================================================================

def test_demo_status_endpoint_removed():
    """Verify GET /api/v1/demo/status returns 404 Not Found (endpoint eliminated)."""
    res = client.get("/api/v1/demo/status")
    assert res.status_code == 404


# ==============================================================================
# 2. Dynamic Blockchain Caching (No Static Disk Pre-warming)
# ==============================================================================

def test_no_disk_prewarming_or_fallback_attributes():
    """Verify prewarm_demo_cache and _get_from_disk are eliminated."""
    assert not hasattr(blockchain_cache, "prewarm_demo_cache")
    assert not hasattr(blockchain_cache, "_get_from_disk")


@pytest.mark.asyncio
async def test_dynamic_in_memory_caching():
    """Verify dynamic cache only serves data written during live operation."""
    test_addr = "0x000000000000000000000000000000000000d00d"
    cache_key = blockchain_cache.build_cache_key("ethereum", test_addr, "activity")

    # Uncached address returns None (no static fallback from disk)
    uncached = await blockchain_cache.get_transactions(cache_key)
    assert uncached is None

    # Write live dynamic transaction
    test_tx = NormalizedTransaction(
        tx_hash="0xdeadbeef1234567890",
        chain="ethereum",
        block_number=20000000,
        timestamp=datetime.now(timezone.utc),
        from_address=test_addr,
        to_address="0x28c6c06298d514db089934071355e5743bf21d60",
        asset_type="ETH",
        amount=1.5
    )
    await blockchain_cache.set_transactions(cache_key, [test_tx], ttl=60)

    # Dynamic cache now hits
    cached = await blockchain_cache.get_transactions(cache_key)
    assert cached is not None
    assert len(cached) == 1
    assert cached[0].tx_hash == "0xdeadbeef1234567890"


# ==============================================================================
# 3. Dynamic Trace Pipeline
# ==============================================================================

def test_start_trace_dynamic_execution(auth_headers):
    """Verify POST /api/v1/trace creates and queues a dynamic trace job."""
    payload = {
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "chain": "ethereum",
        "max_depth": 1,
    }
    res = client.post("/api/v1/trace", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "job_id" in data
    assert data["status"] == "QUEUED"

    # Check status endpoint
    status_res = client.get(f"/api/v1/trace/{data['job_id']}/status", headers=auth_headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["job_id"] == data["job_id"]


# ==============================================================================
# 4. Dynamic Analysis Pipeline
# ==============================================================================

def test_start_analysis_dynamic_execution(auth_headers):
    """Verify POST /api/v1/analyze initiates dynamic ingestion without demo flags."""
    payload = {
        "wallet_address": "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
        "max_hops": 1,
    }
    res = client.post("/api/v1/analyze", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "analysis_id" in data

    # Check analysis status endpoint
    analysis_id = data["analysis_id"]
    status_res = client.get(f"/api/v1/analysis/{analysis_id}", headers=auth_headers)
    assert status_res.status_code == 200
    assert status_res.json()["analysis_id"] == analysis_id


# ==============================================================================
# 5. Multi-Chain Benchmark Address Validation Tests
# ==============================================================================

def test_multi_chain_benchmark_address_validation():
    """Verify address validator accurately detects all benchmark address formats."""
    # Ethereum
    eth_addr = "0x28C6c06298d514Db089934071355E5743bf21d60"
    assert is_valid_eth_address(eth_addr) is True
    assert is_valid_crypto_address(eth_addr) is True
    assert detect_blockchain(eth_addr) == "ethereum"

    # Tron TRC-20
    tron_addr = "TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR"
    assert is_valid_tron_address(tron_addr) is True
    assert is_valid_crypto_address(tron_addr) is True
    assert detect_blockchain(tron_addr) == "tron"

    # Bitcoin Base58 (1...)
    btc_addr1 = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    assert is_valid_btc_address(btc_addr1) is True
    assert is_valid_crypto_address(btc_addr1) is True
    assert detect_blockchain(btc_addr1) == "bitcoin"

    # Bitcoin Script (3...)
    btc_addr2 = "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"
    assert is_valid_btc_address(btc_addr2) is True
    assert is_valid_crypto_address(btc_addr2) is True
    assert detect_blockchain(btc_addr2) == "bitcoin"

    # Bitcoin Bech32 (bc1...)
    btc_addr3 = "bc1qgdjqv0av3q56jvd82tkdjpy7gdp9ut8tlqmgrpmv24sq90ecnvqqjwvw97"
    assert is_valid_btc_address(btc_addr3) is True
    assert is_valid_crypto_address(btc_addr3) is True
    assert detect_blockchain(btc_addr3) == "bitcoin"
