const EMAIL_THEME = require("../config/emailTheme");

// ==================== Escape HTML ====================

const escapeHtml = (value = "") => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ==================== Base Email Layout ====================

const createBaseEmailLayout = ({
  title,
  eyebrow = "LSA Notification",
  preheader = "",
  content,
  footerText = "This is an automated message. Please do not reply to this email.",
}) => {
  const {
    colors,
    typography,
    company,
  } = EMAIL_THEME;

  return `
    <!DOCTYPE html>

    <html lang="en">

      <head>

        <meta charset="UTF-8" />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <meta
          name="x-apple-disable-message-reformatting"
        />

        <title>${escapeHtml(title)}</title>

      </head>

      <body
        style="
          margin: 0;
          padding: 0;
          background-color: ${colors.background};
          font-family: ${typography.fontFamily};
          -webkit-font-smoothing: antialiased;
        "
      >

        <!-- Preheader -->

        <div
          style="
            display: none;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            color: transparent;
          "
        >
          ${escapeHtml(preheader)}
        </div>


        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            width: 100%;
            background-color: ${colors.background};
          "
        >

          <tr>

            <td
              align="center"
              style="
                padding: 20px 12px;
              "
            >

              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width: 100%;
                  max-width: 580px;
                "
              >

                <tr>

                  <td
                    style="
                      overflow: hidden;
                      background-color: ${colors.surface};
                      border: 1px solid ${colors.border};
                      border-radius: 14px;
                    "
                  >

                    <table
                      role="presentation"
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                    >

                      <!-- Header -->

                      <tr>

                        <td
                          style="
                            padding: 18px 24px;
                            background-color: ${colors.primary};
                            border-bottom: 3px solid ${colors.secondary};
                          "
                        >

                          <table
                            role="presentation"
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                          >

                            <tr>

                              <td
                                valign="middle"
                              >

${
  company.logo?.url
    ? `
<img
  src="${escapeHtml(company.logo.url)}"
  width="${company.logo.width}"
  alt="${escapeHtml(company.logo.alt)}"
  border="0"
  style="
    display: block;
    width: ${company.logo.width}px;
    max-width: ${company.logo.width}px;
    height: auto;
    border: 0;
    outline: none;
    text-decoration: none;
  "
/>
    `
    : ""
}
                              </td>


                              <td
                                align="right"
                                valign="middle"
                                style="
                                  padding-left: 16px;
                                "
                              >

                                <p
                                  style="
                                    margin: 0 0 3px;
                                    color: ${colors.white};
                                    font-size: 13px;
                                    line-height: 1.3;
                                    font-weight: 700;
                                  "
                                >
                                  ${escapeHtml(company.name)}
                                </p>

                                <p
                                  style="
                                    margin: 0;
                                    color: rgba(255, 255, 255, 0.70);
                                    font-size: 10px;
                                    line-height: 1.4;
                                  "
                                >
                                  ${escapeHtml(company.tagline)}
                                </p>

                              </td>

                            </tr>

                          </table>

                        </td>

                      </tr>


                      <!-- Content -->

                      <tr>

                        <td
                          style="
                            padding: 28px 30px;
                          "
                        >

                          ${
                            eyebrow
                              ? `
                                <p
                                  style="
                                    margin: 0 0 18px;
                                    color: ${colors.muted};
                                    font-size: 10px;
                                    font-weight: 700;
                                    letter-spacing: 1.4px;
                                    text-transform: uppercase;
                                  "
                                >
                                  ${escapeHtml(eyebrow)}
                                </p>
                              `
                              : ""
                          }

                          ${content}

                        </td>

                      </tr>


                      <!-- Footer -->

                      <tr>

                        <td
                          align="center"
                          style="
                            padding: 16px 24px;
                            background-color: ${colors.softSurface};
                            border-top: 1px solid ${colors.border};
                          "
                        >

                          <p
                            style="
                              margin: 0;
                              color: ${colors.muted};
                              font-size: 10px;
                              line-height: 1.5;
                            "
                          >
                            ${escapeHtml(footerText)}
                          </p>

                          <p
                            style="
                              margin: 5px 0 0;
                              color: ${colors.muted};
                              font-size: 10px;
                              line-height: 1.5;
                            "
                          >
                            © ${new Date().getFullYear()}
                            ${escapeHtml(company.name)}.
                            All rights reserved.
                          </p>

                        </td>

                      </tr>

                    </table>

                  </td>

                </tr>

              </table>

            </td>

          </tr>

        </table>

      </body>

    </html>
  `;
};

// ==================== Email Heading ====================

