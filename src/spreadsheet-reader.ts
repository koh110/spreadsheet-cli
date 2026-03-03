import { google } from 'googleapis';
import type { Profile } from './profile-manager.ts';

function getAuth(profile: Profile) {
  switch (profile.authType) {
    case 'apiKey':
      return profile.apiKey;
    case 'serviceAccount':
      return new google.auth.JWT({
        email: profile.clientEmail,
        key: profile.privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
    case 'adc':
      return new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
    default:
      throw new Error('Profile has invalid authentication configuration');
  }
}

async function readSpreadsheet(
  spreadsheetId: string,
  range: string,
  profile: Profile
) {
  const auth = getAuth(profile);
  const sheets = google.sheets({ version: 'v4', auth });

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read spreadsheet with profile "${profile.name}": ${message}`);
  }
}

async function readWithFallback(
  spreadsheetId: string,
  range: string,
  profiles: Profile[]
) {
  let lastError: Error | null = null;

  for (const profile of profiles) {
    try {
      const data = await readSpreadsheet(spreadsheetId, range, profile);
      return { data, profile };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`✗ Failed with profile "${profile.name}": ${message}`);
      lastError = error instanceof Error ? error : new Error(message);
    }
  }

  throw new Error(
    `All profiles failed to read the spreadsheet. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

export function createSpreadsheetReader() {
  return { readSpreadsheet, readWithFallback };
}
