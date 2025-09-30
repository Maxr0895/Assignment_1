# Cognito Registration Setup Guide

## ✅ What We've Implemented

### **New API Endpoints:**
- `POST /v1/register` - User registration
- `POST /v1/confirm` - Email verification  
- `POST /v1/login` - JWT-based authentication

### **Features:**
✅ User registration with username, email, and password
✅ Email-based confirmation of registration
✅ User login returning JWT upon successful authentication

---

## 🔧 Required Cognito Configuration

### **Step 1: Enable USER_PASSWORD_AUTH**

1. Go to AWS Cognito Console: https://ap-southeast-2.console.aws.amazon.com/cognito/v2/idp/user-pools
2. Click your User Pool: `ap-southeast-2_9tnsorRRj`
3. Go to **"App integration"** tab
4. Under **"App clients and analytics"**, click your app client: `a2-n8501645`
5. Click **"Edit"** button
6. Scroll to **"Authentication flows"**
7. **Check** the box for: ✅ **"ALLOW_USER_PASSWORD_AUTH"**
8. Click **"Save changes"**

---

### **Step 2: Configure Password Policy (Optional)**

1. In your User Pool, go to **"Sign-in experience"** tab
2. Under **"Password policy"**, click **"Edit"**
3. Set minimum requirements (default is fine):
   - Minimum length: 8 characters
   - Requires lowercase, uppercase, numbers, special characters

---

### **Step 3: Verify Email Settings**

1. In your User Pool, go to **"Sign-in experience"** tab
2. Under **"Multi-factor authentication"**, ensure email verification is enabled
3. Go to **"Messaging"** tab
4. Verify **"Email"** configuration:
   - **SES email** (if configured) OR
   - **Cognito (default)** - limited to 50 emails/day for testing

---

## 🧪 Testing the API

### **1. Register a New User**

```bash
curl -X POST http://localhost:8080/v1/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "your-email@example.com",
    "password": "Test123!@#"
  }'
```

**Response:**
```json
{
  "success": true,
  "userSub": "uuid-here",
  "userConfirmed": false,
  "message": "User registered successfully. Please check your email for verification code."
}
```

---

### **2. Confirm Email (Check Your Inbox)**

Check your email for a verification code, then:

```bash
curl -X POST http://localhost:8080/v1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "code": "123456"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Email confirmed successfully. You can now log in."
}
```

---

### **3. Login and Get JWT**

```bash
curl -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123!@#"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJraWQiOiJrS...",
  "accessToken": "eyJraWQiOiJrS...",
  "expiresIn": 3600
}
```

---

### **4. Use JWT to Access Protected Routes**

```bash
# Get meetings list with JWT
curl -X GET http://localhost:8080/v1/meetings \
  -H "Authorization: Bearer eyJraWQiOiJrS..."
```

---

## 🎯 Assignment Requirements Checklist

✅ **User registration** - `POST /v1/register` with username, email, password
✅ **Email-based confirmation** - `POST /v1/confirm` with verification code
✅ **User login** - `POST /v1/login` returning JWT (ID token)
✅ **JWT authentication** - All protected routes accept `Authorization: Bearer <token>`

---

## 🐛 Troubleshooting

### **Error: "InvalidParameterException: USER_PASSWORD_AUTH flow not enabled"**
→ You forgot Step 1 above! Enable `ALLOW_USER_PASSWORD_AUTH` in your app client.

### **Error: "Password did not conform with policy"**
→ Use a stronger password with uppercase, lowercase, numbers, and special characters.

### **Error: "User is not confirmed"**
→ Complete email verification with `POST /v1/confirm` before logging in.

### **Email not received**
→ Check spam folder
→ Verify Cognito email configuration (SES or Cognito default)
→ Default Cognito has 50 email/day limit

---

## 🔒 Security Notes

- **JWT tokens** are returned in the `token` field (ID token)
- Tokens expire after 1 hour by default
- Store tokens securely (httpOnly cookies in production)
- Never commit `.env` file with real credentials
- Use strong session secrets in production

---

## 📚 API Documentation Summary

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/v1/register` | POST | No | Create new user account |
| `/v1/confirm` | POST | No | Verify email with code |
| `/v1/login` | POST | No | Get JWT token |
| `/v1/me` | GET | Yes | Get current user info |
| `/v1/meetings` | GET | Yes | List meetings |
| `/v1/meetings` | POST | Yes | Upload meeting video |
| `/v1/meetings/:id/transcode` | POST | Yes | Transcode video |
| `/v1/meetings/:id/transcribe` | POST | Yes | Generate transcript |
| `/v1/meetings/:id/actions` | POST | Yes | Extract actions |
| `/v1/reports/wbr-summary` | GET | Yes | Generate WBR report |

---

## ✅ Next Steps

1. **Enable USER_PASSWORD_AUTH** in Cognito (see Step 1 above)
2. **Restart your server:** `npm run dev`
3. **Test registration flow** with the curl commands above
4. **Integrate with your frontend** (update login form to use POST instead of GET)
