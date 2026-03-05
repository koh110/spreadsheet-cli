import { parseArgs } from 'node:util';
import type { createProfileManager } from './profile-manager.ts';
import { createProfileInteractive, addProfileCommand } from './interactive.ts';
import { createSpreadsheetReader } from './spreadsheet-reader.ts';

type ProfileManager = Awaited<ReturnType<typeof createProfileManager>>;


export async function handleReadCommand(profileManager: ProfileManager) {
  const reader = await createSpreadsheetReader()
  const { values } = parseArgs({
    allowPositionals: true,
    options: {
      'spreadsheet-id': { type: 'string', short: 's' },
      'range': { type: 'string', short: 'r', default: 'Sheet1' },
      'profile': { type: 'string', short: 'p' },
      'format': { type: 'string', short: 'f', default: 'table' }
    },
    strict: true
  });

  if (!values['spreadsheet-id']) {
    console.error('Error: --spreadsheet-id (-s) is required for read command');
    process.exit(1);
  }

  try {
    // Check if profiles exist, if not, create one interactively
    if (!profileManager.hasProfiles()) {
      await createProfileInteractive(profileManager);
    }

    const profiles = (() => {
      if (values.profile) {
        const profile = profileManager.getProfile(values.profile);
        if (!profile) {
          console.error(`Error: Profile "${values.profile}" not found`);
          process.exit(1);
        }
        return [profile];
      }
      return profileManager.getProfilesSortedByPriority();
    })();

    if (profiles.length === 0) {
      console.error('Error: No profiles available');
      process.exit(1);
    }

    const { data, profile } = await reader.readWithFallback(
      values['spreadsheet-id'],
      values.range || 'Sheet1',
      profiles
    );

    console.log(`\nData retrieved using profile: ${profile.name}\n`);

    // Format output
    if (values.format === 'json') {
      console.log(JSON.stringify(data, null, 2));
    } else if (values.format === 'csv') {
      for (const row of data) {
        console.log(row.map(cell => `"${cell}"`).join(','));
      }
    } else {
      // Table format
      for (const row of data) {
        console.log(row.join('\t'));
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

export async function handleProfileClearCommand(profileManager: ProfileManager) {
  try {
    await profileManager.clearProfiles();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

export async function handleProfileAddCommand(profileManager: ProfileManager) {
  try {
    await addProfileCommand(profileManager);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

export function handleProfileListCommand(profileManager: ProfileManager) {
  const profiles = profileManager.getProfiles();
  if (profiles.length === 0) {
    console.log('No profiles found');
    return;
  }

  console.log('\nProfiles:\n');
  for (const profile of profiles) {
    const authType =
      profile.authType === 'apiKey'
        ? 'API Key'
        : profile.authType === 'oauthCredentials'
          ? 'OAuth credentials command'
          : 'Service Account';
    console.log(`  ${profile.name}`);
    console.log(`    Priority: ${profile.priority}`);
    console.log(`    Auth: ${authType}`);
    if (profile.authType === 'oauthCredentials') {
      console.log(`    credentials command: ${profile.command}`);
    }
    console.log();
  }
}

export async function handleProfileRemoveCommand(profileManager: ProfileManager, args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      'name': { type: 'string', short: 'n' }
    },
    strict: true
  });

  if (!values.name) {
    console.error('Error: --name (-n) is required for profile:remove command');
    process.exit(1);
  }

  const success = await profileManager.removeProfile(values.name);
  if (success) {
    console.log(`✓ Profile "${values.name}" removed`);
  } else {
    console.error(`Error: Profile "${values.name}" not found`);
    process.exit(1);
  }
}
