import pytest
from backend.app.core.config import settings
from backend.app.core.address_validator import (
    is_valid_eth_address,
    is_valid_tron_address,
    is_valid_btc_address,
    is_valid_sol_address,
    is_valid_crypto_address,
    detect_blockchain,
    normalize_address,
    normalize_eth_address,
    to_checksum_address
)

def test_valid_eth_addresses():
    valid_addr = "0x28C6c06298d514Db089934071355E5743bf21d60"
    assert is_valid_eth_address(valid_addr) is True
    assert normalize_eth_address(valid_addr) == "0x28c6c06298d514db089934071355e5743bf21d60"

def test_invalid_eth_addresses():
    assert is_valid_eth_address("0x123") is False
    assert is_valid_eth_address("not_an_address") is False
    assert is_valid_eth_address("0xG8C6c06298d514Db089934071355E5743bf21d60") is False  # invalid hex 'G'
    assert is_valid_eth_address("") is False
    assert is_valid_eth_address(None) is False

def test_normalization_error_on_invalid():
    with pytest.raises(ValueError):
        normalize_eth_address("0xinvalid")


# --- Solana Address Validation & Multi-Chain Detection (Phase 1) ---

def test_valid_solana_addresses():
    known_sol_addresses = [
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",  # Binance Hot Wallet 2
        "5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe",  # Binance Hot Wallet 1
        "2AQdpHJ2JpcEgBtAZubqznPUwhG13nM69qKEmaJ13G3b",  # Coinbase Prime Custody
        "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",  # Coinbase Cold Storage
        "FWznbcNXWQuHTawe9RxvQ2LdJF24zVnSZTGpzZMnLnh8",  # Kraken Hot Wallet
        "5VCwKtCXgCJ6kit5FybXjvmsWnGn6XZ8NFgkWDV1b63X",  # OKX Hot Wallet
        "AC5RDfQFmDS1deWZos921qqvw3LNo8KSmCHbZc2gHSU8",  # Bybit Hot Wallet
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",   # SPL Token Program ID
    ]
    for addr in known_sol_addresses:
        assert is_valid_sol_address(addr) is True
        assert is_valid_crypto_address(addr) is True
        assert detect_blockchain(addr) == "solana"
        assert normalize_address(addr) == addr  # Case-preserving

def test_invalid_solana_addresses():
    invalid_addresses = [
        "",
        "   ",
        None,
        12345,
        "not_an_address",
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAW0",  # contains '0' (invalid Base58)
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWO",  # contains 'O' (invalid Base58)
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWl",  # contains 'l' (invalid Base58)
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWI",  # contains 'I' (invalid Base58)
        "9WzDXwBbmkg8",                                  # too short (< 32 chars)
        "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM" * 2,  # too long (> 44 chars)
    ]
    for addr in invalid_addresses:
        assert is_valid_sol_address(addr) is False

def test_multi_chain_disambiguation():
    eth_addr = "0x28C6c06298d514Db089934071355E5743bf21d60"
    tron_addr = "TMuA6YMeL4nNFYWAnWUCtqnmEvrCfsugnR"
    btc_legacy = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
    btc_p2sh = "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"
    btc_bech32 = "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"
    sol_addr = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"

    # Verify Solana validator rejects non-Solana addresses
    assert is_valid_sol_address(eth_addr) is False
    assert is_valid_sol_address(tron_addr) is False
    assert is_valid_sol_address(btc_legacy) is False
    assert is_valid_sol_address(btc_p2sh) is False
    assert is_valid_sol_address(btc_bech32) is False

    # Verify detect_blockchain correctly disambiguates each network
    assert detect_blockchain(eth_addr) == "ethereum"
    assert detect_blockchain(tron_addr) == "tron"
    assert detect_blockchain(btc_legacy) == "bitcoin"
    assert detect_blockchain(btc_p2sh) == "bitcoin"
    assert detect_blockchain(btc_bech32) == "bitcoin"
    assert detect_blockchain(sol_addr) == "solana"

    # All should be considered valid general crypto addresses
    for addr in [eth_addr, tron_addr, btc_legacy, btc_p2sh, btc_bech32, sol_addr]:
        assert is_valid_crypto_address(addr) is True

def test_solana_config_settings():
    assert settings.SOLANA_RPC_URL == "https://api.mainnet-beta.solana.com"
    assert settings.SOLANA_REQUEST_TIMEOUT_SECONDS == 12.0
    assert hasattr(settings, "SOLSCAN_API_KEY")

