const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get Tailscale IP if available, otherwise fallback to local IP
function getTailscaleIP() {
    try {
        const ip = execSync('tailscale ip -4', {
            encoding: 'utf-8',
            timeout: 5000,
        }).trim();
        
        if (ip && ip.match(/^100\.\d+\.\d+\.\d+$/)) {
            return ip;
        }
    } catch (err) {
        // Tailscale not available or not running
    }
    
    // Fallback to local network IP
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const ip = getTailscaleIP();
console.log(`\n======================================`);
console.log(`[>>] AUTO-DISCOVERY: Network IP Found`);
console.log(`[>>] TARGET IP: ${ip}`);
console.log(`======================================\n`);

// Update Frontend config
const frontendConfigPath = path.join(__dirname, 'System-Frontend', 'constants', 'env.ts');
const frontendConfigContent = `/**
 * PRODUCTION NETWORK CONFIGURATION
 * Auto-updated on every boot via auto-ip.js
 */
export const TAILSCALE_IP = '${ip}';
export const BACKEND_PORT = '8000';
export const API_BASE_URL = \`http://\${TAILSCALE_IP}:\${BACKEND_PORT}\`;
`;

try {
    const dir = path.dirname(frontendConfigPath);
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(frontendConfigPath, frontendConfigContent, 'utf8');
    console.log(`[SUCCESS] Frontend: env.ts updated with IP ${ip}\n`);
} catch (err) {
    console.error(`[ERROR] Failed to write frontend env.ts:`, err);
}

// Update Backend config
const backendConfigPath = path.join(__dirname, 'System-Backend', 'config.py');
try {
    if (fs.existsSync(backendConfigPath)) {
        let configContent = fs.readFileSync(backendConfigPath, 'utf8');
        
        // Update TAILSCALE_IP
        configContent = configContent.replace(
            /TAILSCALE_IP = "[^"]*"/,
            `TAILSCALE_IP = "${ip}"`
        );
        
        // Update OLLAMA_ENDPOINT to use Tailscale IP
        configContent = configContent.replace(
            /OLLAMA_ENDPOINT = f?"http:\/\/[^"]*:11434\/api\/generate"/,
            `OLLAMA_ENDPOINT = f"http://{TAILSCALE_IP}:11434/api/generate"`
        );
        
        fs.writeFileSync(backendConfigPath, configContent, 'utf8');
        console.log(`[SUCCESS] Backend: config.py updated with IP ${ip}\n`);
    }
} catch (err) {
    console.error(`[ERROR] Failed to update backend config.py:`, err);
}