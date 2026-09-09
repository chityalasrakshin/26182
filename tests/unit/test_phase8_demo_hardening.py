"""
Unit and Integration Tests for Phase 8: Demo Hardening & Polish.

Verifies:
1. Blockchain Cache Pre-Warming & Persistence:
   - `blockchain_cache.prewarm_demo_cache()` scans `data/cache/transactions/` and in-memory stores.
   - `is_cached_or_demo()` correctly identifies benchmark targets across Ethereum, Tron, and Bitcoin.
   - Cache diagnostics and fallback to disk operate reliably when memory cache is flushed.
2. Demo Status & Health Endpoint:
   - `GET /api/v1/demo/status` returns operational metadata, active status, and pre-warmed address inventory.
3. Trace Pipeline Demo Mode Support:
   - `POST /api/v1/trace` with `demo_mode: true` flags trace jobs appropriately.
   - `GET /api/v1/trace/{job_id}` retains and exposes `demo_mode` and `is_cached` status.
4. Analysis Pipeline Demo Mode Support:
   - `POST /api/v1/analyze` with `demo_mode: true` persists the flag.
   - `GET /api/v1/analysis/{analysis_id}` retains and exposes `demo_mode`.
5. Multi-Chain Benchmark Address Validation:
   - Benchmark addresses for Ethereum (0x...), Tron (T...), and Bitcoin (1/3/bc1...) validate cleanly.
"""

import asyncio
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

client = TestClient(app)


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture(scope="module", autouse=True)
def setup_demo_cache():
    """Ensure demo cache is pre-warmed for all Phase 8 tests."""
    stats = asyncio.run(blockchain_cache.prewarm_demo_cache())
    assert stats["status"] == "success"
    assert stats["prewarmed_addresses_count"] > 0
    yield stats


@pytest.fixture
def auth_headers():
    token = create_access_token(
        data={"sub": "investigator", "role": "investigator", "id": "test-inv-id"}
    )
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# 1. Pre-warm & Disk Cache Fallback Tests
# ==============================================================================

def test_prewarm_demo_cache_populates_targets():
    """Verify prewarm_demo_cache() discovers benchmark files on disk."""
    stats = blockchain_cache.get_stats()
    assert stats["disk_cache_files"] > 0
    assert len(stats["prewarmed_addresses"]) >= 5


def test_is_cached_or_demo_identifies_benchmarks():
    """Verify is_cached_or_demo identifies known benchmark wallets."""
    benchmarks = [
        ("ethereum", "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b"),  # Tornado Cash
        ("ethereum", "0x3d0246a49591A5462D42fF025b6a3F2169E66e2c"),  # WazirX Hacker
        ("ethereum", "0x28C6c06298d514Db089934071355E5743bf21d60"),  # Binance Hot Wallet
        ("tron", "TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR"),              # Binance Tron Hot
        ("bitcoin", "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo"),           # Binance BTC Cold
    ]
    for chain, addr in benchmarks:
        assert blockchain_cache.is_cached_or_demo(chain, addr) is True


@pytest.mark.asyncio
async def test_disk_cache_fallback_after_memory_flush():
    """Verify that when in-memory cache is cleared, transactions reload from disk."""
    tornado_addr = "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b"
    cache_key = blockchain_cache.build_cache_key("ethereum", tornado_addr, "activity")

    # Flush in-memory cache
    await blockchain_cache._in_memory.clear()

    # Query get_transactions — should fall back to disk and repopulate memory
    cached = await blockchain_cache.get_transactions(cache_key)
    assert cached is not None
    assert len(cached) > 0


# ==============================================================================
# 2. Demo Status API Endpoint Tests
# ==============================================================================

def test_get_demo_status_endpoint():
    """Verify GET /api/v1/demo/status returns valid diagnostic payload."""
    res = client.get("/api/v1/demo/status")
    assert res.status_code == 200
    data = res.json()
    assert data["demo_active"] is True
    assert data["cached_benchmark_count"] >= 5
    assert len(data["benchmarks"]) >= 5
    assert "cache_stats" in data
    assert data["cache_stats"]["disk_cache_files"] > 0


# ==============================================================================
# 3. Trace Pipeline Demo Mode Tests
# ==============================================================================

def test_start_trace_with_demo_mode(auth_headers):
    """Verify POST /api/v1/trace propagates demo_mode flag."""
    payload = {
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "chain": "ethereum",
        "max_depth": 1,
        "demo_mode": True,
    }
    res = client.post("/api/v1/trace", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "job_id" in data
    assert data["demo_mode"] is True

    # Check status endpoint retains demo_mode
    status_res = client.get(f"/api/v1/trace/{data['job_id']}/status", headers=auth_headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert status_data["demo_mode"] is True


def test_start_trace_default_demo_mode_false(auth_headers):
    """Verify default demo_mode is False when omitted from request."""
    payload = {
        "address": "0x28C6c06298d514Db089934071355E5743bf21d60",
        "chain": "ethereum",
        "max_depth": 1,
    }
    res = client.post("/api/v1/trace", json=payload, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["demo_mode"] is False


# ==============================================================================
# 4. Analysis Pipeline Demo Mode Tests
# ==============================================================================

def test_start_analysis_with_demo_mode(auth_headers):
    """Verify POST /api/v1/analyze accepts and exposes demo_mode."""
    payload = {
        "wallet_address": "0xd90e2f925DA726b50C4Ed8D0Fb90Ad053324F31b",
        "max_hops": 2,
        "demo_mode": True,
    }
    res = client.post("/api/v1/analyze", json=payload, headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["demo_mode"] is True

    # Check analysis status endpoint
    analysis_id = data["analysis_id"]
    status_res = client.get(f"/api/v1/analysis/{analysis_id}", headers=auth_headers)
    assert status_res.status_code == 200
    assert status_res.json()["demo_mode"] is True


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
