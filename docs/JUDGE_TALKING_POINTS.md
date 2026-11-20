# SlideNode AI — Judge Talking Points

## Problem & Solution
- **Problem:** AI tools are often locked behind expensive monthly subscriptions, making them inaccessible for sporadic usage. Additionally, handling micro-payments for AI inference is a massive technical hurdle for developers.
- **Solution:** SlideNode converts meeting audio into structured, presentation-ready slides on a pay-per-use basis. We eliminate subscriptions by gating the AI backend using the x402 protocol and the Algorand blockchain.

## Why Pay-Per-Use?
- Users only pay exactly for the computation they consume (priced dynamically per minute of audio).
- Developers don't have to manage complex recurring billing architectures or absorb the compute costs of freemium tiers.

## Why x402?
- x402 standardizes machine-to-machine payments via HTTP 402. 
- It allows our backend to remain agnostic to the payment details. The backend simply says "Payment Required" and verifies the resulting settlement, decoupling the payment UX from the business logic.

## Why Algorand?
- Algorand provides near-instant finality and fractional-cent transaction fees.
- Micro-payments (like 0.40 USDC) are economically viable, which is impossible on traditional credit card rails or high-fee blockchains.

## How Payment Verification Works
- The frontend client detects the `402 Payment Required` challenge.
- The user signs a transaction sending USDC to our designated treasury address.
- An independent Facilitator node verifies the signature and broadcasts it to the Algorand Testnet.
- Once settled, the Facilitator returns a cryptographic receipt to the client, which is then passed to our backend to unlock the AI processing.

## How AI Processing is Gated
- All AI processing routes are protected by an x402 middleware. If a request lacks a valid settlement receipt, it is rejected immediately.
- Private audio files remain locked in a secure bucket and are only accessed via short-lived signed URLs generated specifically for paid requests.

## How Transaction Receipts are Stored
- The verified Algorand transaction ID is logged alongside the meeting record in our Supabase database.
- This creates an immutable audit trail and provides strict idempotency (duplicate clicks won't result in double-charging or duplicate AI execution).

## Why Blockchain Adds Value
- It natively supports cross-border, frictionless micro-payments without relying on legacy banking infrastructure or high-fee merchant gateways.
- It provides a cryptographic, verifiable receipt that both the user and the backend can trust.

## Security Considerations (Implemented)
- Strict separation of concerns: The frontend never interacts with the database directly.
- The `SUPABASE_SERVICE_ROLE_KEY` is securely hidden in the backend environment.
- The backend utilizes structured logging (without leaking keys) and in-memory rate-limiting for abuse protection.
- Stored audio files are fully private.

## Mainnet-Readiness Considerations (Future Enhancements)
While this MVP is fully functional on the **Algorand Testnet** with Testnet USDC, moving to Mainnet requires:
1. **Production Wallet Integration:** Transitioning from mock signers to real user wallet integrations (e.g., Pera Wallet, Defly).
2. **Mainnet Assets:** Configuring the exact Mainnet USDC Asset ID and an operational treasury address.
3. **Facilitator Redundancy:** Running a production-grade Facilitator node instead of relying on the public sandbox.
4. **Enhanced Rate Limits:** Moving from in-memory rate limiting to a distributed cache (like Redis) for multi-instance scaling.
