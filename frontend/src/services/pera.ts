import { PeraWalletConnect } from "@perawallet/connect";
import algosdk from "algosdk";
import { fetchOnChainBalances } from "./algorand";
import { ALGORAND_NETWORK_CONFIG } from "../config/network";

// Initialize PeraWalletConnect instance configured for Algorand Testnet (chainId: 416002)
export const peraWallet = new PeraWalletConnect({
  chainId: ALGORAND_NETWORK_CONFIG.chainId,
});

let connectedPeraAddress = "";

export function getConnectedPeraAddress(): string {
  return connectedPeraAddress;
}

export function setConnectedPeraAddress(addr: string) {
  connectedPeraAddress = addr;
}

/**
 * Reconnect existing session on page load if user previously connected Pera Wallet
 */
export async function initPeraWalletSession(): Promise<string> {
  try {
    const accounts = await peraWallet.reconnectSession();
    peraWallet.connector?.on("disconnect", handleDisconnect);
    if (accounts && accounts.length > 0) {
      connectedPeraAddress = accounts[0];
      console.log("[PERA WALLET] Session reconnected:", connectedPeraAddress);
      return connectedPeraAddress;
    }
  } catch (e) {
    // Session not found or expired
  }
  return "";
}

/**
 * Connect to Pera Wallet (opens Pera Wallet's official UI: QR Code / Web / Extension)
 * Our application receives ONLY the public wallet address.
 * NEVER asks for PIN, password, mnemonic, or seed phrase.
 */
export async function connectPeraWallet(): Promise<string> {
  try {
    // Explicitly pass central chainId (416002 - Algorand Testnet) so Pera Mobile QR code requests Testnet, not Mainnet
    const accounts = await peraWallet.connect({ chainId: ALGORAND_NETWORK_CONFIG.chainId });
    peraWallet.connector?.on("disconnect", handleDisconnect);
    if (accounts && accounts.length > 0) {
      connectedPeraAddress = accounts[0];
      console.log("[PERA WALLET] Connected public wallet address (Testnet 416002):", connectedPeraAddress);

      // Trigger live balance refresh from Algorand Testnet
      const balances = await fetchOnChainBalances(connectedPeraAddress, true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('wallet-balance-updated', { detail: balances }));
      }

      return connectedPeraAddress;
    }
  } catch (err: any) {
    if (err?.data?.type !== "CONNECT_MODAL_CLOSED") {
      console.error("[PERA WALLET] Connection error:", err);
    }
  }
  return "";
}

/**
 * Disconnect Pera Wallet session
 */
export async function disconnectPeraWallet(): Promise<void> {
  try {
    await peraWallet.disconnect();
  } catch (e) {
    console.warn("[PERA WALLET] Disconnect warning:", e);
  } finally {
    handleDisconnect();
  }
}

function handleDisconnect() {
  connectedPeraAddress = "";
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('slidenode_custom_wallet');
  }
  console.log("[PERA WALLET] Session disconnected.");
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wallet-disconnected'));
  }
}

let lastSignedTxId: string = "";

export function getLastSignedTxId(): string {
  return lastSignedTxId;
}

/**
 * Sign transaction group via Pera Wallet.
 * Invokes Pera Wallet's native transaction approval UI.
 * Pera Wallet handles all authentication (PIN/biometrics) inside Pera.
 * Website NEVER receives or logs user credentials.
 */
export async function signTransactionsWithPera(
  txnsMsgpack: Uint8Array[],
  indexesToSign?: number[]
): Promise<(Uint8Array | null)[]> {
  let activeAddr = connectedPeraAddress;

  // 1. Check if session is active or try automatic reconnection
  if (!activeAddr) {
    console.log("[PERA WALLET] Checking active Pera Wallet session...");
    try {
      activeAddr = await initPeraWalletSession();
    } catch (e) {}
  }

  // 2. If session expired or disconnected, automatically prompt Pera Wallet connect modal
  if (!activeAddr) {
    console.log("[PERA WALLET] Session expired or inactive — opening Pera Wallet reconnect modal...");
    activeAddr = await connectPeraWallet();
  }

  if (!activeAddr) {
    const reason = "Wallet not connected: Pera Wallet session is inactive or connect modal was closed.";
    console.error("[PERA WALLET REJECT]", reason);
    throw new Error(reason);
  }

  // Exact required logging sequence
  console.log("Wallet connected");
  console.log("Wallet address", activeAddr);
  console.log("Creating payment transaction");

  // Decode msgpack unsigned transactions to algosdk.Transaction objects
  const transactionObjects = txnsMsgpack.map(txBuf => algosdk.decodeUnsignedTransaction(txBuf));
  const targetIndexes = indexesToSign || txnsMsgpack.map((_, i) => i);

  // Format as SignerTransaction[] required by PeraWalletConnect
  const signerTxnsGroup = transactionObjects.map((txn, idx) => {
    if (targetIndexes.includes(idx)) {
      return { txn, signers: [activeAddr] };
    }
    return { txn, signers: [] }; // Do not sign
  });

  console.log("Calling signTransaction");
  console.log("Waiting for Pera approval");

  try {
    // Opens Pera Wallet native signing modal / mobile QR popup
    const signedTxns = await peraWallet.signTransaction([signerTxnsGroup]);

    if (!signedTxns || signedTxns.length === 0) {
      throw new Error("Pera Wallet returned empty signature response.");
    }

    console.log("Approval received");
    console.log("Transaction signed");

    // Extract transaction ID from signed transaction bytes
    if (signedTxns && signedTxns.length > 0) {
      try {
        const decoded = algosdk.decodeSignedTransaction(signedTxns[0]);
        lastSignedTxId = decoded.txn.txID();
        console.log("Transaction ID:", lastSignedTxId);
      } catch (txErr) {
        console.warn("[PERA WALLET] Could not extract txId from signed txn bytes:", txErr);
      }
    }

    let signedIdx = 0;
    return txnsMsgpack.map((_, i) => {
      if (targetIndexes.includes(i)) {
        return signedTxns[signedIdx++];
      }
      return null;
    });
  } catch (err: any) {
    const errorMsg = err?.message || String(err) || "Transaction signing cancelled or rejected in Pera Wallet.";
    console.error("[PERA WALLET SIGNING FAILED] Exact reason:", errorMsg);
    throw new Error(errorMsg);
  }
}
