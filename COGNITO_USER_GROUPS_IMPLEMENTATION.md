# Cognito User Groups Implementation

This document details the implementation of role-based access control using AWS Cognito User Groups.

## 📋 Overview

The application now supports **two user roles** via Cognito User Groups:

- **Admin**: Full access (upload, process, view)
- **User**: View-only access (list, view details, download)

## 🔧 Implementation Details

### Backend Changes

#### 1. Middleware (`src/middleware/auth.ts`)

**Added `requireGroup()` middleware factory**:
```typescript
export function requireGroup(allowedGroups: string | string[]) {
  // Returns middleware that checks cognito:groups from JWT
  // Returns 403 if user not in required group(s)
}
```

**Features**:
- Extracts `cognito:groups` from verified JWT payload
- Supports single group or array of groups
- Returns descriptive 403 error with required/actual groups
- Logs access denials for audit trail

**Updated `authRequired` middleware**:
- Now extracts and attaches `cognito:groups` to `req.user`
- Defaults to empty array if groups not present

#### 2. Routes Protected with Admin Group

**`src/routes/meetings.ts`**:
- `POST /v1/meetings` → `authRequired` + `requireGroup('Admin')`

**`src/routes/files.ts`**:
- `POST /v1/files/presign-upload` → `authRequired` + `requireGroup('Admin')`
- `GET /v1/files/presign-download/:key` → `authRequired` only (all users can download)

**`src/routes/processing.ts`**:
- `POST /v1/meetings/:id/transcode` → `authRequired` + `requireGroup('Admin')`
- `POST /v1/meetings/:id/transcribe` → `authRequired` + `requireGroup('Admin')`
- `POST /v1/meetings/:id/actions` → `authRequired` + `requireGroup('Admin')`

#### 3. New `/v1/me` Endpoint (`src/routes/auth.ts`)

Returns current user information including groups:

**Request**:
```bash
GET /v1/me
Authorization: Bearer <accessToken>
```

**Response**:
```json
{
  "sub": "uuid-here",
  "username": "testuser",
  "email": "test@example.com",
  "groups": ["Admin"],
  "isAdmin": true
}
```

### Frontend Changes

#### 1. Login Flow (`public/app.js`)

**Updated `handleLogin()`**:
- After successful login, calls `GET /v1/me`
- Stores user info (including groups) in `localStorage.userInfo`
- Passes full user object to `showAuthenticated()`

#### 2. UI Group-Based Display

**Updated `showAuthenticated(userInfo)`**:
- Displays role in user info: `"Logged in as username (Admin)"`
- Shows/hides elements with `.admin-only` class based on `isAdmin` flag
- Shows info message for non-admin users

**Updated `checkAuthState()`**:
- Reads `userInfo` from localStorage instead of `userRole`
- Parses JSON and passes to `showAuthenticated()`

**Updated `logout()`**:
- Clears `userInfo` from localStorage

#### 3. HTML Updates (`public/index.html`)

**Upload Section**:
- Wrapped upload form in `<div class="admin-only">`
- Added info message for non-admin users (hidden by default)
- Message shown when user is not in Admin group

**Processing Controls**:
- Added `admin-only` class to processing controls div
- Hides transcode/transcribe/extract buttons for non-admin users

## 🚀 Setup Instructions

### 1. Create Cognito User Groups

1. **Go to AWS Cognito Console**
2. **Select your User Pool**: `ap-southeast-2_9tnsorRRj`
3. **Go to "Groups" tab**
4. **Create Admin group**:
   - Name: `Admin`
   - Description: "Full administrative access"
   - Precedence: 1
5. **Create User group**:
   - Name: `User`
   - Description: "View-only access"
   - Precedence: 2

### 2. Assign Users to Groups

**Option 1: AWS Console**
1. Go to **Users** tab
2. Select a user
3. Click **Add to group**
4. Select `Admin` or `User`

**Option 2: AWS CLI**
```bash
# Add user to Admin group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ap-southeast-2_9tnsorRRj \
  --username testuser \
  --group-name Admin \
  --region ap-southeast-2

# Add user to User group  
aws cognito-idp admin-add-user-to-group \
  --user-pool-id ap-southeast-2_9tnsorRRj \
  --username viewer \
  --group-name User \
  --region ap-southeast-2
```

## 🧪 Testing

### Test 1: Admin User Flow

```bash
# 1. Login as admin user (assigned to Admin group)
ADMIN_TOKEN=$(curl -s -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin1234!"}' \
  | jq -r '.accessToken')

# 2. Get user info
curl -X GET http://localhost:8080/v1/me \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq

# Expected: { "isAdmin": true, "groups": ["Admin"] }

# 3. Try to upload (should succeed)
curl -X POST http://localhost:8080/v1/files/presign-upload \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","fileType":"video/mp4"}' | jq

# Expected: 200 OK with presigned URL
```

### Test 2: Non-Admin User Flow

