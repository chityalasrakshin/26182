from backend.app.core.config import settings
from backend.app.core.address_validator import (
    detect_blockchain, is_valid_tron_address, is_valid_btc_address,
    is_valid_eth_address, detect_evm_chain
)
from backend.app.services.blockchain.base import BlockchainProvider
from backend.app.services.blockchain.etherscan import EtherscanProvider
from backend.app.services.blockchain.tron import TronProvider
from backend.app.services.blockchain.bitcoin import BitcoinProvider


class BlockchainProviderFactory:
    """
    Factory automatically routing to the appropriate blockchain provider
    (Ethereum, Tron, Bitcoin, Polygon, BSC, Arbitrum) based on the address
    prefix/network or explicit chain name.

    Multi-EVM chains are served by the same EtherscanProvider class, with
    the chainid parameter configured per-chain via the Etherscan v2 API.
    """

    # Etherscan v2 API URLs and chain IDs for multi-EVM support
    EVM_CHAIN_CONFIG = {
        "ethereum": {"chain_id": "1", "api_url": "https://api.etherscan.io/v2/api"},
        "polygon": {"chain_id": "137", "api_url": "https://api.etherscan.io/v2/api"},
        "bsc": {"chain_id": "56", "api_url": "https://api.etherscan.io/v2/api"},
        "arbitrum": {"chain_id": "42161", "api_url": "https://api.etherscan.io/v2/api"},
    }

    @staticmethod
    def get_provider(address_or_chain: str = "ethereum") -> BlockchainProvider:
        """
        Get the appropriate blockchain provider for the given address or chain name.

        Args:
            address_or_chain: Either a wallet address (auto-detected) or an explicit
                            chain name (ethereum, tron, bitcoin, polygon, bsc, arbitrum)

        Returns:
            BlockchainProvider instance configured for the target chain
        """
        arg = address_or_chain.strip()
        arg_lower = arg.lower()

        # --- Explicit chain name routing ---

        # Bitcoin by name
        if arg_lower == "bitcoin" or arg_lower == "btc":
            return BitcoinProvider()

        # Tron by name
        if arg_lower == "tron" or arg_lower == "trx":
            return TronProvider()

        # EVM chains by name
        if arg_lower in BlockchainProviderFactory.EVM_CHAIN_CONFIG:
            config = BlockchainProviderFactory.EVM_CHAIN_CONFIG[arg_lower]
            return EtherscanProvider(
                api_key=settings.BLOCKCHAIN_API_KEY,
                api_url=config["api_url"],
                chain_id=config["chain_id"],
            )

        # --- Address-based auto-detection ---

        # Check Tron address
        if is_valid_tron_address(arg):
            return TronProvider()

        # Check Bitcoin address
        if is_valid_btc_address(arg):
            return BitcoinProvider()

        # Check Ethereum / EVM address (default for 0x addresses)
        if is_valid_eth_address(arg):
            return EtherscanProvider(
                api_key=settings.BLOCKCHAIN_API_KEY,
                api_url=settings.BLOCKCHAIN_API_URL,
            )

        # Default: Ethereum Etherscan-compatible provider
        return EtherscanProvider(
            api_key=settings.BLOCKCHAIN_API_KEY,
            api_url=settings.BLOCKCHAIN_API_URL
        )

    @staticmethod
    def get_supported_chains() -> list:
        """Returns list of all supported blockchain chain names."""
        return ["ethereum", "tron", "bitcoin", "polygon", "bsc", "arbitrum"]
