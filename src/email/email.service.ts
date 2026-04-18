import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  private readonly resendApiKey: string | undefined;
  private readonly smtpHost: string | undefined;
  private readonly smtpPort: number;
  private readonly smtpUser: string | undefined;
  private readonly smtpPass: string | undefined;
  private readonly fromAddress = 'Sayless <no-reply@sayless.app>';

  constructor(private readonly configService: ConfigService) {
    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    this.smtpHost    = this.configService.get<string>('SMTP_HOST');
    this.smtpPort    = this.configService.get<number>('SMTP_PORT', 587);
    this.smtpUser    = this.configService.get<string>('SMTP_USER');
    this.smtpPass    = this.configService.get<string>('SMTP_PASS');
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    if (!this.hasAnyConfig()) {
      this.logger.warn('No email configuration found — skipping email send');
      return;
    }

    if (this.resendApiKey) {
      try {
        await this.sendViaResend({ to, subject, html });
        return;
      } catch (err) {
        this.logger.warn(
          `Resend delivery failed, falling back to SMTP: ${(err as Error).message}`,
        );
      }
    }

    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      await this.sendViaSMTP({ to, subject, html });
    } else {
      this.logger.warn('SMTP is not fully configured — skipping fallback');
    }
  }

  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    const subject = 'Reset your Sayless password';
    const html    = this.buildPasswordResetTemplate(name, resetUrl);
    await this.sendEmail(email, subject, html);
  }

  async sendVerificationEmail(
    email: string,
    name: string,
    verifyUrl: string,
  ): Promise<void> {
    const subject = 'Verify your Sayless account';
    const html    = this.buildVerificationTemplate(name, verifyUrl);
    await this.sendEmail(email, subject, html);
  }

  async sendAdminPasswordEmail(
    email: string,
    name: string,
    password: string,
  ): Promise<void> {
    const subject = 'Your Sayless admin account credentials';
    const html    = this.buildAdminPasswordTemplate(name, password);
    await this.sendEmail(email, subject, html);
  }

  // ─── Private: transport implementations ─────────────────────────────────────

  private async sendViaResend(opts: SendEmailOptions): Promise<void> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Resend API error ${response.status}: ${body}`);
    }

    this.logger.log(`Email sent via Resend to ${opts.to}`);
  }

  private async sendViaSMTP(opts: SendEmailOptions): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: this.smtpPort === 465,
      auth: {
        user: this.smtpUser,
        pass: this.smtpPass,
      },
    });

    await transporter.sendMail({
      from: this.fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });

    this.logger.log(`Email sent via SMTP to ${opts.to}`);
  }

  // ─── Private: helpers ────────────────────────────────────────────────────────

  private hasAnyConfig(): boolean {
    return (
      !!this.resendApiKey ||
      (!!this.smtpHost && !!this.smtpUser && !!this.smtpPass)
    );
  }

  // ─── Private: HTML templates ─────────────────────────────────────────────────

  private baseTemplate(title: string, bodyContent: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #0f0f0f; padding: 32px 40px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; }
    .header span { color: #a855f7; }
    .body { padding: 40px; color: #1a1a1a; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #444; }
    .body h2 { margin: 0 0 20px; font-size: 20px; color: #0f0f0f; }
    .btn { display: inline-block; margin: 24px 0; padding: 14px 32px; background: #a855f7; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 600; }
    .code-block { background: #f3f4f6; border-radius: 8px; padding: 14px 20px; font-family: monospace; font-size: 16px; color: #1a1a1a; letter-spacing: 1px; margin: 20px 0; text-align: center; }
    .footer { padding: 24px 40px; background: #fafafa; border-top: 1px solid #ebebeb; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Say<span>less</span></h1>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Sayless. All rights reserved.</p>
      <p>You received this email because an action was taken on your account.</p>
    </div>
  </div>
</body>
</html>`;
  }

  private buildPasswordResetTemplate(name: string, resetUrl: string): string {
    const body = `
      <h2>Reset your password</h2>
      <p>Hi ${this.escapeName(name)},</p>
      <p>We received a request to reset the password for your Sayless account. Click the button below to choose a new password.</p>
      <p style="text-align:center;">
        <a class="btn" href="${resetUrl}">Reset Password</a>
      </p>
      <p>This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
      <p>Or copy and paste this URL into your browser:<br/>
        <small style="color:#6b7280; word-break:break-all;">${resetUrl}</small>
      </p>`;
    return this.baseTemplate('Reset your password', body);
  }

  private buildVerificationTemplate(name: string, verifyUrl: string): string {
    const body = `
      <h2>Verify your email address</h2>
      <p>Hi ${this.escapeName(name)},</p>
      <p>Thanks for creating a Sayless account! Please verify your email address to get started.</p>
      <p style="text-align:center;">
        <a class="btn" href="${verifyUrl}">Verify Email</a>
      </p>
      <p>This link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.</p>
      <p>Or copy and paste this URL into your browser:<br/>
        <small style="color:#6b7280; word-break:break-all;">${verifyUrl}</small>
      </p>`;
    return this.baseTemplate('Verify your Sayless account', body);
  }

  private buildAdminPasswordTemplate(name: string, password: string): string {
    const body = `
      <h2>Your admin account is ready</h2>
      <p>Hi ${this.escapeName(name)},</p>
      <p>An admin account has been created for you on Sayless. Use the credentials below to sign in.</p>
      <p><strong>Temporary password:</strong></p>
      <div class="code-block">${password}</div>
      <p>For security, please change your password immediately after your first login.</p>
      <p>If you were not expecting this email, please contact your administrator.</p>`;
    return this.baseTemplate('Your Sayless admin credentials', body);
  }

  private escapeName(name: string): string {
    return name
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
