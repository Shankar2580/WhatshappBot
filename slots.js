const database = require('./database');

const NodeCache = require('node-cache');
const slotCache = new NodeCache({ stdTTL: 10 }); // Cache slots for 10 seconds to drastically reduce DB load

async function getAvailableSlotsForDate(date) {
    try {
        const cacheKey = `slots_${date}`;
        let availableSlots = slotCache.get(cacheKey);

        if (!availableSlots) {
            availableSlots = await database.getAvailableSlots(date);
            slotCache.set(cacheKey, availableSlots);
        }

        if (!availableSlots || availableSlots.length === 0) {
            return [];
        }
        // WhatsApp limit: max 3 interactive buttons per message
        return availableSlots.slice(0, 3).map(slot => ({
            id: `slot_${slot.time_range}`,
            title: slot.time_range
        }));
    } catch (error) {
        console.error('Error fetching slots:', error);
        return [];
    }
}

module.exports = {
    getAvailableSlotsForDate
};
