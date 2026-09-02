require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const messageHandler = require('./messageHandler');
const database = require('./database');
const relayController = require('./relayController');
const crypto = require('crypto');
const path = require('path');
const pdfGenerator = require('./pdfGenerator');
const whatsappApi = require('./whatsappApi');
const razorpayApi = require('./razorpayApi');
const { t } = require('./translations');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 8009;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.use(bodyParser.json());
app.use(express.static('public')); // Allow viewing downloaded photos in the browser

// Health Check endpoint for Docker & EKS/Kubernetes probes
app.get('/wb/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Webhook Verification (GET)
app.get(['/webhook', '/wb/webhook'], (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.status(400).send('Missing mode or token');
    }
});

// Webhook Reception (POST)
app.post(['/webhook', '/wb/webhook'], async (req, res) => {
    // ALWAYS respond 200 OK immediately
    res.sendStatus(200);

    try {
        const body = req.body;
        // Commented out heavy logging to speed up disk I/O in production
        // console.log('Received Webhook:', JSON.stringify(body, null, 2));

        if (body.object === 'whatsapp_business_account') {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                
                // Ignore messages older than 5 minutes to prevent ghost retries from Meta
                const messageTime = parseInt(message.timestamp, 10);
                const currentTime = Math.floor(Date.now() / 1000);
                if (currentTime - messageTime > 300) {
                    console.log('Ignored old delayed message:', message.id);
                    return;
                }
                
                const phone = message.from;
                
                let text = null;
                let buttonPayload = null;
                let imagePayload = null;

                if (message.type === 'text') {
                    text = message.text.body;
                } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                    buttonPayload = message.interactive.button_reply.id;
                } else if (message.type === 'interactive' && message.interactive.type === 'list_reply') {
                    buttonPayload = message.interactive.list_reply.id;
                } else if (message.type === 'interactive' && message.interactive.type === 'nfm_reply') {
                    // This handles the WhatsApp Flow JSON response
                    try {
                        const flowJson = JSON.parse(message.interactive.nfm_reply.response_json);
                        text = JSON.stringify(flowJson); // Pass the JSON stringified as the text parameter
                    } catch (e) {
                        console.error('Error parsing flow response:', e);
                    }
                } else if (message.type === 'image') {
                    imagePayload = message.image.id;
                }

                // Process message asynchronously in the background (Do NOT await, this frees up the event loop)
                messageHandler.processMessage(phone, text, buttonPayload, imagePayload).catch(err => console.error(err));
            }
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
    }
});

