#!/usr/bin/env python3
"""Quick test to verify OpenAI API key works"""
import os
from openai import OpenAI

# Read from .env file
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('OPENAI_API_KEY='):
            api_key = line.strip().split('=', 1)[1]
            break

client = OpenAI(api_key=api_key)

try:
    # Simple test - list models
    response = client.models.list()
    print("SUCCESS: API Key is VALID!")
    print("SUCCESS: Can access OpenAI API")
    print(f"SUCCESS: Found {len(list(response.data))} models")
    
    # Check if whisper is available
    models = [m.id for m in response.data if 'whisper' in m.id.lower()]
    if models:
        print(f"SUCCESS: Whisper models available: {models}")
    
except Exception as e:
    print(f"FAILED: API Key test FAILED: {e}")
    print("\nTroubleshooting:")
    print("1. Go to: https://platform.openai.com/settings/organization/billing")
    print("2. Add a payment method")
    print("3. Add credits ($5 minimum)")
    print("4. Or create a new API key at: https://platform.openai.com/api-keys")
