const axios = require('axios');

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

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
    // If credentials are not set, return a mock checkout link for testing
    if (!KEY_ID || !KEY_SECRET) {
        console.warn('[Razorpay] API credentials not found. Generating a mock payment link.');
        return `https://checkout.razorpay.com/v1/checkout.html?mock_booking_ref=${bookingRef}&mock_amount=${amountPaise / 100}`;
    }

    try {
        const auth = Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64');
        const payload = {
            amount: amountPaise,
            currency: 'INR',
            accept_partial: false,
            reference_id: bookingRef,
            description: `Darshan/Aarti Pass Booking: ${aartiName}`,
            customer: {
                name: guestName,
                contact: phone.startsWith('+') ? phone : `+${phone}`
            },
            notify: {
                sms: false,
                email: false
            },
            notes: {
                booking_ref: bookingRef,
                user_phone: phone
            }
        };

        const response = await axios.post('https://api.razorpay.com/v1/payment_links', payload, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.short_url;
    } catch (error) {
        console.error('[Razorpay] Error creating payment link:', error?.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    createPaymentLink
};
