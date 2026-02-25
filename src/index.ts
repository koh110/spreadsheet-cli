#!/usr/bin/env node

import { Command } from 'commander';
import { ProfileManager } from './profile-manager';
import { SpreadsheetReader } from './spreadsheet-reader';
import { createProfileInteractive, addProfileCommand } from './interactive';

const program = new Command();
const profileManager = new ProfileManager();
const reader = new SpreadsheetReader();

program
  .name('spreadsheet-cli')
  .description('CLI tool to read Google Spreadsheets')
  .version('1.0.0');

program
  .command('read')
  .description('Read data from a Google Spreadsheet')
  .requiredOption('-s, --spreadsheet-id <id>', 'Spreadsheet ID')
  .option('-r, --range <range>', 'Range to read (e.g., Sheet1!A1:D10)', 'Sheet1')
  .option('-p, --profile <name>', 'Profile name to use')
  .option('-f, --format <format>', 'Output format (json|csv|table)', 'table')
  .action(async (options) => {
    try {
      // Check if profiles exist, if not, create one interactively
      if (!profileManager.hasProfiles()) {
        await createProfileInteractive(profileManager);
      }

      let profiles;
      if (options.profile) {
        const profile = profileManager.getProfile(options.profile);
        if (!profile) {
          console.error(`Error: Profile "${options.profile}" not found`);
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
        options.spreadsheetId,
        options.range,
        profiles
      );

      console.log(`\nData retrieved using profile: ${profile.name}\n`);

      // Format output
      if (options.format === 'json') {
        console.log(JSON.stringify(data, null, 2));
      } else if (options.format === 'csv') {
        data.forEach(row => {
          console.log(row.map(cell => `"${cell}"`).join(','));
        });
      } else {
        // Table format
        data.forEach(row => {
          console.log(row.join('\t'));
        });
      }
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('profile:add')
  .description('Add a new profile')
  .action(async () => {
    try {
      await addProfileCommand(profileManager);
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('profile:list')
  .description('List all profiles')
  .action(() => {
    const profiles = profileManager.getProfiles();
    if (profiles.length === 0) {
      console.log('No profiles found');
      return;
    }

    console.log('\nProfiles:\n');
    profiles.forEach(profile => {
      const defaultLabel = profile.isDefault ? ' [DEFAULT]' : '';
      const authType = profile.apiKey ? 'API Key' : 'Service Account';
      console.log(`  ${profile.name}${defaultLabel}`);
      console.log(`    Priority: ${profile.priority}`);
      console.log(`    Auth: ${authType}`);
      console.log();
    });
  });

program
  .command('profile:set-default')
  .description('Set a profile as default')
  .requiredOption('-n, --name <name>', 'Profile name')
  .action((options) => {
    const success = profileManager.setDefaultProfile(options.name);
    if (success) {
      console.log(`✓ Profile "${options.name}" set as default`);
    } else {
      console.error(`Error: Profile "${options.name}" not found`);
      process.exit(1);
    }
  });

program
  .command('profile:remove')
  .description('Remove a profile')
  .requiredOption('-n, --name <name>', 'Profile name')
  .action((options) => {
    const success = profileManager.removeProfile(options.name);
    if (success) {
      console.log(`✓ Profile "${options.name}" removed`);
    } else {
      console.error(`Error: Profile "${options.name}" not found`);
      process.exit(1);
    }
  });

program.parse(process.argv);
