import urllib.request
import csv
import io
import re
import json
import yaml
from pathlib import Path

KNOWN_ENTITIES = {
    # Tornado Cash Core Contracts & Router
    "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b": ("Tornado Cash", "Tornado Cash Router", "mixer", "CYBER2", "ethereum"),
    "0x8589427373d6d84e98730d7795d8f6f8731fda16": ("Tornado Cash", "Tornado Cash 0.1 ETH", "mixer", "CYBER2", "ethereum"),
    "0x722122df12d4e14e13ac3b6895a86e84145b6967": ("Tornado Cash", "Tornado Cash 1 ETH", "mixer", "CYBER2", "ethereum"),
    "0xdd4c48c0b24039969fc16d1cdf626eab821d3384": ("Tornado Cash", "Tornado Cash 10 ETH", "mixer", "CYBER2", "ethereum"),
    "0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3": ("Tornado Cash", "Tornado Cash 100 ETH", "mixer", "CYBER2", "ethereum"),
    "0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc": ("Tornado Cash", "Tornado Cash 0.1 WBTC", "mixer", "CYBER2", "ethereum"),
    "0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936": ("Tornado Cash", "Tornado Cash 100 DAI", "mixer", "CYBER2", "ethereum"),
    "0x910cbd523d972eb0a6f4cae4618ad62622b39dbf": ("Tornado Cash", "Tornado Cash 1,000 DAI", "mixer", "CYBER2", "ethereum"),
    "0xa160cdab225685da1d56aa342ad8841c3b53f291": ("Tornado Cash", "Tornado Cash 10,000 DAI", "mixer", "CYBER2", "ethereum"),
    "0xfd8610d1fb1e3f2fe3b130a00f024140a195d126": ("Tornado Cash", "Tornado Cash 100,000 DAI", "mixer", "CYBER2", "ethereum"),
    "0x169ad27a470d064dede56a2d3ff727986b15d52b": ("Tornado Cash", "Tornado Cash 5,000 USDC", "mixer", "CYBER2", "ethereum"),
    "0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f": ("Tornado Cash", "Tornado Cash 50,000 USDC", "mixer", "CYBER2", "ethereum"),
    "0xbb93e448b2a034ab1a8b854acd538634bbe556a8": ("Tornado Cash", "Tornado Cash 100 USDT", "mixer", "CYBER2", "ethereum"),
    "0x0277eb79e50693f50f00a45388804ff17450380c": ("Tornado Cash", "Tornado Cash 1,000 USDT", "mixer", "CYBER2", "ethereum"),
    # Lazarus Group DPRK
    "0x098b716b8aaf21512996dc57eb0615e2383e2f96": ("Lazarus Group (DPRK)", "Ronin Bridge Exploiter", "sanctioned", "DPRK", "ethereum"),
    # Garantex Exchange
    "0x2649b2830fc3aa003a276b6c035c834375bfe5a4": ("Garantex", "Garantex Hot Wallet", "sanctioned", "RUSSIA-EO14024", "ethereum"),
    # Hydra Market
    "149vaAYqWbZsQjMsGGCtVafjnhXWgk3vGu": ("Hydra Market", "Hydra Marketplace Deposit", "sanctioned", "CYBER2", "bitcoin"),
}

