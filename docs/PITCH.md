# SlideNode Pitch

## Problem
In modern workflows, meeting audio is a black hole of valuable information. Extracting structured action items, identifying speakers, and generating coherent presentation slides from meetings is incredibly time-consuming. While powerful AI models exist to solve this, most product implementations are locked behind expensive, inflexible monthly subscriptions that penalize users with sporadic, unpredictable needs.

## Solution
SlideNode is a platform that transforms raw meeting audio into presentation-ready slides, speaker logs, and action items. Our breakthrough is the business model: users pay only for the exact duration of audio they process—no subscriptions required.

## The x402 Innovation
We achieve true pay-per-use economics by integrating the x402 protocol (HTTP 402 Payment Required). SlideNode abstracts away legacy payment architectures. Our backend simply requests a payment, the client fulfills it via blockchain rails, and an independent Facilitator node verifies the transaction. This dramatically reduces backend complexity and liability.

## Algorand Value
To make micropayments (e.g., 0.40 USDC) economically viable, we rely on the Algorand blockchain. Algorand’s near-instant finality (sub-3 second blocks) and fractional-cent transaction fees mean users experience zero delay in receiving their AI outputs, and margins aren't lost to payment gateways.

## AI Value
SlideNode acts as a high-value data structuring pipeline. Instead of returning a wall of text, the AI segments audio natively into structured slides, speakers, and actionable tasks, letting professionals jump straight to output.

## Why This Can Scale
Our architecture decouples heavy storage/database components from the stateless Hono/x402 backend. Because payments are handled immutably on-chain and verified via cryptographic receipts, the backend can scale horizontally without massive monolithic billing systems.

## What makes SlideNode different?
Most AI wrappers build a paywall *in front* of their product using Stripe and subscriptions. SlideNode builds the payment *directly into the HTTP protocol*. We are demonstrating a machine-to-machine, trustless payment layer that perfectly aligns user cost with compute cost.

## Future Roadmap
- **Algorand Mainnet**: Transitioning from Testnet to live Mainnet USDC settlement.
- **Stronger Production Wallet Custody**: Deep integrations with Pera and Defly for fluid user signing.
- **Improved Speaker Diarization**: Multi-model routing to improve voice mapping accuracy.
- **Larger Audio Processing**: Chunking algorithms for handling files > 100MB.
- **More AI Providers**: Fallback mechanics utilizing OpenAI or Anthropic alongside Gemini.
- **Richer Presentation Export**: One-click direct export to `.pptx` or Google Slides.
- **Production Monitoring**: Utilizing Redis-backed rate limiters and enterprise controls.
