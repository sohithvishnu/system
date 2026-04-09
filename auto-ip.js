const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost'; // Fallback
}

const ip = getLocalIP();
console.log(`\n======================================`);
console.log(`[>>] AUTO-DISCOVERY: Network IP Found`);
console.log(`[>>] TARGET IP: ${ip}`);
console.log(`======================================\n`);

// Adjust this path if your frontend folder is named differently
const configPath = path.join(__dirname, 'System-Frontend', 'constants', 'config.ts');

const configContent = `/**
 * AUTO-GENERATED SYSTEM FILE
 * Do not edit manually. This is rewritten on every system boot.
 */
export const BACKEND_URL = 'http://${ip}:8000';
`;

try {
    // Ensure the directories exist just in case
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, configContent, 'utf8');
    console.log(`[SUCCESS] Config file locked and loaded at ${configPath}\n`);
} catch (err) {
    console.error(`[ERROR] Failed to write config.ts:`, err);
}