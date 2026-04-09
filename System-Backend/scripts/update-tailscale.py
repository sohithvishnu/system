#!/usr/bin/env python3
"""
Tailscale IP Auto-Update Script (Backend)
Automatically fetches the current Tailscale IPv4 address and updates config.py
"""

import subprocess
import sys
import re
from pathlib import Path

def get_tailscale_ip():
    """Fetch current Tailscale IPv4 address"""
    try:
        result = subprocess.run(
            ['tailscale', 'ip', '-4'],
            capture_output=True,
            text=True,
            timeout=5,
            check=True
        )
        ip = result.stdout.strip()
        
        # Validate IP format (must be 100.x.x.x)
        if not re.match(r'^100\.\d+\.\d+\.\d+$', ip):
            raise ValueError(f"Invalid Tailscale IP format: {ip}")
        
        return ip
    except subprocess.CalledProcessError:
        print("❌ Error: Tailscale command failed")
        print("   Make sure Tailscale is running: tailscale status")
        sys.exit(1)
    except FileNotFoundError:
        print("❌ Error: Tailscale is not installed or not in PATH")
        print("   Install Tailscale: https://tailscale.com/download")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print("❌ Error: Tailscale command timed out")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

def update_config(tailscale_ip):
    """Update config.py with the current Tailscale IP"""
    config_file = Path(__file__).parent.parent / 'config.py'
    
    if not config_file.exists():
        print(f"❌ Error: config.py not found at {config_file}")
        sys.exit(1)
    
    try:
        content = config_file.read_text()
        
        # Update OLLAMA_ENDPOINT to use Tailscale IP
        updated_content = re.sub(
            r'OLLAMA_ENDPOINT = "http://[^"]*"',
            f'OLLAMA_ENDPOINT = "http://{tailscale_ip}:11434/api/generate"',
            content
        )
        
        # Also add TAILSCALE_IP config if it doesn't exist
        if 'TAILSCALE_IP = ' not in updated_content:
            # Add after DEFAULT_MODEL
            updated_content = re.sub(
                r'(DEFAULT_MODEL = "llama3")',
                f'DEFAULT_MODEL = "llama3"\nTAILSCALE_IP = "{tailscale_ip}"',
                updated_content
            )
        else:
            # Update existing TAILSCALE_IP
            updated_content = re.sub(
                r'TAILSCALE_IP = "[^"]*"',
                f'TAILSCALE_IP = "{tailscale_ip}"',
                updated_content
            )
        
        config_file.write_text(updated_content)
        print(f"✅ Backend Tailscale IP updated successfully!")
        print(f"   IP: {tailscale_ip}")
        print(f"   File: config.py")
        print(f"   OLLAMA_ENDPOINT: http://{tailscale_ip}:11434/api/generate")
        return True
    except Exception as e:
        print(f"❌ Error updating config.py: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("🔍 [BACKEND] Fetching Tailscale IPv4 address...")
    tailscale_ip = get_tailscale_ip()
    update_config(tailscale_ip)
