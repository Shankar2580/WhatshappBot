require('dotenv').config();
const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const BASE_URL = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

const headers = {
    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
    'Content-Type': 'application/json'
};

async function sendTextMessage(phone, text) {
    try {
        await axios.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: text }
        }, { headers });
    } catch (error) {
        console.error('Error sending text message:', error?.response?.data || error.message);
    }
}

async function sendInteractiveButtons(phone, bodyText, buttons) {
    try {
        await axios.post(BASE_URL, {
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
        }, { headers });
    } catch (error) {
        console.error('Error sending buttons:', error?.response?.data || error.message);
    }
}

async function sendSlotButtons(phone, date, buttons) {
    await sendInteractiveButtons(phone, `Available slots for ${date}. Please choose one:`, buttons);
}

async function sendConfirmationButtons(phone, name, age, date, slot) {
    const summary = `Booking Summary:
Name: ${name}
Age: ${age}
Date: ${date}
Time: ${slot}

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
    sendInteractiveButtons
};
