# 📱 WhatsApp In-App Booking Form (WhatsApp Flow) Setup Guide

This guide explains how to set up and deploy the **Native In-App WhatsApp Booking Form** for Shri Mahakaleshwar Temple devotees using **WhatsApp Flows**.

---

## 🌟 What Was Built & How It Works

1. **Native In-App Form ([booking_form_flow.json](file:///Users/nick/Documents/FacePe/facepe-whatsapp-bot/booking_form_flow.json))**:
   * Opens directly inside WhatsApp with zero redirects.
   * Collects:
     * **Aarti/Darshan Service** (Bhasma Aarti, Shighra Darshan, Sandhya Aarti, Shayan Aarti)
     * **Darshan Date** (Interactive native DatePicker for next 30 days)
     * **Number of Devotees** (1 to 4)
     * **Devotee Full Name**
     * **ID Proof Type** (Aadhaar, Passport, Voter ID)
     * **Document / ID Number**
2. **Instant Pass Generation & Delivery ([messageHandler.js](file:///Users/nick/Documents/FacePe/facepe-whatsapp-bot/messageHandler.js))**:
   * Devotee taps "Submit Booking".
   * Meta triggers our EC2 webhook with the full JSON payload (`nfm_reply`).
   * The bot saves the booking to SQLite, compiles the official PDF pass with QR code, and dispatches it straight to the devotee's chat!

---

## 🛠️ Step-by-Step Meta WhatsApp Manager Setup

### Step 1: Open Meta WhatsApp Flows Manager
1. Log in to [Meta Business Suite](https://business.facebook.com/).
2. Navigate to **WhatsApp Manager** (under *Account Tools* or *All Tools*).
3. In the left navigation menu, click **Account tools** → **Flows**.
4. Click the blue button **Create Flow**.

### Step 2: Configure & Paste Flow JSON
1. **Flow Name**: Enter `Mahakal_Darshan_Booking`
2. **Categories**: Choose **Lead Generation** or **Customer Support**.
3. In the Flow Builder editor, click the **`</>` (JSON View)** icon in the top right.
4. Open [booking_form_flow.json](file:///Users/nick/Documents/FacePe/facepe-whatsapp-bot/booking_form_flow.json) in this repo, copy all contents, and paste into the editor.
5. Click **Save** in the top right.
6. Click **Preview**: You can test and click the form fields right inside your browser!

### Step 3: Publish the Flow & Get Flow ID
1. Click the **Publish** button in the top right.
2. Once published, you will see your **Flow ID** (a numeric string, e.g., `104829104812345`).
3. Copy this Flow ID.

---

## 🚀 Step 4: Configure Your EC2 Server

### 1. Update `.env` on EC2
Open your `.env` file on your AWS EC2 instance:
```env
WHATSAPP_FLOW_ID=YOUR_COPIED_FLOW_ID_HERE
```

### 2. Restart PM2 Process
Restart the bot service so it loads the new Flow ID:
```bash
pm2 restart whatsapp-bot --update-env
```

---

## 🧪 Step 5: Test the Form

1. Open WhatsApp on your phone and send **`book`** or **`form`** to your official WhatsApp Business number.
2. The bot will send an interactive message:
   > 🙏 *श्री महाकालेश्वर मंदिर, उज्जैन*  
   > *WhatsApp के अंदर सीधे दर्शन एवं आरती पास बुक करने के लिए कृपया नीचे दिए गए फॉर्म बटन पर टैप करें:*  
   > `[ 📝 फॉर्म खोलें / Book ]`
3. Tap the button → The native form will pop up on your screen.
4. Fill in the details and tap **Submit Booking**.
5. Within 2 seconds, the bot will reply with your booking confirmation and attach the official **Digital PDF Pass**!
