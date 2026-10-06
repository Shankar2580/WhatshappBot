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

async function sendFlowMessage(phone, bodyText, buttonText, flowId, flowToken = 'FLOW_TOKEN_123', flowData = {}, screen = 'BOOKING_FORM_SCREEN', headerText = '॥ श्री महाकालेश्वर दर्शन ॥') {
    const buildPayload = (mode) => {
        const params = {
            flow_message_version: '3',
            flow_token: flowToken,
            flow_id: String(flowId),
            flow_cta: (buttonText || 'Book Pass').substring(0, 20),
            flow_action: 'navigate',
            flow_action_payload: {
                screen: screen,
                data: flowData
            }
        };
        if (mode) {
            params.mode = mode;
        }

        const interactivePayload = {
            type: 'flow',
            header: headerText ? { type: 'text', text: headerText } : undefined,
            body: { text: bodyText },
            footer: { text: 'Shri Mahakaleshwar Temple' },
            action: {
                name: 'flow',
                parameters: params
            }
        };

        if (!headerText) {
            delete interactivePayload.header;
        }

        return {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: interactivePayload
        };
    };

    try {
        await api.post(BASE_URL, buildPayload(process.env.WHATSAPP_FLOW_MODE || undefined));
        console.log(`[WhatsApp Flow] Successfully sent flow ${flowId} (screen: ${screen}) to ${phone}`);
    } catch (error) {
        console.error('Error sending flow message:', JSON.stringify(error?.response?.data || error.message));

        // If error indicates draft mode is required, automatically retry with mode: 'draft'
        const errStr = JSON.stringify(error?.response?.data || '');
        if (errStr.includes('DRAFT') || errStr.includes('draft') || errStr.includes('not published')) {
            console.log('[WhatsApp Flow] Retrying with mode: draft...');
            try {
                await api.post(BASE_URL, buildPayload('draft'));
                console.log(`[WhatsApp Flow] Successfully sent flow in draft mode to ${phone}`);
                return;
            } catch (retryErr) {
                console.error('[WhatsApp Flow] Retry in draft mode failed:', JSON.stringify(retryErr?.response?.data || retryErr.message));
                throw retryErr;
            }
        }
        throw error;
    }
}

async function uploadMedia(filePath, mimeType = 'application/pdf') {
    try {
        const FormData = require('form-data');
        const fs = require('fs');

        const formData = new FormData();
        formData.append('messaging_product', 'whatsapp');
        formData.append('file', fs.createReadStream(filePath), {
            contentType: mimeType
        });

        const response = await axios.post(
            `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/media`,
            formData,
            {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                    ...formData.getHeaders()
                }
            }
        );
        return response.data.id;
    } catch (error) {
        console.error('Error uploading media to WhatsApp:', error?.response?.data || error.message);
        throw error;
    }
}

async function sendDocumentMessage(phone, mediaId, filename, caption) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'document',
            document: {
                id: mediaId,
                filename: filename,
                caption: caption
            }
        });
    } catch (error) {
        console.error('Error sending document message:', error?.response?.data || error.message);
    }
}

async function downloadMediaBuffer(mediaId) {
    try {
        const mediaRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        });
        const mediaUrl = mediaRes.data.url;
        const fileRes = await axios.get(mediaUrl, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
            responseType: 'arraybuffer'
        });
        return Buffer.from(fileRes.data);
    } catch (error) {
        console.error('Error downloading media from WhatsApp:', error?.response?.data || error.message);
        throw error;
    }
}

async function sendImageMessage(phone, mediaId, caption) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'image',
            image: {
                id: mediaId,
                caption: caption
            }
        });
    } catch (error) {
        console.error('Error sending image message:', error?.response?.data || error.message);
    }
}

async function sendCtaUrlButton(phone, bodyText, buttonText, url) {
    try {
        await api.post(BASE_URL, {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'interactive',
            interactive: {
                type: 'cta_url',
                header: {
                    type: 'text',
                    text: '॥ श्री महाकालेश्वर दर्शन ॥'
                },
                body: {
                    text: bodyText
                },
                footer: {
                    text: 'Razorpay Secure Payment 🔒'
                },
                action: {
                    name: 'cta_url',
                    parameters: {
                        display_text: (buttonText || 'Pay Now').substring(0, 20),
                        url: url
                    }
                }
            }
        });
        console.log(`[WhatsApp] Sent CTA URL button to ${phone}`);
    } catch (error) {
        console.warn('[WhatsApp] CTA URL button failed, falling back to text message:', error?.response?.data || error.message);
        await sendTextMessage(phone, `${bodyText}\n\n🔗 ${url}`);
    }
}

module.exports = {
    sendTextMessage,
    sendSlotButtons,
    sendConfirmationButtons,
    sendInteractiveButtons,
    sendListMessage,
    sendFlowMessage,
    sendCtaUrlButton,
    uploadMedia,
    sendDocumentMessage,
    downloadMediaBuffer,
    sendImageMessage
};

