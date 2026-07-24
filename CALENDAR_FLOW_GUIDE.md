# WhatsApp Calendar Flow - Future Implementation Guide

Since Meta requires Business Verification before allowing WhatsApp Flows to go live, we are currently using a temporary **Interactive List Menu (Option A)** to select the date. 

Once your business verification is approved by Meta (typically in 1-3 days), follow these simple steps to switch back to the beautiful **Calendar Flow (Option C)**!

---

## Step 1: Get Your Flow ID
1. Go to your Meta Business Manager -> WhatsApp Manager -> Flows.
2. Ensure your `date_picker` flow is Published.
3. Copy the **Flow ID** (usually found in the URL or next to the Flow name).

## Step 2: Update the Code
Open the file `messageHandler.js` in your code editor. 

Go to **Line 70** (inside the `if (state === STATES.CHOOSE_AARTI)` block). You will see the fallback code I wrote. You just need to uncomment the Flow code and comment out the List code.

**Change the code from this (Current Fallback State):**
```javascript
// --- FALLBACK (Option A): Send List of Next 7 Days ---
// // Send the WhatsApp Flow for date selection (Commented out for now)
// await whatsappApi.sendFlowMessage(phone, bodyText, buttonText, 'YOUR_FLOW_ID', 'FLOW_TOKEN_123');

const dateRows = [];
for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    dateRows.push({ id: dateStr, title: dateStr, description: date.toDateString() });
}

const sections = [{
    title: 'Available Dates',
    rows: dateRows
}];
await whatsappApi.sendListMessage(phone, bodyText + '\n\nPlease select a date from the menu:', buttonText, sections);
```

**To this (The Calendar Flow State):**
```javascript
// --- FLOW CALENDAR (Option C) ---
// Note: REPLACE 'YOUR_FLOW_ID' with the actual Flow ID you copied from Meta!
await whatsappApi.sendFlowMessage(phone, bodyText, buttonText, 'YOUR_FLOW_ID', 'FLOW_TOKEN_123');

/*
const dateRows = [];
for (let i = 1; i <= 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    dateRows.push({ id: dateStr, title: dateStr, description: date.toDateString() });
}

const sections = [{
    title: 'Available Dates',
    rows: dateRows
}];
await whatsappApi.sendListMessage(phone, bodyText + '\n\nPlease select a date from the menu:', buttonText, sections);
*/
```

## Step 3: Restart your Server
After you change those lines and insert your Flow ID:
1. Save the file.
2. Stop the running node server (`Ctrl + C` in the terminal).
3. Start it again: `npm start` (or `node server.js`).

Your bot will instantly start sending the native WhatsApp Calendar picker!
