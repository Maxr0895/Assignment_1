# Example: Provide manual transcript
# Replace YOUR_JWT_TOKEN and YOUR_MEETING_ID with actual values

$headers = @{
    'Authorization' = 'Bearer YOUR_JWT_TOKEN'
    'Content-Type' = 'application/json'
}

$body = @{
    manualTranscript = 'This is the meeting transcript. Discuss action items and deadlines here...'
} | ConvertTo-Json

Invoke-WebRequest -Uri 'http://localhost:8080/v1/meetings/YOUR_MEETING_ID/transcribe' `
    -Method POST `
    -Headers $headers `
    -Body $body
