import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { supabase } from "./supabase.js";
import type { SettleResultContext, HTTPTransportContext } from "@x402/core/server";
import { verifyOnChainSettlement, ALGORAND_TESTNET_CONFIG } from "./algorand.js";

export const SKIP_PAYMENT = process.env.SKIP_PAYMENT === "true";

const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://facilitator.goplausible.xyz";

export const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

export const resourceServer = new x402ResourceServer(facilitatorClient)
  .register("algorand:*", new ExactAvmScheme());

export let lastVerificationError: string | null = null;

export const resetVerificationError = () => {
  lastVerificationError = null;
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

resourceServer.onBeforeVerify(async (_ctx: any) => {
  lastVerificationError = null;
  console.log("[X402] ── Payment verification started ──────────────────────");
  console.log("[X402] Payment proof header received — sending to facilitator...");
});

resourceServer.onAfterVerify(async (ctx: any) => {
  console.log("[X402] Facilitator verification result:", ctx.result?.isValid ? "✅ VALID" : "❌ INVALID");
  if (ctx.result && ctx.result.isValid === false) {
    lastVerificationError = ctx.result.invalidReason || "Payment verification failed: invalid proof or signature";
    console.error("[X402] Verification FAILED:", lastVerificationError);
  }
});

resourceServer.onVerifyFailure(async (ctx: any) => {
  lastVerificationError = ctx.error?.message || String(ctx.error);
  console.error("[X402] Verify EXCEPTION:", ctx.error);
  if (ctx.error && (ctx.error as any).response) {
    const errRes = (ctx.error as any).response;
    console.error("[X402] Facilitator HTTP:", errRes.status, errRes.data);
  }
});

resourceServer.onBeforeSettle(async (_ctx: any) => {
  console.log("[X402] ── Settlement starting ───────────────────────────────");
  console.log("[X402] Submitting signed transaction to Algorand Testnet...");
});

resourceServer.onSettleFailure(async (ctx: any) => {
  console.error("[X402] ❌ Settlement FAILED:", ctx.error);
  console.error("[X402] Verification: ✅ SUCCESS | Settlement: ❌ FAIL");
});

resourceServer.onAfterSettle(async (ctx: SettleResultContext) => {
  console.log("[X402 DEBUG] Raw ctx.result from facilitator:", JSON.stringify(ctx.result));

  const resObj = (ctx.result || {}) as any;
  const transactionId = resObj.transaction || resObj.txId || resObj.txid || resObj.transactionId || resObj.hash || (typeof ctx.result === 'string' ? ctx.result : null);
  const payer = resObj.payer || resObj.payerAddress || resObj.sender || resObj.from || null;
  const merchant = process.env.AVM_ADDRESS || null;

  console.log("[X402] ── Settlement complete ─────────────────────────────");
  console.log("[X402] ✅ Transaction submitted to Algorand Testnet");
  console.log("[X402] Transaction ID:", transactionId);
  console.log("[X402] Payer:", payer);
  console.log("[X402] Merchant:", merchant);

  if (!transactionId) {
    console.error("[X402 SETTLEMENT ERROR] No transaction ID returned from facilitator.");
    return;
  }

  // Extract meeting ID from resource URL
  const transportCtx = ctx.transportContext as HTTPTransportContext;
  const resourcePath = transportCtx?.request?.path || "";
  const meetingIdMatch = resourcePath.match(/\/api\/meetings\/([^/]+)/);
  const meetingId = meetingIdMatch ? meetingIdMatch[1] : null;

  if (!meetingId) {
    console.error("[X402 SETTLEMENT ERROR] Could not extract meetingId from path:", resourcePath);
    return;
  }

  try {
    const { data: meeting } = await supabase
      .from("meetings")
      .select("price_usdc, user_id")
      .eq("id", meetingId)
      .single();
    const amountUsdc = meeting?.price_usdc || 0;

    console.log("[X402] Network:", ALGORAND_TESTNET_CONFIG.network);
    console.log("[X402] USDC ASA:", ALGORAND_TESTNET_CONFIG.usdcAssetId);
    console.log("[X402] Required amount:", amountUsdc, "USDC");

    // Verify the transaction actually landed on-chain
    const verifyRes = await verifyOnChainSettlement(
      transactionId,
      payer || undefined,
      merchant || undefined,
      amountUsdc
    );

    console.log("[X402] On-chain confirmation:", verifyRes.isValid ? "✅ CONFIRMED" : `❌ FAILED (${verifyRes.error})`);
    if (verifyRes.isValid) {
      console.log("[X402] Confirmed USDC amount:", verifyRes.amountUsdc, "USDC");
      console.log("[X402] Confirmed round:", verifyRes.confirmedRound);
    }

    const finalStatus = verifyRes.isValid ? "settled" : "failed";

    const basePayload: Record<string, any> = {
      meeting_id: meetingId,
      user_id: meeting?.user_id || null,
      amount_usdc: amountUsdc,
      currency: "USDC",
      network: ALGORAND_TESTNET_CONFIG.network,
      payment_protocol: "x402",
      transaction_id: transactionId,
      status: finalStatus,
    };

    const extendedPayload = {
      ...basePayload,
      payer_address: payer,
      merchant_address: merchant,
      facilitator_status: verifyRes.isValid ? "verified" : "failed",
      confirmed_at: verifyRes.isValid ? new Date().toISOString() : null,
    };

    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id, transaction_id")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    let dbError: any = null;

    if (existingPayment) {
      const updatePayload: Record<string, any> = {
        transaction_id: transactionId,
        status: finalStatus,
      };
      const fullUpdate = await supabase
        .from("payments")
        .update({ ...updatePayload, payer_address: payer, facilitator_status: finalStatus, confirmed_at: verifyRes.isValid ? new Date().toISOString() : null })
        .eq("id", existingPayment.id);

      if (fullUpdate.error?.code === "PGRST204") {
        const baseUpdate = await supabase.from("payments").update(updatePayload).eq("id", existingPayment.id);
        dbError = baseUpdate.error;
      } else {
        dbError = fullUpdate.error;
      }

      console.log("[X402] Updated existing payment record:", existingPayment.id, "txId:", transactionId);
    } else {
      const fullInsert = await supabase.from("payments").insert(extendedPayload).select("id");
      if (fullInsert.error?.code === "PGRST204") {
        const baseInsert = await supabase.from("payments").insert(basePayload).select("id");
        dbError = baseInsert.error;
        if (!baseInsert.error) {
          console.log("[X402] ✅ Payment record inserted (base schema):", baseInsert.data?.[0]?.id);
          console.log("[X402] ℹ️  Run migration 007 to enable full payment tracking");
        }
      } else {
        dbError = fullInsert.error;
        if (!fullInsert.error) {
          console.log("[X402] ✅ Payment record inserted (full schema):", fullInsert.data?.[0]?.id);
        }
      }
    }

    if (dbError) {
      console.error("[X402] ❌ DB payment record error:", JSON.stringify(dbError));
    }

    if (verifyRes.isValid) {
      await supabase
        .from("meetings")
        .update({ status: "payment_verified" })
        .eq("id", meetingId);
      console.log("[X402] ✅ Meeting", meetingId, "unlocked — status: payment_verified");
    } else {
      console.error("[X402] ❌ On-chain verification failed — meeting status NOT updated");
    }

    console.log("[X402] ── Settlement handler complete ─────────────────────");
  } catch (err: any) {
    console.error("[X402] ❌ onAfterSettle EXCEPTION:", err?.message || err);
  }
});
