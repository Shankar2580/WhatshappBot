require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const outputDir = path.join(__dirname, 'public', 'downloaded_photos');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadWhatsAppMedia(mediaId, filename) {
    try {
        if (!mediaId || mediaId.startsWith('img_test')) return null;

        // Step 1: Get media URL from Meta
        const metaRes = await axios.get(`https://graph.facebook.com/v22.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` }
        });

        const downloadUrl = metaRes.data.url;
        if (!downloadUrl) return null;

        // Step 2: Download media file stream
        const fileRes = await axios.get(downloadUrl, {
            headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` },
            responseType: 'arraybuffer'
        });

        const savePath = path.join(outputDir, filename);
        fs.writeFileSync(savePath, fileRes.data);
        return savePath;
    } catch (err) {
        console.error(`Failed to download WhatsApp media ${mediaId}:`, err?.response?.data || err.message);
        return null;
    }
}

async function exportAllPhotos() {
    const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));

    db.all('SELECT id, user_phone, booking_ref, photo_id, guests_data, created_at FROM bookings_v5', async (err, rows) => {
        if (err) {
            console.error('Database query error:', err);
            return;
        }

        console.log(`\n======================================================`);
        console.log(`  FOUND ${rows.length} BOOKING RECORDS IN DATABASE`);
        console.log(`======================================================\n`);

        for (const r of rows) {
            console.log(`------------------------------------------------------`);
            console.log(`📌 Booking #${r.id} | Phone: ${r.user_phone} | Created: ${r.created_at}`);
            console.log(`------------------------------------------------------`);

            // 1. WhatsApp Selfie Download
            if (r.photo_id) {
                const filename = `booking_${r.id}_selfie.jpg`;
                console.log(`⏳ Downloading WhatsApp Selfie (Media ID: ${r.photo_id})...`);
                const localPath = await downloadWhatsAppMedia(r.photo_id, filename);
                if (localPath) {
                    console.log(`   ✅ Selfie Saved: ${localPath}`);
                } else {
                    console.log(`   ⚠️ Selfie Media ID ${r.photo_id} (Expired or Invalid Token)`);
                }
            }

            // 2. Aadhaar KYC Photos
            try {
                const guests = JSON.parse(r.guests_data);
                guests.forEach((g, i) => {
                    console.log(`\n  👤 Devotee ${i+1}: ${g.kyc_verified_name || g.entered_name || 'N/A'}`);
                    console.log(`  💳 Aadhaar Number: ${g.aadhaar || 'N/A'}`);
                    if (g.photo_url) {
                        console.log(`  🖼️ Aadhaar Photo Link (Direct Browser Link):`);
                        console.log(`     ${g.photo_url}`);
                    } else {
                        console.log(`  🖼️ Aadhaar Photo Link: N/A`);
                    }
                });
            } catch (e) {
                console.error('Error parsing guest data:', e);
            }
            console.log(`\n`);
        }

        console.log(`======================================================`);
        console.log(`✅ All downloaded selfie photos saved in folder:`);
        console.log(`   ${outputDir}`);
        console.log(`======================================================\n`);
    });
}

exportAllPhotos();
