// Single Source of Truth for Algorand Network Configuration
// Entire frontend application MUST import network parameters from this file.

export const ALGORAND_NETWORK_CONFIG = {
  networkName: "testnet" as const, // Central flag: ALGORAND_NETWORK=testnet
  displayName: "Algorand Testnet",
  chainId: 416002 as const, // Pera Wallet Testnet Chain ID (416002 = TestNet, 416001 = MainNet)
  genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  genesisId: "testnet-v1.0",
  caip2Network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  usdcAssetId: 10458941,
  usdcDecimals: 6,
  algodServer: "https://testnet-api.algonode.cloud",
  indexerServer: "https://testnet-idx.algonode.cloud",
  facilitatorUrl: "https://facilitator.goplausible.xyz",
  explorerBaseUrl: "https://testnet.explorer.perawallet.app"
};
