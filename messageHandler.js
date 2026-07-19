const stateManager = require('./stateManager');
const { STATES } = stateManager;
const whatsappApi = require('./whatsappApi');
const slots = require('./slots');
const database = require('./database');

async function processMessage(phone, text, buttonPayload, imagePayload) {
    const msgText = (text || '').trim().toLowerCase();
    
    if (msgText === 'cancel') {
        stateManager.clearUser(phone);
        await whatsappApi.sendTextMessage(phone, 'Booking process cancelled. Send "book" to start over.');
        return;
    }

    let state = stateManager.getState(phone);

    if (state === STATES.IDLE) {
        if (msgText === 'book' || msgText === 'hi' || msgText === 'hello') {
            stateManager.setState(phone, STATES.CHOOSE_AARTI);
            const bodyText = '🙏 Welcome to the official Ujjain Pooja Booking Bot! ✨\n\nPlease select the type of Darshan or Aarti you would like to book today:';
            const buttonText = 'Select Aarti';
            const sections = [{
                title: 'Available Services',
                rows: [
                    { id: 'Bhasma Aarti', title: 'Bhasma Aarti', description: 'Early morning ritual' },
                    { id: 'Shighra Darshan', title: 'Shighra Darshan', description: 'Quick entry ticket' },
                    { id: 'Shayan Aarti', title: 'Shayan Aarti', description: 'Night time ritual' },
                    { id: 'Sandhya Aarti', title: 'Sandhya Aarti', description: 'Evening ritual' }
                ]
            }];
            await whatsappApi.sendListMessage(phone, bodyText, buttonText, sections);
        }
        return;
    }

    if (state === STATES.CHOOSE_AARTI) {
        if (buttonPayload) {
            stateManager.setTempData(phone, { aarti: buttonPayload });
            stateManager.setState(phone, STATES.ASK_DATE);
            await whatsappApi.sendTextMessage(phone, `You selected ${buttonPayload}. ✨\n\nPlease provide the booking date in DD/MM/YYYY format (e.g., 25/06/2026).`);
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please tap the "Select Aarti" button and choose an option.');
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
            stateManager.setState(phone, STATES.ASK_PHOTO);
            await whatsappApi.sendTextMessage(phone, 'Awesome. Next, please send a clear photo of yourself 📸 (You can use the camera or gallery attachment).');
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please tap one of the slot buttons, or type "cancel".');
        }
        return;
    }

    if (state === STATES.ASK_PHOTO) {
        if (imagePayload) {
            stateManager.setTempData(phone, { photoId: imagePayload });
            stateManager.setState(phone, STATES.ASK_NAME);
            await whatsappApi.sendTextMessage(phone, 'Photo received! 🖼️\n\nNow, please type your Full Name.');
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please attach and send an image file. 📸');
        }
        return;
    }

    if (state === STATES.ASK_NAME) {
        if (msgText.length >= 2) {
            stateManager.setTempData(phone, { name: text });
            stateManager.setState(phone, STATES.ASK_AADHAAR);
            await whatsappApi.sendTextMessage(phone, `Thank you, ${text}! 🙏\n\nFinally, please type your 12-digit Aadhaar Card number for verification.`);
        } else {
            await whatsappApi.sendTextMessage(phone, 'Please enter a valid full name (at least 2 characters).');
        }
        return;
    }

    if (state === STATES.ASK_AADHAAR) {
        if (/^\d{12}$/.test(msgText)) {
            stateManager.setTempData(phone, { aadhaar: msgText });
            stateManager.setState(phone, STATES.CONFIRM);
            
            const data = stateManager.getTempData(phone);
            await whatsappApi.sendConfirmationButtons(phone, data.aarti, data.name, data.aadhaar, data.date, data.slot);
        } else {
            await whatsappApi.sendTextMessage(phone, 'Invalid Aadhaar. Please enter exactly 12 digits (e.g., 123456789012).');
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
                    aarti_type: data.aarti,
                    name: data.name,
                    aadhaar: data.aadhaar,
                    photo_id: data.photoId,
                    booking_date: data.date,
                    slot_time: data.slot
                });
                await whatsappApi.sendTextMessage(phone, '✅ Your booking is officially confirmed! Thank you for choosing Ujjain Mahakaleshwar Temple. 🙏');
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
