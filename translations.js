const translations = {
    en: {
        welcome: '🙏 *Welcome to the Official Shri Mahakaleshwar Booking Portal* ✨\n\nExperience a seamless and divine booking journey. To begin, please select your preferred language:',
        btn_english: 'English',
        btn_hindi: 'हिंदी',
        choose_aarti: '✨ *Divine Services & Aarti*\n\nPlease select the sacred Darshan or Aarti you wish to attend:',
        btn_select_aarti: 'View Services',
        bhasma_aarti: 'Bhasma Aarti',
        shighra_darshan: 'Shighra Darshan',
        shayan_aarti: 'Shayan Aarti',
        sandhya_aarti: 'Sandhya Aarti',
        invalid_aarti_selection: '⚠️ Please select a valid service from the menu provided.',
        aarti_selected: (aarti) => `🙏 *${aarti} Selected*\n\nPlease select your preferred date for the divine darshan from the available options below:`,
        btn_select_date: 'Select Date',
        invalid_date: '⚠️ Invalid date format. Please select a valid date from the menu.',
        no_slots: (date) => `⚠️ We deeply apologize, but all slots for *${date}* are currently fully booked. Please select an alternative date.`,
        choose_slot: '⏳ *Select Time Slot*\n\nPlease choose a convenient time slot for your darshan:',
        invalid_slot: '⚠️ Please tap one of the available time slot buttons to proceed.',
        ask_num_people: '👥 *Number of Devotees*\n\nHow many devotees will be attending? (Please enter a number between 1 and 4)',
        invalid_num_people: '⚠️ Invalid entry. Please enter a valid number between 1 and 4.',
        ask_aadhaar: (index) => `👤 *Devotee ${index} Security Verification*\n\nFor mandatory security authentication, please enter their 12-digit Aadhaar Number.`,
        invalid_aadhaar: '⚠️ Invalid Aadhaar format. Please enter exactly 12 numeric digits (e.g., 123456789012).',
        generating_otp: '🔐 *Secure Verification*\n\nInitiating secure Aadhaar verification. Please wait while we generate your OTP... 📲',
        ask_otp: '📩 *OTP Sent*\n\nA 6-digit OTP has been sent to the Aadhaar-linked mobile number. Please enter it below to complete verification:',
        invalid_otp: '⚠️ Invalid OTP or verification failed. Please ensure the code is correct and try again.',
        aadhaar_failed: '⚠️ Aadhaar verification failed. Please ensure the number is correct and linked to an active mobile number, then try again.',
        aadhaar_verified: (name) => `✅ *Aadhaar Verified Successfully*\n\nWelcome, *${name}*. Identity securely authenticated.`,
        ask_photo: '📸 *Facial Verification Setup*\n\nFor a seamless, contactless entry at the temple gate, please capture and send a clear, solo selfie of the primary devotee. This will act as your facial passport at the entrance.',
        invalid_photo: '⚠️ Please attach and send a valid image file to proceed. 📸',
        confirm_booking: (aarti, date, slot, people, namesStr) => `📋 *Final Booking Review*\n\nPlease carefully review your divine booking details before final confirmation:\n\n🕉️ *Service:* ${aarti}\n📅 *Date:* ${date}\n⏰ *Time:* ${slot}\n👥 *Total Devotees:* ${people}\n👤 *Verified Names:* ${namesStr}\n\nDo you wish to proceed and confirm this booking?`,
        btn_yes: '✅ Yes, Confirm',
        btn_no: '❌ No, Cancel',
        duplicate_booking: '⚠️ Our records indicate you already have a confirmed booking for this exact date and time slot.',
        booking_success: '🔱 Har Har Mahadev!\nYour booking is now officially confirmed. Thank you for placing your trust in the divine blessings of Mahakaleshwar Temple, Ujjain. Your Official Booking PDF Pass is attached below. May Lord Mahakal remove every obstacle from your path and fill your life with happiness and strength. 🙏',
        pdf_caption: '🙏 *Official Darshan Pass Attached*\n\nPlease download and preserve this PDF pass for entry at Shri Mahakaleshwar Temple gate.',
        booking_cancelled: '🚫 *Booking Cancelled*\n\nYour booking process has been safely cancelled. Send "book" whenever you are ready to start again.',
        invalid_confirm: '⚠️ Please tap Yes or No to confirm your selection.',
        cancelled: '🚫 *Process Terminated*\n\nThe booking process has been cancelled. Send "book" to start over.'
    },
    hi: {
        welcome: '🙏 *श्री महाकालेश्वर आधिकारिक बुकिंग पोर्टल में आपका स्वागत है* ✨\n\nएक सहज और दिव्य बुकिंग यात्रा का अनुभव करें। आरंभ करने के लिए, कृपया अपनी पसंदीदा भाषा चुनें:',
        btn_english: 'English',
        btn_hindi: 'हिंदी',
        choose_aarti: '✨ *दिव्य दर्शन एवं आरती*\n\nकृपया वह पवित्र दर्शन या आरती चुनें जिसमें आप सम्मिलित होना चाहते हैं:',
        btn_select_aarti: 'सेवाएं देखें',
        bhasma_aarti: 'भस्म आरती',
        shighra_darshan: 'शीघ्र दर्शन',
        shayan_aarti: 'शयन आरती',
        sandhya_aarti: 'संध्या आरती',
        invalid_aarti_selection: '⚠️ कृपया मेनू से एक वैध सेवा का चयन करें।',
        aarti_selected: (aarti) => `🙏 *${aarti} चयनित*\n\nकृपया नीचे दिए गए विकल्पों में से दिव्य दर्शन के लिए अपनी पसंदीदा तिथि चुनें:`,
        btn_select_date: 'तिथि चुनें',
        invalid_date: '⚠️ अमान्य तिथि प्रारूप। कृपया मेनू से एक वैध तिथि चुनें।',
        no_slots: (date) => `⚠️ हमें खेद है, लेकिन *${date}* के लिए सभी स्लॉट वर्तमान में पूरी तरह से बुक हैं। कृपया कोई अन्य तिथि चुनें।`,
        choose_slot: '⏳ *समय स्लॉट चुनें*\n\nकृपया अपने दर्शन के लिए एक सुविधाजनक समय स्लॉट चुनें:',
        invalid_slot: '⚠️ कृपया आगे बढ़ने के लिए उपलब्ध समय स्लॉट बटन में से किसी एक पर टैप करें।',
        ask_num_people: '👥 *भक्तों की संख्या*\n\nकितने भक्त उपस्थित होंगे? (कृपया 1 से 4 के बीच की संख्या दर्ज करें)',
        invalid_num_people: '⚠️ अमान्य प्रविष्टि। कृपया 1 से 4 के बीच एक वैध संख्या दर्ज करें।',
        ask_aadhaar: (index) => `👤 *भक्त ${index} सुरक्षा सत्यापन*\n\nअनिवार्य सुरक्षा प्रमाणीकरण के लिए, कृपया उनका 12 अंकों का आधार नंबर दर्ज करें।`,
        invalid_aadhaar: '⚠️ अमान्य आधार प्रारूप। कृपया ठीक 12 अंक दर्ज करें (जैसे, 123456789012)।',
        generating_otp: '🔐 *सुरक्षित सत्यापन*\n\nसुरक्षित आधार सत्यापन आरंभ किया जा रहा है। कृपया प्रतीक्षा करें, हम आपका OTP जनरेट कर रहे हैं... 📲',
        ask_otp: '📩 *OTP भेजा गया*\n\nआधार-लिंक्ड मोबाइल नंबर पर 6 अंकों का OTP भेज दिया गया है। सत्यापन पूरा करने के लिए कृपया इसे नीचे दर्ज करें:',
        invalid_otp: '⚠️ अमान्य OTP या सत्यापन विफल। कृपया सुनिश्चित करें कि कोड सही है और पुनः प्रयास करें।',
        aadhaar_failed: '⚠️ आधार सत्यापन विफल रहा। कृपया सुनिश्चित करें कि नंबर सही है और एक सक्रिय मोबाइल नंबर से जुड़ा है, फिर पुनः प्रयास करें।',
        aadhaar_verified: (name) => `✅ *आधार सफलतापूर्वक सत्यापित*\n\nस्वागत है, *${name}*। पहचान सुरक्षित रूप से प्रमाणित कर दी गई है।`,
        ask_photo: '📸 *चेहरा सत्यापन (Facial Verification) सेटअप*\n\nमंदिर के द्वार पर निर्बाध और संपर्क रहित प्रवेश के लिए, कृपया मुख्य भक्त की एक स्पष्ट, एकल (solo) selfie खींचकर भेजें। प्रवेश द्वार पर यही आपकी पहचान होगी।',
        invalid_photo: '⚠️ कृपया आगे बढ़ने के लिए एक वैध छवि फ़ाइल संलग्न करें और भेजें। 📸',
        confirm_booking: (aarti, date, slot, people, namesStr) => `📋 *अंतिम बुकिंग समीक्षा*\n\nअंतिम पुष्टि से पहले कृपया अपने दिव्य बुकिंग विवरण की सावधानीपूर्वक समीक्षा करें:\n\n🕉️ *सेवा:* ${aarti}\n📅 *तिथि:* ${date}\n⏰ *समय:* ${slot}\n👥 *कुल भक्त:* ${people}\n👤 *सत्यापित नाम:* ${namesStr}\n\nक्या आप आगे बढ़ना और इस बुकिंग की पुष्टि करना चाहते हैं?`,
        btn_yes: '✅ हाँ, पुष्टि करें',
        btn_no: '❌ नहीं, रद्द करें',
        duplicate_booking: '⚠️ हमारे रिकॉर्ड बताते हैं कि आपके पास इस सटीक तिथि और समय स्लॉट के लिए पहले से ही एक पुष्ट बुकिंग है।',
        booking_success: '🔱 हर हर महादेव!\nआपकी बुकिंग अब आधिकारिक तौर पर पुष्ट हो गई है। उज्जैन के महाकालेश्वर मंदिर के दिव्य आशीर्वाद में अपना विश्वास रखने के लिए धन्यवाद। आपका आधिकारिक बुकिंग पीडीएफ पास नीचे संलग्न है। भगवान महाकाल आपके मार्ग से हर बाधा को दूर करें और आपके जीवन को खुशी और शक्ति से भर दें। 🙏',
        pdf_caption: '🙏 *आधिकारिक दर्शन पास संलग्न*\n\nश्री महाकालेश्वर मंदिर द्वार पर प्रवेश के लिए कृपया इस पीडीएफ पास को डाउनलोड करें और सुरक्षित रखें।',
        booking_cancelled: '🚫 *बुकिंग रद्द*\n\nआपकी बुकिंग प्रक्रिया सुरक्षित रूप से रद्द कर दी गई है। जब भी आप फिर से शुरू करने के लिए तैयार हों, "book" भेजें।',
        invalid_confirm: '⚠️ कृपया अपने चयन की पुष्टि करने के लिए हाँ या नहीं पर टैप करें।',
        cancelled: '🚫 *प्रक्रिया समाप्त*\n\nबुकिंग प्रक्रिया रद्द कर दी गई है। फिर से शुरू करने के लिए "book" भेजें।'
    }
};

function t(lang, key, ...args) {
    const language = lang === 'hi' ? 'hi' : 'en';
    const val = translations[language][key];
    if (typeof val === 'function') {
        return val(...args);
    }
    return val || key;
}

module.exports = { t };
