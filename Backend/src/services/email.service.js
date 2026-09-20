const nodemailer = require("nodemailer");
const path = require("path");
const {
  createVerificationEmailTemplate,
  createPasswordResetTemplate,
  createAccountActivationTemplate,
} = require("../emails/templates/authEmail.templates");

const {
  createEquipmentRequestReceivedTemplate,
  createEquipmentStatusTemplate,
} = require("../emails/templates/equipmentEmail.templates");

const {
  createJobRequestReceivedTemplate,
  createJobRequestStatusTemplate,
} = require("../emails/templates/jobEmail.templates");

const {
  createContactMessageReceivedTemplate,
} = require("../emails/templates/contactEmail.templates");

// ==================== Create Transporter ====================

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,

    port: Number(process.env.EMAIL_PORT),

    secure: process.env.EMAIL_SECURE === "true",

    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },

    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
};

const transporter = createTransporter();

// ==================== Send Email ====================

const sendEmail = async ({ to, subject, text, html, replyTo }) => {
  const mailOptions = {
    from: `"${process.env.EMAIL_FROM_NAME || "LSA"}" <${
      process.env.EMAIL_FROM || process.env.EMAIL_USER
    }>`,
    to,
    subject,
    text,
    html,
  };

  if (replyTo) {
    mailOptions.replyTo = replyTo;
  }

  return transporter.sendMail(mailOptions);
};

// ==================== Verify Email Connection ====================

const verifyEmailConnection = async () => {
  await transporter.verify();

  console.log("Email server connected successfully");
};

// ==================== Send Password Reset Email ====================

