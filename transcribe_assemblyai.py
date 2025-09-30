#!/usr/bin/env python3
"""
Transcribe audio using AssemblyAI (Free tier available)
Sign up at: https://www.assemblyai.com/
Get your API key from: https://www.assemblyai.com/dashboard/
"""

import sys
import os
import requests
import time

# Get your free API key from AssemblyAI dashboard
ASSEMBLYAI_API_KEY = "YOUR_ASSEMBLYAI_API_KEY_HERE"  # Replace this!

def transcribe_audio(audio_file_path):
    """Transcribe audio using AssemblyAI"""
    
    print(f"Uploading: {audio_file_path}")
    
    # Upload audio file
    upload_url = "https://api.assemblyai.com/v2/upload"
    headers = {"authorization": ASSEMBLYAI_API_KEY}
    
    with open(audio_file_path, 'rb') as f:
        response = requests.post(upload_url, headers=headers, files={'file': f})
    
    audio_url = response.json()['upload_url']
    print(f"Audio uploaded: {audio_url}")
    
    # Request transcription
    transcript_url = "https://api.assemblyai.com/v2/transcript"
    data = {"audio_url": audio_url}
    response = requests.post(transcript_url, json=data, headers=headers)
    transcript_id = response.json()['id']
    
    # Poll for completion
    polling_url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"
    print("Transcribing...")
    
    while True:
        response = requests.get(polling_url, headers=headers)
        status = response.json()['status']
        
        if status == 'completed':
            return response.json()['text']
        elif status == 'error':
            raise Exception(f"Transcription failed: {response.json()}")
        
        time.sleep(3)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_assemblyai.py <audio_file_path>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    
    if ASSEMBLYAI_API_KEY == "YOUR_ASSEMBLYAI_API_KEY_HERE":
        print("ERROR: Please set your AssemblyAI API key in the script!")
        print("Get a free API key at: https://www.assemblyai.com/dashboard/")
        sys.exit(1)
    
    try:
        transcript = transcribe_audio(audio_path)
        print("\n" + "="*80)
        print("TRANSCRIPT:")
        print("="*80)
        print(transcript)
        print("="*80)
        
        # Save to file
        output_file = audio_path.replace('.mp3', '_transcript.txt')
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(transcript)
        print(f"\nTranscript saved to: {output_file}")
        
    except Exception as e:
        print(f"Error: {e}")
