const EMAIL_THEME = require("../config/emailTheme");

const {
  formatEmailValue,
  formatIdentifier,
  formatFullName,
} = require("../helpers/email.helper");

const {
  createBaseEmailLayout,
  createEmailHeading,
  createInformationCard,
} = require("../layouts/baseEmail.layout");

// ==================== Contact Message Received ====================

const createContactMessageReceivedTemplate = ({
  fullName,
  service,
  messageId,
}) => {
  const content = `
    ${createEmailHeading({
      eyebrow: "Inquiry confirmation",
      title: "Your Message Has Been Received",
      description:
        "Thank you for contacting LSA. Your inquiry has been forwarded to the appropriate team.",
    })}

    <p
      style="
        margin: 0;
        color: ${EMAIL_THEME.colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      Hello <strong>${formatFullName(fullName)}</strong>,
      one of our specialists will review your requirements and respond as soon as possible.
    </p>

    ${createInformationCard({
      title: "Inquiry Details",
      rows: [
        {
          label: "Selected Service",
          value: formatEmailValue(service),
        },
        {
          label: "Reference ID",
          value: formatIdentifier(messageId),
        },
      ],
    })}

    <p
      style="
        margin: 0;
        color: ${EMAIL_THEME.colors.text};
        font-size: 15px;
        line-height: 1.8;
      "
    >
      We appreciate your interest in LSA and look forward to supporting your project.
    </p>
  `;

  return createBaseEmailLayout({
    title: "Message Received",
    eyebrow: "Contact LSA",
    preheader: "Your inquiry has been received by the LSA team.",
    content,
  });
};

// ==================== Exports ====================

module.exports = {
  createContactMessageReceivedTemplate,
};
