import { google } from "googleapis";

// Separate OAuth client for Drive, deliberately using its own env vars
// (GOOGLE_DRIVE_OAUTH_*) so it can't collide with the Sheets client in
// lib/google-client.ts.
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

async function findOrCreateSkuFolder(drive: ReturnType<typeof getDriveClient>, sku: string): Promise<string> {
  const parentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

  const existing = await drive.files.list({
    q: `'${parentId}' in parents and name = '${sku}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
  });

  const found = existing.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name: sku,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  if (!created.data.id) throw new Error("Drive didn't return a folder id.");
  return created.data.id;
}

export async function uploadListingTextFile(sku: string, filename: string, content: string): Promise<string> {
  const drive = getDriveClient();
  const folderId = await findOrCreateSkuFolder(drive, sku);

  const uploaded = await drive.files.create({
    requestBody: { name: filename, parents: [folderId] },
    media: { mimeType: "text/plain", body: content },
    fields: "webViewLink",
  });

  return uploaded.data.webViewLink ?? "";
}