def infer_chain(addr: str, asset_hint: str = "") -> str:
    clean = addr.strip()
    if clean.startswith("0x") or clean.startswith("0X"):
        asset_u = (asset_hint or "").upper()
        if asset_u in ["ARB", "ARBITRUM"]:
            return "arbitrum"
        if asset_u in ["BSC", "BNB"]:
            return "bsc"
        return "ethereum"
    if clean.startswith("1") or clean.startswith("3") or clean.startswith("bc1"):
        return "bitcoin"
    if clean.startswith("T") and len(clean) == 34:
        return "tron"
    asset_u = (asset_hint or "").upper()
    if asset_u in ["SOL", "SOLANA"]:
        return "solana"
    if asset_u in ["LTC", "LITECOIN"]:
        return "litecoin"
    if asset_u in ["BCH", "BITCOIN CASH"]:
        return "bitcoin_cash"
    if asset_u in ["DASH"]:
        return "dash"
    if asset_u in ["ZEC", "ZCASH"]:
        return "zcash"
    if asset_u in ["XMR", "MONERO"]:
        return "monero"
    if asset_u in ["DOGE", "DOGECOIN"]:
        return "dogecoin"
    if asset_u in ["ETC", "ETHEREUM CLASSIC"]:
        return "ethereum_classic"
    if asset_u in ["BTG", "BITCOIN GOLD"]:
        return "bitcoin_gold"
    if asset_u in ["XVG", "VERGE"]:
        return "verge"
    if asset_u in ["XRP", "RIPPLE"]:
        return "ripple"
    return "unknown"

def normalize_address(addr: str) -> str:
    clean = addr.strip()
    if clean.startswith("0x") or clean.startswith("0X"):
        return clean.lower()
    if clean.startswith("bc1"):
        return clean.lower()
    return clean

