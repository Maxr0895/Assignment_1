#!/usr/bin/env python3
"""
Simple script to transcribe audio using OpenAI Whisper API
Usage: python transcribe_audio.py <audio_file_path>
"""

import sys
import os
from openai import OpenAI

# Read API key from .env file
with open('.env', 'r') as f:
    for line in f:
        if line.startswith('OPENAI_API_KEY='):
            api_key = line.strip().split('=', 1)[1]
            break
else:
    raise ValueError('OPENAI_API_KEY not found in .env file')

client = OpenAI(api_key=api_key)

def transcribe_audio(audio_file_path):
    """Transcribe an audio file using OpenAI Whisper"""
    print(f"Transcribing: {audio_file_path}")
    
    with open(audio_file_path, 'rb') as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )
    
    return transcript

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe_audio.py <audio_file_path>")
        print("\nExample:")
        print(r"  python transcribe_audio.py C:\Users\maxrein\Assignment_1\data\meetings\385f9f20-61c2-4040-83b4-b8b4bf30c9e5\audio.mp3")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    
    if not os.path.exists(audio_path):
        print(f"Error: File not found: {audio_path}")
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
        print(f"Error transcribing audio: {e}")
        sys.exit(1)
