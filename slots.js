const database = require('./database');

async function getAvailableSlotsForDate(date) {
    try {
        const availableSlots = await database.getAvailableSlots(date);
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