// Razorpay Webhook Endpoint
app.post(['/webhook/razorpay', '/wb/webhook/razorpay'], async (req, res) => {
    // 1. Immediately acknowledge the receipt with 200 OK
    res.sendStatus(200);

    const signature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Validate Signature
    if (secret) {
        try {
            const shasum = crypto.createHmac('sha256', secret);
            shasum.update(JSON.stringify(req.body));
            const digest = shasum.digest('hex');
            
            if (digest !== signature) {
                console.warn('[Razorpay Webhook] Invalid signature. Ignoring webhook.');
                return;
            }
        } catch (err) {
            console.error('[Razorpay Webhook] Signature verification failed:', err.message);
            return;
        }
    } else {
        console.warn('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured. Proceeding without signature verification (Sandbox mode).');
    }

    try {
        const body = req.body;
        console.log('[Razorpay Webhook] Event received:', body.event);

        if (body.event === 'payment.captured' || body.event === 'order.paid') {
            const paymentEntity = body.payload.payment.entity;
            const bookingRef = paymentEntity.notes.booking_ref || paymentEntity.reference_id;
            const phone = paymentEntity.notes.user_phone || paymentEntity.contact;
            
            if (!bookingRef) {
                console.warn('[Razorpay Webhook] Webhook ignored: no booking_ref found in notes.');
                return;
            }

            // Retrieve booking
            const booking = await database.getBookingByRef(bookingRef);
            if (!booking) {
                console.warn(`[Razorpay Webhook] Booking not found for ref: ${bookingRef}`);
                return;
            }

            if (booking.status === 'pending_payment') {
                console.log(`[Razorpay Webhook] Payment captured for ref ${bookingRef}. Confirming booking.`);
                
                const paymentId = paymentEntity.id || 'MOCK_PAYMENT_ID';
                const amountPaid = paymentEntity.amount ? (paymentEntity.amount / 100) : 0;

                // Update booking status and save payment details in the database
                await database.confirmBookingPayment(bookingRef, paymentId, amountPaid);

                // Download devotee selfie from WhatsApp media servers if photo_id is available
                let tempSelfiePath = null;
                if (booking.photo_id) {
                    try {
                        const tempDir = path.join(__dirname, 'public', 'downloaded_photos');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir, { recursive: true });
                        }
                        tempSelfiePath = path.join(tempDir, `selfie_${bookingRef}.jpg`);
                        const buffer = await whatsappApi.downloadMediaBuffer(booking.photo_id);
                        fs.writeFileSync(tempSelfiePath, buffer);
                        console.log(`[Razorpay Webhook] Successfully downloaded devotee selfie to: ${tempSelfiePath}`);
                    } catch (dlErr) {
                        console.error('[Razorpay Webhook] Error downloading devotee selfie for ticket pass:', dlErr.message);
                        tempSelfiePath = null;
                    }
                }

                // Send confirmation message
                const lang = booking.language || 'en';
                await whatsappApi.sendTextMessage(phone, t(lang, 'booking_success'));

                // Generate and send PDF pass document over WhatsApp
                try {
                    const pdfPath = path.join(__dirname, 'public', 'tickets', `${bookingRef}.pdf`);
                    const guests = JSON.parse(booking.guests_data);
                    
                    await pdfGenerator.generateBookingPdf({
                        booking_ref: bookingRef,
                        user_phone: booking.user_phone,
                        aarti_type: booking.aarti_type,
                        booking_date: booking.booking_date,
                        slot_time: booking.slot_time,
                        num_people: booking.num_people,
                        guests: guests,
                        payment_id: paymentId,
                        amount_paid: amountPaid,
                        selfie_path: tempSelfiePath
                    }, pdfPath);

                    const mediaId = await whatsappApi.uploadMedia(pdfPath, 'application/pdf');
                    await whatsappApi.sendDocumentMessage(phone, mediaId, `${bookingRef}.pdf`, t(lang, 'pdf_caption'));
                } catch (pdfErr) {
                    console.error('[Razorpay Webhook] Error generating or sending PDF pass:', pdfErr);
                } finally {
                    // Clean up downloaded selfie to preserve disk space
                    if (tempSelfiePath && fs.existsSync(tempSelfiePath)) {
                        try {
                            fs.unlinkSync(tempSelfiePath);
                            console.log(`[Razorpay Webhook] Cleaned up temporary devotee selfie file: ${tempSelfiePath}`);
                        } catch (unlinkErr) {
                            console.error('[Razorpay Webhook] Error deleting temp selfie:', unlinkErr.message);
                        }
                    }
                }
            } else {
                console.log(`[Razorpay Webhook] Booking ${bookingRef} already processed (status: ${booking.status})`);
            }
        }
    } catch (error) {
        console.error('[Razorpay Webhook] Error processing event:', error);
    }
});

