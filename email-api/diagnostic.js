// diagnostic.js
console.log("=== DIAGNOSTIC START ===");
console.log("Current directory:", process.cwd());
console.log("Node version:", process.version);
console.log("Attempting to load 'pg'...");
try {
    const pg = require('pg');
    console.log("✅ SUCCESS: 'pg' module loaded!");
    console.log("pg version:", pg.version);
} catch (error) {
    console.error("❌ FAILED to load 'pg':", error.message);
    console.error("Error code:", error.code);
}
console.log("=== DIAGNOSTIC END ===");