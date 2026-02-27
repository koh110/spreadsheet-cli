import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { Profile } from './profile-manager.ts';

export class SpreadsheetReader {
  async readSpreadsheet(spreadsheetId: string, range: string, profile: Profile): Promise<unknown[][]> {
    const auth = (() => {
      switch (profile.authType) {
        case 'apiKey':
          return profile.apiKey;
        case 'serviceAccount': {
          const jwtClient = new google.auth.JWT({
            email: profile.clientEmail,
            key: profile.privateKey.replace(/\\n/g, '\n'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
          });
          return jwtClient;
        }
        case 'oauth': {
          const oauthClient = new google.auth.OAuth2(
            profile.oauthClientId,
            profile.oauthClientSecret
          );
          oauthClient.setCredentials({
            refresh_token: profile.oauthRefreshToken
          });
          return oauthClient;
        }
        default:
          throw new Error('Profile has invalid authentication configuration');
      }
    })()

    const sheets = google.sheets({ version: 'v4', auth });

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      return response.data.values || [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read spreadsheet with profile "${profile.name}": ${message}`);
    }
  }

  async readWithFallback(
    spreadsheetId: string,
    range: string,
    profiles: Profile[]
  ): Promise<{ data: unknown[][]; profile: Profile }> {
    let lastError: Error | null = null;

    for (const profile of profiles) {
      try {
        console.log(`Trying profile: ${profile.name} (priority: ${profile.priority})`);
        const data = await this.readSpreadsheet(spreadsheetId, range, profile);
        console.log(`✓ Successfully read with profile: ${profile.name}`);
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
}
