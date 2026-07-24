const axios = require('axios');

const BASE_URL = 'https://api.kycbox.ai/api/db_checks/in/uid';

async function getHeaders() {
    return {
        'Authorization': `Bearer ${process.env.KYCBOX_API_KEY}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Generate OTP for Aadhaar verification
 * @param {string} aadhaarNumber 12-digit Aadhaar number
 * @param {string} referenceId Optional client-supplied reference ID
 * @returns {Promise<Object>} The API response containing request_id and otp_sent flag
 */
async function generateOtp(aadhaarNumber, referenceId = null) {
    try {
        const payload = { aadhaar_number: aadhaarNumber };
        if (referenceId) {
            payload.reference_id = referenceId;
        }

        const response = await axios.post(`${BASE_URL}/generate`, payload, {
            headers: await getHeaders()
        });
        
        return response.data;
    } catch (error) {
        console.error('Error in KYCBox generateOtp:', error?.response?.data || error.message);
        throw error;
    }
}

/**
 * Submit OTP for Aadhaar verification
 * @param {string} requestId The request_id returned by generateOtp
 * @param {string} otp The 6-digit OTP entered by the user
 * @returns {Promise<Object>} The API response containing full KYC data
 */
async function submitOtp(requestId, otp) {
    try {
        const payload = { 
            request_id: requestId, 
            otp: otp 
        };

        const response = await axios.post(`${BASE_URL}/submit`, payload, {
            headers: await getHeaders()
        });
        
        return response.data;
    } catch (error) {
        console.error('Error in KYCBox submitOtp:', error?.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    generateOtp,
    submitOtp
};
