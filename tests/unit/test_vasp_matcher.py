from backend.app.services.vasp.matcher import vasp_matcher
from backend.app.services.labels.store import label_store

def test_vasp_seed_loading():
    count = vasp_matcher.load_seed_data()
    assert count >= 1000, f"Expected 1000+ addresses, loaded {count}"

def test_vasp_address_matching():
    # Known Binance 14 hot wallet
    binance_addr = "0x28C6c06298d514Db089934071355E5743bf21d60"
    match = vasp_matcher.match_address(binance_addr)
    assert match is not None
    assert match["vasp_name"] == "Binance"
    assert match["confidence"] in ["HIGH", "VERIFIED"]
    assert match["verification_status"] == "verified"
    assert vasp_matcher.is_known_vasp(binance_addr) is True

def test_unknown_address_matching():
    unknown_addr = "0x000000000000000000000000000000000000dead"
    match = vasp_matcher.match_address(unknown_addr)
    assert match is None
    assert vasp_matcher.is_known_vasp(unknown_addr) is False

# --- Solana VASP Matching & Attribution (Phase 3) ---

def test_solana_vasp_matching():
    binance_sol_1 = "5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe"
    binance_sol_2 = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM"
    coinbase_sol = "2AQdpHJ2JpcEgBtAZubqznPUwhG13nM69qKEmaJ13G3b"
    kraken_sol = "FWznbcNXWQuHTawe9RxvQ2LdJF24zVnSZTGpzZMnLnh8"
    okx_sol = "5VCwKtCXgCJ6kit5FybXjvmsWnGn6XZ8NFgkWDV1b63X"
    bybit_sol = "AC5RDfQFmDS1deWZos921qqvw3LNo8KSmCHbZc2gHSU8"

    # Match Binance Solana hot wallets
    m1 = vasp_matcher.match_address(binance_sol_1)
    assert m1 is not None
    assert m1["vasp_name"] == "Binance"
    assert m1["chain"] == "solana"
    assert vasp_matcher.is_vasp(binance_sol_1) is True
    assert vasp_matcher.get_vasp_name(binance_sol_1) == "Binance"

    m2 = vasp_matcher.match_address(binance_sol_2)
    assert m2 is not None
    assert m2["vasp_name"] == "Binance"
    assert m2["chain"] == "solana"

    # Match Coinbase, Kraken, OKX, Bybit on Solana
    assert vasp_matcher.get_vasp_name(coinbase_sol) == "Coinbase"
    assert vasp_matcher.get_vasp_name(kraken_sol) == "Kraken"
    assert vasp_matcher.get_vasp_name(okx_sol) == "OKX"
    assert vasp_matcher.get_vasp_name(bybit_sol) == "Bybit"

def test_label_store_solana_vasp_resolution():
    binance_sol = "5tzFkiKscMRHK5ZXWBZXZUXJwomD5pmQV82QEGxmqVCe"
    label = label_store.lookup(binance_sol)
    assert label is not None
    assert label.entity == "Binance"
    assert label.chain == "solana"
    assert label.is_vasp is True
    assert label_store.is_vasp(binance_sol) is True
    assert label_store.get_vasp_name(binance_sol) == "Binance"

    coinbase_sol = "2AQdpHJ2JpcEgBtAZubqznPUwhG13nM69qKEmaJ13G3b"
    assert label_store.get_vasp_name(coinbase_sol) == "Coinbase"

    kraken_sol = "FWznbcNXWQuHTawe9RxvQ2LdJF24zVnSZTGpzZMnLnh8"
    assert label_store.get_vasp_name(kraken_sol) == "Kraken"

