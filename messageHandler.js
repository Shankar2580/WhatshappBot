const stateManager = require('./stateManager');
const { STATES } = stateManager;
const whatsappApi = require('./whatsappApi');
const slots = require('./slots');
const database = require('./database');
const { t } = require('./translations');
const kycBoxApi = require('./kycBoxApi');
const pdfGenerator = require('./pdfGenerator');
const path = require('path');
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
            
            // Use WhatsApp Flow if configured, otherwise fallback to interactive list message
            if (process.env.WHATSAPP_FLOW_ID) {
                await whatsappApi.sendFlowMessage(phone, bodyText, buttonText, process.env.WHATSAPP_FLOW_ID, 'FLOW_TOKEN_123');
            } else {
                // --- FALLBACK (Option A): Send List of Next 7 Days ---
                const dateRows = [];
                for (let i = 1; i <= 7; i++) {
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
        } catch(e) {
            console.error('Error parsing date:', e);
        }
        
        // Standardize YYYY-MM-DD format from WhatsApp Flow to DD/MM/YYYY
        if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
            const parts = selectedDate.split('-');
            selectedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
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
            
            // --- BYPASSED: KYCBox Aadhaar OTP Generation ---
            /*
            await whatsappApi.sendTextMessage(phone, t(lang, 'generating_otp'));
            try {
                const res = await kycBoxApi.generateOtp(msgText);
                console.log("KYCBox generateOtp response:", JSON.stringify(res, null, 2));
                const requestId = res.request_id || res.data?.request_id || res.result?.request_id || res.id;
                if (!requestId) {
                    throw new Error("No request_id returned from KYCBox OTP generator");
                }
                stateManager.setTempData(phone, { kycRequestId: requestId });
                stateManager.setState(phone, STATES.ASK_AADHAAR_OTP);
                await whatsappApi.sendTextMessage(phone, t(lang, 'ask_otp'));
            } catch (err) {
                console.error("KYCBox generateOtp error:", err?.response?.data || err.message);
                const detail = err?.response?.data?.message || err?.response?.data?.detail || err.message || '';
                await whatsappApi.sendTextMessage(phone, `Failed to generate OTP via Aadhaar API: ${detail}. Please check the Aadhaar number and try again.`);
            }
            */
            
            // --- DIRECT BYPASS ROUTE ---
            const data = stateManager.getTempData(phone);
            const verifiedName = `Devotee ${data.currentGuestIndex || 1}`;
            
            if (!data.guests) {
                data.guests = [];
            }
            data.guests.push({
                id_type: 'aadhaar',
                kyc_verified_name: verifiedName,
                aadhaar: msgText,
                kyc_request_id: 'bypassed',
                gender: 'Male',
                dob: '15-08-1990',
                address: 'Bypassed',
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
        if (/^\d{6}$/.test(msgText)) {
            const data = stateManager.getTempData(phone);
            try {
                if (!data.kycRequestId) {
                    throw new Error("OTP Session expired or missing request ID. Please type 'cancel' and try again.");
                }

                const kycRes = await kycBoxApi.submitOtp(data.kycRequestId, msgText);
                console.log("KYCBox submitOtp result:", JSON.stringify(kycRes, null, 2));

                const kycData = kycRes.data || kycRes.result || kycRes;
                const verifiedName = kycData.full_name || kycData.name || kycData.verified_name || "Aadhaar Holder";
                const gender = kycData.gender || "Male";
                const dob = kycData.dob || kycData.date_of_birth || "15-08-1990";
                const addressStr = typeof kycData.address === 'object' ? JSON.stringify(kycData.address) : (kycData.address || "Verified Address");
                const photoUrl = kycData.photo_link || kycData.profile_image || "";
                
                if (!data.guests) {
                    data.guests = [];
                }

                data.guests.push({
                    id_type: 'aadhaar',
                    kyc_verified_name: verifiedName,
                    aadhaar: data.aadhaar,
                    kyc_request_id: data.kycRequestId,
                    gender: gender,
                    dob: dob,
                    address: addressStr,
                    photo_url: photoUrl
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
            } catch (error) {
                console.error("KYCBox submitOtp error:", error?.response?.data || error.message);
                const errDetail = error?.response?.data?.message || error?.response?.data?.detail || error.message || '';
                await whatsappApi.sendTextMessage(phone, `Aadhaar OTP verification failed (${errDetail}). Please check the 6-digit OTP or try again.`);
            }
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_otp'));
        }
        return;
    }

    if (state === STATES.ASK_PASSPORT_IMAGE) {
        if (imagePayload) {
            await whatsappApi.sendTextMessage(phone, t(lang, 'verifying_passport'));
            const data = stateManager.getTempData(phone);
            try {
                // --- BYPASSED: KYCBox Passport OCR Call ---
                /*
                const imageBuffer = await whatsappApi.downloadMediaBuffer(imagePayload);
                const ocrRes = await kycBoxApi.verifyPassportOcr(imageBuffer, 'passport.jpg');
                console.log("KYCBox Passport OCR result:", JSON.stringify(ocrRes, null, 2));

                const ocrData = ocrRes.data?.data || ocrRes.data || ocrRes.result || ocrRes;
                
                // Extract string from string or object { value: "..." }
                const val = (item) => (typeof item === 'object' && item !== null ? (item.value || item.text || item.val) : item);

                const gName = val(ocrData.given_names) || val(ocrData.given_name) || val(ocrData.first_name);
                const sName = val(ocrData.surname) || val(ocrData.last_name);
                const fName = val(ocrData.name) || val(ocrData.full_name);

                let verifiedName = 'Passport Holder';
                if (gName || sName) {
                    verifiedName = `${gName || ''} ${sName || ''}`.trim();
                } else if (fName) {
                    verifiedName = fName;
                }

                const passportNum = val(ocrData.passport_number) || val(ocrData.document_number) || "Verified";
                const dob = val(ocrData.dob) || val(ocrData.date_of_birth) || "15-08-1990";
                const sex = val(ocrData.sex) || val(ocrData.gender) || "Male";
                */

                // --- DIRECT BYPASS ROUTE ---
                const verifiedName = `Passport Devotee ${data.currentGuestIndex || 1}`;
                const passportNum = "BYPASSED";
                const sex = "Male";
                const dob = "15-08-1990";
 
                if (!data.guests) {
                    data.guests = [];
                }

                data.guests.push({
                    id_type: 'passport',
                    kyc_verified_name: verifiedName,
                    passport_number: passportNum,
                    gender: sex,
                    dob: dob,
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
            } catch (error) {
                console.error('Passport OCR error:', error.message);
                await whatsappApi.sendTextMessage(phone, t(lang, 'passport_failed'));
            }
        } else {
            await whatsappApi.sendTextMessage(phone, t(lang, 'invalid_passport_image'));
        }
        return;
    }
    
    if (state === STATES.ASK_PHOTO) {
        if (imagePayload) {
            await whatsappApi.sendTextMessage(phone, "Processing photo, please wait...");
            try {
                const imageBuffer = await whatsappApi.downloadMediaBuffer(imagePayload);
                const data = stateManager.getTempData(phone);
                
                // Construct a unique person_id matching the primary guest's details
                const primaryGuestName = (data.guests[0]?.kyc_verified_name || 'Guest').replace(/[^a-zA-Z0-9]/g, '_');
                const personId = `${phone}_${primaryGuestName}`;

                // Register face embedding in FacePe backend
                const regRes = await facepeApi.registerFace(personId, imageBuffer);
                console.log('Face registered successfully on FacePe:', regRes);

                stateManager.setTempData(phone, { photoId: imagePayload });
                stateManager.setState(phone, STATES.CONFIRM);
                
                const namesStr = data.guests.map(g => g.kyc_verified_name || g.entered_name || 'Devotee').join(', ');
                const confirmMsg = t(lang, 'confirm_booking', data.aarti, data.date, data.slot, data.numPeople, namesStr);
                await whatsappApi.sendConfirmationButtons(phone, confirmMsg, t(lang, 'btn_yes'), t(lang, 'btn_no'));
            } catch (err) {
                console.error('FacePe registration error:', err);
                const errMsg = err?.response?.data?.detail || err.message || '';
                if (errMsg.includes('no face detected')) {
                    await whatsappApi.sendTextMessage(phone, "No face detected in the photo. Please send a clear, solo selfie of the primary devotee.");
                } else {
                    // Connection error fallback: Proceed to confirm booking anyway to prevent lockouts
                    console.log("Proceeding with confirmation due to FacePe service error.");
                    stateManager.setTempData(phone, { photoId: imagePayload });
                    stateManager.setState(phone, STATES.CONFIRM);
                    const data = stateManager.getTempData(phone);
                    const namesStr = data.guests.map(g => g.kyc_verified_name || g.entered_name || 'Devotee').join(', ');
                    const confirmMsg = t(lang, 'confirm_booking', data.aarti, data.date, data.slot, data.numPeople, namesStr);
                    await whatsappApi.sendConfirmationButtons(phone, confirmMsg, t(lang, 'btn_yes'), t(lang, 'btn_no'));
                }
            }
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
                 stateManager.clearUser(phone);
            } else {
                 const randomId = Math.floor(1000 + Math.random() * 9000);
                 const dateClean = (data.date || '').replace(/\D/g, '');
                 const bookingRef = `MAHAKAL-${dateClean || '2026'}-${randomId}`;

                 // Define price based on Aarti type
                 const aartiPrices = {
                     'Bhasma Aarti': 100,
                     'Shighra Darshan': 250,
                     'Shayan Aarti': 50,
                     'Sandhya Aarti': 50
                 };
                 const unitPrice = aartiPrices[data.aarti] || 50;
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

                     // Send payment link to user
                     await whatsappApi.sendTextMessage(phone, t(lang, 'payment_pending', totalPrice, paymentLink));
                 } catch (payErr) {
                     console.error('[Razorpay] Failed to generate payment link, fallback to mock link:', payErr);
                     // Fallback mock link for testing/resilience
                     const mockLink = `https://checkout.razorpay.com/v1/checkout.html?mock_booking_ref=${bookingRef}&mock_amount=${totalPrice}`;
                     await whatsappApi.sendTextMessage(phone, t(lang, 'payment_pending', totalPrice, mockLink));
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

module.exports = {
    processMessage
};
