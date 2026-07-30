const NodeCache = require('node-cache');
// Initialize node-cache with 15-minute TTL
const cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const STATES = {
    IDLE: 'IDLE',
    ASK_LANGUAGE: 'ASK_LANGUAGE',
    CHOOSE_AARTI: 'CHOOSE_AARTI',
    ASK_DATE_FLOW: 'ASK_DATE_FLOW',
    CHOOSE_SLOT: 'CHOOSE_SLOT',
    ASK_NUM_PEOPLE: 'ASK_NUM_PEOPLE',
    ASK_ID_TYPE: 'ASK_ID_TYPE',
    ASK_GUEST_NAME: 'ASK_GUEST_NAME',
    ASK_NAME: 'ASK_NAME',
    ASK_AADHAAR: 'ASK_AADHAAR',
    ASK_AADHAAR_OTP: 'ASK_AADHAAR_OTP',
    ASK_PASSPORT_IMAGE: 'ASK_PASSPORT_IMAGE',
    ASK_PHOTO: 'ASK_PHOTO',
    CONFIRM: 'CONFIRM'
};

function getState(phone) {
    const state = cache.get(`state:${phone}`);
    return state || STATES.IDLE;
}

function setState(phone, state) {
    cache.set(`state:${phone}`, state);
}

function getTempData(phone) {
    const data = cache.get(`data:${phone}`);
    return data || {};
}

function setTempData(phone, data) {
    const currentData = getTempData(phone);
    cache.set(`data:${phone}`, { ...currentData, ...data });
}

function clearUser(phone) {
    cache.del(`state:${phone}`);
    cache.del(`data:${phone}`);
}

module.exports = {
    STATES,
    getState,
    setState,
    getTempData,
    setTempData,
    clearUser
};
