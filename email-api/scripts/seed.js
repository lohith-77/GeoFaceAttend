require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const moment = require('moment');

async function seed() {
    console.log('🌱 Seeding database with sample data...');

    let pool;
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Clear existing data (optional - comment out if you want to keep data)
        // await pool.query('TRUNCATE users, attendance, leave_requests, qr_codes, outstation_history RESTART IDENTITY CASCADE');

        // Hash passwords
        const saltRounds = 10;
        const adminPassword = await bcrypt.hash('admin123', saltRounds);
        const empPassword = await bcrypt.hash('emp123', saltRounds);

        // Insert sample users
        const users = await pool.query(`
            INSERT INTO users (emp_id, name, email, phone, password, department, position, join_date, role, leave_balance_annual, leave_balance_sick, leave_balance_personal) VALUES
            ('ADM001', 'Admin User', 'admin@company.com', '+1234567890', $1, 'Management', 'System Administrator', '2024-01-15', 'admin', 15, 10, 5),
            ('EMP001', 'John Doe', 'john.doe@company.com', '+1234567891', $2, 'Engineering', 'Senior Developer', '2024-01-15', 'employee', 15, 10, 5),
            ('EMP002', 'Jane Smith', 'jane.smith@company.com', '+1234567892', $2, 'Sales', 'Sales Manager', '2024-02-01', 'employee', 12, 8, 4),
            ('EMP003', 'Mike Johnson', 'mike.johnson@company.com', '+1234567893', $2, 'Marketing', 'Marketing Specialist', '2024-02-15', 'employee', 10, 7, 3),
            ('EMP004', 'Sarah Williams', 'sarah.williams@company.com', '+1234567894', $2, 'HR', 'HR Manager', '2024-03-01', 'employee', 8, 5, 2),
            ('EMP005', 'Robert Brown', 'robert.brown@company.com', '+1234567895', $2, 'Finance', 'Financial Analyst', '2024-03-15', 'employee', 5, 3, 1)
        `, [adminPassword, empPassword]);

        console.log('✅ Sample users created');

        // Insert sample attendance records for last 30 days
        const employees = ['EMP001', 'EMP002', 'EMP003', 'EMP004', 'EMP005'];
        const now = moment();

        for (const empId of employees) {
            for (let i = 0; i < 30; i++) {
                const date = moment().subtract(i, 'days');

                // Skip weekends (Saturday and Sunday)
                if (date.day() === 0 || date.day() === 6) continue;

                // Random check-in time between 8:30 AM and 9:30 AM
                const checkInHour = 8 + Math.floor(Math.random() * 2);
                const checkInMinute = Math.floor(Math.random() * 60);
                const checkIn = date.clone().hour(checkInHour).minute(checkInMinute).second(0);

                // Random check-out time between 5:00 PM and 6:30 PM
                const checkOutHour = 17 + Math.floor(Math.random() * 2);
                const checkOutMinute = Math.floor(Math.random() * 30);
                const checkOut = date.clone().hour(checkOutHour).minute(checkOutMinute).second(0);

                // Calculate hours worked
                const hoursWorked = checkOut.diff(checkIn, 'hours', true);

                // Determine if late (after 9:15 AM)
                const isLate = checkIn.hour() > 9 || (checkIn.hour() === 9 && checkIn.minute() > 15);

                await pool.query(`
                    INSERT INTO attendance (emp_id, check_in, check_out, check_in_location, method, hours_worked, is_late, date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    empId,
                    checkIn.toISOString(),
                    checkOut.toISOString(),
                    'Main Office',
                    'face',
                    hoursWorked,
                    isLate,
                    date.format('YYYY-MM-DD')
                ]);
            }
        }

        console.log('✅ Sample attendance records created');

        // Insert sample leave requests
        const leaveRequests = [
            {
                emp_id: 'EMP001',
                leave_type: 'Annual',
                start_date: '2026-03-10',
                end_date: '2026-03-12',
                days: 3,
                reason: 'Family vacation',
                status: 'approved'
            },
            {
                emp_id: 'EMP002',
                leave_type: 'Sick',
                start_date: '2026-03-05',
                end_date: '2026-03-06',
                days: 2,
                reason: 'Flu',
                status: 'pending'
            },
            {
                emp_id: 'EMP003',
                leave_type: 'Personal',
                start_date: '2026-03-15',
                end_date: '2026-03-15',
                days: 1,
                reason: 'Personal errands',
                status: 'rejected'
            }
        ];

        for (const leave of leaveRequests) {
            await pool.query(`
                INSERT INTO leave_requests (emp_id, leave_type, start_date, end_date, days, reason, status, applied_on)
                VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
            `, [leave.emp_id, leave.leave_type, leave.start_date, leave.end_date, leave.days, leave.reason, leave.status]);
        }

        console.log('✅ Sample leave requests created');

        // Insert sample QR codes
        const qrCodes = [
            {
                qr_id: 'QR-' + Date.now() + '-001',
                emp_id: 'EMP001',
                location: 'Client Site - Mumbai',
                purpose: 'Client meeting',
                start_date: '2026-03-01',
                end_date: '2026-03-31',
                valid_hours: 12,
                allow_checkout: true
            },
            {
                qr_id: 'QR-' + Date.now() + '-002',
                emp_id: 'EMP002',
                location: 'Branch Office - Delhi',
                purpose: 'Training',
                start_date: '2026-03-01',
                end_date: '2026-03-15',
                valid_hours: 8,
                allow_checkout: true
            }
        ];

        for (const qr of qrCodes) {
            await pool.query(`
                INSERT INTO qr_codes (qr_id, emp_id, location, purpose, start_date, end_date, valid_hours, allow_checkout, generated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ADM001')
            `, [qr.qr_id, qr.emp_id, qr.location, qr.purpose, qr.start_date, qr.end_date, qr.valid_hours, qr.allow_checkout]);
        }

        console.log('✅ Sample QR codes created');

        // Insert sample outstation history
        const outstationHistory = [
            {
                emp_id: 'EMP001',
                qr_id: 'QR-' + Date.now() + '-001',
                location: 'Client Site - Mumbai',
                purpose: 'Client meeting',
                check_in: moment().subtract(2, 'days').hour(10).minute(0).toISOString(),
                check_out: moment().subtract(2, 'days').hour(18).minute(30).toISOString(),
                hours_worked: 8.5
            }
        ];

        for (const out of outstationHistory) {
            await pool.query(`
                INSERT INTO outstation_history (emp_id, qr_id, location, purpose, check_in, check_out, hours_worked)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [out.emp_id, out.qr_id, out.location, out.purpose, out.check_in, out.check_out, out.hours_worked]);
        }

        console.log('✅ Sample outstation history created');

        console.log('🎉 Database seeding completed successfully!');
        console.log('\n📊 Sample Data Summary:');
        console.log('👥 Users: 6 (1 admin, 5 employees)');
        console.log('📅 Attendance: ~150 records');
        console.log('📋 Leave Requests: 3');
        console.log('📱 QR Codes: 2');
        console.log('📍 Outstation Records: 1');

        console.log('\n🔐 Login Credentials:');
        console.log('Admin - ID: ADM001, Password: admin123');
        console.log('Employee - ID: EMP001, Password: emp123');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
    }
}

// Run seeding
seed().then(() => {
    console.log('✨ Database ready!');
    process.exit(0);
});