const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function uploadZip() {
    try {
        const photosDir = path.join(__dirname, 'public', 'downloaded_photos');
        const archivePath = path.join(__dirname, 'all_devotee_photos.tar.gz');

        if (!fs.existsSync(photosDir)) {
            console.log('No downloaded_photos folder found. Please run node download_all_photos.js first.');
            return;
        }

        console.log('📦 Compressing all downloaded photos into archive...');
        execSync(`tar -czf "${archivePath}" -C "${path.join(__dirname, 'public')}" downloaded_photos`);

        console.log('🚀 Uploading archive to temporary download link...');
        const link = execSync(`curl -s -F "file=@${archivePath}" https://0x0.st`).toString().trim();

        if (link && link.startsWith('http')) {
            console.log(`\n======================================================`);
            console.log(`🎉 SUCCESS! Click the link below to download all photos:`);
            console.log(`👉 ${link}`);
            console.log(`======================================================\n`);
        } else {
            console.log('Upload result:', link);
        }

        if (fs.existsSync(archivePath)) {
            fs.unlinkSync(archivePath);
        }
    } catch (err) {
        console.error('Error creating or uploading photos archive:', err.message);
    }
}

uploadZip();
