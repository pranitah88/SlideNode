import { Hono } from "hono";
import algosdk from "algosdk";
import { getOnChainUsdcBalance } from "../lib/algorand.js";

const signerRoute = new Hono();

signerRoute.get("/", async (c) => {
  try {
    if (!process.env.AVM_PRIVATE_KEY) {
      return c.json({ error: "AVM_PRIVATE_KEY missing" }, 500);
    }
    const keyInput = process.env.AVM_PRIVATE_KEY.trim();
    let sk: Uint8Array;
    if (keyInput.includes(" ")) {
      sk = algosdk.mnemonicToSecretKey(keyInput).sk;
    } else {
      sk = Buffer.from(keyInput, 'base64');
    }
    const address = algosdk.encodeAddress(sk.subarray(32));
    return c.json({ address });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

signerRoute.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const { txns, indexesToSign, payerAddress } = body;

    console.log("[SIGNER DEBUG] Remote signing request received for payer:", payerAddress || "default", "Tx count:", txns?.length);

    if (!txns || !Array.isArray(txns)) {
      console.error("[SIGNER DEBUG] Invalid txns payload received");
      return c.json({ success: false, stage: "wallet_signing", error: "Invalid txns payload" }, 400);
    }

    // Check payer's real on-chain USDC ASA balance on Algorand Testnet
    if (payerAddress) {
      const { balanceBaseUnits, balanceUsdc } = await getOnChainUsdcBalance(payerAddress);
      console.log(`[SIGNER DEBUG] On-chain USDC balance for ${payerAddress}: ${balanceUsdc} USDC (${balanceBaseUnits} base units)`);

      if (balanceBaseUnits <= 0) {
        console.error("[SIGNER DEBUG REJECTED] Payer wallet", payerAddress, "has 0 USDC balance on Algorand Testnet.");
        return c.json({
          success: false,
          stage: "wallet_signing",
          error: `Insufficient USDC balance: Connected wallet (${payerAddress.substring(0, 8)}...) has 0 USDC on Algorand Testnet. Payment rejected.`,
          code: "INSUFFICIENT_BALANCE"
        }, 402);
      }
    }

    if (!process.env.AVM_PRIVATE_KEY) {
      console.error("[SIGNER DEBUG] AVM_PRIVATE_KEY missing from environment");
      return c.json({ success: false, stage: "wallet_signing", error: "AVM_PRIVATE_KEY is not configured on backend" }, 500);
    }

    const keyInput = process.env.AVM_PRIVATE_KEY.trim();
    let sk: Uint8Array;
    if (keyInput.includes(" ")) {
      // 25-word mnemonic
      sk = algosdk.mnemonicToSecretKey(keyInput).sk;
    } else {
      sk = Buffer.from(keyInput, 'base64');
    }
    
    // Decode txns from base64 msgpack back to algosdk.Transaction objects
    const transactionObjects = txns.map((txBase64: string) => {
      const buffer = Buffer.from(txBase64, 'base64');
      const decoded = algosdk.decodeUnsignedTransaction(buffer);
      return decoded;
    });
    
    // Sign transactions
    const signedTxns = indexesToSign.map((idx: number) => {
       const tx = transactionObjects[idx];
       return tx.signTxn(sk);
    });
    
    // Convert Uint8Array signed txns back to base64
    const signedTxnsBase64 = signedTxns.map((stx: Uint8Array) => Buffer.from(stx).toString('base64'));

    console.log("[SIGNER DEBUG] Wallet signing succeeded. Signed transactions returned.");
    return c.json({ success: true, signedTxns: signedTxnsBase64 });
  } catch (error: any) {
    console.error("[SIGNER DEBUG] Remote Signer Route Error:", error);
    return c.json({ success: false, stage: "wallet_signing", error: `Failed to sign transactions: ${error.message}` }, 500);
  }
});

export default signerRoute;
