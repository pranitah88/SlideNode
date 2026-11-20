import algosdk from "algosdk";

export const ALGORAND_TESTNET_CONFIG = {
  network: "Algorand Testnet",
  genesisHash: "SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",
  usdcAssetId: 10458941,
  usdcDecimals: 6,
  algodServer: "https://testnet-api.algonode.cloud",
  indexerServer: "https://testnet-idx.algonode.cloud",
};

export interface UsdcBalanceResult {
  balanceBaseUnits: number;
  balanceUsdc: number;
  hasOptedIn: boolean;
}

/**
  * Reads the authoritative USDC ASA (10458941) balance directly from Algorand Testnet.
  */
export async function getOnChainUsdcBalance(walletAddress: string): Promise<UsdcBalanceResult> {
  if (!walletAddress || !walletAddress.trim()) {
    return { balanceBaseUnits: 0, balanceUsdc: 0, hasOptedIn: false };
  }

  try {
    const res = await fetch(`${ALGORAND_TESTNET_CONFIG.algodServer}/v2/accounts/${walletAddress.trim()}`);
    if (!res.ok) {
      console.warn(`[Algorand Testnet] Algod account fetch HTTP ${res.status} for ${walletAddress}`);
      return { balanceBaseUnits: 0, balanceUsdc: 0, hasOptedIn: false };
    }

    const data = await res.json();
    const assets = data.assets || [];
    const usdcAsset = assets.find((a: any) => Number(a["asset-id"]) === ALGORAND_TESTNET_CONFIG.usdcAssetId);

    if (!usdcAsset) {
      return { balanceBaseUnits: 0, balanceUsdc: 0, hasOptedIn: false };
    }

    const baseUnits = Number(usdcAsset.amount) || 0;
    const usdcVal = baseUnits / Math.pow(10, ALGORAND_TESTNET_CONFIG.usdcDecimals);

    return {
      balanceBaseUnits: baseUnits,
      balanceUsdc: usdcVal,
      hasOptedIn: true,
    };
  } catch (err: any) {
    console.error("[Algorand Testnet] Balance query error:", err?.message || err);
    return { balanceBaseUnits: 0, balanceUsdc: 0, hasOptedIn: false };
  }
}

export interface SettlementVerificationResult {
  isValid: boolean;
  error?: string;
  payerAddress?: string;
  merchantAddress?: string;
  assetId?: number;
  amountBaseUnits?: number;
  amountUsdc?: number;
  confirmedRound?: number;
}

/**
  * Verifies a settlement transaction on Algorand Testnet on-chain.
  */
