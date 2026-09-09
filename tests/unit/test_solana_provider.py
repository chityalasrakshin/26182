"""
Unit tests for SolanaProvider and BlockchainProviderFactory Solana integration.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from backend.app.schemas.analysis import NormalizedTransaction
from backend.app.services.blockchain.factory import BlockchainProviderFactory
from backend.app.services.blockchain.solana import SolanaProvider, SYSTEM_PROGRAM_ID, TOKEN_PROGRAM_ID
from backend.app.services.blockchain.cache import blockchain_cache


@pytest.fixture
def anyio_backend():
    return "asyncio"


class TestSolanaProviderFactory:
    """Test factory routing to SolanaProvider."""

    def test_factory_solana_by_name(self):
        provider = BlockchainProviderFactory.get_provider("solana")
        assert isinstance(provider, SolanaProvider)
        assert provider.chain == "solana"

    def test_factory_sol_by_symbol(self):
        provider = BlockchainProviderFactory.get_provider("sol")
        assert isinstance(provider, SolanaProvider)

    def test_factory_solana_by_address(self):
        sol_addr = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
        provider = BlockchainProviderFactory.get_provider(sol_addr)
        assert isinstance(provider, SolanaProvider)

    def test_factory_supported_chains_includes_solana(self):
        chains = BlockchainProviderFactory.get_supported_chains()
        assert "solana" in chains
        assert "ethereum" in chains
        assert "tron" in chains
        assert "bitcoin" in chains


class TestSolanaTransactionParsing:
    """Test parsing of native SOL and SPL token transactions."""

    @pytest.fixture
    def provider(self):
        return SolanaProvider()

    def test_parse_native_system_transfer(self, provider):
        mock_tx = {
            "slot": 250000000,
            "blockTime": 1700000000,
            "transaction": {
                "signatures": ["5U3b...sig1"],
                "message": {
                    "accountKeys": [
                        {"pubkey": "SenderWallet1111111111111111111111111111111"},
                        {"pubkey": "ReceiverWallet11111111111111111111111111111"},
                        {"pubkey": SYSTEM_PROGRAM_ID},
                    ],
                    "instructions": [
                        {
                            "program": "system",
                            "programId": SYSTEM_PROGRAM_ID,
                            "parsed": {
                                "type": "transfer",
                                "info": {
                                    "source": "SenderWallet1111111111111111111111111111111",
                                    "destination": "ReceiverWallet11111111111111111111111111111",
                                    "lamports": 2500000000,  # 2.5 SOL
                                },
                            },
                        }
                    ],
                },
            },
            "meta": {"err": None, "fee": 5000},
        }

        parsed = provider._parse_native_transfers_from_tx(
            mock_tx, target_address="SenderWallet1111111111111111111111111111111"
        )
        assert len(parsed) == 1
        tx = parsed[0]
        assert tx.tx_hash == "5U3b...sig1"
        assert tx.chain == "solana"
        assert tx.from_address == "SenderWallet1111111111111111111111111111111"
        assert tx.to_address == "ReceiverWallet11111111111111111111111111111"
        assert tx.asset_type == "SOL"
        assert tx.token_symbol == "SOL"
        assert tx.token_decimals == 9
        assert tx.amount == 2.5
        assert tx.is_error is False

    def test_parse_spl_token_transfer(self, provider):
        usdt_mint = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
        mock_tx = {
            "slot": 250000001,
            "blockTime": 1700000010,
            "transaction": {
                "signatures": ["4T2a...sig2"],
                "message": {
                    "accountKeys": [
                        {"pubkey": "UserSignerWallet1111111111111111111111111"},
                        {"pubkey": "SourceTokenAccount11111111111111111111111"},
                        {"pubkey": "DestTokenAccount1111111111111111111111111"},
                        {"pubkey": TOKEN_PROGRAM_ID},
                    ],
                    "instructions": [
                        {
                            "program": "spl-token",
                            "programId": TOKEN_PROGRAM_ID,
                            "parsed": {
                                "type": "transfer",
                                "info": {
                                    "source": "SourceTokenAccount11111111111111111111111",
                                    "destination": "DestTokenAccount1111111111111111111111111",
                                    "authority": "UserSignerWallet1111111111111111111111111",
                                    "amount": "50000000",  # 50 USDT (6 decimals)
                                },
                            },
                        }
                    ],
                },
            },
            "meta": {
                "err": None,
                "preTokenBalances": [
                    {
                        "accountIndex": 1,
                        "mint": usdt_mint,
                        "owner": "UserSignerWallet1111111111111111111111111",
                    }
                ],
                "postTokenBalances": [
                    {
                        "accountIndex": 2,
                        "mint": usdt_mint,
                        "owner": "RecipientOwnerWallet1111111111111111111111",
                    }
                ],
            },
        }

        parsed = provider._parse_token_transfers_from_tx(
            mock_tx, target_address="UserSignerWallet1111111111111111111111111"
        )
        assert len(parsed) == 1
        tx = parsed[0]
        assert tx.tx_hash == "4T2a...sig2"
        assert tx.chain == "solana"
        assert tx.from_address == "UserSignerWallet1111111111111111111111111"
        assert tx.to_address == "RecipientOwnerWallet1111111111111111111111"
        assert tx.asset_type == "SPL"
        assert tx.token_address == usdt_mint
        assert tx.token_symbol == "USDT"
        assert tx.token_decimals == 6
        assert tx.amount == 50.0

    def test_parse_spl_token_transfer_checked(self, provider):
        usdc_mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        mock_tx = {
            "slot": 250000002,
            "blockTime": 1700000020,
            "transaction": {
                "signatures": ["3S1c...sig3"],
                "message": {
                    "accountKeys": [
                        {"pubkey": "SenderOwner111111111111111111111111111111"},
                        {"pubkey": "RecipientOwner111111111111111111111111111"},
                    ],
                    "instructions": [
                        {
                            "program": "spl-token",
                            "programId": TOKEN_PROGRAM_ID,
                            "parsed": {
                                "type": "transferChecked",
                                "info": {
                                    "source": "SourceATA1111111111111111111111111111111",
                                    "destination": "DestATA111111111111111111111111111111111",
                                    "authority": "SenderOwner111111111111111111111111111111",
                                    "mint": usdc_mint,
                                    "tokenAmount": {
                                        "amount": "100000000",
                                        "decimals": 6,
                                        "uiAmount": 100.0,
                                    },
                                },
                            },
                        }
                    ],
                },
            },
            "meta": {
                "err": None,
                "preTokenBalances": [
                    {"accountIndex": 0, "mint": usdc_mint, "owner": "SenderOwner111111111111111111111111111111"}
                ],
                "postTokenBalances": [
                    {"accountIndex": 1, "mint": usdc_mint, "owner": "RecipientOwner111111111111111111111111111"}
                ],
            },
        }

        parsed = provider._parse_token_transfers_from_tx(
            mock_tx, target_address="SenderOwner111111111111111111111111111111"
        )
        assert len(parsed) == 1
        tx = parsed[0]
        assert tx.token_symbol == "USDC"
        assert tx.amount == 100.0
        assert tx.from_address == "SenderOwner111111111111111111111111111111"


class TestSolanaProviderAsyncMethods:
    """Test async provider methods with mocked RPC calls and caching."""

    @pytest.mark.anyio
    async def test_get_address_activity_flow(self):
        provider = SolanaProvider()
        test_addr = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"

        mock_sigs = [{"signature": "mock_sig_123"}]
        mock_tx_data = {
            "slot": 100,
            "blockTime": 1700000000,
            "transaction": {
                "signatures": ["mock_sig_123"],
                "message": {
                    "accountKeys": [{"pubkey": test_addr}, {"pubkey": "Recipient111111111111111111111111111111"}],
                    "instructions": [
                        {
                            "program": "system",
                            "programId": SYSTEM_PROGRAM_ID,
                            "parsed": {
                                "type": "transfer",
                                "info": {
                                    "source": test_addr,
                                    "destination": "Recipient111111111111111111111111111111",
                                    "lamports": 1000000000,  # 1.0 SOL
                                },
                            },
                        }
                    ],
                },
            },
            "meta": {"err": None},
        }

        async def fake_rpc_call(method, params):
            if method == "getSignaturesForAddress":
                return mock_sigs
            elif method == "getParsedTransaction":
                return mock_tx_data
            return None

        with patch.object(provider, "_rpc_call", side_effect=fake_rpc_call):
            activity = await provider.get_address_activity(test_addr, max_tx=10)
            assert len(activity) == 1
            assert activity[0].from_address == test_addr
            assert activity[0].amount == 1.0

            # Directional checks
            outgoing = await provider.get_outgoing_txs(test_addr, max_tx=10)
            assert len(outgoing) == 1
            assert outgoing[0].from_address == test_addr

            incoming = await provider.get_incoming_txs(test_addr, max_tx=10)
            assert len(incoming) == 0

    @pytest.mark.anyio
    async def test_invalid_address_returns_empty(self):
        provider = SolanaProvider()
        res = await provider.get_native_transactions("invalid_address")
        assert res == []