// API Endpoint to fetch devotee booking details by Face ID (person_id) & open turnstile gate
app.get(['/api/booking-by-face/:personId', '/wb/api/booking-by-face/:personId'], async (req, res) => {
    try {
        const personId = req.params.personId;
        if (!personId) {
            return res.status(400).json({ error: 'Missing personId parameter' });
        }
        
        // Extract phone number from personId (e.g. 919999999999_Aadhaar_Holder -> 919999999999)
        const parts = personId.split('_');
        const phone = parts[0];
        
        const booking = await database.getLatestBookingByPhone(phone);
        if (!booking) {
            return res.status(404).json({ error: 'No active booking found for this devotee' });
        }
        
        let guests = [];
        try {
            guests = JSON.parse(booking.guests_data);
        } catch (e) {
            console.error('Error parsing guests data:', e);
        }
        
        // Try direct relay trigger if EC2 is on local network, fallback safely if cloud-hosted
        let gateUnlocked = false;
        let gateMessage = 'Local mobile bridge trigger active';
        try {
            const relayResult = await Promise.race([
                relayController.triggerGateRelay(0, 500),
                new Promise((_, r) => setTimeout(() => r(new Error('EC2 Relay timeout')), 1000))
            ]);
            gateUnlocked = relayResult.success;
            gateMessage = relayResult.message;
        } catch (rErr) {
            // Safe fallback: local mobile app handles relay triggering on local Wi-Fi
        }
        
        return res.status(200).json({
            booking_ref: booking.booking_ref,
            user_phone: booking.user_phone,
            aarti_type: booking.aarti_type,
            booking_date: booking.booking_date,
            slot_time: booking.slot_time,
            num_people: booking.num_people,
            guests: guests,
            status: booking.status,
            gate_unlocked: gateUnlocked,
            gate_message: gateMessage
        });
    } catch (err) {
        console.error('Error in /api/booking-by-face:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// User-friendly Payment Success Landing Page
app.get(['/payment-success', '/wb/payment-success'], (req, res) => {
    const bookingRef = req.query.ref || '';
    res.send(`
    <!DOCTYPE html>
    <html lang="hi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>श्री महाकालेश्वर दर्शन • भुगतान सफल</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #2A0500; color: #FFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: linear-gradient(145deg, #4A0E00, #7A1705); border: 2px solid #FFB300; border-radius: 24px; padding: 32px 24px; text-align: center; max-width: 420px; width: 100%; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }
            .icon { font-size: 54px; margin-bottom: 12px; }
            .mantra { color: #FFB300; font-size: 14px; font-weight: bold; letter-spacing: 2px; }
            h1 { font-size: 22px; color: #FFF; margin: 12px 0 8px; }
            p { font-size: 14px; color: #FFE0B2; line-height: 1.5; margin: 6px 0; }
            .ref-pill { background: rgba(255, 179, 0, 0.15); border: 1px dashed #FFB300; border-radius: 12px; padding: 10px; margin: 18px 0; color: #FFD54F; font-weight: bold; font-size: 15px; }
            .btn { display: inline-block; background: #FF6F00; color: #FFF; text-decoration: none; padding: 14px 28px; border-radius: 14px; font-weight: bold; margin-top: 14px; border: 1px solid #FFB300; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="mantra">॥ ॐ नमः शिवाय ॥</div>
            <div class="icon">✅</div>
            <h1>भुगतान सफल रहा!</h1>
            <p>Payment Successful • श्री महाकालेश्वर दर्शन</p>
            ${bookingRef ? `<div class="ref-pill">Booking Ref: ${bookingRef}</div>` : ''}
            <p>आपका आधिकारिक डिजिटल दर्शन पास WhatsApp पर भेजा जा चुका है।</p>
            <p style="font-size: 12px; color: #FFCC80; margin-top: 16px;">कृपया WhatsApp खोलें और अपना PDF पास डाउनलोड करें।</p>
            <a href="whatsapp://" class="btn">WhatsApp पर जाएं</a>
        </div>
    </body>
    </html>
    `);
});

// Pooja Pricing Map
const aartiPrices = {
    'Bhasma Aarti': 100,
    'Shighra Darshan': 250,
    'Shayan Aarti': 50,
    'Sandhya Aarti': 50
};

// Razorpay Hosted Checkout Page (Unlimited in Test Mode & Live Mode)
app.get(['/checkout', '/wb/checkout'], async (req, res) => {
    const bookingRef = req.query.ref || '';
    if (!bookingRef) {
        return res.status(400).send('Missing booking reference.');
    }

    try {
        const booking = await database.getBookingByRef(bookingRef);
        if (!booking) {
            return res.status(404).send('Booking reference not found.');
        }

        if (booking.status === 'confirmed') {
            return res.redirect(`/payment-success?ref=${bookingRef}`);
        }

        let guests = [];
        try { guests = JSON.parse(booking.guests_data); } catch (e) {}
        const primaryGuestName = guests[0]?.kyc_verified_name || 'Devotee';

        const pricePerPerson = aartiPrices[booking.aarti_type] || 100;
        const totalAmount = pricePerPerson * (booking.num_people || 1);
        const amountPaise = totalAmount * 100;

        const keyId = process.env.RAZORPAY_KEY_ID || '';
        const order = await razorpayApi.createOrder(bookingRef, amountPaise, { user_phone: booking.user_phone });

        res.send(`
        <!DOCTYPE html>
        <html lang="hi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>श्री महाकालेश्वर दर्शन • सुरक्षित भुगतान</title>
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    background: #1A0000;
                    color: #FFFFFF;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    padding: 16px;
                    box-sizing: border-box;
                }
                .checkout-card {
                    background: linear-gradient(160deg, #380800, #5C0E00, #7A1400);
                    border: 2px solid #FFB300;
                    border-radius: 24px;
                    padding: 32px 24px;
                    max-width: 440px;
                    width: 100%;
                    box-shadow: 0 16px 36px rgba(0,0,0,0.7);
                    text-align: center;
                }
                .mantra { color: #FFB300; font-size: 13px; font-weight: 800; letter-spacing: 2px; }
                .temple-title { font-size: 20px; font-weight: 900; color: #FFF; margin: 8px 0 4px; }
                .temple-sub { font-size: 12px; color: #FFCC80; margin-bottom: 20px; }
                .details-box {
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(255, 179, 0, 0.3);
                    border-radius: 16px;
                    padding: 16px;
                    margin: 16px 0;
                    text-align: left;
                    font-size: 13px;
                }
                .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                .row:last-child { margin-bottom: 0; }
                .label { color: #FFCC80; }
                .val { color: #FFFFFF; font-weight: bold; }
                .amount-highlight {
                    font-size: 28px;
                    font-weight: 900;
                    color: #FFB300;
                    margin: 18px 0;
                }
                .pay-btn {
                    background: linear-gradient(90deg, #FF6F00, #FFA000);
                    color: #FFFFFF;
                    border: 2px solid #FFD54F;
                    padding: 16px;
                    width: 100%;
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 900;
                    cursor: pointer;
                    box-shadow: 0 6px 20px rgba(255, 111, 0, 0.4);
                    transition: transform 0.1s;
                }
                .pay-btn:active { transform: scale(0.98); }
                .secure-badge { font-size: 11px; color: #B0BEC5; margin-top: 14px; }
            </style>
        </head>
        <body>
            <div class="checkout-card">
                <div class="mantra">॥ ॐ नमः शिवाय ॥</div>
                <div class="temple-title">श्री महाकालेश्वर ज्योतिर्लिंग</div>
                <div class="temple-sub">उज्जैन (म.प्र.) • दर्शन पास भुगतान</div>

                <div class="details-box">
                    <div class="row"><span class="label">सेवा / आरती:</span><span class="val">${booking.aarti_type}</span></div>
                    <div class="row"><span class="label">दर्शन तिथि:</span><span class="val">${booking.booking_date}</span></div>
                    <div class="row"><span class="label">समय स्लॉट:</span><span class="val">${booking.slot_time}</span></div>
                    <div class="row"><span class="label">भक्त संख्या:</span><span class="val">${booking.num_people} व्यक्ति</span></div>
                    <div class="row"><span class="label">मुख्य भक्त:</span><span class="val">${primaryGuestName}</span></div>
                    <div class="row"><span class="label">Booking Ref:</span><span class="val">${booking.booking_ref}</span></div>
                </div>

                <div class="amount-highlight">₹${totalAmount}</div>

                <button class="pay-btn" id="payBtn" onclick="openRazorpay()">💳 Razorpay / UPI से भुगतान करें</button>

                <div class="secure-badge">🔒 256-Bit SSL Secured by Razorpay</div>
            </div>

            <script>
                const options = {
                    key: "${keyId}",
                    amount: "${amountPaise}",
                    currency: "INR",
                    name: "श्री महाकालेश्वर ज्योतिर्लिंग",
                    description: "${booking.aarti_type} Pass (${booking.num_people} Devotees)",
                    order_id: "${order.id || ''}",
                    prefill: {
                        name: "${primaryGuestName}",
                        contact: "${booking.user_phone}"
                    },
                    theme: {
                        color: "#B71C1C"
                    },
                    handler: async function (response) {
                        document.getElementById('payBtn').innerText = '⏳ पुष्टि की जा रही है...';
                        document.getElementById('payBtn').disabled = true;

                        const prefix = window.location.pathname.startsWith('/wb') ? '/wb' : '';
                        try {
                            const res = await fetch(prefix + '/api/confirm-payment', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    booking_ref: "${bookingRef}",
                                    payment_id: response.razorpay_payment_id || 'PAY_MOCK_SUCCESS',
                                    order_id: response.razorpay_order_id,
                                    signature: response.razorpay_signature,
                                    amount: ${totalAmount}
                                })
                            });

                            if (res.ok) {
                                window.location.href = prefix + '/payment-success?ref=${bookingRef}';
                            } else {
                                alert('भुगतान सत्यापन विफल रहा। कृपया पुनः प्रयास करें।');
                                document.getElementById('payBtn').innerText = '💳 पुनः प्रयास करें';
                                document.getElementById('payBtn').disabled = false;
                            }
                        } catch (err) {
                            window.location.href = prefix + '/payment-success?ref=${bookingRef}';
                        }
                    },
                    modal: {
                        ondismiss: function() {
                            console.log('Checkout dismissed');
                        }
                    }
                };

                function openRazorpay() {
                    const prefix = window.location.pathname.startsWith('/wb') ? '/wb' : '';
                    if (!options.key) {
                        window.location.href = prefix + '/mock-payment?ref=${bookingRef}&amount=${totalAmount}&action=pay';
                        return;
                    }
                    const rzp = new Razorpay(options);
                    rzp.open();
                }

                // Automatically launch payment on page load
                window.onload = function() {
                    setTimeout(openRazorpay, 300);
                };
            </script>
        </body>
        </html>
        `);
    } catch (err) {
        console.error('Error loading checkout page:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Endpoint to confirm payment and dispatch PDF ticket to devotee WhatsApp
app.post(['/api/confirm-payment', '/wb/api/confirm-payment'], async (req, res) => {
    try {
        const { booking_ref, payment_id, amount } = req.body;
        if (!booking_ref) {
            return res.status(400).json({ error: 'Missing booking_ref' });
        }

        const booking = await database.getBookingByRef(booking_ref);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const paymentId = payment_id || `pay_${Date.now()}`;
        const amountPaid = amount || 100;

        await database.confirmBookingPayment(booking_ref, paymentId, amountPaid);

        // Download devotee selfie if available
        let tempSelfiePath = null;
        if (booking.photo_id) {
            try {
                const tempDir = path.join(__dirname, 'public', 'downloaded_photos');
                if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                }
                tempSelfiePath = path.join(tempDir, `selfie_${booking_ref}.jpg`);
                const buffer = await whatsappApi.downloadMediaBuffer(booking.photo_id);
                fs.writeFileSync(tempSelfiePath, buffer);
            } catch (dlErr) {
                console.error('[Payment Confirmation] Error downloading selfie:', dlErr.message);
                tempSelfiePath = null;
            }
        }

        // Send confirmation message and PDF
        const lang = booking.language || 'en';
        await whatsappApi.sendTextMessage(booking.user_phone, t(lang, 'booking_success'));

        try {
            const pdfPath = path.join(__dirname, 'public', 'tickets', `${booking_ref}.pdf`);
            const guests = JSON.parse(booking.guests_data);
            await pdfGenerator.generateBookingPdf({
                booking_ref: booking_ref,
                user_phone: booking.user_phone,
                aarti_type: booking.aarti_type,
                booking_date: booking.booking_date,
                slot_time: booking.slot_time,
                num_people: booking.num_people,
                guests: guests,
                payment_id: paymentId,
                amount_paid: amountPaid,
                selfie_path: tempSelfiePath
            }, pdfPath);

            const mediaId = await whatsappApi.uploadMedia(pdfPath);
            await whatsappApi.sendDocumentMessage(booking.user_phone, mediaId, `${booking_ref}.pdf`, t(lang, 'pdf_caption'));
        } catch (pdfErr) {
            console.error('[Payment Confirmation] Error sending PDF pass:', pdfErr.message);
        }

        return res.status(200).json({ success: true, booking_ref });
    } catch (err) {
        console.error('Error in /api/confirm-payment:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Sandbox / Mock Payment Simulation Page
app.get(['/mock-payment', '/wb/mock-payment'], async (req, res) => {
    const bookingRef = req.query.ref || '';
    const amount = req.query.amount || '100';

    if (req.query.action === 'pay') {
        const booking = await database.getBookingByRef(bookingRef);
        if (booking) {
            const fakePaymentId = `pay_mock_${Date.now()}`;
            await database.confirmBookingPayment(bookingRef, fakePaymentId, parseFloat(amount));

            // Generate and send ticket to WhatsApp
            try {
                const pdfPath = path.join(__dirname, 'public', 'tickets', `${bookingRef}.pdf`);
                const guests = JSON.parse(booking.guests_data);
                await pdfGenerator.generateBookingPdf({
                    booking_ref: bookingRef,
                    user_phone: booking.user_phone,
                    aarti_type: booking.aarti_type,
                    booking_date: booking.booking_date,
                    slot_time: booking.slot_time,
                    num_people: booking.num_people,
                    guests: guests,
                    payment_id: fakePaymentId,
                    amount_paid: parseFloat(amount),
                    selfie_path: null
                }, pdfPath);

                const lang = booking.language || 'en';
                await whatsappApi.sendTextMessage(booking.user_phone, t(lang, 'booking_success'));
                const mediaId = await whatsappApi.uploadMedia(pdfPath);
                await whatsappApi.sendDocumentMessage(booking.user_phone, mediaId, `${bookingRef}.pdf`, t(lang, 'pdf_caption'));
            } catch (err) {
                console.error('Error generating PDF during mock payment:', err);
            }
        }
        return res.redirect(`/payment-success?ref=${bookingRef}`);
    }

    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Razorpay Test Gateway</title>
        <style>
            body { font-family: sans-serif; background: #0c1524; color: #FFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
            .box { background: #182337; border: 1px solid #2d3f5e; border-radius: 16px; padding: 28px; max-width: 380px; width: 100%; text-align: center; }
            .amt { font-size: 32px; font-weight: bold; color: #528FF0; margin: 16px 0; }
            .btn { background: #528FF0; color: #FFF; border: none; padding: 14px; width: 100%; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; text-decoration: none; display: block; box-sizing: border-box; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2 style="margin: 0; color: #94A3B8; font-size: 16px;">Razorpay Sandbox Checkout</h2>
            <div class="amt">₹${amount}</div>
            <p style="color: #94A3B8; font-size: 13px;">Ref: ${bookingRef}</p>
            <a href="/mock-payment?ref=${bookingRef}&amount=${amount}&action=pay" class="btn">Complete Test Payment</a>
        </div>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
