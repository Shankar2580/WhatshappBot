const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

/**
 * Generates an official booking PDF pass for Shri Mahakaleshwar Temple
 * @param {Object} bookingData 
 * @param {string} bookingData.booking_ref - Unique booking reference ID
 * @param {string} bookingData.user_phone - Phone number of user
 * @param {string} bookingData.aarti_type - Aarti / Service selected
 * @param {string} bookingData.booking_date - Date of darshan (DD/MM/YYYY)
 * @param {string} bookingData.slot_time - Time slot
 * @param {number} bookingData.num_people - Devotee count
 * @param {Array<Object>} bookingData.guests - List of guest KYC objects
 * @param {string} outputPath - File path to save the PDF
 * @returns {Promise<string>} Resolves with the outputPath
 */
async function generateBookingPdf(bookingData, outputPath) {
    return new Promise(async (resolve, reject) => {
        try {
            // Ensure destination folder exists
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const writeStream = fs.createWriteStream(outputPath);
            doc.pipe(writeStream);

            // Styling Colors
            const saffronColor = '#E65100'; // Deep Saffron
            const headerBg = '#FFF3E0';
            const darkText = '#1A1A1A';
            const mutedText = '#555555';
            const greenSuccess = '#2E7D32';
            const borderBg = '#FFE0B2';

            // Top Header Box
            doc.rect(40, 35, 515, 110).fillAndStroke(headerBg, saffronColor);

            // Logo Image
            const logoPath = path.join(__dirname, 'shrimahakaleshwar_logo.png');
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, 52, 45, { width: 90 });
            }

            // Header Text
            doc.fillColor(saffronColor)
               .fontSize(16)
               .font('Helvetica-Bold')
               .text('SHRI MAHAKALESHWAR TEMPLE', 155, 48);

            doc.fillColor(darkText)
               .fontSize(11)
               .font('Helvetica')
               .text('Management Committee, Ujjain (M.P.)', 155, 68);

            doc.fillColor(saffronColor)
               .fontSize(13)
               .font('Helvetica-Bold')
               .text('OFFICIAL DARSHAN & AARTI PASS', 155, 86);

            doc.fillColor(mutedText)
               .fontSize(9)
               .font('Helvetica')
               .text(`Booking Ref: ${bookingData.booking_ref || 'N/A'}`, 155, 106)
               .text(`Issued On: ${new Date().toLocaleDateString('en-IN')}`, 155, 120);

            // Status Stamp (CONFIRMED)
            doc.rect(440, 45, 100, 22).fillAndStroke('#E8F5E9', greenSuccess);
            doc.fillColor(greenSuccess)
               .fontSize(9.5)
               .font('Helvetica-Bold')
               .text('CONFIRMED', 440, 51, { align: 'center', width: 100 });

            // Generate QR Code Buffer
            const qrText = JSON.stringify({
                ref: bookingData.booking_ref,
                service: bookingData.aarti_type,
                date: bookingData.booking_date,
                slot: bookingData.slot_time,
                count: bookingData.num_people,
                phone: bookingData.user_phone
            });
            const qrBuffer = await QRCode.toBuffer(qrText, { margin: 1, width: 100 });
            doc.image(qrBuffer, 462, 73, { width: 56, height: 56 });

            // -------------------------------------------------------------
            // Section 1: Booking Overview Card
            // -------------------------------------------------------------
            let y = 160;
            doc.rect(40, y, 515, 80).fillAndStroke('#FAFAFA', borderBg);

            doc.fillColor(saffronColor).fontSize(11).font('Helvetica-Bold').text('BOOKING DETAILS', 50, y + 10);

            doc.fillColor(darkText).fontSize(9).font('Helvetica-Bold');
            
            // Left Column
            doc.text('Service / Aarti:', 50, y + 30);
            doc.font('Helvetica').text(bookingData.aarti_type || 'N/A', 140, y + 30);

            doc.font('Helvetica-Bold').text('Darshan Date:', 50, y + 48);
            doc.font('Helvetica').text(bookingData.booking_date || 'N/A', 140, y + 48);

            doc.font('Helvetica-Bold').text('Time Slot:', 50, y + 64);
            doc.font('Helvetica').text(bookingData.slot_time || 'N/A', 140, y + 64);

            // Right Column
            doc.font('Helvetica-Bold').text('Total Devotees:', 320, y + 30);
            doc.font('Helvetica').text(`${bookingData.num_people} Person(s)`, 410, y + 30);

            doc.font('Helvetica-Bold').text('Registered Mobile:', 320, y + 48);
            doc.font('Helvetica').text(bookingData.user_phone || 'N/A', 410, y + 48);

            // -------------------------------------------------------------
            // Section 2: Devotee Roster Table
            // -------------------------------------------------------------
            y += 95;
            doc.fillColor(saffronColor).fontSize(11).font('Helvetica-Bold').text('DEVOTEE ROSTER (VERIFIED IDENTITY)', 40, y);

            y += 18;
            // Table Header
            doc.rect(40, y, 515, 22).fill('#FFE0B2');
            doc.fillColor(saffronColor).fontSize(9).font('Helvetica-Bold');
            doc.text('#', 48, y + 6);
            doc.text('Devotee Name', 80, y + 6);
            doc.text('Verified Document / No.', 260, y + 6);
            doc.text('Gender', 390, y + 6);
            doc.text('DOB / YOB', 460, y + 6);

            y += 22;
            doc.font('Helvetica').fontSize(9).fillColor(darkText);

            const guests = bookingData.guests || [];
            guests.forEach((g, index) => {
                const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F5F5F5';
                doc.rect(40, y, 515, 22).fillAndStroke(rowBg, '#EEEEEE');

                let docStr = 'N/A';
                if (g.id_type === 'passport' || g.passport_number) {
                    docStr = `Passport: ${g.passport_number || 'Verified'}`;
                } else {
                    const rawAadhaar = (g.aadhaar || '').replace(/\D/g, '');
                    docStr = rawAadhaar.length === 12 
                        ? `Aadhaar: XXXX-XXXX-${rawAadhaar.substring(8)}`
                        : (g.aadhaar ? `Aadhaar: ${g.aadhaar}` : 'Aadhaar Verified');
                }

                doc.fillColor(darkText);
                doc.text(`${index + 1}`, 48, y + 6);
                doc.text(g.kyc_verified_name || g.entered_name || 'N/A', 80, y + 6, { width: 170, height: 14 });
                doc.text(docStr, 260, y + 6, { width: 125, height: 14 });
                doc.text(g.gender || 'N/A', 390, y + 6);
                doc.text(g.dob || 'N/A', 460, y + 6);

                y += 22;
            });

            // -------------------------------------------------------------
            // Section 3: Gate Entrance Instructions & Guidelines
            // -------------------------------------------------------------
            y += 20;
            doc.rect(40, y, 515, 150).fillAndStroke('#FFFDE7', '#FFE082');

            doc.fillColor('#F57F17').fontSize(10).font('Helvetica-Bold').text('IMPORTANT INSTRUCTIONS FOR DEVOTEES', 50, y + 12);

            doc.fillColor(darkText).fontSize(8.5).font('Helvetica');
            const instructions = [
                '1. Mandatory Identification: All devotees must carry their ORIGINAL Aadhaar Card for physical verification at entry.',
                '2. Reporting Time: Please arrive at Gate No. 4 (VIP / Pass Entrance) strictly 30 minutes before your allotted time slot.',
                '3. Facial Verification: Facial verification will be conducted at the gate using the registered photo submitted during booking.',
                '4. Dress Code: Traditional / Modest attire is required inside the temple complex. Cell phones & leather items are restricted in main sanctum.',
                '5. Non-Transferable: This pass is strictly non-transferable and valid only for the date and time slot printed above.',
                '6. Assistance: For help or queries, contact the Shri Mahakaleshwar Temple Helpdesk at Ujjain.'
            ];

            let instY = y + 30;
            instructions.forEach(inst => {
                doc.text(inst, 50, instY, { width: 495 });
                instY += 18;
            });

            // -------------------------------------------------------------
            // Footer Blessing
            // -------------------------------------------------------------
            const footerY = 740;
            doc.rect(40, footerY, 515, 35).fill(saffronColor);
            doc.fillColor('#FFFFFF')
               .fontSize(11)
               .font('Helvetica-Bold')
               .text('*** HAR HAR MAHADEV! JAI SHRI MAHAKAL! ***', 40, footerY + 12, { align: 'center', width: 515 });

            doc.end();

            writeStream.on('finish', () => {
                resolve(outputPath);
            });

            writeStream.on('error', (err) => {
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = {
    generateBookingPdf
};
