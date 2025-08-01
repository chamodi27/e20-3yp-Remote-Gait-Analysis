// ===== NEW SES Implementation =====
package com._yp.gaitMate.mail.service;

import com._yp.gaitMate.mail.service.EmailService;
import com._yp.gaitMate.security.model.AccountType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.*;

@Service
@ConditionalOnProperty(name = "email.provider", havingValue = "ses", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class EmailServiceSESImpl implements EmailService {

    private final SesClient sesClient;

    @Value("${frontend.base.url}")
    private String frontendUrl;

    @Value("${email.ses.from-email}")
    private String fromEmail;

    @Override
    public void sendInvitationEmail(String toEmail, String invitationToken, AccountType accountType) {
        try {
            // Add debug info to see what's happening
            log.info("🔧 [SES DEBUG] Sending email from: {} to: {}", fromEmail, toEmail);

            String signupUrl = frontendUrl + "/signup?token=" + invitationToken + "&type=" + accountType.getValue();

            String subject = "Complete Your RehabGait Account Setup";
            String htmlContent = buildInvitationHtmlContent(signupUrl, toEmail);
            String textContent = buildInvitationTextContent(signupUrl, toEmail);

            sendEmail(toEmail, subject, htmlContent, textContent);
            log.info("✅ [SES] Invitation email sent successfully to: {}", toEmail);

        } catch (Exception e) {
            log.error("❌ [SES] Failed to send email to {}: {}", toEmail, e.getMessage());
            // Check if it's still using wrong region
            if (e.getMessage().contains("EU-NORTH-1")) {
                log.error("🚨 [SES] Still using wrong region! Check spring.cloud.aws.ses.region configuration");
            }

            throw new RuntimeException("Failed to send invitation email via SES", e);
        }
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String resetToken) {
        try {
            log.info("🔧 [SES DEBUG] Sending password reset from: {} to: {}", fromEmail, toEmail);

            String resetUrl = frontendUrl + "/reset-password?token=" + resetToken;

            String subject = "Reset Your RehabGait Password";
            String htmlContent = buildPasswordResetHtmlContent(resetUrl, toEmail);
            String textContent = buildPasswordResetTextContent(resetUrl, toEmail);

            sendEmail(toEmail, subject, htmlContent, textContent);
            log.info("✅ [SES] Password reset email sent successfully to: {}", toEmail);

        } catch (Exception e) {
            log.error("❌ [SES] Failed to send password reset email to {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Failed to send password reset email via SES", e);
        }
    }

    private void sendEmail(String toEmail, String subject, String htmlContent, String textContent) {
        try {
            Destination destination = Destination.builder()
                    .toAddresses(toEmail)
                    .build();

            Content subjectContent = Content.builder()
                    .data(subject)
                    .build();

            Content htmlBody = Content.builder()
                    .data(htmlContent)
                    .build();

            Content textBody = Content.builder()
                    .data(textContent)
                    .build();

            Body body = Body.builder()
                    .html(htmlBody)
                    .text(textBody)
                    .build();

            Message message = Message.builder()
                    .subject(subjectContent)
                    .body(body)
                    .build();

            SendEmailRequest emailRequest = SendEmailRequest.builder()
                    .destination(destination)
                    .message(message)
                    .source(fromEmail)
                    .build();

            SendEmailResponse response = sesClient.sendEmail(emailRequest);
            log.debug("📧 [SES] Email sent successfully. Message ID: {}", response.messageId());

        } catch (SesException e) {
            log.error("❌ [SES] Exception occurred: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to send email via SES", e);
        }
    }

    // Your existing HTML template methods with minor updates for SES
    private String buildPasswordResetHtmlContent(String resetUrl, String toEmail) {
        String htmlTemplate = """
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <!-- Header -->
                <div style="background: #6c757d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px; font-weight: 500;">Reset Your Password</h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 30px;">
                    <p style="color: #495057; font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">
                        You requested to reset your password for your RehabGait account.
                    </p>
                    
                    <p style="color: #495057; font-size: 16px; line-height: 1.5; margin: 0 0 30px 0;">
                        Click the button below to create a new password:
                    </p>
                    
                    <!-- Button -->
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{{RESET_URL}}" style="background: #dc3545; color: white; padding: 16px 40px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3); text-transform: uppercase; letter-spacing: 1px;">
                            Reset Password
                        </a>
                    </div>
                    
                    <p style="color: #6c757d; font-size: 14px; line-height: 1.5; margin: 20px 0 0 0;">
                        This link will expire in 15 minutes for security reasons.
                    </p>
                    
                    <p style="color: #6c757d; font-size: 14px; line-height: 1.5; margin: 10px 0 0 0;">
                        If you didn't request this, please ignore this email.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #dee2e6;">
                    <p style="margin: 0; color: #6c757d; font-size: 12px;">
                        This email was sent to {{TO_EMAIL}}
                    </p>
                </div>
            </div>
        </body>
        </html>
        """;

        return htmlTemplate.replace("{{RESET_URL}}", resetUrl)
                .replace("{{TO_EMAIL}}", toEmail);
    }

    private String buildInvitationHtmlContent(String signupUrl, String toEmail) {
        String htmlTemplate = """
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to RehabGait</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                    <!-- Header -->
                    <div style="text-align: center; padding: 40px 20px; color: white;">
                        <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                            Welcome to RehabGait
                        </h1>
                        <p style="margin: 8px 0 0 0; font-size: 18px; opacity: 0.9;">
                            Your journey to better mobility starts here
                        </p>
                    </div>
                   
                    <!-- Main Content -->
                    <div style="background: white; padding: 40px 30px; border-radius: 12px 12px 0 0; box-shadow: 0 -4px 20px rgba(0,0,0,0.1);">
                        <h2 style="color: #2d3748; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">
                            You're Invited! 🎉
                        </h2>
                        
                        <p style="color: #4a5568; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                            You've been invited to join <strong>RehabGait</strong>. We're excited to have you on board! 
                            Click the button below to complete your account setup and start your journey.
                        </p>
                        
                        <!-- CTA Button -->
                        <div style="text-align: center; margin: 32px 0;">
                            <a href="{{SIGNUP_URL}}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                                Complete Your Setup
                            </a>
                        </div>
                        
                        <div style="background: #f7fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 24px 0;">
                            <h3 style="color: #2d3748; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
                                What's Next?
                            </h3>
                            <ul style="color: #4a5568; margin: 0; padding-left: 20px;">
                                <li style="margin-bottom: 8px;">Choose your unique username</li>
                                <li style="margin-bottom: 8px;">Create a secure password</li>
                                <li style="margin-bottom: 8px;">Complete your profile setup</li>
                                <li>Start exploring RehabGait features</li>
                            </ul>
                        </div>
                        
                        <p style="color: #718096; font-size: 14px; margin: 24px 0 0 0; line-height: 1.5;">
                            If you have any questions or need assistance, feel free to reach out to our support team. 
                            We're here to help you every step of the way!
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background: #2d3748; color: #a0aec0; padding: 24px 30px; text-align: center; border-radius: 0 0 12px 12px;">
                        <p style="margin: 0; font-size: 14px;">
                            Best regards,<br>
                            <strong style="color: white;">The RehabGait Team</strong>
                        </p>
                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #4a5568;">
                            <p style="margin: 0; font-size: 12px; opacity: 0.7;">
                                This invitation was sent to {{TO_EMAIL}}<br>
                                If you didn't expect this invitation, you can safely ignore this email.
                            </p>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """;

        return htmlTemplate.replace("{{SIGNUP_URL}}", signupUrl)
                .replace("{{TO_EMAIL}}", toEmail);
    }

    // Text fallback methods
    private String buildInvitationTextContent(String signupUrl, String toEmail) {
        return """
            Welcome to RehabGait
            
            You're Invited!
            
            You've been invited to join RehabGait. We're excited to have you on board!
            
            To complete your account setup, please visit:
            %s
            
            What's Next?
            • Choose your unique username
            • Create a secure password
            • Complete your profile setup
            • Start exploring RehabGait features
            
            If you have any questions or need assistance, feel free to reach out to our support team.
            
            Best regards,
            The RehabGait Team
            
            This invitation was sent to %s
            If you didn't expect this invitation, you can safely ignore this email.
            """.formatted(signupUrl, toEmail);
    }

    private String buildPasswordResetTextContent(String resetUrl, String toEmail) {
        return """
            Reset Your Password
            
            You requested to reset your password for your RehabGait account.
            
            To create a new password, please visit:
            %s
            
            This link will expire in 15 minutes for security reasons.
            
            If you didn't request this, please ignore this email.
            
            This email was sent to %s
            """.formatted(resetUrl, toEmail);
    }
}