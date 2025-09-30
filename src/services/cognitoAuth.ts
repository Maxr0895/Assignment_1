import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  InitiateAuthCommand,
  AuthFlowType,
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
 */
export async function authenticateUser(username: string, password: string): Promise<any> {
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: config.cognitoClientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);
    
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
