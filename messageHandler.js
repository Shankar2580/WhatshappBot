const stateManager = require('./stateManager');
const { STATES } = stateManager;
const whatsappApi = require('./whatsappApi');
const slots = require('./slots');
const database = require('./database');

async function processMessage(phone, text, buttonPayload) {
    const msgText = (text || '').trim().toLowerCase();
    
    if (msgText === 'cancel') {
        stateManager.clearUser(phone);
        await whatsappApi.sendTextMessage(phone, 'Booking process cancelled. Send "book" to start over.');
        return;
    }

    let state = stateManager.getState(phone);

    if (state === STATES.IDLE) {
        if (msgText === 'book' || msgText === 'hi' || msgText === 'hello') {
            stateManager.setState(phone, STATES.ASK_NAME);
            await whatsappApi.sendTextMessage(phone, 'Welcome to the booking bot! What is your name?');
        }
        return;
    }

    if (state === STATES.ASK_NAME) {
        if (msgText.length >= 2) {
            stateManager.setTempData(phone, { name: text });
            stateManager.setState(phone, STATES.ASK_AGE);
            await whatsappApi.sendTextMessage(phone, `Nice to meet you, ${text}! What is your age?`);
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please enter a valid name (at least 2 characters).');
        }
        return;
    }

    if (state === STATES.ASK_AGE) {
        const age = parseInt(msgText, 10);
        if (!isNaN(age) && age >= 1 && age <= 120) {
            stateManager.setTempData(phone, { age: age });
            stateManager.setState(phone, STATES.ASK_DATE);
            await whatsappApi.sendTextMessage(phone, 'Great. Please provide the booking date in DD/MM/YYYY format.');
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please enter a valid age between 1 and 120.');
        }
        return;
    }

    if (state === STATES.ASK_DATE) {
        const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = msgText.match(dateRegex);
        
        if (match) {
            const day = parseInt(match[1], 10);
            const month = parseInt(match[2], 10) - 1;
            const year = parseInt(match[3], 10);
            
            const dateObj = new Date(year, month, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (dateObj >= today) {
                const dateStr = msgText;
                stateManager.setTempData(phone, { date: dateStr });
                
                const availableSlots = await slots.getAvailableSlotsForDate(dateStr);
                
                if (availableSlots.length > 0) {
                    stateManager.setState(phone, STATES.CHOOSE_SLOT);
                    await whatsappApi.sendSlotButtons(phone, dateStr, availableSlots);
                } else {
                    await whatsappApi.sendTextMessage(phone, `Sorry, no slots are available for ${dateStr}. Please try another date (DD/MM/YYYY).`);
                }
            } else {
                await whatsappApi.sendTextMessage(phone, 'The date cannot be in the past. Please enter a future date (DD/MM/YYYY).');
            }
        } else {
            await whatsappApi.sendTextMessage(phone, 'Invalid format. Please use DD/MM/YYYY.');
        }
        return;
    }

    if (state === STATES.CHOOSE_SLOT) {
        if (buttonPayload && buttonPayload.startsWith('slot_')) {
            const slotTime = buttonPayload.replace('slot_', '');
            stateManager.setTempData(phone, { slot: slotTime });
            stateManager.setState(phone, STATES.CONFIRM);
            
            const data = stateManager.getTempData(phone);
            await whatsappApi.sendConfirmationButtons(phone, data.name, data.age, data.date, slotTime);
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please tap one of the slot buttons, or type "cancel".');
        }
        return;
    }

    if (state === STATES.CONFIRM) {
        if (buttonPayload === 'confirm_yes' || msgText === 'yes') {
            const data = stateManager.getTempData(phone);
            
            const isDuplicate = await database.checkDuplicate(phone, data.date, data.slot);
            if (isDuplicate) {
                 await whatsappApi.sendTextMessage(phone, 'You already have a booking for this slot.');
            } else {
                 await database.saveBooking({
                    user_phone: phone,
                    name: data.name,
                    age: data.age,
                    booking_date: data.date,
                    slot_time: data.slot
                });
                await whatsappApi.sendTextMessage(phone, 'Your booking is confirmed! Thank you.');
            }
            stateManager.clearUser(phone);
        } else if (buttonPayload === 'confirm_no' || msgText === 'no') {
            stateManager.clearUser(phone);
            await whatsappApi.sendTextMessage(phone, 'Booking cancelled. Send "book" to start again.');
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please tap Yes or No to confirm.');
        }
        return;
    }
}

module.exports = {
    processMessage
};