export async function verifyOnChainSettlement(
  txId: string,
  expectedPayer?: string,
  expectedMerchant?: string,
  requiredAmountUsdc?: number
): Promise<SettlementVerificationResult> {
  console.log("TX ID", txId);
  console.log("Expected Network", "Algorand Testnet");
  console.log("Actual Network", ALGORAND_TESTNET_CONFIG.network);

  if (!txId || txId === "PENDING_SETTLEMENT" || txId === "VERIFIED_ON_CHAIN" || txId.length < 30) {
    console.log("Transaction Confirmed", false);
    return { isValid: false, error: `Invalid transaction ID reference: ${txId}` };
  }

  console.log(`[ALGO VERIFY] Querying Algorand Testnet Indexer/Algod for tx: ${txId}...`);

  const MAX_RETRIES = 6;
  const RETRY_DELAY_MS = 5000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let txData: any = null;

      // Try Indexer first — most reliable for confirmed transactions
      try {
        const idxRes = await fetch(`${ALGORAND_TESTNET_CONFIG.indexerServer}/v2/transactions/${txId}`, {
          headers: { "Accept": "application/json" }
        });
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          txData = idxData.transaction;
          if (txData) console.log(`[ALGO VERIFY] Indexer returned tx data on attempt ${attempt}`);
        }
      } catch (idxErr) {
        console.warn(`[ALGO VERIFY] Indexer fetch error (attempt ${attempt}):`, idxErr);
      }

      // Fallback: Algod pending transactions endpoint
      if (!txData) {
        try {
          const algodRes = await fetch(`${ALGORAND_TESTNET_CONFIG.algodServer}/v2/transactions/pending/${txId}`, {
            headers: { "Accept": "application/json" }
          });
          if (algodRes.ok) {
            txData = await algodRes.json();
            if (txData) console.log(`[ALGO VERIFY] Algod returned tx data on attempt ${attempt}`);
          }
        } catch (algodErr) {
          console.warn(`[ALGO VERIFY] Algod fetch error (attempt ${attempt}):`, algodErr);
        }
      }

      if (!txData) {
        console.log(`[ALGO VERIFY] Tx not found yet (attempt ${attempt}/${MAX_RETRIES}) — waiting ${RETRY_DELAY_MS}ms...`);
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      // Check if confirmed
      const confirmedRound = Number(
        txData["confirmed-round"] || txData["confirmedRound"] ||
        txData.txn?.["confirmed-round"] || 0
      );

      const confirmed = confirmedRound > 0;
      console.log("Transaction Confirmed", confirmed);

      if (!confirmed) {
        console.log(`[ALGO VERIFY] Tx still pending (round=0) on attempt ${attempt}/${MAX_RETRIES} — waiting ${RETRY_DELAY_MS}ms...`);
        if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      console.log(`[ALGO VERIFY] ✅ Tx confirmed at round ${confirmedRound} on attempt ${attempt}`);

      // Extract Asset Transfer details
      let txn = txData.txn?.txn || txData.txn || txData;
      let assetTransfer = txn["asset-transfer-transaction"] || txn.xaax || {};
      let assetId = Number(assetTransfer["asset-id"] || assetTransfer.xaid || 0);

      // Search atomic group if tx is part of group
      if (assetId !== ALGORAND_TESTNET_CONFIG.usdcAssetId && txData.group) {
        console.log(`[ALGO VERIFY] Searching atomic group ${txData.group} for USDC ASA ${ALGORAND_TESTNET_CONFIG.usdcAssetId}...`);
        try {
          const groupRes = await fetch(`${ALGORAND_TESTNET_CONFIG.indexerServer}/v2/transactions?group=${encodeURIComponent(txData.group)}`, {
            headers: { "Accept": "application/json" }
          });
          if (groupRes.ok) {
            const groupData = await groupRes.json();
            const groupTxns: any[] = groupData.transactions || [];
            const usdcTx = groupTxns.find((t: any) => {
              const innerTxn = t.txn?.txn || t.txn || t;
              const innerAsset = innerTxn["asset-transfer-transaction"] || innerTxn.xaax || {};
              return Number(innerAsset["asset-id"] || innerAsset.xaid || 0) === ALGORAND_TESTNET_CONFIG.usdcAssetId;
            });

            if (usdcTx) {
              console.log(`[ALGO VERIFY] ✅ Found USDC ASA transfer transaction in group! ID: ${usdcTx.id}`);
              txData = usdcTx;
              txn = txData.txn?.txn || txData.txn || txData;
              assetTransfer = txn["asset-transfer-transaction"] || txn.xaax || {};
              assetId = Number(assetTransfer["asset-id"] || assetTransfer.xaid || 0);
            }
          }
        } catch (gErr) {
          console.warn("[ALGO VERIFY] Group lookup warning:", gErr);
        }
      }

      // Search inner-txns array if present
      if (assetId !== ALGORAND_TESTNET_CONFIG.usdcAssetId && Array.isArray(txData["inner-txns"])) {
        const usdcInner = txData["inner-txns"].find((t: any) => {
          const innerTxn = t.txn?.txn || t.txn || t;
          const innerAsset = innerTxn["asset-transfer-transaction"] || innerTxn.xaax || {};
          return Number(innerAsset["asset-id"] || innerAsset.xaid || 0) === ALGORAND_TESTNET_CONFIG.usdcAssetId;
        });
        if (usdcInner) {
          txn = usdcInner.txn?.txn || usdcInner.txn || usdcInner;
          assetTransfer = txn["asset-transfer-transaction"] || txn.xaax || {};
          assetId = Number(assetTransfer["asset-id"] || assetTransfer.xaid || 0);
        }
      }

      const receiver = String(assetTransfer["receiver"] || assetTransfer.arcv || "");
      const amountBaseUnits = Number(assetTransfer["amount"] || assetTransfer.aamt || 0);
      const amountUsdc = amountBaseUnits / Math.pow(10, ALGORAND_TESTNET_CONFIG.usdcDecimals);
      const sender = String(txn["sender"] || txn.snd || "");

      // Emit exact required debugging logs
      console.log("Expected Asset ID", ALGORAND_TESTNET_CONFIG.usdcAssetId);
      console.log("Actual Asset ID", assetId);

      console.log("Expected Receiver", expectedMerchant || "N/A");
      console.log("Actual Receiver", receiver);

      console.log("Expected Amount", requiredAmountUsdc ? requiredAmountUsdc + " USDC" : "N/A");
      console.log("Actual Amount", amountUsdc + " USDC");

      // 1. Verify ASA ID matches USDC (10458941)
      if (assetId !== ALGORAND_TESTNET_CONFIG.usdcAssetId) {
        console.log("Complete Transaction Object:", JSON.stringify(txData, null, 2));
        const errMsg = `Asset ID mismatch: Expected ${ALGORAND_TESTNET_CONFIG.usdcAssetId}, got ${assetId}`;
        console.error(`[ALGO VERIFY REJECT] ${errMsg}`);
        return { isValid: false, error: errMsg };
      }

      // 2. Verify Recipient Address
      if (expectedMerchant && receiver !== expectedMerchant) {
        console.log("Complete Transaction Object:", JSON.stringify(txData, null, 2));
        const errMsg = `Receiver mismatch: Expected ${expectedMerchant}, got ${receiver}`;
        console.error(`[ALGO VERIFY REJECT] ${errMsg}`);
        return { isValid: false, error: errMsg };
      }

      // 3. Verify Payer Address if provided
      if (expectedPayer && sender !== expectedPayer) {
        console.log("Complete Transaction Object:", JSON.stringify(txData, null, 2));
        const errMsg = `Sender mismatch: Expected ${expectedPayer}, got ${sender}`;
        console.error(`[ALGO VERIFY REJECT] ${errMsg}`);
        return { isValid: false, error: errMsg };
      }

      // 4. Verify Amount
      if (requiredAmountUsdc && requiredAmountUsdc > 0) {
        const requiredBaseUnits = Math.round(requiredAmountUsdc * Math.pow(10, ALGORAND_TESTNET_CONFIG.usdcDecimals));
        if (amountBaseUnits < requiredBaseUnits) {
          console.log("Complete Transaction Object:", JSON.stringify(txData, null, 2));
          const errMsg = `Amount mismatch: Expected ${requiredAmountUsdc} USDC (${requiredBaseUnits} base units), got ${amountUsdc} USDC (${amountBaseUnits} base units)`;
          console.error(`[ALGO VERIFY REJECT] ${errMsg}`);
          return { isValid: false, error: errMsg };
        }
      }

      console.log(`[ALGO VERIFY] ✅ Verification passed for tx: ${txId}`);

      return {
        isValid: true,
        payerAddress: sender,
        merchantAddress: receiver,
        assetId,
        amountBaseUnits,
        amountUsdc,
        confirmedRound,
      };
    } catch (err: any) {
      console.error(`[ALGO VERIFY] Exception on attempt ${attempt}:`, err?.message || err);
      if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
  }

  console.log("Transaction Confirmed", false);
  const errMsg = `Transaction not confirmed: Transaction ${txId} was not found or confirmed on Algorand Testnet within ${(MAX_RETRIES * RETRY_DELAY_MS) / 1000}s`;
  console.error(`[ALGO VERIFY REJECT] ${errMsg}`);
  return { isValid: false, error: errMsg };
}

