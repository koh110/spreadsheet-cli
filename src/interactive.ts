import inquirer from 'inquirer';
import { ProfileManager } from './profile-manager.ts';
import type { Profile } from './profile-manager.ts';

export async function createProfileInteractive(profileManager: ProfileManager): Promise<Profile> {
  console.log('\nNo profiles found. Let\'s create one!\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Profile name:',
      default: 'default',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Profile name is required';
        }
        return true;
      }
    },
    {
      type: 'list',
      name: 'authType',
      message: 'Authentication type:',
      choices: [
        { name: 'API Key', value: 'apiKey' },
        { name: 'Service Account (JSON key)', value: 'serviceAccount' }
      ]
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key:',
      when: (answers: any) => answers.authType === 'apiKey',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'API Key is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'clientEmail',
      message: 'Service account email:',
      when: (answers: any) => answers.authType === 'serviceAccount',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Client email is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'privateKey',
      message: 'Private key (paste the key including -----BEGIN/END PRIVATE KEY-----):',
      when: (answers: any) => answers.authType === 'serviceAccount',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Private key is required';
        }
        return true;
      }
    },
    {
      type: 'number',
      name: 'priority',
      message: 'Priority (lower number = higher priority):',
      default: 1,
      validate: (input: number) => {
        if (isNaN(input) || input < 0) {
          return 'Priority must be a non-negative number';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'isDefault',
      message: 'Set as default profile?',
      default: true
    }
  ]);

  const profile: Profile = {
    name: answers.name.trim(),
    priority: answers.priority,
    isDefault: answers.isDefault
  };

  if (answers.authType === 'apiKey') {
    profile.apiKey = answers.apiKey.trim();
  } else {
    profile.clientEmail = answers.clientEmail.trim();
    profile.privateKey = answers.privateKey.trim();
  }

  profileManager.addProfile(profile);
  console.log(`\n✓ Profile "${profile.name}" created successfully!\n`);

  return profile;
}

export async function addProfileCommand(profileManager: ProfileManager): Promise<void> {
  await createProfileInteractive(profileManager);
}
