import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  InitiateAuthCommand,
  AuthFlowType,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  RespondToAuthChallengeCommand,
  ChallengeNameType,
} from '@aws-sdk/client-cognito-identity-provider';
import { config } from '../config';

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.awsRegion,
});

/**
 * Register a new user with Cognito
 */
export async function registerUser(username: string, email: string, password: string) {
  try {
    const command = new SignUpCommand({
      ClientId: config.cognitoClientId,
      Username: username,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
      ],
    });

    const response = await cognitoClient.send(command);
    
    return {
      success: true,
      userSub: response.UserSub,
      userConfirmed: response.UserConfirmed,
      message: 'User registered successfully. Please check your email for verification code.',
    };
  } catch (error: any) {
    console.error('Cognito registration error:', error);
    throw new Error(error.message || 'Registration failed');
  }
}

/**
 * Confirm user registration with verification code
 */
export async function confirmRegistration(username: string, confirmationCode: string) {
  try {
    const command = new ConfirmSignUpCommand({
      ClientId: config.cognitoClientId,
      Username: username,
      ConfirmationCode: confirmationCode,
    });

    await cognitoClient.send(command);
    
    return {
      success: true,
      message: 'Email confirmed successfully. You can now log in.',
    };
  } catch (error: any) {
    console.error('Cognito confirmation error:', error);
    throw new Error(error.message || 'Confirmation failed');
  }
}

/**
 * Authenticate user with username and password, returning JWT tokens
 * Handles MFA challenges if user has MFA enabled
 */
export async function authenticateUser(username: string, password: string, mfaCode?: string, session?: string): Promise<any> {
  try {
    // DEBUG: Log what parameters we received
    console.log('🔐 authenticateUser called with:', {
      username,
      hasMfaCode: !!mfaCode,
      mfaCodeLength: mfaCode?.length,
      hasSession: !!session,
      sessionLength: session?.length
    });
    
    // If MFA code provided, respond to MFA challenge
    if (mfaCode && session) {
      console.log('✅ MFA code AND session provided - responding to challenge');
      const challengeCommand = new RespondToAuthChallengeCommand({
        ClientId: config.cognitoClientId,
        ChallengeName: ChallengeNameType.SOFTWARE_TOKEN_MFA,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: mfaCode,
        },
      });

      const challengeResponse = await cognitoClient.send(challengeCommand);
      
      console.log('📥 MFA Challenge Response received:', {
        hasAuthResult: !!challengeResponse.AuthenticationResult,
        hasIdToken: !!challengeResponse.AuthenticationResult?.IdToken
      });
      
      if (!challengeResponse.AuthenticationResult) {
        throw new Error('MFA verification failed');
      }

      console.log('✅ MFA SUCCESS - returning tokens WITH MFA FLAG');
      
      // WORKAROUND: USER_PASSWORD_AUTH doesn't include amr claim
      // So we return a flag to indicate MFA was verified
      return {
        success: true,
        idToken: challengeResponse.AuthenticationResult.IdToken,
        accessToken: challengeResponse.AuthenticationResult.AccessToken,
        refreshToken: challengeResponse.AuthenticationResult.RefreshToken,
        expiresIn: challengeResponse.AuthenticationResult.ExpiresIn,
        mfaVerified: true  // ✅ Manual flag since Cognito doesn't include amr
      };
    }

    // Initial authentication
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: config.cognitoClientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);
    
    // DEBUG: Log what Cognito returns
    console.log('🔐 Cognito InitiateAuth Response:', {
      ChallengeName: response.ChallengeName,
      hasAuthResult: !!response.AuthenticationResult,
      hasSession: !!response.Session
    });
    
    // Check if MFA challenge is required
    if (response.ChallengeName === ChallengeNameType.SOFTWARE_TOKEN_MFA) {
      console.log('✅ MFA Challenge detected - returning to client');
      return {
        success: false,
        challengeName: 'SOFTWARE_TOKEN_MFA',
        session: response.Session,
        message: 'MFA code required. Please enter the 6-digit code from your authenticator app.',
      };
    }

    // Check if MFA setup is required (first-time MFA enrollment during login)
    if (response.ChallengeName === ChallengeNameType.MFA_SETUP) {
      return {
        success: false,
        challengeName: 'MFA_SETUP',
        session: response.Session,
        message: 'MFA setup required. Please complete MFA enrollment.',
      };
    }
    
    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed - no tokens returned');
    }

    return {
      success: true,
      idToken: response.AuthenticationResult.IdToken,
      accessToken: response.AuthenticationResult.AccessToken,
      refreshToken: response.AuthenticationResult.RefreshToken,
      expiresIn: response.AuthenticationResult.ExpiresIn,
    };
  } catch (error: any) {
    console.error('Cognito authentication error:', error);
    throw new Error(error.message || 'Authentication failed');
  }
}

/**
 * Reset password with verification code
 */
export async function resetPassword(username: string, code: string, newPassword: string) {
  try {
    const command = new ConfirmForgotPasswordCommand({
      ClientId: config.cognitoClientId,
      Username: username,
      ConfirmationCode: code,
      Password: newPassword,
    });

    await cognitoClient.send(command);
    
    return {
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.',
    };
  } catch (error: any) {
    console.error('Password reset error:', error);
    throw new Error(error.message || 'Password reset failed');
  }
}

/**
 * Setup MFA for a user (generate QR code secret)
 * Requires the user's access token
 */
export async function setupMFA(accessToken: string): Promise<any> {
  try {
    const command = new AssociateSoftwareTokenCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);
    
    if (!response.SecretCode) {
      throw new Error('Failed to generate MFA secret');
    }

    // Generate QR code data for authenticator apps
    // Format: otpauth://totp/{label}?secret={secret}&issuer={issuer}
    const appName = 'WBR Actionizer';
    const secretCode = response.SecretCode;
    const qrCodeData = `otpauth://totp/${encodeURIComponent(appName)}?secret=${secretCode}&issuer=${encodeURIComponent(appName)}`;

    return {
      success: true,
      secretCode,
      qrCodeData,
      message: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
    };
  } catch (error: any) {
    console.error('MFA setup error:', error);
    throw new Error(error.message || 'MFA setup failed');
  }
}

/**
 * Verify MFA code and enable MFA for the user
 * Requires the user's access token and the 6-digit code from authenticator app
 */
export async function verifyMFA(accessToken: string, mfaCode: string): Promise<any> {
  try {
    // Verify the TOTP code
    const verifyCommand = new VerifySoftwareTokenCommand({
      AccessToken: accessToken,
      UserCode: mfaCode,
      FriendlyDeviceName: 'Authenticator App',
    });

    const verifyResponse = await cognitoClient.send(verifyCommand);
    
    if (verifyResponse.Status !== 'SUCCESS') {
      throw new Error('Invalid MFA code. Please try again.');
    }

    // Enable TOTP as the preferred MFA method
    const preferenceCommand = new SetUserMFAPreferenceCommand({
      AccessToken: accessToken,
      SoftwareTokenMfaSettings: {
        Enabled: true,
        PreferredMfa: true,
      },
    });

    await cognitoClient.send(preferenceCommand);

    return {
      success: true,
      message: 'MFA enabled successfully! You will need to enter a code when logging in.',
    };
  } catch (error: any) {
    console.error('MFA verification error:', error);
    throw new Error(error.message || 'MFA verification failed');
  }
}
