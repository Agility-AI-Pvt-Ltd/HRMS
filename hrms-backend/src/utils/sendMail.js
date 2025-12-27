import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
export const sendRequestNotificationMail = async ({
  to,
  subject,
  title,
  employeeName,
  details,
}) => {
  await transporter.sendMail({
    from: `"HRMS" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:Arial; line-height:1.6">
        <h2>${title}</h2>

        <p><b>Employee:</b> ${employeeName}</p>

        <p><b>Details:</b></p>
        <ul>
          ${details.map(d => `<li>${d}</li>`).join("")}
        </ul>

        <p>
          Please login to HRMS to review this request.
        </p>

        <p>
          <a href="${process.env.FRONTEND_URL}">
            Open HRMS
          </a>
        </p>

        <br/>
        <p>HRMS System</p>
      </div>
    `,
  });
};

export const sendResignationMail = async ({
  to,
  employeeName,
  lastWorking,
  reason,
  subject = "New Resignation Request Submitted"
}) => {
  await transporter.sendMail({
    from: `"HRMS" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html: `
      <div style="font-family:Arial; line-height:1.6;">
        <h2>Resignation Request</h2>

        <p><b>Employee:</b> ${employeeName}</p>
        <p><b>Last Working Day:</b> ${new Date(lastWorking).toLocaleDateString()}</p>
        
        ${reason ? `<p><b>Reason:</b> ${reason}</p>` : ""}

        <p>
          Please login to HRMS to review this resignation request.<br/>
          <a href="${process.env.FRONTEND_URL}" style="color:#4f46e5;font-weight:bold;">
            Open HRMS Portal
          </a>
        </p>

        <br/>
        <p>Regards,<br/>HRMS System</p>
      </div>
    `
  });
};

export const sendResignationStatusMail = async ({
  to,
  employeeName,
  status,
  reason,
}) => {
  await transporter.sendMail({
    from: `"HRMS" <${process.env.SMTP_USER}>`,
    to,
    subject: `Resignation ${status}`,
    html: `
      <div style="font-family:Arial; line-height:1.6;">
        <h2>Resignation Status Update</h2>

        <p><b>Employee:</b> ${employeeName}</p>
        <p><b>Status:</b> ${status}</p>
        ${status === "REJECTED" ? `<p><b>Reason:</b> ${reason}</p>` : ""}

        <p>
          Login to HRMS for more details:
          <a href="${process.env.FRONTEND_URL}" style="color:#4f46e5;font-weight:bold;">
            Open HRMS Portal
          </a>
        </p>

        <br/>
        <p>Regards,<br/>HRMS System</p>
      </div>
    `
  });
};


export const sendUserCredentialsMail = async ({
  to,
  name,
  email,
  password,
}) => {
  await transporter.sendMail({
    from: `"HRMS" <${process.env.SMTP_USER}>`,
    to,
    subject: "Your HRMS Login Credentials",
    html: `
      <div style="font-family:Arial; line-height:1.6">
        <h2>Welcome to HRMS, ${name}</h2>

        <p>Your account has been created by Admin.</p>

        <p><strong>Login Details:</strong></p>
        <ul>
          <li>Email: <b>${email}</b></li>
          <li>Password: <b>${password}</b></li>
        </ul>

        <p>
          Login here:
          <a href="${process.env.FRONTEND_URL}">
            ${process.env.FRONTEND_URL}
          </a>
        </p
        <br/>
        <p>HRMS Team</p>
      </div>
    `,
  });
};
