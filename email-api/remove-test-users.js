const mysql = require('mysql2/promise');

async function removeTestUsers() {
    try {
        const conn = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'geofaceattend'
        });
        
        console.log('📋 Current users before deletion:');
        const [before] = await conn.execute('SELECT emp_id, name, email FROM users');
        before.forEach(u => console.log(`   ${u.emp_id}: ${u.name} - ${u.email}`));
        
        // Delete test users (keeping ADM001 and EMP001 only)
        const [result] = await conn.execute(`
            DELETE FROM users 
            WHERE emp_id NOT IN ('ADM001', 'EMP001')
        `);
        
        console.log(`\n✅ Deleted ${result.affectedRows} test users`);
        
        console.log('\n📋 Remaining users:');
        const [after] = await conn.execute('SELECT emp_id, name, email, role FROM users');
        after.forEach(u => console.log(`   ${u.emp_id}: ${u.name} (${u.role}) - ${u.email}`));
        
        await conn.end();
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

removeTestUsers();