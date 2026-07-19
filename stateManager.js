const NodeCache = require('node-cache');
// Initialize node-cache with 15-minute TTL
const cache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const STATES = {
    IDLE: 'IDLE',
    ASK_NAME: 'ASK_NAME',
    ASK_AGE: 'ASK_AGE',
    ASK_DATE: 'ASK_DATE',
    CHOOSE_SLOT: 'CHOOSE_SLOT',
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
