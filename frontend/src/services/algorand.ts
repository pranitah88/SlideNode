import { ALGORAND_NETWORK_CONFIG } from '../config/network';

export const ALGORAND_TESTNET_CONFIG = {
  network: ALGORAND_NETWORK_CONFIG.displayName,
  usdcAssetId: ALGORAND_NETWORK_CONFIG.usdcAssetId,
  usdcDecimals: ALGORAND_NETWORK_CONFIG.usdcDecimals,
  algodServer: ALGORAND_NETWORK_CONFIG.algodServer,
  indexerServer: ALGORAND_NETWORK_CONFIG.indexerServer
};

export interface WalletOnChainBalance {
  address: string;
  algoBalanceStr: string;
  usdcBalanceStr: string;
  algoVal: number;
  usdcVal: number;
  usdcBaseUnits: number;
  hasOptedIn: boolean;
  isLoading: boolean;
  error: string | null;
}

export const walletState = {
  address: "",
  algoBalance: "0.000 ALGO",
  usdcBalance: "0.00 USDC",
  algoVal: 0,
  usdcVal: 0,
  hasOptedIn: false,
  isLoading: false,
  error: null as string | null
};

/**
 * Fetches real on-chain ALGO and USDC ASA (10458941) balances directly
 * from the Algorand Testnet Algod/Indexer API.
 *
 * NEVER returns a hardcoded or cached value when forceRefresh is true.
 * Always hits the blockchain API when forceRefresh=true.
 */
export async function fetchOnChainBalances(
  walletAddress: string,
  forceRefresh: boolean = false
): Promise<WalletOnChainBalance> {
  const cleanAddr = (walletAddress || "").trim();

  if (!cleanAddr) {
    console.warn("[ALGO BALANCE] No wallet address provided — returning zeroes.");
    walletState.address = "";
    walletState.algoBalance = "0.000 ALGO";
    walletState.usdcBalance = "0.00 USDC";
    walletState.algoVal = 0;
    walletState.usdcVal = 0;
    walletState.hasOptedIn = false;
    walletState.isLoading = false;
    walletState.error = null;
    return {
      address: "",
      algoBalanceStr: "0.000 ALGO",
      usdcBalanceStr: "0.00 USDC",
      algoVal: 0,
      usdcVal: 0,
      usdcBaseUnits: 0,
      hasOptedIn: false,
      isLoading: false,
      error: null
    };
  }

  // Debug log every fetch attempt
  console.log("Fetching latest wallet data");
  console.log(`[ALGO BALANCE] Fetching on-chain balance for ${cleanAddr.substring(0, 8)}...${cleanAddr.substring(cleanAddr.length - 6)}`);
  console.log(`[ALGO BALANCE] Network: ${ALGORAND_TESTNET_CONFIG.network}`);
  console.log(`[ALGO BALANCE] USDC Asset ID: ${ALGORAND_TESTNET_CONFIG.usdcAssetId}`);

  let data: any = null;
  let fetchErr: any = null;

  // Endpoint 1: Algod Node (primary)
  const algodUrl = `${ALGORAND_TESTNET_CONFIG.algodServer}/v2/accounts/${cleanAddr}`;
  try {
    console.log(`[ALGO BALANCE] Querying Algod: ${algodUrl}`);
    const response = await fetch(algodUrl, {
      headers: { "Accept": "application/json" },
      cache: "no-store"  // Prevent browser HTTP cache
    });
    if (response.ok) {
      data = await response.json();
      console.log(`[ALGO BALANCE] Algod response OK. Raw account amount: ${data.amount}, assets count: ${(data.assets || []).length}`);
    } else if (response.status === 404) {
      console.warn(`[ALGO BALANCE] Algod returned 404 — account not found on Testnet.`);
      data = { amount: 0, assets: [] };
    } else {
      console.warn(`[ALGO BALANCE] Algod returned HTTP ${response.status}`);
    }
  } catch (e) {
    fetchErr = e;
    console.warn(`[ALGO BALANCE] Algod fetch error:`, e);
  }

  // Endpoint 2 Fallback: Indexer Node
  if (!data) {
    const indexerUrl = `${ALGORAND_TESTNET_CONFIG.indexerServer}/v2/accounts/${cleanAddr}`;
    try {
      console.log(`[ALGO BALANCE] Querying Indexer fallback: ${indexerUrl}`);
      const idxRes = await fetch(indexerUrl, {
        headers: { "Accept": "application/json" },
        cache: "no-store"
      });
      if (idxRes.ok) {
        const idxData = await idxRes.json();
        data = idxData.account || idxData;
        console.log(`[ALGO BALANCE] Indexer response OK. Raw account amount: ${data.amount}, assets count: ${(data.assets || []).length}`);
      } else if (idxRes.status === 404) {
        console.warn(`[ALGO BALANCE] Indexer returned 404 — account not found.`);
        data = { amount: 0, assets: [] };
      } else {
        console.warn(`[ALGO BALANCE] Indexer returned HTTP ${idxRes.status}`);
      }
    } catch (e) {
      console.error(`[ALGO BALANCE] Both Algod and Indexer fetch FAILED for ${cleanAddr}:`, fetchErr || e);
    }
  }

  // If both endpoints failed, return error state — NEVER a fake number
  if (!data) {
    console.error(`[ALGO BALANCE] FAILED to fetch any data for ${cleanAddr}. Returning error state.`);
    walletState.error = "Failed to connect to Algorand Testnet node";
    return {
      address: cleanAddr,
      algoBalanceStr: "Unable to load",
      usdcBalanceStr: "Unable to load",
      algoVal: 0,
      usdcVal: 0,
      usdcBaseUnits: 0,
      hasOptedIn: false,
      isLoading: false,
      error: "Failed to connect to Algorand Testnet node"
    };
  }

  // 1. Calculate ALGO Balance (amount in microAlgos / 10^6)
  const microAlgos = Number(data.amount || data["amount-without-pending-rewards"] || 0);
  const algoVal = microAlgos / 1_000_000;
  const algoBalanceStr = `${algoVal.toFixed(3)} ALGO`;

  // 2. Calculate USDC ASA (10458941) Balance
  const assets: any[] = data.assets || [];
  const usdcAsset = assets.find((a: any) => {
    const id = Number(a["asset-id"] || a["asset_id"] || a.assetId || 0);
    return id === ALGORAND_TESTNET_CONFIG.usdcAssetId;
  });

  let usdcBaseUnits = 0;
  let usdcVal = 0;
  let hasOptedIn = false;

  if (usdcAsset) {
    hasOptedIn = true;
    usdcBaseUnits = Number(usdcAsset.amount) || 0;
    usdcVal = usdcBaseUnits / Math.pow(10, ALGORAND_TESTNET_CONFIG.usdcDecimals);
  }

  const usdcBalanceStr = `${usdcVal.toFixed(2)} USDC`;

  // Update global walletState directly
  walletState.address = cleanAddr;
  walletState.algoBalance = algoBalanceStr;
  walletState.usdcBalance = usdcBalanceStr;
  walletState.algoVal = algoVal;
  walletState.usdcVal = usdcVal;
  walletState.hasOptedIn = hasOptedIn;
  walletState.isLoading = false;
  walletState.error = null;

  console.log("Live ALGO balance:", algoBalanceStr);
  console.log("Live USDC balance:", usdcBalanceStr);
  console.log("Wallet UI updated");

  const result: WalletOnChainBalance = {
    address: cleanAddr,
    algoBalanceStr,
    usdcBalanceStr,
    algoVal,
    usdcVal,
    usdcBaseUnits,
    hasOptedIn,
    isLoading: false,
    error: null
  };

  return result;
}

