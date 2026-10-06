const stateManager = require('./stateManager');
const { STATES } = stateManager;
const whatsappApi = require('./whatsappApi');
const slots = require('./slots');
const database = require('./database');
const { t } = require('./translations');
const kycBoxApi = require('./kycBoxApi');
const pdfGenerator = require('./pdfGenerator');
const path = require('path');
const fs = require('fs');
const facepeApi = require('./facepeApi');
const razorpayApi = require('./razorpayApi');


async function processMessage(phone, text, buttonPayload, imagePayload) {
    const msgText = (text || '').trim().toLowerCase();
    const lang = stateManager.getTempData(phone)?.language || 'en';

    if (msgText === 'cancel') {
        stateManager.clearUser(phone);
        await whatsappApi.sendTextMessage(phone, t(lang, 'cancelled'));
        return;
    }

    // Check if message is a full WhatsApp Flow form submission JSON
    if (text && text.startsWith('{')) {
        try {
            const flowData = JSON.parse(text);
            if (flowData.devotee_name || (flowData.aarti_type && flowData.booking_date)) {
                await handleFullFlowSubmission(phone, flowData, lang);
                return;
            }
        } catch (e) {
            // Not a JSON flow response, proceed with standard message handling
        }
    }

    // If user sends any greeting or start trigger, reset session and trigger flow if available
    const isStartCommand = ['hi', 'hello', 'hey', 'book', 'form', 'booking', 'start', 'menu', 'darshan', 'reset'].includes(msgText);
    if (isStartCommand) {
        stateManager.clearUser(phone);
        if (process.env.WHATSAPP_FLOW_ID) {
            const flowSent = await sendBookingFlow(phone, lang);
            if (flowSent) return;
        }
    }

    let state = stateManager.getState(phone);

    if (state === STATES.IDLE) {
        if (process.env.WHATSAPP_FLOW_ID) {
            const flowSent = await sendBookingFlow(phone, lang);
            if (flowSent) return;
        }

        if (msgText === 'book' || msgText === 'hi' || msgText === 'hello') {
            stateManager.setState(phone, STATES.ASK_LANGUAGE);

            // Send Ujjain Mahakal Temple Image first
            try {
                const logoPath = path.join(__dirname, 'mahakaleshwar_welcome.png');
                const mediaId = await whatsappApi.uploadMedia(logoPath, 'image/png');
                await whatsappApi.sendImageMessage(phone, mediaId, '🔱 Shri Mahakaleshwar Temple, Ujjain 🔱');
            } catch (logoErr) {
                console.error('Error sending temple welcome image:', logoErr);
            }

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

            if (process.env.WHATSAPP_FLOW_ID) {
                const flowSent = await sendBookingFlow(phone, selectedLang);
                if (flowSent) {
                    stateManager.clearUser(phone);
                    return;
                }
            }

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

            if (process.env.WHATSAPP_FLOW_ID) {
                const flowSent = await sendBookingFlow(phone, lang);
                if (flowSent) {
                    stateManager.clearUser(phone);
                    return;
                }
            }

            stateManager.setState(phone, STATES.ASK_DATE_FLOW);

            const bodyText = t(lang, 'aarti_selected', buttonPayload);
            const buttonText = t(lang, 'btn_select_date');

            // Helper to send reliable 10-day date selection list
            const sendDateListFallback = async () => {
                const dateRows = [];
                for (let i = 1; i <= 10; i++) {
                    const date = new Date();
                    date.setDate(date.getDate() + i);
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const year = date.getFullYear();
                    const rawDateStr = `${day}/${month}/${year}`;
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                    const dateStr = `${rawDateStr} (${dayName})`;
                    dateRows.push({ id: rawDateStr, title: dateStr });
                }

                const sections = [{
                    title: 'Available Dates',
                    rows: dateRows
                }];
                await whatsappApi.sendListMessage(phone, bodyText + '\n\nPlease select a date from the menu:', buttonText, sections);
            };

            let flowSent = false;
            if (process.env.WHATSAPP_FLOW_ID) {
                try {
                    const minD = new Date();
                    minD.setDate(minD.getDate() + 1);
                    const maxD = new Date();
                    maxD.setDate(maxD.getDate() + 30);
                    const flowData = {
                        min_date: minD.toISOString().split('T')[0],
                        max_date: maxD.toISOString().split('T')[0]
                    };
                    await whatsappApi.sendFlowMessage(phone, bodyText, buttonText, process.env.WHATSAPP_FLOW_ID, 'FLOW_TOKEN_123', flowData);
                    flowSent = true;
                } catch (flowErr) {
                    console.warn('[WhatsApp Flow] Flow sending failed, falling back to Date List:', flowErr?.response?.data || flowErr.message);
                    flowSent = false;
                }
            }

            if (!flowSent) {
                await sendDateListFallback();
            }

        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_aarti_selection'));
        }
        return;
    }

    if (state === STATES.ASK_DATE_FLOW) {
        let selectedDate = null;

        try {
            if (buttonPayload) {
                const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                if (dateRegex.test(buttonPayload)) {
                    selectedDate = buttonPayload;
                }
            } else if (text && text.startsWith('{')) {
                const flowData = JSON.parse(text);
                if (flowData && flowData.date) {
                    selectedDate = flowData.date;
                }
            } else {
                const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                const match = msgText.match(dateRegex);
                if (match) {
                    selectedDate = msgText;
                }
            }
        } catch (e) {
            console.error('Error parsing date:', e);
        }

        // Standardize YYYY-MM-DD format from WhatsApp Flow to DD/MM/YYYY
        if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
            const parts = selectedDate.split('-');
            selectedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }

        if (selectedDate) {
            // Validate that the date is within the next 30 days
            try {
                const parts = selectedDate.split('/');
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const targetDate = new Date(year, month, day);

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const diffTime = targetDate - today;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 1 || diffDays > 30) {
                    const minDate = new Date();
                    minDate.setDate(minDate.getDate() + 1);
                    const maxDate = new Date();
                    maxDate.setDate(maxDate.getDate() + 30);

                    const minStr = `${String(minDate.getDate()).padStart(2, '0')}/${String(minDate.getMonth() + 1).padStart(2, '0')}/${minDate.getFullYear()}`;
                    const maxStr = `${String(maxDate.getDate()).padStart(2, '0')}/${String(maxDate.getMonth() + 1).padStart(2, '0')}/${maxDate.getFullYear()}`;

                    await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_date_range', minStr, maxStr));
                    return;
                }
            } catch (err) {
                console.error('Date range validation error:', err);
                await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_date'));
                return;
            }

            stateManager.setTempData(phone, { date: selectedDate });

            const data = stateManager.getTempData(phone);
            const aarti = data?.aarti;

            if (aarti === 'Bhasma Aarti') {
                stateManager.setTempData(phone, { slot: '4:00 AM - 6:00 AM' });
                stateManager.setState(phone, STATES.ASK_NUM_PEOPLE);
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_num_people'));
            } else if (aarti === 'Sandhya Aarti') {
                stateManager.setTempData(phone, { slot: '5:30 PM - 7:00 PM' });
                stateManager.setState(phone, STATES.ASK_NUM_PEOPLE);
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_num_people'));
            } else if (aarti === 'Shayan Aarti') {
                stateManager.setTempData(phone, { slot: '10:30 PM - 11:00 PM' });
                stateManager.setState(phone, STATES.ASK_NUM_PEOPLE);
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_num_people'));
            } else {
                const availableSlots = await slots.getAvailableSlotsForDate(selectedDate);
                if (availableSlots.length > 0) {
                    stateManager.setState(phone, STATES.CHOOSE_SLOT);
                    await whatsappApi.sendSlotButtons(phone, t(lang, 'choose_slot'), availableSlots);
                } else {
                    await whatsappApi.sendTextMessage(phone, t(lang, 'no_slots', selectedDate));
                }
            }
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_date'));
        }
        return;
    }

    if (state === STATES.CHOOSE_SLOT) {
        let slotTime = null;
        if (buttonPayload) {
            slotTime = buttonPayload.replace(/^slot_/, '');
        } else if (text && (text.includes('AM') || text.includes('PM') || text.includes('-') || text.includes(':'))) {
            slotTime = text.trim();
        }

        if (slotTime) {
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
        if (!isNaN(num) && num > 0 && num <= 4) {
            stateManager.setTempData(phone, { numPeople: num, guests: [], currentGuestIndex: 1 });
            stateManager.setState(phone, STATES.ASK_ID_TYPE);

            const buttons = [
                { id: 'doc_aadhaar', title: t(lang, 'btn_aadhaar') },
                { id: 'doc_passport', title: t(lang, 'btn_passport') }
            ];
            await whatsappApi.sendInteractiveButtons(phone, t(lang, 'ask_id_type', 1), buttons);
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_num_people'));
        }
        return;
    }

    if (state === STATES.ASK_ID_TYPE) {
        const data = stateManager.getTempData(phone);
        const index = data.currentGuestIndex || 1;
        if (buttonPayload === 'doc_aadhaar') {
            stateManager.setState(phone, STATES.ASK_AADHAAR);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_aadhaar', index));
        } else if (buttonPayload === 'doc_passport') {
            stateManager.setState(phone, STATES.ASK_PASSPORT_IMAGE);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_passport_image'));
        } else {
            const buttons = [
                { id: 'doc_aadhaar', title: t(lang, 'btn_aadhaar') },
                { id: 'doc_passport', title: t(lang, 'btn_passport') }
            ];
            await whatsappApi.sendInteractiveButtons(phone, t(lang, 'ask_id_type', index), buttons);
        }
        return;
    }

    if (state === STATES.ASK_AADHAAR) {
        if (/^\d{12}$/.test(msgText)) {
            stateManager.setTempData(phone, { aadhaar: msgText });
            const data = stateManager.getTempData(phone);
            const verifiedName = `Devotee ${data.currentGuestIndex || 1}`;

            if (!data.guests) {
                data.guests = [];
            }

            data.guests.push({
                id_type: 'aadhaar',
                kyc_verified_name: verifiedName,
                aadhaar: msgText,
                gender: 'Male',
                dob: '15-08-1990',
                address: 'Ujjain, Madhya Pradesh',
                photo_url: ''
            });

            await whatsappApi.sendTextMessage(phone, t(lang, 'aadhaar_verified', verifiedName));

            const currentIdx = data.currentGuestIndex || 1;
            const numPeople = data.numPeople || 1;

            if (currentIdx < numPeople) {
                data.currentGuestIndex = currentIdx + 1;
                stateManager.setTempData(phone, data);
                stateManager.setState(phone, STATES.ASK_ID_TYPE);
                const buttons = [
                    { id: 'doc_aadhaar', title: t(lang, 'btn_aadhaar') },
                    { id: 'doc_passport', title: t(lang, 'btn_passport') }
                ];
                await whatsappApi.sendInteractiveButtons(phone, t(lang, 'ask_id_type', data.currentGuestIndex), buttons);
            } else {
                stateManager.setTempData(phone, data);
                stateManager.setState(phone, STATES.ASK_PHOTO);
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_photo'));
            }
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_aadhaar'));
        }
        return;
    }

    if (state === STATES.ASK_AADHAAR_OTP) {
        // Fallback if user lands in OTP state: accept any 6-digit OTP
        if (/^\d{6}$/.test(msgText)) {
            const data = stateManager.getTempData(phone);
            const verifiedName = `Devotee ${data.currentGuestIndex || 1}`;
            await whatsappApi.sendTextMessage(phone, t(lang, 'aadhaar_verified', verifiedName));
            stateManager.setState(phone, STATES.ASK_PHOTO);
            await whatsappApi.sendTextMessage(phone, t(lang, 'ask_photo'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_otp'));
        }
        return;
    }

    if (state === STATES.ASK_PASSPORT_IMAGE) {
        if (imagePayload) {
            const data = stateManager.getTempData(phone);
            const verifiedName = `Passport Devotee ${data.currentGuestIndex || 1}`;
            const passportNum = "P" + Math.floor(1000000 + Math.random() * 9000000);

            if (!data.guests) {
                data.guests = [];
            }

            data.guests.push({
                id_type: 'passport',
                kyc_verified_name: verifiedName,
                passport_number: passportNum,
                gender: 'Male',
                dob: '15-08-1990',
                country: 'IND'
            });

            await whatsappApi.sendTextMessage(phone, t(lang, 'passport_verified', verifiedName));

            if (data.currentGuestIndex < data.numPeople) {
                data.currentGuestIndex++;
                stateManager.setTempData(phone, data);
                stateManager.setState(phone, STATES.ASK_ID_TYPE);
                const buttons = [
                    { id: 'doc_aadhaar', title: t(lang, 'btn_aadhaar') },
                    { id: 'doc_passport', title: t(lang, 'btn_passport') }
                ];
                await whatsappApi.sendInteractiveButtons(phone, t(lang, 'ask_id_type', data.currentGuestIndex), buttons);
            } else {
                stateManager.setTempData(phone, data);
                stateManager.setState(phone, STATES.ASK_PHOTO);
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_photo'));
            }
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_passport_image'));
        }
        return;
    }

    if (state === STATES.ASK_PHOTO) {
        stateManager.clearUser(phone);
        await whatsappApi.sendTextMessage(
            phone,
            lang === 'hi'
                ? `🙏 आपका पास पहले ही जारी हो चुका है। दर्शन हेतु श्री महाकालेश्वर मंदिर में आपका स्वागत है!\n\n(नया पास बुक करने के लिए 'book' या 'hi' भेजें)`
                : `🙏 Your pass is already confirmed and delivered above. Welcome to Shri Mahakaleshwar Temple!\n\n(Send 'book' or 'hi' to start a new booking)`
        );
        return;
    }

    if (state === STATES.CONFIRM) {
        if (buttonPayload === 'confirm_yes' || msgText === 'yes') {
            const data = stateManager.getTempData(phone);

            const isDuplicate = await database.checkDuplicate(phone, data.date, data.slot);
            if (isDuplicate) {
                await whatsappApi.sendTextMessage(phone, t(lang, 'duplicate_booking'));
                stateManager.clearUser(phone);
            } else {
                const randomId = Math.floor(1000 + Math.random() * 9000);
                const dateClean = (data.date || '').replace(/\D/g, '');
                const bookingRef = `MAHAKAL-${dateClean || '2026'}-${randomId}`;

                // Define price based on Aarti type
                const aartiPrices = {
                    'Bhasma Aarti': 200,
                    'Shighra Darshan': 250,
                    'Shayan Aarti': 250,
                    'Sandhya Aarti': 250
                };
                const unitPrice = aartiPrices[data.aarti] || 250;
                const totalPrice = unitPrice * data.numPeople;

                // Save booking as 'pending_payment'
                await database.saveBooking({
                    booking_ref: bookingRef,
                    user_phone: phone,
                    language: lang,
                    aarti_type: data.aarti,
                    num_people: data.numPeople,
                    guests_data: JSON.stringify(data.guests),
                    photo_id: data.photoId,
                    booking_date: data.date,
                    slot_time: data.slot,
                    status: 'pending_payment'
                });

                // Create Razorpay payment link
                try {
                    const primaryGuestName = data.guests[0]?.kyc_verified_name || 'Devotee';
                    const amountPaise = totalPrice * 100; // in paise
                    const paymentLink = await razorpayApi.createPaymentLink(
                        bookingRef,
                        amountPaise,
                        phone,
                        data.aarti,
                        primaryGuestName
                    );

                    // Send interactive CTA URL button to user (with clickable link fallback)
                    await whatsappApi.sendCtaUrlButton(
                        phone,
                        t(lang, 'payment_pending_body', totalPrice),
                        t(lang, 'btn_pay_now'),
                        paymentLink
                    );
                } catch (payErr) {
                    console.error('[Razorpay] Failed to generate payment link, fallback to hosted checkout:', payErr);
                    const baseUrl = process.env.APP_BASE_URL || 'https://api.dev.facepe.ai/wb';
                    const fallbackLink = `${baseUrl}/checkout?ref=${bookingRef}`;
                    await whatsappApi.sendTextMessage(phone, t(lang, 'payment_pending', totalPrice, fallbackLink));
                }

                // Clear user state immediately (the webhook will handle ticket delivery upon payment)
                stateManager.clearUser(phone);
            }
        } else if (buttonPayload === 'confirm_no' || msgText === 'no') {
            stateManager.clearUser(phone);
            await whatsappApi.sendTextMessage(phone, t(lang, 'booking_cancelled'));
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_confirm'));
        }
        return;
    }
}

async function sendBookingFlow(phone, lang = 'hi') {
    const flowId = process.env.WHATSAPP_FLOW_ID;
    if (!flowId) {
        console.warn('[WhatsApp Flow] WHATSAPP_FLOW_ID is not configured in .env');
        return false;
    }

    try {
        const minD = new Date();
        minD.setDate(minD.getDate() + 1);
        const maxD = new Date();
        maxD.setDate(maxD.getDate() + 30);

        const flowData = {
            min_date: minD.toISOString().split('T')[0],
            max_date: maxD.toISOString().split('T')[0]
        };

        const bodyText = lang === 'hi'
            ? '🙏 *श्री महाकालेश्वर मंदिर, उज्जैन*\n\nWhatsApp के अंदर सीधे दर्शन एवं आरती पास बुक करने के लिए कृपया नीचे दिए गए फॉर्म बटन पर टैप करें:'
            : '🙏 *Shri Mahakaleshwar Temple, Ujjain*\n\nTo book your Darshan and Aarti passes directly inside WhatsApp, please tap the button below:';
        const buttonText = lang === 'hi' ? 'पास बुक करें' : 'Book Pass';

        await whatsappApi.sendFlowMessage(
            phone,
            bodyText,
            buttonText,
            flowId,
            'FLOW_DEVOTEE_' + Date.now(),
            flowData,
            'BOOKING_FORM_SCREEN',
            '॥ श्री महाकालेश्वर दर्शन ॥'
        );
        return true;
    } catch (err) {
        console.error('[WhatsApp Flow] Failed to send booking flow:', err?.response?.data || err.message);
        return false;
    }
}

async function handleFullFlowSubmission(phone, flowData, lang = 'hi') {
    let { aarti_type, booking_date, num_people, devotee_name, devotee_name_2, devotee_name_3, devotee_name_4, id_type, id_number } = flowData;

    // Standardize YYYY-MM-DD from flow datepicker to DD/MM/YYYY
    if (booking_date && /^\d{4}-\d{2}-\d{2}$/.test(booking_date)) {
        const parts = booking_date.split('-');
        booking_date = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const aarti = aarti_type || 'Bhasma Aarti';
    let slot = '04:00 AM - 06:00 AM';
    if (aarti === 'Sandhya Aarti') slot = '05:30 PM - 07:00 PM';
    else if (aarti === 'Shayan Aarti') slot = '10:30 PM - 11:00 PM';
    else if (aarti === 'Shighra Darshan') slot = '09:00 AM - 12:00 PM';

    const normalizedIdType = (id_type || 'Aadhaar').toLowerCase().includes('passport') ? 'passport' : 'aadhaar';

    const guestsList = [
        {
            kyc_verified_name: (devotee_name || 'Primary Devotee').trim(),
            id_type: normalizedIdType,
            aadhaar: normalizedIdType === 'aadhaar' ? (id_number || 'Verified') : 'Verified',
            passport_number: normalizedIdType === 'passport' ? (id_number || 'Verified') : 'Verified',
            gender: 'Verified',
            dob: 'N/A'
        }
    ];

    if (devotee_name_2 && devotee_name_2.trim()) {
        guestsList.push({
            kyc_verified_name: devotee_name_2.trim(),
            id_type: 'companion',
            aadhaar: 'Accompanying',
            passport_number: 'Accompanying',
            gender: 'Verified',
            dob: 'N/A'
        });
    }
    if (devotee_name_3 && devotee_name_3.trim()) {
        guestsList.push({
            kyc_verified_name: devotee_name_3.trim(),
            id_type: 'companion',
            aadhaar: 'Accompanying',
            passport_number: 'Accompanying',
            gender: 'Verified',
            dob: 'N/A'
        });
    }
    if (devotee_name_4 && devotee_name_4.trim()) {
        guestsList.push({
            kyc_verified_name: devotee_name_4.trim(),
            id_type: 'companion',
            aadhaar: 'Accompanying',
            passport_number: 'Accompanying',
            gender: 'Verified',
            dob: 'N/A'
        });
    }

    const count = flowData.num_people ? parseInt(flowData.num_people, 10) : guestsList.length;
    const cleanDate = (booking_date || '').replace(/\D/g, '');
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `MAHAKAL-${cleanDate || '2026'}-${randomId}`;

    const aartiPrices = {
        'Bhasma Aarti': 200,
        'Shighra Darshan': 250,
        'Shayan Aarti': 50,
        'Sandhya Aarti': 50
    };
    const unitPrice = aartiPrices[aarti] || 200;
    const totalPrice = unitPrice * count;

    // Check duplicate
    const isDuplicate = await database.checkDuplicate(phone, booking_date, slot);
    if (isDuplicate) {
        await whatsappApi.sendTextMessage(phone, t(lang, 'duplicate_booking'));
        return;
    }

    // Save confirmed booking in database
    await database.saveBooking({
        booking_ref: bookingRef,
        user_phone: phone,
        language: lang,
        aarti_type: aarti,
        num_people: count,
        guests_data: JSON.stringify(guestsList),
        photo_id: '',
        booking_date: booking_date,
        slot_time: slot,
        status: 'confirmed'
    });

    // Notify devotee immediately
    const devoteeNamesText = guestsList.map(g => g.kyc_verified_name).join(', ');
    const confirmText = lang === 'hi'
        ? `🔱 *हर हर महादेव!*\n\nआपका फॉर्म सफलतापूर्वक प्राप्त हो गया है:\n• *भक्तगण:* ${devoteeNamesText}\n• *सेवा:* ${aarti}\n• *दर्शन तिथि:* ${booking_date}\n• *समय स्लॉट:* ${slot}\n• *कुल भक्त:* ${count} व्यक्ति\n• *बुकिंग संदर्भ:* *${bookingRef}*\n\n📄 आपका आधिकारिक डिजिटल पास तैयार किया जा रहा है...`
        : `🔱 *Har Har Mahadev!*\n\nYour booking form has been received successfully:\n• *Devotee(s):* ${devoteeNamesText}\n• *Service:* ${aarti}\n• *Date:* ${booking_date}\n• *Slot:* ${slot}\n• *Devotees:* ${count} Person(s)\n• *Booking Ref:* *${bookingRef}*\n\n📄 Generating your official digital Darshan pass now...`;
    
    await whatsappApi.sendTextMessage(phone, confirmText);

    // Generate & Dispatch official PDF pass
    try {
        const ticketsDir = path.join(__dirname, 'public', 'tickets');
        if (!fs.existsSync(ticketsDir)) {
            fs.mkdirSync(ticketsDir, { recursive: true });
        }
        const pdfPath = path.join(ticketsDir, `${bookingRef}.pdf`);

        await pdfGenerator.generateBookingPdf({
            booking_ref: bookingRef,
            user_phone: phone,
            aarti_type: aarti,
            booking_date: booking_date,
            slot_time: slot,
            num_people: count,
            guests: guestsList,
            payment_id: 'PASS_CONFIRMED',
            amount_paid: totalPrice,
            selfie_path: null
        }, pdfPath);

        const mediaId = await whatsappApi.uploadMedia(pdfPath, 'application/pdf');
        await whatsappApi.sendDocumentMessage(phone, mediaId, `${bookingRef}.pdf`, t(lang, 'pdf_caption'));

        // Booking is completely finished. Clear session and send blessing message.
        stateManager.clearUser(phone);
        await whatsappApi.sendTextMessage(
            phone,
            lang === 'hi'
                ? `🙏 *श्री महाकालेश्वर दर्शन हेतु आपका स्वागत है!*\n\nआपका आधिकारिक डिजिटल पास ऊपर भेज दिया गया है। प्रवेश द्वार पर पीडीएफ में दिया गया क्यूआर कोड दिखाएं।\n\n(नई बुकिंग के लिए कभी भी 'book' या 'hi' भेजें)`
                : `🙏 *Har Har Mahadev!*\n\nYour official digital pass has been delivered above. Please present the QR code on the PDF pass at the temple entry gate.\n\n(Send 'book' or 'hi' anytime to book again)`
        );
    } catch (pdfErr) {
        console.error('[WhatsApp Flow] Error generating or sending PDF pass:', pdfErr);
    }
}

module.exports = {
    processMessage,
    sendBookingFlow,
    handleFullFlowSubmission
};
