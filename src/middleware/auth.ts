import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { config } from '../config';

// Create JWT verifier for Cognito Access Tokens
const verifier = CognitoJwtVerifier.create({
  userPoolId: config.cognitoUserPoolId,
  tokenUse: 'access',
  clientId: config.cognitoClientId,
});

interface CognitoUser {
  sub: string;
  username: string;
  email?: string;
  'cognito:groups'?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: CognitoUser;
    }
  }
}

/**
 * Middleware to ensure authentication via Cognito Access Token
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
      // Verify JWT using aws-jwt-verify (validates signature, expiry, issuer)
      const payload = await verifier.verify(token);
      
      // Attach user info to request
      req.user = {
        sub: payload.sub,
        username: payload.username || payload.sub,
        email: payload.email,
        'cognito:groups': payload['cognito:groups']
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