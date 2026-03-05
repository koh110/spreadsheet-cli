import { spawn } from 'node:child_process';
import { google } from 'googleapis';
import { parseEnv } from 'node:util';
import { TOKEN_PATH } from './config.ts';
import { authenticate } from './google.ts'
import type { Profile } from './profile-manager.ts';

const COMMAND_TIMEOUT_MS = 30_000;

async function getOauthCredentials(command: string) {
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, CI: '1' }
      });

      let output = '';
      let errorOutput = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        child.kill('SIGTERM');
        reject(new Error('command timed out; interactive prompts are not supported'));
      }, COMMAND_TIMEOUT_MS);

      child.stdout.on('data', chunk => {
        output += String(chunk);
      });

      child.stderr.on('data', chunk => {
        errorOutput += String(chunk);
      });

      child.on('error', error => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });

      child.on('close', code => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        if (code !== 0) {
          const stderrMessage = errorOutput.trim();
          reject(
            new Error(
              stderrMessage
                ? `command exited with code ${code}: ${stderrMessage}`
                : `command exited with code ${code}`
            )
          );
          return;
        }
        resolve(output);
      });
    });
    const credentialsText = stdout.trim();
    if (!credentialsText) {
      throw new Error('command returned empty output');
    }
    const parsedEnvValues = parseEnv(credentialsText)
    if (!parsedEnvValues.GOOGLE_CREDENTIALS_JSON) {
      throw new Error('command output did not contain GOOGLE_CREDENTIALS_JSON variable');
    }
    return parsedEnvValues.GOOGLE_CREDENTIALS_JSON;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load OAuth credentials via command: ${message}`);
  }
}

async function getAuth(profile: Profile) {
  switch (profile.authType) {
    case 'apiKey':
      return profile.apiKey;
    case 'serviceAccount':
      return new google.auth.JWT({
        email: profile.clientEmail,
        key: profile.privateKey.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
    case 'oauthCredentials': {
      const result = await authenticate({ tokenPath: TOKEN_PATH, getCredentials: () => getOauthCredentials(profile.command) });
      if (!result.success) {
        throw new Error('Failed to authenticate with OAuth credentials');
      }
      return result.client;
    }
    default:
      throw new Error('Profile has invalid authentication configuration');
  }
}

async function readSpreadsheet(
  spreadsheetId: string,
  range: string,
  profile: Profile
) {
  const auth = await getAuth(profile);
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

  let res: { data: Awaited<ReturnType<typeof readSpreadsheet>>; profile: Profile} | null = null;
  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    try {
      const data = await readSpreadsheet(spreadsheetId, range, profile);
      res = { data, profile }
      break
    } catch (error: unknown) {
      const message = error instanceof Error    ? error.message : String(error);
      console.log(`Failed [${profile.name}]: ${message}`);
      lastError = error instanceof Error ? error : new Error(message);
    }
  }
  if (res !== null) {
    return res
  }

  throw new Error(
    `All profiles failed to read the spreadsheet. Last error: ${lastError?.message || 'Unknown error'}`
  );
}

export function createSpreadsheetReader() {
  return { readSpreadsheet, readWithFallback };
}
