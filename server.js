require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const messageHandler = require('./messageHandler');

const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.use(bodyParser.json());

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
        console.log('Received Webhook:', JSON.stringify(body, null, 2));

        
        if (body.object === 'whatsapp_business_account') {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const phone = message.from;
                
                let text = null;
                let buttonPayload = null;

                if (message.type === 'text') {
                    text = message.text.body;
                } else if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                    buttonPayload = message.interactive.button_reply.id;
                }

                // Process message asynchronously
                await messageHandler.processMessage(phone, text, buttonPayload);
            }
        }
    } catch (error) {
        console.error('Error processing webhook:', error);
    }
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
