const EMAIL_THEME = require("../config/emailTheme");

const { escapeHtml, formatFullName } = require("../helpers/email.helper");

const {
  createBaseEmailLayout,
  createEmailHeading,
  createEmailButton,
  createVerificationCodeCard,
} = require("../layouts/baseEmail.layout");

// ==================== Verification Email Template ====================

const createVerificationEmailTemplate = ({
  title,
  fullName,
  description,
  verificationCode,
  expirationText,
}) => {
  const { colors } = EMAIL_THEME;

  const content = `
    ${createEmailHeading({
      eyebrow: "Secure verification",
      title,
    })}

    <p
      style="
        margin: 0 0 16px;
        color: ${colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      Hello <strong>${formatFullName(fullName, "User")}</strong>,
    </p>

    <p
      style="
        margin: 0;
        color: ${colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      ${escapeHtml(description)}
    </p>

    ${createVerificationCodeCard({
      verificationCode,
    })}

    <p
      style="
        margin: 0 0 10px;
        color: ${colors.text};
        font-size: 14px;
        line-height: 1.8;
      "
    >
      ${escapeHtml(expirationText)}
    </p>

    <p
      style="
        margin: 0;
        color: ${colors.muted};
        font-size: 13px;
        line-height: 1.8;
      "
    >
      If you did not request this action, you can safely ignore this email.
    </p>
  `;

  return createBaseEmailLayout({
    title,
    eyebrow: "Account Security",
    preheader: description,
    content,
  });
};

// ==================== Password Reset Template ====================

const createPasswordResetTemplate = ({ fullName, resetUrl }) => {
  const { colors } = EMAIL_THEME;

  const content = `
    ${createEmailHeading({
      eyebrow: "Account security",
      title: "Reset Your Password",
      description: "We received a request to reset your LSA account password.",
    })}

    <p
      style="
        margin: 0;
        color: ${colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      Hello <strong>${formatFullName(fullName, "User")}</strong>,
      click the button below to create a new password.
    </p>

    ${createEmailButton({
      label: "Reset Password",
      url: resetUrl,
    })}

    <p
      style="
        margin: 0 0 12px;
        color: ${colors.text};
        font-size: 14px;
        line-height: 1.8;
      "
    >
      This secure link expires in 15 minutes.
    </p>

    <p
      style="
        margin: 0 0 8px;
        color: ${colors.muted};
        font-size: 13px;
        line-height: 1.7;
      "
    >
      If the button does not work, copy and paste this address into your browser:
    </p>

    <p
      style="
        margin: 0;
        color: ${colors.primary};
        font-size: 12px;
        line-height: 1.7;
        word-break: break-all;
      "
    >
      ${escapeHtml(resetUrl)}
    </p>
  `;

  return createBaseEmailLayout({
    title: "Reset Your Password",
    eyebrow: "Password Reset",
    preheader: "Use the secure link to reset your LSA account password.",
    content,
  });
};

// ==================== Account Activation Template ====================

const createAccountActivationTemplate = ({ fullName, activationUrl }) => {
  const { colors } = EMAIL_THEME;

  const content = `
    ${createEmailHeading({
      eyebrow: "Welcome to LSA",
      title: "Activate Your Dashboard Account",
      description:
        "An administrator has created an LSA dashboard account for you.",
    })}

    <p
      style="
        margin: 0;
        color: ${colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      Hello <strong>${formatFullName(fullName, "User")}</strong>,
      activate your account and create your secure password using the button below.
    </p>

    ${createEmailButton({
      label: "Activate Account",
      url: activationUrl,
    })}

    <p
      style="
        margin: 0 0 12px;
        color: ${colors.text};
        font-size: 14px;
        line-height: 1.8;
      "
    >
      This activation link expires in 24 hours.
    </p>

    <p
      style="
        margin: 0;
        color: ${colors.primary};
        font-size: 12px;
        line-height: 1.7;
        word-break: break-all;
      "
    >
      ${escapeHtml(activationUrl)}
    </p>
  `;

  return createBaseEmailLayout({
    title: "Activate Your LSA Account",
    eyebrow: "Account Activation",
    preheader: "Activate your new LSA dashboard account.",
    content,
  });
};

// ==================== Exports ====================

module.exports = {
  createVerificationEmailTemplate,
  createPasswordResetTemplate,
  createAccountActivationTemplate,
};
