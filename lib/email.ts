import nodemailer from 'nodemailer';

// Sends via the Gmail account named in GMAIL_USER, authenticated with a Gmail
// "App Password" (GMAIL_APP_PASSWORD). Both are set in Vercel. If either is
// missing we degrade gracefully rather than throwing at import time.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const REPORT_RECIPIENTS = ['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com'];
const ALERT_RECIPIENTS = ['erykpawluk@gmail.com'];

function getTransport() {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

export async function sendMonthlyReportEmail(monthLabel: string, pdfBuffer: Buffer) {
  const transport = getTransport();
  if (!transport) {
    const error = 'Gmail email not configured (missing GMAIL_USER / GMAIL_APP_PASSWORD).';
    console.error(error);
    return { error };
  }

  try {
    const info = await transport.sendMail({
      from: `Task OS <${GMAIL_USER}>`,
      to: REPORT_RECIPIENTS,
      subject: `Monthly Report: ${monthLabel}`,
      text: `Please find attached the closed analytics report for ${monthLabel}.`,
      attachments: [
        {
          filename: `${monthLabel.replace(/\s+/g, '_')}_Report.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    return { data: info };
  } catch (error) {
    console.error('Failed to send monthly report email:', error);
    return { error };
  }
}

export async function sendErrorAlertEmail(phase: string, errorMessage: string) {
  const transport = getTransport();
  if (!transport) {
    console.error('Cannot send alert email — Gmail email not configured.');
    return;
  }

  try {
    await transport.sendMail({
      from: `Task OS <${GMAIL_USER}>`,
      to: ALERT_RECIPIENTS,
      subject: `🚨 SYSTEM ALERT: Monthly Rollover Failed (${phase})`,
      text: `The automated monthly rollover cron job caught an error during ${phase}.\n\nError Details:\n${errorMessage}\n\nPlease check Vercel logs and Supabase.`,
    });
  } catch (err) {
    console.error('Failed to send alert email:', err);
  }
}