/**
 * Clears any remaining references (no-op now that cache is removed).
 * Kept for backward compatibility with existing call sites.
 */
export function invalidateBalanceCache(_walletAddress?: string) {
  // No cache to invalidate — every call goes directly to blockchain.
}

/**
 * Force refresh ALGO and USDC ASA balances from Algorand Testnet.
 * Always queries the blockchain directly — never returns cached data.
 * Dispatches a global 'wallet-balance-updated' event so the wallet modal
 * and any other listeners can update their UI.
 */
export async function refreshWalletBalances(walletAddress?: string): Promise<WalletOnChainBalance> {
  const cleanAddr = (walletAddress || walletState.address || "").trim();
  console.log("Fetching latest wallet data");

  const result = await fetchOnChainBalances(cleanAddr, true);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-balance-updated', { detail: result }));
  }

  return result;
}

// Alias export for single/plural function name
export const refreshWalletBalance = refreshWalletBalances;

/**
 * Post-payment balance refresh with retry.
 * Waits for the blockchain to settle (3 seconds), then fetches fresh balance.
 * If balance hasn't changed, retries once more after 4 seconds.
 */
export async function refreshBalanceAfterPayment(
  walletAddress: string,
  previousUsdcVal: number
): Promise<WalletOnChainBalance> {
  const cleanAddr = (walletAddress || "").trim();
  console.log("Fetching latest wallet data");
  console.log(`[POST-PAYMENT] Previous USDC balance: ${previousUsdcVal.toFixed(2)} USDC`);

  // Wait 3 seconds for blockchain to settle the transaction
  await new Promise(resolve => setTimeout(resolve, 3000));

  let result = await refreshWalletBalances(cleanAddr);

  // If balance hasn't changed, the transaction may still be settling — retry after 4 more seconds
  if (Math.abs(result.usdcVal - previousUsdcVal) < 0.001 && !result.error) {
    console.log(`[POST-PAYMENT] Balance unchanged — retrying in 4s...`);
    await new Promise(resolve => setTimeout(resolve, 4000));
    result = await refreshWalletBalances(cleanAddr);
  }

  return result;
}

