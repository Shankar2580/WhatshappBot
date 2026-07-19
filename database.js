const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

function initDb() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                time_range TEXT NOT NULL,
                max_bookings INTEGER NOT NULL DEFAULT 2,
                is_active INTEGER DEFAULT 1
            );
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_phone TEXT NOT NULL,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                booking_date TEXT NOT NULL,
                slot_time TEXT NOT NULL,
                status TEXT DEFAULT 'confirmed',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

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
                FROM bookings
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
        const { user_phone, name, age, booking_date, slot_time } = bookingData;
        const stmt = db.prepare(`
            INSERT INTO bookings (user_phone, name, age, booking_date, slot_time)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run([user_phone, name, age, booking_date, slot_time], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
        stmt.finalize();
    });
}

function checkDuplicate(phone, date, slot) {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT COUNT(*) as count FROM bookings
            WHERE user_phone = ? AND booking_date = ? AND slot_time = ? AND status = 'confirmed'
        `;
        db.get(query, [phone, date, slot], (err, row) => {
            if (err) reject(err);
            else resolve(row.count > 0);
        });
    });
}

initDb();

module.exports = {
    getAvailableSlots,
    saveBooking,
    checkDuplicate
};
