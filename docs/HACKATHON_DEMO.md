# SlideNode AI — Hackathon Demo Script

This script is designed for a strict 5-minute hackathon pitch and live demonstration.

## Demo Flow (5 Minutes)

### 0:00–0:30: The Problem & Solution
- **Hook:** "Every day, thousands of hours are wasted converting meeting recordings into actionable slides and summaries. Enterprise AI subscriptions are expensive and lack flexible pay-per-use models."
- **Solution:** "We built SlideNode: a platform that converts meeting audio into structured, presentation-ready outputs. But the real innovation is under the hood: we leverage the **x402 protocol** on **Algorand** to enable seamless, trustless, pay-per-use AI processing."

### 0:30–1:00: Upload Meeting Audio
- **Action:** Open the SlideNode frontend.
- **Action:** Select a real `.mp3` or `.wav` meeting audio file.
- **Talking Point:** "As soon as I select the file, SlideNode calculates the exact duration of the meeting locally before uploading it securely to a private bucket."

### 1:00–1:30: Dynamic Pay-Per-Use Price
- **Action:** Click "Continue" to reach the Payment page.
- **Talking Point:** "Based on the exact duration, the backend dynamically calculates the price at 0.40 USDC per billable minute. No subscriptions. You only pay for what you use."

### 1:30–2:30: The x402 Challenge & Settlement
- **Action:** Click "Pay & Continue".
- **Visuals:** Point out the UI explicitly cycling through "Payment Required", "Signing Payment", and "Verifying Payment".
- **Talking Point:** "Here is where the magic happens. We didn't build a complex payment backend. The server simply responds with an HTTP 402 Payment Required. Our x402 client automatically intercepts this, prompts the user to sign the exact USDC transaction, and sends it to the x402 Facilitator. The Facilitator settles it instantly on the Algorand Testnet with near-zero fees."

### 2:30–3:00: Real Transaction Receipt
- **Action:** Transition to the Processing page.
- **Talking Point:** "The payment is verified. The backend now holds a cryptographic receipt—an actual Algorand Testnet transaction ID. We store this in our Supabase database to ensure the processing is idempotent. No double charges."

### 3:00–4:15: AI Processing
- **Action:** Wait for the progress bars to complete on the processing screen.
- **Talking Point:** "Only after the blockchain settlement is confirmed does the backend grant the AI provider access to the private audio file via a short-lived signed URL. The AI pipeline is currently transcribing the speech, extracting speakers, identifying action items, and generating presentation slides."

### 4:15–5:00: The Results
- **Action:** The app redirects to the Insights Dashboard.
- **Action:** Briefly click through the Transcript, Speakers, Slides, and Action Items tabs.
- **Talking Point:** "And here is the final output. The raw audio has been transformed into a fully structured, ready-to-use presentation. With Algorand and x402, we’ve demonstrated a scalable architecture for monetizing AI agents on a pay-per-use basis."
