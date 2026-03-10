const mysql = require('mysql2/promise');

async function checkUsers() {
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'geofaceattend'
        });
        
        const [users] = await conn.execute('SELECT emp_id, name, email, role FROM users');
        
        console.log('\n📊 Users in database:');
        console.log('=' .repeat(50));
        
        users.forEach(u => {
            console.log(`   ${u.emp_id}: ${u.name} (${u.role}) - ${u.email}`);
        });
        
        console.log(`\n📈 Total users: ${users.length}`);
        
        await conn.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkUsers();