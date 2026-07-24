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

async function sendSlotButtons(phone, bodyText, buttons) {
    await sendInteractiveButtons(phone, bodyText, buttons);
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

async function sendConfirmationButtons(phone, bodyText, btnYesLabel, btnNoLabel) {
    const buttons = [
        { id: 'confirm_yes', title: btnYesLabel || 'Yes' },
        { id: 'confirm_no', title: btnNoLabel || 'No' }
    ];
    await sendInteractiveButtons(phone, bodyText, buttons);
}

async function sendFlowMessage(phone, bodyText, buttonText, flowId, flowToken) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'flow',
                body: { text: bodyText },
                action: {
                    name: 'flow',
                    parameters: {
                        flow_message_version: '3',
                        flow_token: flowToken,
                        flow_id: flowId,
                        flow_cta: buttonText,
                        flow_action: 'navigate',
                        flow_action_payload: {
                            screen: 'date_selection_screen'
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error sending flow message:', error?.response?.data || error.message);
    }
}

module.exports = {
    sendTextMessage,
    sendSlotButtons,
    sendConfirmationButtons,
    sendInteractiveButtons,
    sendListMessage,
    sendFlowMessage
};
