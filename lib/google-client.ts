import { google } from "googleapis";

// Shared authenticated Google Sheets client (OAuth refresh-token flow).
// Used by lib/sheets.ts and lib/carry-forward.ts.
export function getGoogleSheetsClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
  });

  return google.sheets({ version: "v4", auth: oauth2Client });
}
