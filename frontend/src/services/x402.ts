import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { Buffer } from "buffer";

if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}
if (typeof globalThis !== "undefined") {
  (globalThis as any).Buffer = Buffer;
}

console.log("Buffer available:", typeof Buffer);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

import { auth } from './auth';
import { fetchOnChainBalances } from './algorand';
import { getConnectedPeraAddress, initPeraWalletSession, signTransactionsWithPera } from './pera';

let activeAddress = "";

// Initialize wallet address from Pera Wallet session or backend signer
async function initActiveAddress() {
  // 1. Try Pera Wallet session first
  try {
    const peraAddr = await initPeraWalletSession();
    if (peraAddr) {
      activeAddress = peraAddr;
      console.log("[WALLET] Connected Pera Wallet address:", activeAddress);
      return;
    }
  } catch (e) {}

  // 2. Try backend signer (/api/test/sign)
  try {
    const res = await fetch(`${API_URL}/api/test/sign`);
    const data = await res.json();
    if (data && data.address) {
      activeAddress = data.address;
      console.log("[WALLET] Connected address:", activeAddress);
      console.log("[WALLET] Address source: backend signer (/api/test/sign)");
      return;
    }
  } catch (err) {
    console.warn("[X402 FRONTEND] Could not fetch signer address from backend:", err);
  }

  // 3. Fallback: try user wallet from Supabase
  try {
    const userWallet = await auth.getUserWallet();
    if (userWallet?.address && userWallet.address !== "NOT_SET" && userWallet.address !== "SHATJ64UNTP4ROCYV4YW4YZVNLR66ZTNZ3LZMNXXRCREPIZHGX5ZYR25GU") {
      activeAddress = userWallet.address;
      console.log("[WALLET] Connected address (from Supabase wallet):", activeAddress);
      return;
    }
  } catch (e) {}

  console.warn("[WALLET] Could not determine wallet address — balance will show Loading until resolved.");
}

initActiveAddress();

const clientAvmSigner = {
  get address() {
    const peraAddr = getConnectedPeraAddress();
    return peraAddr || activeAddress;
  },
  set address(val: string) {
    activeAddress = val;
  },
  signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]) => {
    const currentAddr = getConnectedPeraAddress() || activeAddress;
    console.log(`[WALLET] Signing address: ${currentAddr}`);

    // Verify wallet's real on-chain USDC ASA balance on Algorand Testnet before signing
    try {
      const onChain = await fetchOnChainBalances(currentAddr, true);
      console.log(`[WALLET] USDC balance before payment: ${onChain.usdcVal} USDC`);

      if (onChain.usdcVal <= 0) {
        console.error("[X402 FRONTEND ERROR] Wallet has 0 USDC balance on Algorand Testnet");
        throw new Error(`Insufficient USDC balance: Connected wallet (${currentAddr.substring(0, 8)}...) has 0 USDC on Algorand Testnet. Payment rejected.`);
      }
    } catch (balErr: any) {
      if (balErr.message && balErr.message.includes("Insufficient USDC balance")) {
        throw balErr;
      }
      console.warn("[X402 FRONTEND] Balance query warning:", balErr);
    }

    // Route all transaction signing through Pera Wallet UI
    console.log("[X402 FRONTEND] Routing transaction signing to Pera Wallet UI...");
    const signedResult = await signTransactionsWithPera(txns, indexesToSign);
    console.log("Transaction submitted");
    return signedResult;

    // Fallback: Remote signing endpoint for dev/test
    const targetIndexes = indexesToSign || txns.map((_, i) => i);
    const txnsBase64 = txns.map(tx => Buffer.from(tx).toString('base64'));

    const response = await fetch(`${API_URL}/api/test/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txns: txnsBase64, indexesToSign: targetIndexes, payerAddress: currentAddr }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      console.error("[X402 FRONTEND] Wallet signing failed:", errBody.error || response.statusText);
      throw new Error(errBody.error || `Wallet signing failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.error) {
      console.error("[X402 FRONTEND] Wallet signing error:", result.error);
      throw new Error(`Wallet signing error: ${result.error}`);
    }

    console.log("[X402 FRONTEND] Transaction group signed successfully");
    
    let signedIdx = 0;
    return txns.map((_, i) => {
      if (targetIndexes.includes(i)) {
        const b64 = result.signedTxns[signedIdx++];
        return b64 ? new Uint8Array(Buffer.from(b64, 'base64')) : null;
      }
      return null;
    });
  }
};

const coreClient = new x402Client().register("algorand:*", new ExactAvmScheme(clientAvmSigner));

export type X402PaymentStatus = 
  | 'idle'
  | 'checking_balance'
  | 'waiting_wallet'
  | 'confirming_payment'
  | 'verifying_payment'
  | 'settling'
  | 'confirming'
  | 'verified'
  | 'insufficient_balance'
  | 'failed';

let statusCallback: ((status: X402PaymentStatus, details?: any) => void) | null = null;

export const setX402StatusCallback = (cb: (status: X402PaymentStatus, details?: any) => void) => {
  statusCallback = cb;
};

coreClient.onBeforePaymentCreation(async () => {
  console.log("[ X402 ] Server returned 402 Payment Required");
  console.log("[ X402 ] Payment requirements received from backend");
  console.log("[ X402 ] Connected wallet:", clientAvmSigner.address);
  if (statusCallback) statusCallback('waiting_wallet');
});

coreClient.onAfterPaymentCreation(async () => {
  console.log("[ X402 ] Transaction signed");
  console.log("[ X402 ] Submitting payment proof to facilitator");
  if (statusCallback) statusCallback('confirming_payment');
});

coreClient.onPaymentCreationFailure(async (err) => {
  console.error("[ X402 ] Payment proof creation failed:", err);
  if (statusCallback) statusCallback('failed', err);
});

coreClient.onPaymentResponse(async (response: any) => {
  console.log("[ X402 ] Verifying payment on backend & Algorand Testnet");
  if (statusCallback) statusCallback('verifying_payment');
});

const wrappedFetch = wrapFetchWithPayment(window.fetch.bind(window), coreClient);

export const x402Fetch = wrappedFetch;
export const x402 = {
  fetch: wrappedFetch,
  setStatusCallback: setX402StatusCallback,
  getWalletAddress: () => activeAddress
};
