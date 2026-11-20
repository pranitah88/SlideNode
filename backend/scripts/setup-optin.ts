import algosdk from "algosdk";
import "dotenv/config";

const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
const USDC_TESTNET_ASA = 10458941;

async function run() {
  console.log("=== Algorand Testnet Opt-In Helper ===");

  if (!process.env.AVM_PRIVATE_KEY) {
    console.error("Error: AVM_PRIVATE_KEY is missing from backend/.env");
    return;
  }

  const sk = Buffer.from(process.env.AVM_PRIVATE_KEY, 'base64');
  const payerAddr = algosdk.encodeAddress(sk.subarray(32));
  console.log("Payer Address:", payerAddr);

  try {
    const payerInfo = await algodClient.accountInformation(payerAddr).do();
    const algoBalance = Number(payerInfo.amount) / 1e6;
    console.log(`Payer ALGO Balance: ${algoBalance} ALGO`);

    if (algoBalance < 0.2) {
      console.error(`Insufficient ALGO to opt-in. Please fund ${payerAddr} with at least 0.2 ALGO from Testnet Dispenser.`);
      return;
    }

    const hasUsdc = payerInfo.assets?.some((a: any) => BigInt(a.assetId || a['asset-id']) === BigInt(USDC_TESTNET_ASA));
    if (hasUsdc) {
      console.log("Payer is ALREADY opted into Testnet USDC (ASA 10458941)!");
    } else {
      console.log("Opting Payer into Testnet USDC (ASA 10458941)...");
      const params = await algodClient.getTransactionParams().do();
      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: payerAddr,
        receiver: payerAddr,
        assetIndex: USDC_TESTNET_ASA,
        amount: 0,
        suggestedParams: params,
      });

      const signedOptIn = optInTxn.signTxn(sk);
      const { txId } = await algodClient.sendRawTransaction(signedOptIn).do();
      console.log(`Opt-In Tx sent! TxID: ${txId}`);
      await algosdk.waitForConfirmation(algodClient, txId, 4);
      console.log("Opt-In confirmed on Algorand Testnet!");
    }
  } catch (e: any) {
    console.error("Opt-In failed:", e.message || e);
  }
}

run();
