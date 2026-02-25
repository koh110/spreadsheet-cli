import { google } from 'googleapis';
import { Profile } from './types';

export class SpreadsheetReader {
  async readSpreadsheet(spreadsheetId: string, range: string, profile: Profile): Promise<any[][]> {
    let auth;

    if (profile.apiKey) {
      auth = profile.apiKey;
    } else if (profile.clientEmail && profile.privateKey) {
      const jwtClient = new google.auth.JWT({
        email: profile.clientEmail,
        key: profile.privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      auth = jwtClient;
    } else {
      throw new Error(`Profile "${profile.name}" has invalid authentication configuration`);
    }

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error: any) {
      throw new Error(`Failed to read spreadsheet with profile "${profile.name}": ${error.message}`);
    }
  }

  async readWithFallback(
    spreadsheetId: string,
    range: string,
    profiles: Profile[]
  ): Promise<{ data: any[][]; profile: Profile }> {
    let lastError: Error | null = null;

    for (const profile of profiles) {
      try {
        console.log(`Trying profile: ${profile.name} (priority: ${profile.priority})`);
        const data = await this.readSpreadsheet(spreadsheetId, range, profile);
        console.log(`✓ Successfully read with profile: ${profile.name}`);
        return { data, profile };
      } catch (error: any) {
        console.log(`✗ Failed with profile "${profile.name}": ${error.message}`);
        lastError = error;
      }
    }

    throw new Error(
      `All profiles failed to read the spreadsheet. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }
}