const createEmailHeading = ({
  eyebrow,
  title,
  description,
}) => {
  const { colors } = EMAIL_THEME;

  return `
    ${
      eyebrow
        ? `
          <p
            style="
              margin: 0 0 6px;
              color: ${colors.secondary};
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 1.2px;
              text-transform: uppercase;
            "
          >
            ${escapeHtml(eyebrow)}
          </p>
        `
        : ""
    }

    <h2
      style="
        margin: 0 0 10px;
        color: ${colors.heading};
        font-size: 22px;
        line-height: 1.3;
        font-weight: 700;
      "
    >
      ${escapeHtml(title)}
    </h2>

    ${
      description
        ? `
          <p
            style="
              margin: 0 0 18px;
              color: ${colors.text};
              font-size: 14px;
              line-height: 1.65;
            "
          >
            ${description}
          </p>
        `
        : ""
    }
  `;
};

// ==================== Email Button ====================

const createEmailButton = ({
  label,
  url,
}) => {
  const { colors } = EMAIL_THEME;

  return `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        margin: 20px 0;
      "
    >

      <tr>

        <td>

          <a
            href="${escapeHtml(url)}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              display: inline-block;
              padding: 11px 20px;
              color: ${colors.white};
              background-color: ${colors.secondary};
              border-radius: 7px;
              text-decoration: none;
              font-size: 13px;
              font-weight: 700;
              line-height: 1.2;
            "
          >
            ${escapeHtml(label)}
          </a>

        </td>

      </tr>

    </table>
  `;
};

// ==================== Information Card ====================

const createInformationCard = ({
  title = "Details",
  rows = [],
}) => {
  const { colors } = EMAIL_THEME;

  const visibleRows = rows.filter(
    (row) =>
      row &&
      row.label &&
      row.value !== undefined &&
      row.value !== null &&
      row.value !== "",
  );

  if (!visibleRows.length) {
    return "";
  }

  return `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        width: 100%;
        margin: 18px 0;
        background-color: ${colors.softSurface};
        border: 1px solid ${colors.border};
        border-radius: 10px;
      "
    >

      <tr>

        <td
          style="
            padding: 16px 18px;
          "
        >

          <p
            style="
              margin: 0 0 8px;
              color: ${colors.primary};
              font-size: 13px;
              line-height: 1.4;
              font-weight: 700;
            "
          >
            ${escapeHtml(title)}
          </p>


          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            border="0"
          >

            ${visibleRows
              .map(
                (row, index) => `
                  <tr>

                    <td
                      valign="top"
                      style="
                        width: 42%;
                        padding: 7px 0;
                        color: ${colors.muted};
                        border-top: ${
                          index === 0
                            ? "none"
                            : `1px solid ${colors.lightBorder}`
                        };
                        font-size: 11px;
                        line-height: 1.5;
                      "
                    >
                      ${escapeHtml(row.label)}
                    </td>


                    <td
                      align="right"
                      valign="top"
                      style="
                        padding: 7px 0;
                        color: ${colors.heading};
                        border-top: ${
                          index === 0
                            ? "none"
                            : `1px solid ${colors.lightBorder}`
                        };
                        font-size: 12px;
                        line-height: 1.5;
                        font-weight: 600;
                        word-break: break-word;
                      "
                    >
                      ${escapeHtml(row.value)}
                    </td>

                  </tr>
                `,
              )
              .join("")}

          </table>

        </td>

      </tr>

    </table>
  `;
};

// ==================== Verification Code Card ====================

const createVerificationCodeCard = ({
  verificationCode,
}) => {
  const { colors } = EMAIL_THEME;

  return `
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        width: 100%;
        margin: 20px 0;
        background-color: ${colors.softSurface};
        border: 1px solid ${colors.border};
        border-radius: 10px;
      "
    >

      <tr>

        <td
          align="center"
          style="
            padding: 18px 16px;
          "
        >

          <p
            style="
              margin: 0 0 7px;
              color: ${colors.muted};
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 1.2px;
              text-transform: uppercase;
            "
          >
            Verification Code
          </p>


          <p
            style="
              margin: 0;
              color: ${colors.primary};
              font-size: 30px;
              line-height: 1.2;
              font-weight: 800;
              letter-spacing: 7px;
            "
          >
            ${escapeHtml(verificationCode)}
          </p>

        </td>

      </tr>

    </table>
  `;
};

// ==================== Exports ====================

module.exports = {
  createBaseEmailLayout,
  createEmailHeading,
  createEmailButton,
  createInformationCard,
  createVerificationCodeCard,
};