const sendPasswordResetEmail = async ({ to, firstName, resetUrl }) => {
  const subject = "Reset Your LSA Password";

  const text = `
Hello ${firstName || "User"},

We received a request to reset your LSA account password.

Reset your password using this link:

${resetUrl}

This link expires in 15 minutes.

If you did not request this action, you can safely ignore this email.
  `.trim();

  const html = createPasswordResetTemplate({
    fullName: firstName,
    resetUrl,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Signup Verification Email ====================

const sendSignupVerificationEmail = async ({
  to,
  fullName,
  verificationCode,
}) => {
  const subject = "Verify Your LSA Account";

  const text = `
Hello ${fullName || "User"},

Your LSA account verification code is:

${verificationCode}

This code expires in 10 minutes.
    `.trim();

  const html = createVerificationEmailTemplate({
    title: "Verify Your Account",
    fullName,
    description:
      "Use the verification code below to confirm your email address and activate your account.",
    verificationCode,
    expirationText:
      "This verification code expires in 10 minutes and can only be used once.",
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Password Change Verification Email ====================

const sendPasswordChangeVerificationEmail = async ({
  to,
  fullName,
  verificationCode,
}) => {
  const subject = "Confirm Your LSA Password Change";

  const text = `
Hello ${fullName || "User"},

Your password change verification code is:

${verificationCode}

This code expires in 10 minutes.

Do not share this code with anyone.
    `.trim();

  const html = createVerificationEmailTemplate({
    title: "Confirm Password Change",
    fullName,
    description:
      "We received a request to change your account password. Use the secure code below to confirm this action.",
    verificationCode,
    expirationText:
      "This code expires in 10 minutes. Do not share it with anyone.",
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Email Change Verification Email ====================

const sendEmailChangeVerificationEmail = async ({
  to,
  fullName,
  verificationCode,
}) => {
  const subject = "Confirm Your New LSA Email Address";

  const text = `
Hello ${fullName || "User"},

Your email change verification code is:

${verificationCode}

This code expires in 10 minutes.

Do not share this code with anyone. If you did not request this change, you can safely ignore this email — your current sign-in email remains unchanged.
    `.trim();

  const html = createVerificationEmailTemplate({
    title: "Confirm Your New Email",
    fullName,
    description:
      "We received a request to change the email address on your account to this one. Use the secure code below to confirm this address.",
    verificationCode,
    expirationText:
      "This code expires in 10 minutes. Do not share it with anyone.",
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Account Activation Email ====================

const sendAccountActivationEmail = async ({ to, fullName, activationUrl }) => {
  const subject = "Activate Your LSA Account";

  const text = `
Hello ${fullName || "User"},

An administrator created an LSA dashboard account for you.

Activate your account using this link:

${activationUrl}

This link expires in 24 hours.
    `.trim();

  const html = createAccountActivationTemplate({
    fullName,
    activationUrl,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Equipment Request Received Email ====================

const sendEquipmentRequestReceivedEmail = async ({
  to,
  fullName,
  requestId,
  equipmentTitle,
  company,
  workLocation,
  estimatedRequiredDays,
}) => {
  const subject = "LSA Equipment Request Received";

  const text = `
Hello ${fullName || "Customer"},

Your equipment request has been received.

Equipment: ${equipmentTitle}
Company: ${company}
Work Location: ${workLocation}
Required Days: ${estimatedRequiredDays}
Reference ID: ${requestId}

Our equipment team will contact you shortly.
    `.trim();

  const html = createEquipmentRequestReceivedTemplate({
    fullName,
    requestId,
    equipmentTitle,
    company,
    workLocation,
    estimatedRequiredDays,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Equipment Request Status Email ====================

const sendEquipmentRequestStatusEmail = async ({
  to,
  fullName,
  equipmentTitle,
  status,
}) => {
  const subjects = {
    approved: "Your LSA Equipment Request Was Approved",
    rejected: "Update Regarding Your LSA Equipment Request",
    completed: "Your LSA Equipment Request Was Completed",
  };

  const subject = subjects[status];

  if (!subject) {
    return null;
  }

  const html = createEquipmentStatusTemplate({
    fullName,
    equipmentTitle,
    status,
  });

  const text = `
Hello ${fullName || "Customer"},

Your equipment request status is now: ${status}.

Equipment: ${equipmentTitle}

Thank you,
LSA Team
    `.trim();

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Job Request Received Email ====================

const sendJobRequestReceivedEmail = async ({
  to,
  fullName,
  jobTitle,
  requestId,
}) => {
  const subject = `Application Received — ${jobTitle}`;

  const text = `
Hello ${fullName || "Applicant"},

Your application for ${jobTitle} has been received.

Application ID: ${requestId}

Our Human Resources team will review your application.
    `.trim();

  const html = createJobRequestReceivedTemplate({
    fullName,
    jobTitle,
    requestId,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Job Request Status Email ====================

const sendJobRequestStatusEmail = async ({
  to,
  fullName,
  jobTitle,
  status,
}) => {
  const subjects = {
    accepted: `Application Accepted — ${jobTitle}`,
    rejected: `Application Update — ${jobTitle}`,
  };

  const subject = subjects[status];

  if (!subject) {
    return null;
  }

  const html = createJobRequestStatusTemplate({
    fullName,
    jobTitle,
    status,
  });

  const text = `
Hello ${fullName || "Applicant"},

Your application status for ${jobTitle} is now: ${status}.

Best regards,
LSA Human Resources Team
    `.trim();

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Send Contact Message Received Email ====================

const sendContactMessageReceivedEmail = async ({
  to,
  fullName,
  service,
  messageId,
}) => {
  const subject = "Your Inquiry Has Been Received by LSA";

  const text = `
Hello ${fullName || "Customer"},

Thank you for contacting LSA.

Service: ${service}
Reference ID: ${messageId}

Our team will review your inquiry and contact you shortly.
    `.trim();

  const html = createContactMessageReceivedTemplate({
    fullName,
    service,
    messageId,
  });

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// ==================== Exports ====================

module.exports = {
  sendEmail,
  verifyEmailConnection,

  sendPasswordResetEmail,
  sendSignupVerificationEmail,
  sendPasswordChangeVerificationEmail,
  sendEmailChangeVerificationEmail,
  sendAccountActivationEmail,

  sendEquipmentRequestReceivedEmail,
  sendEquipmentRequestStatusEmail,

  sendJobRequestReceivedEmail,
  sendJobRequestStatusEmail,

  sendContactMessageReceivedEmail,
};
