require('dotenv').config();
const axios = require('axios');

const https = require('https');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BASE_URL = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

// Enable Keep-Alive to dramatically reduce latency on outgoing Meta API requests
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });
const api = axios.create({
    headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
    },
    httpsAgent: httpsAgent
});

async function sendTextMessage(phone, text) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text }
        });
    } catch (error) {
        console.error('Error sending text message:', error?.response?.data || error.message);
    }
}

async function sendInteractiveButtons(phone, bodyText, buttons) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'button',
                body: { text: bodyText },
                action: {
                    buttons: buttons.map(btn => ({
                        type: 'reply',
                        reply: {
                            id: btn.id.substring(0, 256), // Max 256 chars
                            title: btn.title.substring(0, 20) // Max 20 chars per WA spec
                        }
                    }))
                }
            }
        });
    } catch (error) {
        console.error('Error sending buttons:', error?.response?.data || error.message);
    }
}

async function sendSlotButtons(phone, date, buttons) {
    await sendInteractiveButtons(phone, `Available slots for ${date}. Please choose one:`, buttons);
}

async function sendListMessage(phone, bodyText, buttonText, sections) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'list',
                header: { type: 'text', text: 'Ujjain Pooja Booking 🙏' },
                body: { text: bodyText },
                footer: { text: 'Shri Mahakaleshwar Temple' },
                action: {
                    button: buttonText,
                    sections: sections
                }
            }
        });
    } catch (error) {
        console.error('Error sending list message:', error?.response?.data || error.message);
    }
}

async function sendConfirmationButtons(phone, aarti_type, name, aadhaar, date, slot) {
    const summary = `Booking Summary:
🙏 Aarti: ${aarti_type}
👤 Name: ${name}
🆔 Aadhaar: ${aadhaar}
📅 Date: ${date}
⏰ Time: ${slot}

Do you want to confirm?`;

    const buttons = [
        { id: 'confirm_yes', title: 'Yes' },
        { id: 'confirm_no', title: 'No' }
    ];

    await sendInteractiveButtons(phone, summary, buttons);
}

module.exports = {
    sendTextMessage,
    sendSlotButtons,
    sendConfirmationButtons,
    sendInteractiveButtons,
    sendListMessage
};
