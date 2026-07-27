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

        let galleryHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Shri Mahakaleshwar Bot - Devotee Photo Gallery</title>
    <style>
        body { font-family: system-ui, sans-serif; background: #fdf8f4; color: #333; margin: 0; padding: 20px; }
        h1 { text-align: center; color: #e65100; margin-bottom: 30px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
        .card { background: #fff; border: 1px solid #ffe0b2; border-radius: 12px; padding: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .card-header { border-bottom: 2px solid #e65100; padding-bottom: 8px; margin-bottom: 12px; }
        .title { font-weight: bold; font-size: 1.1rem; color: #e65100; }
        .meta { font-size: 0.85rem; color: #666; margin-top: 4px; }
        .img-box { margin-top: 12px; }
        .img-label { font-size: 0.8rem; font-weight: bold; color: #444; margin-bottom: 4px; }
        img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd; background: #eee; }
        .no-img { padding: 20px; text-align: center; background: #f5f5f5; border-radius: 8px; color: #888; font-size: 0.85rem; }
    </style>
</head>
<body>
    <h1>🕉️ Shri Mahakaleshwar Devotee Photo Gallery</h1>
    <div class="grid">
`;

        for (const r of rows) {
            console.log(`------------------------------------------------------`);
            console.log(`📌 Booking #${r.id} | Phone: ${r.user_phone} | Created: ${r.created_at}`);
            console.log(`------------------------------------------------------`);

            let selfieLocalPath = null;
            if (r.photo_id) {
                const filename = `booking_${r.id}_selfie.jpg`;
                console.log(`⏳ Downloading WhatsApp Selfie (Media ID: ${r.photo_id})...`);
                const localPath = await downloadWhatsAppMedia(r.photo_id, filename);
                if (localPath) {
                    console.log(`   ✅ Selfie Saved: ${localPath}`);
                    selfieLocalPath = `/downloaded_photos/${filename}`;
                } else {
                    console.log(`   ⚠️ Selfie Media ID ${r.photo_id} (Expired or Invalid Token)`);
                }
            }

            let guests = [];
            try { guests = JSON.parse(r.guests_data); } catch(e) {}

            galleryHtml += `
        <div class="card">
            <div class="card-header">
                <div class="title">Booking #${r.id} (${r.booking_ref || 'N/A'})</div>
                <div class="meta">📱 ${r.user_phone} | 📅 ${r.created_at}</div>
            </div>
`;

            guests.forEach((g, i) => {
                galleryHtml += `
            <div class="img-box">
                <div class="img-label">👤 Devotee ${i+1}: ${g.kyc_verified_name || g.entered_name || 'N/A'}</div>
                <div class="meta">Aadhaar: ${g.aadhaar || 'N/A'}</div>
                ${g.photo_url ? `<div style="margin-top:6px"><div class="img-label">💳 Aadhaar Photo:</div><img src="${g.photo_url}" alt="Aadhaar Photo"></div>` : ''}
            </div>
`;
            });

            if (selfieLocalPath) {
                galleryHtml += `
            <div class="img-box">
                <div class="img-label">📸 WhatsApp Selfie Photo:</div>
                <img src="${selfieLocalPath}" alt="Selfie Photo">
            </div>
`;
            } else {
                galleryHtml += `<div class="img-box"><div class="no-img">📸 WhatsApp Selfie: Expired / Test Media ID</div></div>`;
            }

            galleryHtml += `</div>`;
        }

        galleryHtml += `
    </div>
</body>
</html>
`;

        const galleryPath = path.join(__dirname, 'public', 'gallery.html');
        fs.writeFileSync(galleryPath, galleryHtml);

        console.log(`======================================================`);
        console.log(`✅ All downloaded selfie photos saved in folder:`);
        console.log(`   ${outputDir}`);
        console.log(`✅ Web Gallery HTML generated:`);
        console.log(`   ${galleryPath}`);
        console.log(`======================================================\n`);
    });
}

exportAllPhotos();
