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

// ==================== Equipment Request Received ====================

const createEquipmentRequestReceivedTemplate = ({
  fullName,
  requestId,
  equipmentTitle,
  company,
  workLocation,
  estimatedRequiredDays,
}) => {
  const { colors } = EMAIL_THEME;

  const content = `
    ${createEmailHeading({
      eyebrow: "Request confirmation",
      title: "Equipment Request Received",
      description:
        "Your request has been successfully submitted to our equipment team.",
    })}

    <p
      style="
        margin: 0;
        color: ${colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      Hello <strong>${formatFullName(fullName)}</strong>,
      thank you for contacting LSA. Our specialists will review your requirements and contact you shortly.
    </p>

    ${createInformationCard({
      title: "Request Details",
      rows: [
        {
          label: "Reference ID",
          value: formatIdentifier(requestId),
        },
        {
          label: "Equipment",
          value: formatEmailValue(equipmentTitle),
        },
        {
          label: "Company",
          value: formatEmailValue(company),
        },
        {
          label: "Work Location",
          value: formatEmailValue(workLocation),
        },
        {
          label: "Required Duration",
          value: `${formatEmailValue(estimatedRequiredDays)} day(s)`,
        },
      ],
    })}

    <p
      style="
        margin: 0;
        color: ${colors.text};
        font-size: 15px;
        line-height: 1.8;
      "
    >
      Additional details may be requested before availability, pricing and scheduling are confirmed.
    </p>
  `;

  return createBaseEmailLayout({
    title: "Equipment Request Received",
    eyebrow: "Equipment Services",
    preheader: "Your LSA equipment request has been received.",
    content,
  });
};

// ==================== Equipment Status Template ====================

const createEquipmentStatusTemplate = ({
  fullName,
  equipmentTitle,
  status,
}) => {
  const statusConfig = {
    approved: {
      eyebrow: "Request approved",
      title: "Your Request Has Been Approved",
      description:
        "Our team will contact you to finalize scheduling, commercial terms and operational arrangements.",
    },

    rejected: {
      eyebrow: "Request update",
      title: "Update Regarding Your Request",
      description:
        "We are unable to approve this equipment request at the present time. Our team remains available to discuss alternative solutions.",
    },

    completed: {
      eyebrow: "Request completed",
      title: "Your Request Has Been Completed",
      description:
        "Your equipment request has been successfully completed. Thank you for choosing LSA.",
    },
  };

  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  const content = `
    ${createEmailHeading({
      eyebrow: config.eyebrow,
      title: config.title,
      description: config.description,
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
    </p>

    ${createInformationCard({
      title: "Equipment Information",
      rows: [
        {
          label: "Equipment",
          value: formatEmailValue(equipmentTitle),
        },
        {
          label: "Current Status",
          value: status.toUpperCase(),
        },
      ],
    })}
  `;

  return createBaseEmailLayout({
    title: config.title,
    eyebrow: "Equipment Request",
    preheader: config.description,
    content,
  });
};

// ==================== Exports ====================

module.exports = {
  createEquipmentRequestReceivedTemplate,
  createEquipmentStatusTemplate,
};
