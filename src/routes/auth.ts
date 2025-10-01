import { Router } from 'express';
import express from 'express';
import {
  registerUser,
  confirmRegistration,
  authenticateUser,
  resetPassword,
  setupMFA,
  verifyMFA,
} from '../services/cognitoAuth';
import { authRequired } from '../middleware/auth';

const router = Router();

// JSON parsing middleware for POST routes
router.use(express.json());

/**
 * POST /register
 * Register a new user with Cognito
 * Body: { username, email, password }
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    const result = await registerUser(username, email, password);
    res.status(201).json(result);
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      error: error.message || 'Registration failed' 
    });
  }
});

/**
 * POST /confirm
 * Confirm user email with verification code
 * Body: { username, code }
 */
router.post('/confirm', async (req, res) => {
  try {
    const { username, code } = req.body;

    if (!username || !code) {
      return res.status(400).json({ 
        error: 'Username and confirmation code are required' 
      });
    }

    const result = await confirmRegistration(username, code);
    res.json(result);
  } catch (error: any) {
    console.error('Confirmation error:', error);
    res.status(400).json({ 
      error: error.message || 'Confirmation failed' 
    });
  }
});

/**
 * POST /reset-password
 * Reset password with verification code from email
 * Body: { username, code, newPassword }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { username, code, newPassword } = req.body;

    if (!username || !code || !newPassword) {
      return res.status(400).json({ 
        error: 'Username, code, and new password are required' 
      });
    }

    const result = await resetPassword(username, code, newPassword);
    res.json(result);
  } catch (error: any) {
    console.error('Password reset error:', error);
    res.status(400).json({ 
      error: error.message || 'Password reset failed' 
    });
  }
});

/**
 * POST /login
 * Authenticate with username/password, returns JWT tokens (stateless)
 * Handles MFA challenges if user has MFA enabled
 * 
 * Body: { username, password } for initial login
 *       { username, password, mfaCode, session } for MFA challenge response
 * 
 * Returns: { accessToken, idToken, expiresIn } on success
 *          { challengeName, session, message } if MFA code needed
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, mfaCode, session } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    const result = await authenticateUser(username, password, mfaCode, session);
    
    // If MFA challenge required, return challenge details
    if (!result.success && result.challengeName) {
      return res.json({
        success: false,
        challengeName: result.challengeName,
        session: result.session,
        message: result.message,
      });
    }
    
    // Return JWT tokens for stateless API access
    res.json({
      success: true,
      accessToken: result.accessToken,
      idToken: result.idToken,
      expiresIn: result.expiresIn,
      message: 'Use idToken in Authorization header as: Bearer <idToken>'
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ 
      error: error.message || 'Authentication failed' 
    });
  }
});

/**
 * GET /me
 * Get current authenticated user's information including groups and MFA status
 * Requires: Bearer token in Authorization header (ID token preferred for MFA info)
 * Returns: { sub, username, email, groups, isAdmin, mfaSatisfied }
 */
router.get('/me', authRequired, (req, res) => {
  try {
    const user = req.user!;
    
    // Check if MFA is satisfied via the 'amr' claim (only present in ID tokens)
    const amr = user.amr || [];
    const mfaSatisfied = amr.includes('mfa') || amr.includes('software_token_mfa');
    
    res.json({
      sub: user.sub,
      username: user.username,
      email: user.email || null,
      groups: user['cognito:groups'] || [],
      isAdmin: (user['cognito:groups'] || []).includes('Admin'),
      mfaSatisfied,
      amr // Include for debugging (can be removed in production)
    });
  } catch (error: any) {
    console.error('Get user info error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user information' 
    });
  }
});

/**
 * POST /mfa/setup
 * Generate MFA secret and QR code data for user
 * Requires: Bearer token in Authorization header (access token)
 * Returns: { secretCode, qrCodeData, message }
 */
router.post('/mfa/setup', authRequired, async (req, res) => {
  try {
    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const accessToken = authHeader.substring(7);
    const result = await setupMFA(accessToken);
    
    res.json(result);
  } catch (error: any) {
    console.error('MFA setup error:', error);
    res.status(500).json({ 
      error: error.message || 'MFA setup failed' 
    });
  }
});

/**
 * POST /mfa/verify
 * Verify MFA code and enable TOTP for user
 * Requires: Bearer token in Authorization header (access token)
 * Body: { mfaCode } - 6-digit code from authenticator app
 * Returns: { success, message }
 */
router.post('/mfa/verify', authRequired, async (req, res) => {
  try {
    const { mfaCode } = req.body;
    
    if (!mfaCode) {
      return res.status(400).json({ error: 'MFA code is required' });
    }
    
    // Extract access token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    const accessToken = authHeader.substring(7);
    const result = await verifyMFA(accessToken, mfaCode);
    
    res.json(result);
  } catch (error: any) {
    console.error('MFA verification error:', error);
    res.status(400).json({ 
      error: error.message || 'MFA verification failed' 
    });
  }
});

export default router;