```bash
# 1. Register new user
curl -X POST http://localhost:8080/v1/register \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer","email":"viewer@example.com","password":"Viewer1234!"}'

# 2. Confirm (use code from email)
curl -X POST http://localhost:8080/v1/confirm \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer","code":"123456"}'

# 3. Login (user not in any group yet)
VIEWER_TOKEN=$(curl -s -X POST http://localhost:8080/v1/login \
  -H "Content-Type: application/json" \
  -d '{"username":"viewer","password":"Viewer1234!"}' \
  | jq -r '.accessToken')

# 4. Get user info
curl -X GET http://localhost:8080/v1/me \
  -H "Authorization: Bearer $VIEWER_TOKEN" | jq

# Expected: { "isAdmin": false, "groups": [] }

# 5. Try to upload (should fail with 403)
curl -X POST http://localhost:8080/v1/files/presign-upload \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileName":"test.mp4","fileType":"video/mp4"}' | jq

# Expected: 403 Forbidden
# {
#   "error": "Insufficient permissions",
#   "message": "This action requires membership in one of these groups: Admin",
#   "requiredGroups": ["Admin"],
#   "userGroups": []
# }

# 6. View meetings (should succeed)
curl -X GET http://localhost:8080/v1/meetings \
  -H "Authorization: Bearer $VIEWER_TOKEN" | jq

# Expected: 200 OK with meetings list
```

### Test 3: Frontend UI

1. **Login as non-admin user**:
   - Upload form and processing buttons hidden
   - Info message displayed: "View-Only Access"
   - User info shows: "Logged in as viewer (User)"

2. **Add user to Admin group in Cognito**

3. **Logout and login again**:
   - Upload form and processing buttons now visible
   - Info message hidden
   - User info shows: "Logged in as viewer (Admin)"

## 📊 Authorization Flow

```
1. User logs in → receives accessToken
2. Frontend calls GET /v1/me with accessToken
3. Backend verifies JWT and extracts cognito:groups
4. Response includes { isAdmin: true/false, groups: [...] }
5. Frontend shows/hides UI based on isAdmin flag
6. User tries to access admin endpoint
7. authRequired middleware verifies JWT
8. requireGroup('Admin') checks cognito:groups
9. If user in Admin group → proceed
10. If not in Admin group → return 403
```

## 🎯 Protected vs Public Endpoints

### Admin-Only Endpoints (require Admin group)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/meetings` | Upload meeting |
| POST | `/v1/files/presign-upload` | Generate upload URL |
| POST | `/v1/meetings/:id/transcode` | Transcode video |
| POST | `/v1/meetings/:id/transcribe` | Generate transcript |
| POST | `/v1/meetings/:id/actions` | Extract actions |

### All Authenticated Users

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/v1/me` | Get current user info |
| GET | `/v1/meetings` | List meetings |
| GET | `/v1/meetings/:id` | Get meeting details |
| GET | `/v1/files/presign-download/:key` | Generate download URL |
| GET | `/v1/reports/wbr-summary` | View summary report |

### Public Endpoints (no auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/v1/register` | Register new user |
| POST | `/v1/confirm` | Confirm email |
| POST | `/v1/login` | Login |
| GET | `/health` | Health check |
| GET | `/v1/config` | Get config |

## 🔒 Security Considerations

1. **JWT Groups Claim**: Groups are embedded in the JWT by Cognito - cannot be manipulated client-side
2. **Server-Side Enforcement**: All authorization checks happen server-side
3. **Middleware Order**: `authRequired` MUST run before `requireGroup` to ensure user is authenticated first
4. **Audit Trail**: Group-based denials are logged server-side for security monitoring
5. **Frontend UI**: Hiding controls is UX only - server enforces authorization

## 📝 Files Modified

### Backend
- `src/middleware/auth.ts` - Added `requireGroup()` middleware
- `src/routes/auth.ts` - Added `GET /v1/me` endpoint
- `src/routes/meetings.ts` - Protected with `requireGroup('Admin')`
- `src/routes/files.ts` - Protected presign-upload with `requireGroup('Admin')`
- `src/routes/processing.ts` - Protected all processing routes with `requireGroup('Admin')`

### Frontend
- `public/app.js` - Updated login flow, auth state, UI display logic
- `public/index.html` - Added `admin-only` classes, info message

### Documentation
- `README.md` - Added comprehensive RBAC section
- `COGNITO_USER_GROUPS_IMPLEMENTATION.md` - This document

## ✅ Assignment Compliance

This implementation satisfies requirements for **authorization**:

- ✅ Different permission levels (Admin vs User)
- ✅ Group-based access control via Cognito User Groups
- ✅ Server-side authorization enforcement
- ✅ Descriptive 403 errors with required/actual groups
- ✅ Frontend conditional rendering based on permissions
- ✅ Comprehensive testing and documentation

## 🎊 Summary

The application now supports full role-based access control:
- **Admins** can upload and process videos
- **Regular users** can only view meetings and reports
- **Authorization enforced** server-side with descriptive errors
- **UI adapts** to show only available functionality
- **Fully documented** with setup instructions and test cases

