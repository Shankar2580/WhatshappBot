# Guide: Restoring Live KYCBox Verification Flow

This guide provides instructions on how to re-enable live Aadhaar OTP verification and Passport OCR scans via the KYCBox API in the WhatsApp Bot.

---

## Current Status (Bypass Mode)
To conserve API credits, the live KYCBox API checks have been commented out:
1. **Aadhaar**: When users input their 12-digit Aadhaar number, they are not prompted for an OTP. The system automatically creates a mocked guest profile (`Devotee <Index>`) and proceeds to the next step.
2. **Passport**: When users upload their passport main page photo, the OCR service is skipped. The system automatically creates a mocked guest profile (`Passport Devotee <Index>`) and proceeds.

---

## Re-enabling Live KYCBox Verification

Follow these steps in [`messageHandler.js`](file:///home/shankar/Documents/Product/WhatshappBot/messageHandler.js):

### Step 1: Restore Aadhaar OTP Flow
Find the block `if (state === STATES.ASK_AADHAAR)` in [`messageHandler.js`](file:///home/shankar/Documents/Product/WhatshappBot/messageHandler.js).

1. **Uncomment** the OTP generation block (the try/catch calling `kycBoxApi.generateOtp`).
2. **Remove or Comment Out** the `DIRECT BYPASS ROUTE` block.

#### Code to Restore:
```javascript
    if (state === STATES.ASK_AADHAAR) {
        if (/^\d{12}$/.test(msgText)) {
            stateManager.setTempData(phone, { aadhaar: msgText });
            
            // 1. Uncomment this block:
            await whatsappApi.sendTextMessage(phone, t(lang, 'generating_otp'));
            try {
                const res = await kycBoxApi.generateOtp(msgText);
                console.log("KYCBox generateOtp response:", JSON.stringify(res, null, 2));
                const requestId = res.request_id || res.data?.request_id || res.result?.request_id || res.id;
                if (!requestId) {
                    throw new Error("No request_id returned from KYCBox OTP generator");
                }
                stateManager.setTempData(phone, { kycRequestId: requestId });
                stateManager.setState(phone, STATES.ASK_AADHAAR_OTP); // This enables the OTP entry state
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_otp'));
            } catch (err) {
                console.error("KYCBox generateOtp error:", err?.response?.data || err.message);
                const detail = err?.response?.data?.message || err?.response?.data?.detail || err.message || '';
                await whatsappApi.sendTextMessage(phone, `Failed to generate OTP via Aadhaar API: ${detail}. Please check the Aadhaar number and try again.`);
            }
            
            // 2. Remove or comment out this block:
            /*
            const data = stateManager.getTempData(phone);
            const verifiedName = `Devotee ${data.currentGuestIndex || 1}`;
            ...
            */
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_aadhaar'));
        }
        return;
    }
```

---

### Step 2: Restore Passport OCR Flow
Find the block `if (state === STATES.ASK_PASSPORT_IMAGE)` in [`messageHandler.js`](file:///home/shankar/Documents/Product/WhatshappBot/messageHandler.js).

1. **Uncomment** the image download and passport OCR logic block.
2. **Remove or Comment Out** the `DIRECT BYPASS ROUTE` block that creates mock details.

#### Code to Restore:
```javascript
    if (state === STATES.ASK_PASSPORT_IMAGE) {
        if (imagePayload) {
            await whatsappApi.sendTextMessage(phone, t(lang, 'verifying_passport'));
            const data = stateManager.getTempData(phone);
            try {
                // 1. Uncomment this block:
                const imageBuffer = await whatsappApi.downloadMediaBuffer(imagePayload);
                const ocrRes = await kycBoxApi.verifyPassportOcr(imageBuffer, 'passport.jpg');
                console.log("KYCBox Passport OCR result:", JSON.stringify(ocrRes, null, 2));

                const ocrData = ocrRes.data?.data || ocrRes.data || ocrRes.result || ocrRes;
                
                const val = (item) => (typeof item === 'object' && item !== null ? (item.value || item.text || item.val) : item);

                const gName = val(ocrData.given_names) || val(ocrData.given_name) || val(ocrData.first_name);
                const sName = val(ocrData.surname) || val(ocrData.last_name);
                const fName = val(ocrData.name) || val(ocrData.full_name);

                let verifiedName = 'Passport Holder';
                if (gName || sName) {
                    verifiedName = `${gName || ''} ${sName || ''}`.trim();
                } else if (fName) {
                    verifiedName = fName;
                }

                const passportNum = val(ocrData.passport_number) || val(ocrData.document_number) || "Verified";
                const dob = val(ocrData.dob) || val(ocrData.date_of_birth) || "15-08-1990";
                const sex = val(ocrData.sex) || val(ocrData.gender) || "Male";
 
                if (!data.guests) {
                    data.guests = [];
                }

                data.guests.push({
                    id_type: 'passport',
                    kyc_verified_name: verifiedName,
                    passport_number: passportNum,
                    gender: sex,
                    dob: dob,
                    country: val(ocrData.country) || 'IND'
                });
 
                await whatsappApi.sendTextMessage(phone, t(lang, 'passport_verified', verifiedName));
                
                // 2. Remove or comment out this block:
                /*
                const verifiedName = `Passport Devotee ${data.currentGuestIndex || 1}`;
                const passportNum = "BYPASSED";
                ...
                */

                // 3. Keep the state routing logic as-is:
                if (data.currentGuestIndex < data.numPeople) {
                    data.currentGuestIndex++;
                    stateManager.setTempData(phone, data);
                    stateManager.setState(phone, STATES.ASK_ID_TYPE);
                    const buttons = [
                        { id: 'doc_aadhaar', title: t(lang, 'btn_aadhaar') },
                        { id: 'doc_passport', title: t(lang, 'btn_passport') }
                    ];
                    await whatsappApi.sendInteractiveButtons(phone, t(lang, 'ask_id_type', data.currentGuestIndex), buttons);
                } else {
                    stateManager.setTempData(phone, data);
                    stateManager.setState(phone, STATES.ASK_PHOTO);
                    await whatsappApi.sendTextMessage(phone, t(lang, 'ask_photo'));
                }
            } catch (error) {
                console.error('Passport OCR error:', error.message);
                await whatsappApi.sendTextMessage(phone, t(lang, 'passport_failed'));
            }
        }
        ...
```

---

### Step 3: Deploy Changes on EC2
Once you have modified the code, pull the changes on EC2 and restart the service:
```bash
git pull
PORT=3000 pm2 restart whatsapp-bot --update-env
```
