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

// ==================== Job Request Received ====================

const createJobRequestReceivedTemplate = ({
  fullName,
  jobTitle,
  requestId,
}) => {
  const content = `
    ${createEmailHeading({
      eyebrow: "Application confirmation",
      title: "Application Successfully Received",
      description:
        "Thank you for your interest in joining LSA. Your application and CV have been received.",
    })}

    <p
      style="
        margin: 0;
        color: ${EMAIL_THEME.colors.text};
        font-size: 16px;
        line-height: 1.8;
      "
    >
      Hello <strong>${formatFullName(fullName, "Applicant")}</strong>,
      our Human Resources team will review your qualifications against the role requirements.
    </p>

    ${createInformationCard({
      title: "Application Details",
      rows: [
        {
          label: "Position",
          value: formatEmailValue(jobTitle),
        },
        {
          label: "Application ID",
          value: formatIdentifier(requestId),
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
      Candidates whose experience matches the requirements will be contacted regarding the next stage.
    </p>
  `;

  return createBaseEmailLayout({
    title: "Application Received",
    eyebrow: "LSA Careers",
    preheader:
      "Your application has been received by the LSA Human Resources team.",
    content,
  });
};

// ==================== Job Status Template ====================

const createJobRequestStatusTemplate = ({ fullName, jobTitle, status }) => {
  const statusConfig = {
    accepted: {
      title: "Congratulations — Application Accepted",
      description:
        "We are pleased to inform you that your application has been accepted. Our Human Resources team will contact you with the next steps.",
    },

    rejected: {
      title: "Application Update",
      description:
        "Thank you for your interest in joining LSA. After careful review, we will not be progressing your application for this opportunity.",
    },
  };

  const config = statusConfig[status];

  if (!config) {
    return null;
  }

  const content = `
    ${createEmailHeading({
      eyebrow: "Recruitment update",
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
      Hello <strong>${formatFullName(fullName, "Applicant")}</strong>,
    </p>

    ${createInformationCard({
      title: "Position",
      rows: [
        {
          label: "Job Title",
          value: formatEmailValue(jobTitle),
        },
        {
          label: "Application Status",
          value: status.toUpperCase(),
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
      Best regards,<br />
      <strong>LSA Human Resources Team</strong>
    </p>
  `;

  return createBaseEmailLayout({
    title: config.title,
    eyebrow: "LSA Careers",
    preheader: config.description,
    content,
  });
};

// ==================== Exports ====================

module.exports = {
  createJobRequestReceivedTemplate,
  createJobRequestStatusTemplate,
};
