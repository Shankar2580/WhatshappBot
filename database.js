const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function initDb() {
    db.serialize(() => {
        db.run('PRAGMA journal_mode = WAL;');
        
        db.run(`
            CREATE TABLE IF NOT EXISTS slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time_range TEXT NOT NULL,
                max_bookings INTEGER NOT NULL DEFAULT 2,
                is_active INTEGER DEFAULT 1
            );
        `);
        
        // We will create a fresh table for the new schema
        db.run(`
            CREATE TABLE IF NOT EXISTS bookings_v5 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_ref TEXT,
                user_phone TEXT NOT NULL,
                language TEXT NOT NULL,
                aarti_type TEXT NOT NULL,
                num_people INTEGER NOT NULL,
                guests_data TEXT NOT NULL,
                photo_id TEXT NOT NULL,
                booking_date TEXT NOT NULL,
                slot_time TEXT NOT NULL,
                status TEXT DEFAULT 'confirmed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Safely alter existing table if booking_ref column is missing
        db.run("ALTER TABLE bookings_v5 ADD COLUMN booking_ref TEXT", (err) => {
            // Ignore error if column already exists
        });

        // Create indexes for high-speed lookups
        db.run('CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON bookings_v5 (booking_date, status);');
        db.run('CREATE INDEX IF NOT EXISTS idx_bookings_duplicate_check ON bookings_v5 (user_phone, booking_date, slot_time, status);');

        db.get('SELECT COUNT(*) as count FROM slots', (err, row) => {
            if (row && row.count === 0) {
                const defaultSlots = [
                    '9:00 AM - 10:00 AM',
                    '10:00 AM - 11:00 AM',
                    '11:00 AM - 12:00 PM',
                    '2:00 PM - 3:00 PM',
                    '3:00 PM - 4:00 PM',
                    '4:00 PM - 5:00 PM'
                ];
                
                const stmt = db.prepare('INSERT INTO slots (time_range) VALUES (?)');
                defaultSlots.forEach(slot => stmt.run(slot));
                stmt.finalize();
            }
        });
    });
}

function getAvailableSlots(date) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT s.time_range, s.max_bookings - IFNULL(b.booked_count, 0) as available
            FROM slots s
            LEFT JOIN (
                SELECT slot_time, COUNT(*) as booked_count
                FROM bookings_v5
                WHERE booking_date = ? AND status = 'confirmed'
                GROUP BY slot_time
            ) b ON s.time_range = b.slot_time
            WHERE s.is_active = 1 AND (s.max_bookings - IFNULL(b.booked_count, 0)) > 0
        `;
        db.all(query, [date], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function saveBooking(bookingData) {
    return new Promise((resolve, reject) => {
        const { 
            booking_ref, user_phone, language, aarti_type, num_people, guests_data, 
            photo_id, booking_date, slot_time 
        } = bookingData;
        
        const stmt = db.prepare(`
            INSERT INTO bookings_v5 (
                booking_ref, user_phone, language, aarti_type, num_people, guests_data,
                photo_id, booking_date, slot_time
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run([
            booking_ref, user_phone, language, aarti_type, num_people, guests_data, 
            photo_id, booking_date, slot_time
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

function checkDuplicate(phone, date, slot) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) as count FROM bookings_v5
            WHERE user_phone = ? AND booking_date = ? AND slot_time = ? AND status = 'confirmed'
        `;
        db.get(query, [phone, date, slot], (err, row) => {
            if (err) reject(err);
            else resolve(row.count > 0);
        });
    });
}

function getLatestBookingByPhone(phone) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT * FROM bookings_v5
            WHERE user_phone = ? AND status = 'confirmed'
            ORDER BY id DESC LIMIT 1
        `;
        db.get(query, [phone], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

initDb();

module.exports = {
    getAvailableSlots,
    saveBooking,
    checkDuplicate,
    getLatestBookingByPhone
};
