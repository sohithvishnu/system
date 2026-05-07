#!/usr/bin/env node
/**
 * Tailscale IP Auto-Update Script
 * Automatically fetches the current Tailscale IPv4 address and updates constants/env.ts
 * 
 * Usage: node scripts/update-tailscale.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '../constants/env.ts');

try {
  // Get current Tailscale IP
  console.log('🔍 Fetching Tailscale IPv4 address...');
  const tailscaleIP = execSync('tailscale ip -4', {
    encoding: 'utf-8',
    timeout: 5000,
  }).trim();

  if (!tailscaleIP || !tailscaleIP.match(/^100\.\d+\.\d+\.\d+$/)) {
    throw new Error(`Invalid Tailscale IP format: ${tailscaleIP}`);
  }

  // Read current env.ts
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');

  // Replace the IP placeholder with actual IP
  const updatedContent = envContent.replace(
    /export const TAILSCALE_IP = '[^']*'/,
    `export const TAILSCALE_IP = '${tailscaleIP}'`
  );

  // Write back to file
  fs.writeFileSync(ENV_FILE, updatedContent, 'utf-8');

  console.log('✅ Tailscale IP updated successfully!');
  console.log(`   IP: ${tailscaleIP}`);
  console.log(`   File: constants/env.ts`);
  console.log(`   API_BASE_URL: http://${tailscaleIP}:8000`);
} catch (error) {
  if (error.status === 127) {
    console.error('❌ Error: Tailscale is not installed or not in PATH');
    console.error('   Install Tailscale: https://tailscale.com/download');
    process.exit(1);
  } else if (error.message.includes('timeout')) {
    console.error('❌ Error: Tailscale command timed out');
    console.error('   Make sure Tailscale is running: tailscale status');
    process.exit(1);
  } else {
    console.error('❌ Error updating Tailscale IP:', error.message);
    process.exit(1);
  }
}
