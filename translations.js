const translations = {
    en: {
        welcome: '🙏 Welcome to the official Ujjain Pooja Booking Bot! ✨\n\nPlease select your preferred language:',
        btn_english: 'English',
        btn_hindi: 'हिंदी',
        choose_aarti: 'Please select the type of Darshan or Aarti you would like to book today:',
        btn_select_aarti: 'Select Aarti',
        bhasma_aarti: 'Bhasma Aarti',
        shighra_darshan: 'Shighra Darshan',
        shayan_aarti: 'Shayan Aarti',
        sandhya_aarti: 'Sandhya Aarti',
        aarti_selected: (aarti) => `You selected ${aarti}. ✨\n\nPlease select the booking date.`,
        btn_select_date: 'Select Date',
        invalid_aarti_selection: 'Please tap the "Select Aarti" button and choose an option.',
        invalid_date: 'Invalid format or past date. Please select a valid future date.',
        no_slots: (date) => `Sorry, no slots are available for ${date}. Please try another date.`,
        choose_slot: 'Please choose an available time slot:',
        invalid_slot: 'Please tap one of the slot buttons, or type "cancel".',
        ask_num_people: 'How many people will be attending? (Please enter a number between 1 and 10)',
        invalid_num_people: 'Invalid number. Please enter a number between 1 and 10.',
        ask_name: 'Great! Next, please type the Full Name (as per Aadhaar) for the main booking person.',
        invalid_name: 'Please enter a valid full name (at least 2 characters).',
        ask_aadhaar: (name) => `Thank you, ${name}! 🙏\n\nNow, please type your 12-digit Aadhaar Card number for verification.`,
        invalid_aadhaar: 'Invalid Aadhaar. Please enter exactly 12 digits (e.g., 123456789012).',
        generating_otp: 'Please wait, sending OTP to your Aadhaar linked mobile... 📲',
        ask_otp: 'OTP sent successfully! Please enter the 6-digit OTP to verify your Aadhaar.',
        invalid_otp: 'The OTP is incorrect or expired. Please try again.',
        aadhaar_failed: 'Aadhaar verification failed. It may not be linked to a mobile number. Please try another Aadhaar number.',
        aadhaar_verified: (name) => `✅ Aadhaar verified successfully!\nName: ${name}\n\nNext, please send a clear photo of yourself 📸 (You can use the camera or gallery attachment).`,
        ask_photo: 'Aadhaar verified. Next, please send a clear photo of yourself 📸 (You can use the camera or gallery attachment).',
        invalid_photo: 'Please attach and send an image file. 📸',
        confirm_booking: (aarti, date, slot, people, name, aadhaar) => `*Booking Summary*\n\n🕉️ Aarti: ${aarti}\n📅 Date: ${date}\n⏰ Slot: ${slot}\n👥 People: ${people}\n👤 Name: ${name}\n💳 Aadhaar: ${aadhaar}\n\nDo you want to confirm this booking?`,
        btn_yes: 'Yes, Confirm',
        btn_no: 'No, Cancel',
        duplicate_booking: 'You already have a booking for this slot.',
        booking_success: '✅ Your booking is officially confirmed! Thank you for choosing Ujjain Mahakaleshwar Temple. 🙏',
        booking_cancelled: 'Booking cancelled. Send "book" to start again.',
        invalid_confirm: 'Please tap Yes or No to confirm.',
        cancelled: 'Booking process cancelled. Send "book" to start over.'
    },
    hi: {
        welcome: '🙏 उज्जैन पूजा बुकिंग बॉट में आपका स्वागत है! ✨\n\nकृपया अपनी पसंदीदा भाषा चुनें:',
        btn_english: 'English',
        btn_hindi: 'हिंदी',
        choose_aarti: 'कृपया दर्शन या आरती का प्रकार चुनें जिसे आप आज बुक करना चाहते हैं:',
        btn_select_aarti: 'आरती चुनें',
        bhasma_aarti: 'भस्म आरती',
        shighra_darshan: 'शीघ्र दर्शन',
        shayan_aarti: 'शयन आरती',
        sandhya_aarti: 'संध्या आरती',
        aarti_selected: (aarti) => `आपने ${aarti} को चुना है। ✨\n\nकृपया बुकिंग की तारीख चुनें।`,
        btn_select_date: 'तारीख चुनें',
        invalid_aarti_selection: 'कृपया "आरती चुनें" बटन पर टैप करें और एक विकल्प चुनें।',
        invalid_date: 'अमान्य प्रारूप या बीती तारीख। कृपया एक मान्य भविष्य की तारीख चुनें।',
        no_slots: (date) => `क्षमा करें, ${date} के लिए कोई स्लॉट उपलब्ध नहीं हैं। कृपया दूसरी तारीख चुनें।`,
        choose_slot: 'कृपया उपलब्ध समय स्लॉट चुनें:',
        invalid_slot: 'कृपया स्लॉट बटन में से किसी एक पर टैप करें, या "cancel" टाइप करें।',
        ask_num_people: 'कितने लोग उपस्थित होंगे? (कृपया 1 से 10 के बीच की संख्या दर्ज करें)',
        invalid_num_people: 'अमान्य संख्या। कृपया 1 से 10 के बीच की संख्या दर्ज करें।',
        ask_name: 'बहुत बढ़िया! इसके बाद, कृपया मुख्य बुकिंग व्यक्ति का पूरा नाम (आधार के अनुसार) टाइप करें।',
        invalid_name: 'कृपया एक वैध पूरा नाम दर्ज करें (कम से कम 2 अक्षर)।',
        ask_aadhaar: (name) => `धन्यवाद, ${name}! 🙏\n\nअब, कृपया सत्यापन के लिए अपना 12 अंकों का आधार कार्ड नंबर टाइप करें।`,
        invalid_aadhaar: 'अमान्य आधार। कृपया ठीक 12 अंक दर्ज करें (जैसे, 123456789012)।',
        generating_otp: 'कृपया प्रतीक्षा करें, आपके आधार से जुड़े मोबाइल पर OTP भेजा जा रहा है... 📲',
        ask_otp: 'OTP सफलतापूर्वक भेजा गया! कृपया अपना आधार सत्यापित करने के लिए 6 अंकों का OTP दर्ज करें।',
        invalid_otp: 'OTP गलत है या समाप्त हो गया है। कृपया पुनः प्रयास करें।',
        aadhaar_failed: 'आधार सत्यापन विफल रहा। हो सकता है कि यह मोबाइल नंबर से लिंक न हो। कृपया दूसरा आधार नंबर दर्ज करें।',
        aadhaar_verified: (name) => `✅ आधार सफलतापूर्वक सत्यापित!\nनाम: ${name}\n\nइसके बाद, कृपया अपनी एक स्पष्ट तस्वीर भेजें 📸 (आप कैमरे या गैलरी का उपयोग कर सकते हैं)।`,
        ask_photo: 'आधार सत्यापित। इसके बाद, कृपया अपनी एक स्पष्ट तस्वीर भेजें 📸 (आप कैमरे या गैलरी का उपयोग कर सकते हैं)।',
        invalid_photo: 'कृपया एक छवि फ़ाइल संलग्न करें और भेजें। 📸',
        confirm_booking: (aarti, date, slot, people, name, aadhaar) => `*बुकिंग सारांश*\n\n🕉️ आरती: ${aarti}\n📅 तारीख: ${date}\n⏰ स्लॉट: ${slot}\n👥 लोग: ${people}\n👤 नाम: ${name}\n💳 आधार: ${aadhaar}\n\nक्या आप इस बुकिंग की पुष्टि करना चाहते हैं?`,
        btn_yes: 'हाँ, पुष्टि करें',
        btn_no: 'नहीं, रद्द करें',
        duplicate_booking: 'आपके पास इस स्लॉट के लिए पहले से ही एक बुकिंग है।',
        booking_success: '✅ आपकी बुकिंग आधिकारिक रूप से पुष्ट हो गई है! उज्जैन महाकालेश्वर मंदिर को चुनने के लिए धन्यवाद। 🙏',
        booking_cancelled: 'बुकिंग रद्द कर दी गई। फिर से शुरू करने के लिए "book" भेजें।',
        invalid_confirm: 'कृपया पुष्टि करने के लिए हाँ या नहीं पर टैप करें।',
        cancelled: 'बुकिंग प्रक्रिया रद्द कर दी गई। फिर से शुरू करने के लिए "book" भेजें।'
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
