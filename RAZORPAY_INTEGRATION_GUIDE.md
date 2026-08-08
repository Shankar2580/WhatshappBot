# Guide: Configuring Razorpay Payment Gateway & Webhooks

This guide explains how to configure Razorpay Payment Links, set up webhook events for transaction confirmations, and perform local sandbox testing.

---

## 1. Environment Variables Configuration

To run the live payment flow, define the following variables in your `.env` file (or in your Kubernetes Deployment secrets / PM2 environment configurations):

```env
# Razorpay Credentials (from Dashboard)
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourKeySecretHere

# Webhook Security Secret (custom string you define)
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere
```

*Note: If `RAZORPAY_KEY_ID` or `RAZORPAY_KEY_SECRET` are not set, the bot will automatically fall back to **Local Sandbox Mode**, creating mock checkout links for developers to test the flow without active credentials.*

---

## 2. Setting Up Razorpay Webhooks

When a devotee completes their payment via the Payment Link, Razorpay triggers a webhook event. The server listens on `/webhook/razorpay` to mark the booking as confirmed and send the official ticket PDF.

Follow these steps to set up the Webhook in your Razorpay Dashboard:

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to **Account & Settings** → **Webhooks** (under **Developer controls**).
3. Click **Add New Webhook**.
4. Enter the configuration:
   * **Webhook URL**: `https://chat.facepe.ai/webhook/razorpay` *(Change this to your actual public domain mapping if hosted elsewhere)*
   * **Secret**: Enter the exact string value you configured under `RAZORPAY_WEBHOOK_SECRET` in your `.env` file.
   * **Alert Email**: Enter your developer/support email.
5. In **Active Events**, select the following:
   * `payment.captured`
   * `order.paid`
6. Click **Create Webhook**.

---

## 3. Dynamic Pooja Pricing Matrix

The bot calculates pricing dynamically based on the chosen Aarti and the number of devotees. You can edit this pricing matrix at any time in [`messageHandler.js`](file:///home/shankar/Documents/Product/WhatshappBot/messageHandler.js):

| Aarti / Service | Price (per devotee) |
| :--- | :--- |
| **Bhasma Aarti** | ₹100 |
| **Shighra Darshan** | ₹250 |
| **Shayan Aarti** | ₹50 |
| **Sandhya Aarti** | ₹50 |

---

## 4. Local Sandbox Testing & Simulation

To test the end-to-end payment confirmation flow locally:

### Step 1: Start a Booking
Send a WhatsApp message (e.g. "hi") to start booking. Select your Aarti, slot, date, number of people, and finish devotee details.

### Step 2: Get your Booking Reference
Upon confirming booking, the bot will respond with a payment link indicating that payment is pending. Find the booking reference (e.g. `MAHAKAL-08082026-4792`) either in your server logs or in the SQLite database (`bookings_v5` table).

### Step 3: Trigger Mock Webhook Callback
If you do not have live keys configured, the signature check is skipped automatically. Trigger a simulated payment capture by executing the following `curl` command in your terminal:

```bash
curl -X POST http://localhost:3000/webhook/razorpay \
  -H "Content-Type: application/json" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "entity": {
          "notes": {
            "booking_ref": "MAHAKAL-08082026-4792",
            "user_phone": "919999999999"
          }
        }
      }
    }
  }'
```

Replace `MAHAKAL-08082026-4792` and `919999999999` with your actual booking reference and phone number.

The local server will immediately catch the mock event, update the booking status to `confirmed`, compile the official PDF ticket, and dispatch it to the WhatsApp device!
