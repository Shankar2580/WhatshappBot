const stateManager = require('./stateManager');
const { STATES } = stateManager;
const whatsappApi = require('./whatsappApi');
const slots = require('./slots');
const database = require('./database');
const { t } = require('./translations');

async function processMessage(phone, text, buttonPayload, imagePayload) {
    const msgText = (text || '').trim().toLowerCase();
    const lang = stateManager.getTempData(phone)?.language || 'en';
    
    if (msgText === 'cancel') {
        stateManager.clearUser(phone);
        await whatsappApi.sendTextMessage(phone, t(lang, 'cancelled'));
        return;
    }

    let state = stateManager.getState(phone);

    if (state === STATES.IDLE) {
        if (msgText === 'book' || msgText === 'hi' || msgText === 'hello') {
            stateManager.setState(phone, STATES.ASK_LANGUAGE);
            const bodyText = t('en', 'welcome');
            const buttons = [
                { id: 'lang_en', title: t('en', 'btn_english') },
                { id: 'lang_hi', title: t('en', 'btn_hindi') }
            ];
            await whatsappApi.sendInteractiveButtons(phone, bodyText, buttons);
        }
        return;
    }

    if (state === STATES.ASK_LANGUAGE) {
        if (buttonPayload === 'lang_en' || buttonPayload === 'lang_hi') {
            const selectedLang = buttonPayload === 'lang_en' ? 'en' : 'hi';
            stateManager.setTempData(phone, { language: selectedLang });
            stateManager.setState(phone, STATES.CHOOSE_AARTI);
            
            const bodyText = t(selectedLang, 'choose_aarti');
            const buttonText = t(selectedLang, 'btn_select_aarti');
            const sections = [{
                title: 'Available Services',
                rows: [
                    { id: 'Bhasma Aarti', title: t(selectedLang, 'bhasma_aarti') },
                    { id: 'Shighra Darshan', title: t(selectedLang, 'shighra_darshan') },
                    { id: 'Shayan Aarti', title: t(selectedLang, 'shayan_aarti') },
                    { id: 'Sandhya Aarti', title: t(selectedLang, 'sandhya_aarti') }
                ]
            }];
            await whatsappApi.sendListMessage(phone, bodyText, buttonText, sections);
        } else {
            const buttons = [
                { id: 'lang_en', title: 'English' },
                { id: 'lang_hi', title: 'हिंदी' }
            ];
            await whatsappApi.sendInteractiveButtons(phone, 'Please select your language / कृपया अपनी भाषा चुनें', buttons);
        }
        return;
    }

    if (state === STATES.CHOOSE_AARTI) {
        if (buttonPayload) {
            stateManager.setTempData(phone, { aarti: buttonPayload });
            stateManager.setState(phone, STATES.ASK_DATE_FLOW);
            
            const bodyText = t(lang, 'aarti_selected', buttonPayload);
            const buttonText = t(lang, 'btn_select_date');
            
            // --- FALLBACK (Option A): Send List of Next 7 Days ---
            // // Send the WhatsApp Flow for date selection (Commented out for now)
            // await whatsappApi.sendFlowMessage(phone, bodyText, buttonText, 'YOUR_FLOW_ID', 'FLOW_TOKEN_123');

            const dateRows = [];
            for (let i = 1; i <= 7; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i);
                const day = String(date.getDate()).padStart(2, '0');
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const year = date.getFullYear();
                const dateStr = `${day}/${month}/${year}`;
                dateRows.push({ id: dateStr, title: dateStr, description: date.toDateString() });
            }

            const sections = [{
                title: 'Available Dates',
                rows: dateRows
            }];
            await whatsappApi.sendListMessage(phone, bodyText + '\n\nPlease select a date from the menu:', buttonText, sections);

        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_aarti_selection'));
        }
        return;
    }

    if (state === STATES.ASK_DATE_FLOW) {
        let selectedDate = null;
        
        try {
            if (buttonPayload) {
                // If they clicked the List Menu fallback option
                const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                if (dateRegex.test(buttonPayload)) {
                    selectedDate = buttonPayload;
                }
            } else if (text && text.startsWith('{')) {
                // text will be a stringified JSON if it came from the flow nfm_reply
                const flowData = JSON.parse(text);
                if (flowData && flowData.date) {
                    selectedDate = flowData.date;
                }
            } else {
                // If they typed it manually instead of using the flow/list
                const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                const match = msgText.match(dateRegex);
                if (match) {
                    selectedDate = msgText;
                }
            }
        } catch(e) {
            console.error('Error parsing date:', e);
        }
        
        if (selectedDate) {
            stateManager.setTempData(phone, { date: selectedDate });
            const availableSlots = await slots.getAvailableSlotsForDate(selectedDate);
            
            if (availableSlots.length > 0) {
                stateManager.setState(phone, STATES.CHOOSE_SLOT);
                await whatsappApi.sendSlotButtons(phone, t(lang, 'choose_slot'), availableSlots);
            } else {
                await whatsappApi.sendTextMessage(phone, t(lang, 'no_slots', selectedDate));
            }
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_date'));
        }
        return;
    }

    if (state === STATES.CHOOSE_SLOT) {
        if (buttonPayload && buttonPayload.startsWith('slot_')) {
            const slotTime = buttonPayload.replace('slot_', '');
            stateManager.setTempData(phone, { slot: slotTime });
            stateManager.setState(phone, STATES.ASK_NUM_PEOPLE);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_num_people'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_slot'));
        }
        return;
    }

    if (state === STATES.ASK_NUM_PEOPLE) {
        const num = parseInt(msgText, 10);
        if (!isNaN(num) && num > 0 && num <= 10) {
            stateManager.setTempData(phone, { numPeople: num });
            stateManager.setState(phone, STATES.ASK_NAME);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_name'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_num_people'));
        }
        return;
    }

    if (state === STATES.ASK_NAME) {
        if (msgText.length >= 2) {
            stateManager.setTempData(phone, { name: text });
            stateManager.setState(phone, STATES.ASK_AADHAAR);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_aadhaar', text));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_name'));
        }
        return;
    }

    if (state === STATES.ASK_AADHAAR) {
        if (/^\d{12}$/.test(msgText)) {
            stateManager.setTempData(phone, { aadhaar: msgText });
            stateManager.setState(phone, STATES.ASK_PHOTO);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_photo'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_aadhaar'));
        }
        return;
    }
    
    if (state === STATES.ASK_PHOTO) {
        if (imagePayload) {
            stateManager.setTempData(phone, { photoId: imagePayload });
            stateManager.setState(phone, STATES.CONFIRM);
            
            const data = stateManager.getTempData(phone);
            const confirmMsg = t(lang, 'confirm_booking', data.aarti, data.date, data.slot, data.numPeople, data.name, data.aadhaar);
            await whatsappApi.sendConfirmationButtons(phone, confirmMsg, t(lang, 'btn_yes'), t(lang, 'btn_no'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_photo'));
        }
        return;
    }

    if (state === STATES.CONFIRM) {
        if (buttonPayload === 'confirm_yes' || msgText === 'yes') {
            const data = stateManager.getTempData(phone);
            
            const isDuplicate = await database.checkDuplicate(phone, data.date, data.slot);
            if (isDuplicate) {
                 await whatsappApi.sendTextMessage(phone, t(lang, 'duplicate_booking'));
            } else {
                 await database.saveBooking({
                    user_phone: phone,
                    language: lang,
                    aarti_type: data.aarti,
                    num_people: data.numPeople,
                    name: data.name,
                    aadhaar: data.aadhaar,
                    photo_id: data.photoId,
                    booking_date: data.date,
                    slot_time: data.slot
                });
                await whatsappApi.sendTextMessage(phone, t(lang, 'booking_success'));
            }
            stateManager.clearUser(phone);
        } else if (buttonPayload === 'confirm_no' || msgText === 'no') {
            stateManager.clearUser(phone);
            await whatsappApi.sendTextMessage(phone, t(lang, 'booking_cancelled'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_confirm'));
        }
        return;
    }
}

module.exports = {
    processMessage
};