def main():
    records_by_address = {}

    def add_record(address, chain, entity, label, category, program, sanctions_source="US Treasury OFAC SDN"):
        norm_addr = normalize_address(address)
        if not norm_addr:
            return

        # Check known overrides first
        addr_lower = norm_addr.lower()
        if addr_lower in KNOWN_ENTITIES:
            ent, lbl, cat, prog, ch = KNOWN_ENTITIES[addr_lower]
            records_by_address[norm_addr] = {
                "address": norm_addr,
                "chain": ch,
                "entity": ent,
                "label": lbl,
                "category": cat,
                "program": prog,
                "sanctions_source": sanctions_source
            }
            return

        existing = records_by_address.get(norm_addr)
        if not existing:
            records_by_address[norm_addr] = {
                "address": norm_addr,
                "chain": chain,
                "entity": entity,
                "label": label,
                "category": category,
                "program": program,
                "sanctions_source": sanctions_source
            }
        else:
            # Upgrade entity if current is generic
            if existing["entity"] == "OFAC Sanctioned Entity" and entity != "OFAC Sanctioned Entity":
                existing["entity"] = entity
                existing["label"] = label
                existing["category"] = category
                existing["program"] = program
            # Keep more specific chain if existing was unknown
            if existing["chain"] == "unknown" and chain != "unknown":
                existing["chain"] = chain

    # 1. 0xB10C Sanctions Lists
    print("Pulling 0xB10C Sanctions Lists...")
    b10c_assets = [
        ("ETH", "ethereum"),
        ("XBT", "bitcoin"),
        ("TRX", "tron"),
        ("SOL", "solana"),
        ("BSC", "bsc"),
        ("ARB", "arbitrum"),
        ("USDT", "ethereum"),
        ("USDC", "ethereum"),
        ("LTC", "litecoin"),
        ("BCH", "bitcoin_cash"),
        ("DASH", "dash"),
        ("ZEC", "zcash"),
        ("XMR", "monero"),
    ]
    for asset_name, default_ch in b10c_assets:
        try:
            url = f"https://raw.githubusercontent.com/0xB10C/ofac-sanctioned-digital-currency-addresses/lists/sanctioned_addresses_{asset_name}.json"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            addrs = json.loads(urllib.request.urlopen(req, timeout=15).read().decode())
            for addr in addrs:
                ch = infer_chain(addr, asset_name)
                add_record(
                    address=addr,
                    chain=ch,
                    entity="OFAC Sanctioned Entity",
                    label=f"OFAC Sanctioned {asset_name} Address",
                    category="sanctioned",
                    program="OFAC SDN",
                    sanctions_source="US OFAC SDN Digital Currency List (via 0xB10C)"
                )
        except Exception as e:
            print(f"Error loading 0xB10C {asset_name}: {e}")

    # 2. GraphSense TagPacks
    print("Pulling GraphSense TagPacks...")
    gs_packs = [
        ("tornado_cash.yaml", "Tornado Cash", "mixer", "CYBER2", "ethereum"),
        ("blender_io.yaml", "Blender.io", "mixer", "DPRK3", "bitcoin"),
        ("sinbad_io.yaml", "Sinbad.io", "mixer", "DPRK3", "bitcoin"),
        ("lazarus.yaml", "Lazarus Group (DPRK)", "sanctioned", "DPRK", "bitcoin"),
        ("lazarus2.yaml", "Lazarus Group (DPRK)", "sanctioned", "DPRK", "bitcoin"),
        ("hydra.yaml", "Hydra Market", "sanctioned", "RUSSIA-EO14024", "bitcoin"),
    ]
    for pack_file, ent, cat, prog, default_ch in gs_packs:
        try:
            url = f"https://raw.githubusercontent.com/graphsense/graphsense-tagpacks/master/packs/{pack_file}"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            content = urllib.request.urlopen(req, timeout=15).read().decode("utf-8")
            data = yaml.safe_load(content)
            for t in data.get("tags", []):
                addr = t.get("address")
                if addr:
                    ch = infer_chain(addr, t.get("currency") or data.get("currency") or default_ch)
                    add_record(
                        address=addr,
                        chain=ch,
                        entity=ent,
                        label=f"{ent} Designated Address",
                        category=cat,
                        program=prog,
                        sanctions_source="US Treasury OFAC SDN (via GraphSense)"
                    )
        except Exception as e:
            print(f"Error loading GraphSense pack {pack_file}: {e}")

    # 3. Parse official SDN.CSV from US Treasury
    print("Parsing US Treasury SDN.CSV...")
    try:
        req = urllib.request.Request('https://www.treasury.gov/ofac/downloads/sdn.csv', headers={'User-Agent': 'Mozilla/5.0'})
        raw = urllib.request.urlopen(req, timeout=20).read().decode('utf-8', errors='ignore')
        reader = csv.reader(io.StringIO(raw))
        pattern = re.compile(r'(?:alt\.\s*)?Digital Currency Address\s*-\s*([A-Za-z0-9]+)\s+([a-zA-Z0-9]+)', re.IGNORECASE)

        for row in reader:
            if len(row) > 11 and "digital currency address" in row[11].lower():
                sdn_name = row[1].strip()
                program = row[3].strip() or "OFAC SDN"
                cat = "mixer" if any(m in sdn_name.upper() for m in ["TORNADO", "BLENDER", "SINBAD", "MIX"]) else "sanctioned"
                matches = pattern.findall(row[11])
                for asset, addr in matches:
                    asset_u = asset.upper()
                    ch = infer_chain(addr, asset_u)
                    add_record(
                        address=addr,
                        chain=ch,
                        entity=sdn_name,
                        label=f"{sdn_name} ({asset_u})",
                        category=cat,
                        program=program,
                        sanctions_source="US Treasury OFAC SDN"
                    )
    except Exception as e:
        print("Error reading SDN.CSV:", e)

    # 4. Enforce known high-priority entities
    for known_addr, (ent, lbl, cat, prog, ch) in KNOWN_ENTITIES.items():
        norm_addr = normalize_address(known_addr)
        # If there was a lowercased or alternate version, clean it
        if known_addr.lower() in records_by_address and known_addr.lower() != norm_addr:
            del records_by_address[known_addr.lower()]
        records_by_address[norm_addr] = {
            "address": norm_addr,
            "chain": ch,
            "entity": ent,
            "label": lbl,
            "category": cat,
            "program": prog,
            "sanctions_source": "US Treasury OFAC SDN"
        }

    # Convert to sorted list
    out_list = sorted(records_by_address.values(), key=lambda x: (x["chain"], x["entity"], x["address"]))

    out_path = Path("data/labels/ofac_sdn.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out_list, f, indent=2)
    print(f"Successfully wrote {len(out_list)} records to {out_path} ({out_path.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
