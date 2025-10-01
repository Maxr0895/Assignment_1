# MFA Enrollment Guide - Custom API Flow

## Overview

Since you're using the **custom API login** (not Cognito Hosted UI), MFA enrollment works differently. You now have a **built-in MFA enrollment flow** directly in the application!

## ✅ What Changed

### Backend
- ✅ **`src/services/cognitoAuth.ts`** - Added MFA setup/verify functions, updated login to handle MFA challenges
- ✅ **`src/routes/auth.ts`** - Added `/v1/mfa/setup` and `/v1/mfa/verify` endpoints

### Frontend  
- ✅ **`public/index.html`** - Added MFA enrollment modal with QR code display
- ✅ **`public/app.js`** - Added MFA enrollment functions, updated login to handle MFA challenges
- ✅ **`public/styles.css`** - Added modal styling

## 🎯 How to Enroll MFA (Step-by-Step)

### For Admin Users Who See the Yellow Banner:

1. **Click the yellow MFA warning banner**
   - It now says "Click here to enroll MFA"
   - This will open the MFA enrollment modal

2. **Click "Generate QR Code"**
   - The app calls `/v1/mfa/setup` with your access token
   - A QR code will appear
   - You'll also see the secret code as a backup

3. **Scan the QR code with your authenticator app**
   - Use **Google Authenticator**, **Authy**, **Microsoft Authenticator**, or any TOTP app
   - The app will add a new entry: "WBR Actionizer"

4. **Enter the 6-digit code**
   - Your authenticator app will show a 6-digit code
   - Enter it in the modal
   - Click "Verify & Enable MFA"

5. **Success!**
   - You'll see: "MFA enabled successfully! Refreshing..."
   - You'll be logged out automatically
   - Log in again - **now you'll be prompted for the 6-digit code**

## 📱 Login Flow After MFA Enrollment

**Before MFA:**
```
1. Enter username/password
2. Click Login
3. ✅ Logged in
```

**After MFA:**
```
1. Enter username/password
2. Click Login
3. 🔐 Pop-up appears: "Enter the 6-digit code from your authenticator app"
4. Enter code from authenticator
5. ✅ Logged in with MFA
```

## 🧪 Testing the Complete Flow

### Test 1: Enroll MFA

1. ✅ Login as admin (without MFA)
2. ✅ See yellow banner + disabled admin buttons
3. ✅ Click banner → Modal opens
4. ✅ Click "Generate QR Code"
5. ✅ Scan QR code with Google Authenticator
6. ✅ Enter 6-digit code → Success
7. ✅ Auto-logout

### Test 2: Login with MFA

1. ✅ Login with username/password
2. ✅ Prompt appears for 6-digit code
3. ✅ Enter code from authenticator
4. ✅ Login successful
5. ✅ **No yellow banner** (MFA satisfied)
6. ✅ **Admin buttons enabled**

### Test 3: Use Admin Functions

1. ✅ Upload a meeting
2. ✅ Click "Transcode Video" → **Works** (200 OK)
3. ✅ Click "Generate Transcript" → **Works** (200 OK)
4. ✅ Click "Extract Actions" → **Works** (200 OK)

### Test 4: Check `/v1/me` Response

```bash
curl http://localhost:8080/v1/me \
  -H "Authorization: Bearer {your_id_token}"

# Response with MFA:
{
  "sub": "...",
  "username": "admin",
  "groups": ["Admin"],
  "isAdmin": true,
  "mfaSatisfied": true,  ✅
  "amr": ["pwd", "mfa"]  ✅
}
```

## 🔧 API Endpoints

### POST /v1/mfa/setup
**Generate MFA secret and QR code**

**Request:**
```bash
POST /v1/mfa/setup
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "secretCode": "JBSWY3DPEHPK3PXP",
  "qrCodeData": "otpauth://totp/WBR%20Actionizer?secret=JBSWY3DPEHPK3PXP&issuer=WBR%20Actionizer",
  "message": "Scan the QR code with your authenticator app..."
}
```

### POST /v1/mfa/verify
**Verify MFA code and enable TOTP**

**Request:**
```bash
POST /v1/mfa/verify
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "mfaCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA enabled successfully! You will need to enter a code when logging in."
}
```

### POST /v1/login (with MFA)
**Login with MFA challenge**

**Step 1: Initial login**
```bash
POST /v1/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123"
}
```

**Response (MFA challenge):**
```json
{
  "success": false,
  "challengeName": "SOFTWARE_TOKEN_MFA",
  "session": "AYABeK...",
  "message": "MFA code required. Please enter the 6-digit code from your authenticator app."
}
```

**Step 2: Respond with MFA code**
```bash
POST /v1/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123",
  "mfaCode": "123456",
  "session": "AYABeK..."
}
```

**Response (success):**
```json
{
  "success": true,
  "accessToken": "eyJra...",
  "idToken": "eyJra...",  // Contains amr: ["pwd", "mfa"]
  "expiresIn": 3600
}
```

## 🎨 UI Components

### MFA Warning Banner
- **Location:** Top of page (after header)
- **Color:** Yellow (#fef3c7)
- **Clickable:** Opens MFA enrollment modal
- **Shows when:** `isAdmin === true && mfaSatisfied === false`

### MFA Enrollment Modal
- **Step 1:** Generate QR Code
  - Button to call `/v1/mfa/setup`
  - Displays QR code image (via qrserver.com API)
  - Shows secret code as backup
- **Step 2:** Enter 6-digit code
  - Input field for TOTP code
  - Button to call `/v1/mfa/verify`
  - Success/error messages

## 🐛 Troubleshooting

### "Access token required" error
- **Cause:** Using ID token instead of access token for setup
- **Fix:** The frontend automatically uses the correct token, but if testing manually, use `accessToken` (not `idToken`) for `/mfa/setup` and `/mfa/verify`

### "Invalid MFA code" error
- **Cause:** Wrong code or time sync issue
- **Fix:** 
  - Make sure your phone's time is synced (TOTP is time-based)
  - Try the next code (codes refresh every 30 seconds)
  - Check you're using the correct account in authenticator

### Banner still shows after MFA enrollment
- **Cause:** Using old access token without MFA claim
- **Fix:** Logout and login again (the app forces this automatically)

### QR code doesn't load
- **Cause:** Network issue with qrserver.com API
- **Fix:** Use the "Manual Entry Code" shown below the QR code

## 📸 Screenshots for Assessment

1. ✅ **MFA Warning Banner** - Yellow banner at top
2. ✅ **MFA Modal - QR Code** - Generated QR code in modal
3. ✅ **Authenticator App** - Showing "WBR Actionizer" entry
4. ✅ **MFA Login Prompt** - Browser prompt for 6-digit code
5. ✅ **Successful Login** - No banner, buttons enabled
6. ✅ **API 200 Response** - Transcode works after MFA

## ✅ Summary

You can now **enroll MFA without using Cognito Hosted UI**! 

Just:
1. Click the yellow banner
2. Scan the QR code
3. Enter the code
4. Done!

The next time you login, you'll be prompted for your 6-digit code from the authenticator app. 🎉

