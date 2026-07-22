require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const messageHandler = require('./messageHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.use(bodyParser.json());
app.use(express.static('public')); // Allow viewing downloaded photos in the browser

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

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
