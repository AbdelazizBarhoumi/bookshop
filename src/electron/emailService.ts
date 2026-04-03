/**
 * emailService.ts - Email sending service for password reset verification
 */

import nodemailer from 'nodemailer';

const SMTP_CONFIG = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'riclibrary2025@gmail.com',
    pass: 'kiskujtcvkebplfv',
  },
};

// Store verification codes with expiry
interface VerificationCode {
  code: string;
  email: string;
  username: string;
  expiresAt: number;
  attempts: number;
}

const _verificationCodes = new Map<string, VerificationCode>();
const CODE_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * Generate a 6-digit verification code
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send verification code via email
 */
export async function sendVerificationCode(
  email: string,
  username: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate code
    const code = generateCode();
    const expiresAt = Date.now() + CODE_EXPIRY_MS;

    // Store code
    _verificationCodes.set(username.toLowerCase(), {
      code,
      email,
      username,
      expiresAt,
      attempts: 0,
    });

    // Create transporter
    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    // Email content
    const mailOptions = {
      from: `"RIC Library" <${SMTP_CONFIG.auth.user}>`,
      to: email,
      subject: 'Password Reset Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>You have requested to reset your password. Use the verification code below:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563eb; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          <p><strong>This code will expire in 1 hour.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          <p style="color: #666; font-size: 12px;">RIC Library - Bookshop Management System</p>
        </div>
      `,
      text: `
Hello ${username},

You have requested to reset your password. Use the verification code below:

${code}

This code will expire in 1 hour.

If you didn't request this, please ignore this email.

RIC Library - Bookshop Management System
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    console.log(`[emailService] Verification code sent to ${email} for user ${username}`);
    return { success: true };
  } catch (error) {
    console.error('[emailService] Failed to send email:', error);
    return { success: false, error: 'Failed to send verification email' };
  }
}

/**
 * Verify the code entered by user
 */
export function verifyCode(
  username: string,
  code: string
): { success: boolean; error?: string } {
  const key = username.toLowerCase();
  const stored = _verificationCodes.get(key);

  if (!stored) {
    return { success: false, error: 'No verification code found. Please request a new one.' };
  }

  // Check expiry
  if (Date.now() > stored.expiresAt) {
    _verificationCodes.delete(key);
    return { success: false, error: 'Verification code expired. Please request a new one.' };
  }

  // Check max attempts
  if (stored.attempts >= MAX_VERIFY_ATTEMPTS) {
    _verificationCodes.delete(key);
    return { success: false, error: 'Too many failed attempts. Please request a new code.' };
  }

  // Verify code
  if (stored.code !== code.trim()) {
    stored.attempts++;
    return { success: false, error: 'Invalid verification code. Please try again.' };
  }

  // Success - keep the code for password reset
  return { success: true };
}

/**
 * Clean up verification code after successful password reset
 */
export function clearVerificationCode(username: string): void {
  _verificationCodes.delete(username.toLowerCase());
}

/**
 * Check if a verification code exists and is valid
 */
export function hasValidCode(username: string): boolean {
  const key = username.toLowerCase();
  const stored = _verificationCodes.get(key);
  if (!stored) return false;
  if (Date.now() > stored.expiresAt) {
    _verificationCodes.delete(key);
    return false;
  }
  return true;
}
