import { Router } from 'express';
import express from 'express';
import {
  registerUser,
  confirmRegistration,
  authenticateUser,
  resetPassword,
} from '../services/cognitoAuth';

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
 * Body: { username, password }
 * Returns: { accessToken, idToken, expiresIn }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ 
        error: 'Username and password are required' 
      });
    }

    const result = await authenticateUser(username, password);
    
    // Return JWT tokens for stateless API access
    res.json({
      success: true,
      accessToken: result.accessToken,
      idToken: result.idToken,
      expiresIn: result.expiresIn,
      message: 'Use accessToken in Authorization header as: Bearer <accessToken>'
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ 
      error: error.message || 'Authentication failed' 
    });
  }
});

export default router;