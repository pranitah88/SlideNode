import fs from 'fs';
import { x402Client } from "@x402/core/client";
import { x402HTTPClient } from "@x402/core/http";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { toClientAvmSigner } from "@x402/avm";
import algosdk from "algosdk";
import "dotenv/config";

// Ensure AI configuration is mocked
process.env.AI_TRANSCRIPTION_PROVIDER = "mock";
process.env.AI_TRANSCRIPTION_API_KEY = "mock_key";

async function run() {
  console.log("=== Starting Test Flow ===");

  // 1. Upload audio
  console.log("Uploading audio...");
  const fileBuffer = fs.readFileSync('test_30s.wav');
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', blob, 'test_30s.wav');

  const uploadRes = await fetch('http://localhost:3000/api/meetings/upload', {
    method: 'POST',
    body: formData,
  });

  const uploadData = await uploadRes.json();
  console.log("Upload response:", uploadData);
  
  if (!uploadData.success) {
    console.error("Upload failed.");
    return;
  }
  
  const meetingId = uploadData.meeting.id;
  console.log(`Meeting ID: ${meetingId}`);

  // 2. Client Setup
  let signer;
  try {
    // Requires AVM_PRIVATE_KEY in .env for signing.
    if (process.env.AVM_PRIVATE_KEY) {
      signer = toClientAvmSigner(process.env.AVM_PRIVATE_KEY);
      console.log("Using AVM signer address:", signer.address);
    } else {
      console.log("No AVM_PRIVATE_KEY found. Generating a mock one for test structure...");
      const account = algosdk.generateAccount();
      signer = toClientAvmSigner(Buffer.from(account.sk).toString('base64'));
    }
  } catch (e) {
    console.error("Failed to create signer. Make sure algosdk is installed.", e);
    return;
  }

  const coreClient = new x402Client().register("algorand:*", new ExactAvmScheme(signer));
  const client = new x402HTTPClient(coreClient);

  // 3. Make the protected request
  const url = `http://localhost:3000/api/meetings/${meetingId}/process`;
  console.log(`Making request to protected endpoint: ${url}`);
  
  const response = await fetch(url, { method: 'POST' });

  console.log(`Initial Response Status: ${response.status}`);
  if (response.status === 402) {
    console.log("Received HTTP 402 Payment Required.");
    try {
      const responseBody = await response.json().catch(() => ({}));
      const paymentRequired = client.getPaymentRequiredResponse(
        (name) => response.headers.get(name) || undefined,
        responseBody
      );
      
      console.log("Payment Requirements:", JSON.stringify(paymentRequired.accepts, null, 2));

      console.log("Creating payment payload...");
      const paymentPayload = await client.createPaymentPayload(paymentRequired);
      
      console.log("Sending payment...");
      const paidResponse = await fetch(url, {
        method: 'POST',
        headers: client.encodePaymentSignatureHeader(paymentPayload),
      });

      console.log(`Paid Response Status: ${paidResponse.status}`);
      const paidBody = await paidResponse.json();
      console.log("Paid Response Body:", paidBody);
      
      if (paidResponse.status === 200) {
        console.log("Payment and Processing successful!");
        try {
          const settlement = client.getPaymentSettleResponse(
            (name) => paidResponse.headers.get(name) || undefined
          );
          console.log("Settled Transaction ID:", settlement.transaction);
        } catch(e) {
          console.log("Could not parse settlement header, it might not be present.");
        }
      } else {
        console.error("Payment failed or processing error.");
      }
    } catch (e) {
      console.error("Error during payment flow:", e);
    }
  } else {
    console.log("Expected 402, got:", await response.text());
  }

  // Verify meeting status
  console.log("Verifying meeting details...");
  const detailsRes = await fetch(`http://localhost:3000/api/meetings/${meetingId}`);
  const details = await detailsRes.json();
  console.log("Meeting Status:", details.meeting.status);
  console.log("Payment record:", details.payment);
}

run();
