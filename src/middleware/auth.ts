import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from '../config';

// Create JWT verifier for Cognito Access Tokens
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: config.cognitoUserPoolId,
  tokenUse: 'access',
  clientId: config.cognitoClientId,
});

// Create JWT verifier for Cognito ID Tokens (contains MFA info)
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: config.cognitoUserPoolId,
  tokenUse: 'id',
  clientId: config.cognitoClientId,
});

interface CognitoUser {
  sub: string;
  username: string;
  email?: string;
  'cognito:groups'?: string[];
  amr?: string[]; // Authentication Methods References (for MFA detection)
}

declare global {
  namespace Express {
    interface Request {
      user?: CognitoUser;
    }
  }
}

/**
 * Middleware to ensure authentication via Cognito Token
 * Accepts either Access Token or ID Token (ID token preferred for MFA info)
 * Pure bearer token auth - NO sessions
 */
export async function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Provide a valid Bearer token in Authorization header'
      });
    }

    const token = authHeader.substring(7);

    try {
      // Try ID token first (contains MFA info via 'amr' claim)
      let payload: any;
      let tokenType: 'id' | 'access';
      
      try {
        payload = await idTokenVerifier.verify(token);
        tokenType = 'id';
      } catch {
        // Fall back to access token
        payload = await accessTokenVerifier.verify(token);
        tokenType = 'access';
      }
      
      // Attach user info to request (including groups for RBAC and amr for MFA)
      req.user = {
        sub: payload.sub,
        username: payload['cognito:username'] || payload.username || payload.sub,
        email: payload.email,
        'cognito:groups': payload['cognito:groups'] || [],
        amr: tokenType === 'id' ? payload.amr : undefined // MFA info only in ID tokens
      };

      return next();
    } catch (error: any) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Middleware factory to require specific Cognito User Group membership
 * Usage: requireGroup('Admin') or requireGroup(['Admin', 'Moderator'])
 * 
 * @param allowedGroups - Single group name or array of allowed group names
 * @returns Express middleware that enforces group membership
 */
export function requireGroup(allowedGroups: string | string[]) {
  // Normalize to array
  const groupsArray = Array.isArray(allowedGroups) ? allowedGroups : [allowedGroups];
  
  return (req: Request, res: Response, next: NextFunction) => {
    // User must be authenticated first (authRequired should run before this)
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    const userGroups = req.user['cognito:groups'] || [];
    
    // Check if user is in any of the allowed groups
    const hasRequiredGroup = groupsArray.some(group => userGroups.includes(group));
    
    if (!hasRequiredGroup) {
      console.warn(`Access denied for user ${req.user.username}: requires group [${groupsArray.join(', ')}], has [${userGroups.join(', ')}]`);
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        message: `This action requires membership in one of these groups: ${groupsArray.join(', ')}`,
        requiredGroups: groupsArray,
        userGroups
      });
    }

    // User has required group - proceed
    next();
  };
}

/**
 * Middleware to require MFA for sensitive admin operations
 * Checks the 'amr' (Authentication Methods References) claim from Cognito ID token
 * 
 * Must be used AFTER authRequired middleware
 * 
 * @returns Express middleware that enforces MFA enrollment
 */
export function requireMFA() {
  return (req: Request, res: Response, next: NextFunction) => {
    // User must be authenticated first
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      });
    }

    // Check if MFA is satisfied via the 'amr' claim
    const amr = req.user.amr || [];
    const mfaSatisfied = amr.includes('mfa') || amr.includes('software_token_mfa');
    
    if (!mfaSatisfied) {
      console.warn(`MFA required for user ${req.user.username} but not satisfied. amr: ${JSON.stringify(amr)}`);
      
      return res.status(403).json({ 
        error: 'MFA required',
        message: 'Multi-factor authentication is required for admin actions. Please enroll via the login page.',
        mfaEnrolled: false,
        hint: 'Logout and log in again to enroll TOTP (scan QR code with authenticator app)'
      });
    }

    // MFA is satisfied - proceed
    console.log(`✅ MFA satisfied for user ${req.user.username}`);
    next();
  };
}