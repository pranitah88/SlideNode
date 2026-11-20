/**
 * setup_merchant.ts - Creates and funds merchant wallet for x402 USDC payments
 * Uses algosdk v3 API + direct fetch for broadcasting transactions
 */
import 'dotenv/config';
import algosdk from 'algosdk';
import fs from 'fs';

const ALGOD   = 'https://testnet-api.algonode.cloud';
const USDC_ID = 10458941;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getPayerSk(): { sk: Uint8Array; addr: string } {
  const raw = process.env.AVM_PRIVATE_KEY!.trim();
  const sk  = new Uint8Array(Buffer.from(raw, 'base64'));
  return { sk, addr: algosdk.encodeAddress(sk.subarray(32)) };
}

function getAddrStr(addr: any): string {
  if (typeof addr === 'string') return addr;
  if (addr?.publicKey) return algosdk.encodeAddress(addr.publicKey);
  return String(addr);
}

async function getParams() {
  const r = await fetch(`${ALGOD}/v2/transactions/params`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`params HTTP ${r.status}`);
  const d = await r.json() as any;
  // algosdk v3 SuggestedParams shape
  return {
    flatFee:    true,
    fee:        1000n,
    firstValid: BigInt(d['last-round']),
    lastValid:  BigInt(d['last-round'] + 1000),
    genesisID:  d['genesis-id'] as string,
    genesisHash: new Uint8Array(Buffer.from(d['genesis-hash'], 'base64')),
    minFee:     1000n,
  } as algosdk.SuggestedParams;
}

async function broadcast(signedTxn: Uint8Array): Promise<string> {
  const r = await fetch(`${ALGOD}/v2/transactions`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-binary' },
    body:    signedTxn,
  });
  const d = await r.json() as any;
  if (!r.ok) throw new Error(`broadcast failed: ${JSON.stringify(d)}`);
  return d.txId as string;
}

async function waitConfirm(txId: string): Promise<void> {
  process.stdout.write(`  Waiting for ${txId.substring(0, 12)}...`);
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    process.stdout.write('.');
    try {
      const r = await fetch(`${ALGOD}/v2/transactions/pending/${txId}`, { headers: { Accept: 'application/json' } });
      const d = await r.json() as any;
      if (Number(d['confirmed-round']) > 0) { console.log(` ✅ round ${d['confirmed-round']}`); return; }
    } catch {}
  }
  console.log(' ⚠️ timeout (proceed anyway)');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== x402 Merchant Wallet Setup ===\n');

  const payer = getPayerSk();
  console.log('Payer wallet :', payer.addr);
  console.log('Current AVM_ADDRESS:', process.env.AVM_ADDRESS || '(same as payer — will be changed)');

  // 1. Generate merchant keypair
  console.log('\n[1] Generating new merchant wallet...');
  const m      = algosdk.generateAccount();
  const mAddr  = getAddrStr(m.addr);
  const mSk    = m.sk;
  console.log('    Merchant address:', mAddr);

  // 2. Fund merchant with 0.5 ALGO so it can pay opt-in fee
  console.log('\n[2] Funding merchant with 0.5 ALGO...');
  const sp1 = await getParams();
  const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender:   payer.addr,
    receiver: mAddr,
    amount:   500_000n,
    suggestedParams: sp1,
  });
  const fundId = await broadcast(fundTxn.signTxn(payer.sk));
  console.log('    txId:', fundId);
  await waitConfirm(fundId);

  // 3. Merchant opts into USDC ASA (required to receive USDC)
  console.log('\n[3] Opting merchant into USDC ASA 10458941...');
  const sp2 = await getParams();
  const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender:   mAddr,
    receiver: mAddr,
    amount:   0n,
    assetIndex: USDC_ID,
    suggestedParams: sp2,
  });
  const optId = await broadcast(optInTxn.signTxn(mSk));
  console.log('    txId:', optId);
  await waitConfirm(optId);

  // 4. Verify on-chain
  console.log('\n[4] Verifying merchant account...');
  const acct = await (await fetch(`${ALGOD}/v2/accounts/${mAddr}`, { headers: { Accept: 'application/json' } })).json() as any;
  const usdcEntry = (acct.assets || []).find((a: any) => Number(a['asset-id']) === USDC_ID);
  console.log('    ALGO balance:', (Number(acct.amount) / 1e6).toFixed(3), 'ALGO');
  console.log('    USDC opt-in:', usdcEntry ? '✅ Ready' : '❌ Failed');

  // 5. Update backend .env
  console.log('\n[5] Updating backend .env...');
  let env = fs.readFileSync('.env', 'utf-8');
  env = env.match(/^AVM_ADDRESS=/m)
    ? env.replace(/^AVM_ADDRESS=.*/m, `AVM_ADDRESS=${mAddr}`)
    : env + `\nAVM_ADDRESS=${mAddr}\n`;
  fs.writeFileSync('.env', env);

  // Save mnemonic for recovery
  const mnemonic = algosdk.secretKeyToMnemonic(mSk);
  fs.writeFileSync('merchant_mnemonic.txt',
    `Merchant Address : ${mAddr}\nMnemonic         : ${mnemonic}\n\n⚠️  KEEP SAFE — DO NOT SHARE OR COMMIT TO GIT\n`
  );

  console.log('    ✅ .env updated');
  console.log('    ✅ Mnemonic → merchant_mnemonic.txt (keep this safe!)');

  console.log('\n' + '═'.repeat(64));
  console.log('✅  DONE! Restart the backend server now.\n');
  console.log('  Payer    (spends USDC):', payer.addr.substring(0,20) + '...');
  console.log('  Merchant (earns  USDC):', mAddr.substring(0,20) + '...');
  console.log('\n  After next payment: payer wallet balance WILL decrease ✅');
  console.log('═'.repeat(64) + '\n');
}

main().catch(e => { console.error('\n❌ Setup failed:', e?.message || e); process.exit(1); });
