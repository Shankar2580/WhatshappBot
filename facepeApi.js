const axios = require('axios');
const FormData = require('form-data');

const BASE_URL = process.env.FACEPE_API_BASE_URL || 'https://api.dev.facepe.ai';

/**
 * Register a devotee's face on FacePe OpenSearch vector index
 * @param {string} personId Unique identifier for the devotee
 * @param {Buffer} imageBuffer Buffer of the captured photo
 * @param {string} filename Filename for the photo upload
 * @returns {Promise<Object>} The API response containing face_id and status
 */
async function registerFace(personId, imageBuffer, filename = 'selfie.jpg') {
    try {
        const formData = new FormData();
        formData.append('person_id', personId);
        formData.append('image', imageBuffer, {
            filename: filename,
            contentType: 'image/jpeg'
        });

        const response = await axios.post(`${BASE_URL}/fo/faces`, formData, {
            headers: {
                ...formData.getHeaders()
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error in FacePe registerFace:', error?.response?.data || error.message);
        throw error;
    }
}

module.exports = {
    registerFace
};
