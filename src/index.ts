#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { createProfileManager } from './profile-manager.ts';
import { createSpreadsheetReader } from './spreadsheet-reader.ts';
import { createProfileInteractive, addProfileCommand } from './interactive.ts';

const profileManager = await createProfileManager();
const reader = createSpreadsheetReader();

function showHelp() {
  console.log(`
Usage: spreadsheet-cli <command> [options]

Commands:
  read                     Read data from a Google Spreadsheet
  profile:add              Add a new profile
  profile:list             List all profiles
  profile:set-default      Set a profile as default
  profile:remove           Remove a profile
  help                     Show this help message

Options for 'read' command:
  -s, --spreadsheet-id <id>  Spreadsheet ID (required)
  -r, --range <range>        Range to read (default: "Sheet1")
  -p, --profile <name>       Profile name to use
  -f, --format <format>      Output format: json|csv|table (default: "table")

Options for 'profile:set-default' and 'profile:remove' commands:
  -n, --name <name>          Profile name (required)

Examples:
  spreadsheet-cli read -s 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms -r "Sheet1!A1:D10"
  spreadsheet-cli profile:add
  spreadsheet-cli profile:list
  spreadsheet-cli profile:set-default -n myprofile
  spreadsheet-cli profile:remove -n myprofile
`);
}

async function handleReadCommand(args: string[]) {
  const { values } = parseArgs({
    args,
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

    let profiles;
    if (values.profile) {
      const profile = profileManager.getProfile(values.profile);
      if (!profile) {
        console.error(`Error: Profile "${values.profile}" not found`);
        process.exit(1);
      }
      profiles = [profile];
    } else {
      // Use default profile first, then try others by priority
      const defaultProfile = profileManager.getDefaultProfile();
      const sortedProfiles = profileManager.getProfilesSortedByPriority();
      
      if (defaultProfile) {
        // Put default first, then others
        profiles = [
          defaultProfile,
          ...sortedProfiles.filter(p => p.name !== defaultProfile.name)
        ];
      } else {
        profiles = sortedProfiles;
      }
    }

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
      data.forEach(row => {
        console.log(row.map(cell => `"${cell}"`).join(','));
      });
    } else {
      // Table format
      data.forEach(row => {
        console.log(row.join('\t'));
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

async function handleProfileAddCommand() {
  try {
    await addProfileCommand(profileManager);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}

function handleProfileListCommand() {
  const profiles = profileManager.getProfiles();
  if (profiles.length === 0) {
    console.log('No profiles found');
    return;
  }

  console.log('\nProfiles:\n');
  profiles.forEach(profile => {
    const defaultLabel = profile.isDefault ? ' [DEFAULT]' : '';
    const authType =
      profile.authType === 'apiKey'
        ? 'API Key'
        : profile.authType === 'oauth'
          ? 'OAuth'
          : 'Service Account';
    console.log(`  ${profile.name}${defaultLabel}`);
    console.log(`    Priority: ${profile.priority}`);
    console.log(`    Auth: ${authType}`);
    console.log();
  });
}

async function handleProfileSetDefaultCommand(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      'name': { type: 'string', short: 'n' }
    },
    strict: true
  });

  if (!values.name) {
    console.error('Error: --name (-n) is required for profile:set-default command');
    process.exit(1);
  }

  const success = await profileManager.setDefaultProfile(values.name);
  if (success) {
    console.log(`✓ Profile "${values.name}" set as default`);
  } else {
    console.error(`Error: Profile "${values.name}" not found`);
    process.exit(1);
  }
}

async function handleProfileRemoveCommand(args: string[]) {
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

// Main execution
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
  showHelp();
  process.exit(0);
}

const command = args[0];
const commandArgs = args.slice(1);

switch (command) {
  case 'read':
    await handleReadCommand(commandArgs);
    break;
  case 'profile:add':
    await handleProfileAddCommand();
    break;
  case 'profile:list':
    handleProfileListCommand();
    break;
  case 'profile:set-default':
    await handleProfileSetDefaultCommand(commandArgs);
    break;
  case 'profile:remove':
    await handleProfileRemoveCommand(commandArgs);
    break;
  default:
    console.error(`Error: Unknown command "${command}"`);
    console.log('Run "spreadsheet-cli help" for usage information');
    process.exit(1);
}
