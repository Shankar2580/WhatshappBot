require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const messageHandler = require('./messageHandler');
const database = require('./database');
const relayController = require('./relayController');


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
app.get('/webhook', (req, res) => {
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
app.post('/webhook', async (req, res) => {
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

// API Endpoint to fetch devotee booking details by Face ID (person_id) & open turnstile gate
app.get('/api/booking-by-face/:personId', async (req, res) => {
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


app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
