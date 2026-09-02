const axios = require('axios');
const crypto = require('crypto');

function sanitizePhoneForRazorpay(phone) {
    if (!phone) return '';
    // Strip all non-digit characters (+, spaces, dashes)
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `91${digits}`;
    }
    return digits;
}

/**
 * Creates a Razorpay Order for Standard Checkout (Unlimited in Test & Live Mode)
 * @param {string} bookingRef Unique booking reference ID
 * @param {number} amountPaise Amount in paise
 * @param {object} notes Custom notes metadata
 * @returns {Promise<object>} The Razorpay Order object
 */
async function createOrder(bookingRef, amountPaise, notes = {}) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        return {
            id: `order_mock_${Date.now()}`,
            amount: amountPaise,
            currency: 'INR',
            receipt: bookingRef
        };
    }

    try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const payload = {
            amount: amountPaise,
            currency: 'INR',
            receipt: bookingRef.substring(0, 40),
            notes: {
                booking_ref: bookingRef,
                ...notes
            }
        };

        const response = await axios.post('https://api.razorpay.com/v1/orders', payload, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        return response.data;
    } catch (error) {
        console.error('[Razorpay Order] Error creating order:', error?.response?.data || error.message);
        // Fallback gracefully so checkout page can still render
        return {
            id: `order_mock_${Date.now()}`,
            amount: amountPaise,
            currency: 'INR',
            receipt: bookingRef
        };
    }
}

/**
 * Verifies Razorpay Checkout Payment Signature
 * @param {string} orderId Razorpay Order ID
 * @param {string} paymentId Razorpay Payment ID
 * @param {string} signature Razorpay Signature
 * @returns {boolean}
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return true; // Sandbox fallback

    try {
        const hmac = crypto.createHmac('sha256', keySecret);
        hmac.update(`${orderId}|${paymentId}`);
        const generatedSignature = hmac.digest('hex');
        return generatedSignature === signature;
    } catch (err) {
        console.error('[Razorpay Signature] Verification error:', err.message);
        return false;
    }
}

/**
 * Creates a Razorpay Payment Link
 * @param {string} bookingRef Unique booking reference ID
 * @param {number} amountPaise Amount in paise (1 INR = 100 paise)
 * @param {string} phone Devotee's phone number
 * @param {string} aartiName Name of the Aarti service
 * @param {string} guestName Devotee's name
 * @returns {Promise<string>} The payment link URL
 */
async function createPaymentLink(bookingRef, amountPaise, phone, aartiName, guestName = 'Devotee') {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const baseUrl = process.env.APP_BASE_URL || 'https://api.dev.facepe.ai/wb';

    // In test mode or when links hit rate limits, hosted checkout on api.dev.facepe.ai/wb is the primary link
    const hostedCheckoutUrl = `${baseUrl}/checkout?ref=${bookingRef}`;

    if (!keyId || !keySecret) {
        return hostedCheckoutUrl;
    }

    try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const cleanPhone = sanitizePhoneForRazorpay(phone);

        const payload = {
            amount: amountPaise,
            currency: 'INR',
            accept_partial: false,
            reference_id: bookingRef.substring(0, 40),
            description: `Darshan Pass: ${aartiName}`.substring(0, 255),
            customer: {
                name: (guestName || 'Devotee').substring(0, 100),
                ...(cleanPhone && cleanPhone.length >= 10 ? { contact: cleanPhone } : {})
            },
            notify: {
                sms: false,
                email: false
            },
            reminder_enable: false,
            notes: {
                booking_ref: bookingRef,
                user_phone: phone
            },
            callback_url: `${baseUrl}/payment-success?ref=${bookingRef}`,
            callback_method: 'get'
        };

        const response = await axios.post('https://api.razorpay.com/v1/payment_links', payload, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        const paymentUrl = response.data.short_url || response.data.url;
        console.log(`[Razorpay] Successfully created payment link for ref ${bookingRef}: ${paymentUrl}`);
        return paymentUrl;
    } catch (error) {
        console.warn('[Razorpay] Payment link creation returned error (e.g. rate limit), falling back to Hosted Checkout:', error?.response?.data || error.message);
        return hostedCheckoutUrl;
    }
}

module.exports = {
    createPaymentLink,
    createOrder,
    verifyPaymentSignature,
    sanitizePhoneForRazorpay
};
