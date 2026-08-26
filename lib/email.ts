import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMonthlyReportEmail(monthLabel: string, pdfBuffer: Buffer) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Analytics OS <reports@resend.dev>', // Update to a verified domain if available
      to: ['erykpawluk@gmail.com', 'alexandra.ap.archive@gmail.com'],
      subject: `Monthly Report: ${monthLabel}`,
      text: `Please find attached the closed analytics report for ${monthLabel}.`,
      attachments: [
        {
          filename: `${monthLabel.replace(/\s+/g, '_')}_Report.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend Error:", error);
      return { error };
    }
    
    return { data };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { error };
  }
}

export async function sendErrorAlertEmail(phase: string, errorMessage: string) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Analytics OS <alerts@resend.dev>',
      to: ['erykpawluk@gmail.com'], // Only sending alert to the admin
      subject: `🚨 SYSTEM ALERT: Monthly Rollover Failed (${phase})`,
      text: `The automated monthly rollover cron job caught an error during ${phase}.\n\nError Details:\n${errorMessage}\n\nPlease check Vercel logs and Supabase.`,
    });

    if (error) {
      console.error("Resend Alert Error:", error);
    }
  } catch (err) {
    console.error("Failed to send alert email:", err);
  }
}
