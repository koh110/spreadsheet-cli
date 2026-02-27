import inquirer from 'inquirer';
import { z } from 'zod';
import type { Profile, ProfileManager } from './profile-manager.ts';

const baseAnswerShape = {
  name: z.string(),
  authType: z.union([z.literal('apiKey'), z.literal('serviceAccount'), z.literal('oauth')]),
  priority: z.number(),
  isDefault: z.boolean()
};

const apiKeyAnswersSchema = z
  .object({
    ...baseAnswerShape,
    authType: z.literal('apiKey'),
    apiKey: z.string()
  })
  .strict();

const serviceAccountAnswersSchema = z
  .object({
    ...baseAnswerShape,
    authType: z.literal('serviceAccount'),
    clientEmail: z.string(),
    privateKey: z.string()
  })
  .strict();

const oauthAnswersSchema = z
  .object({
    ...baseAnswerShape,
    authType: z.literal('oauth'),
    oauthClientId: z.string(),
    oauthClientSecret: z.string(),
    oauthRefreshToken: z.string()
  })
  .strict();

const profileAnswersSchema = z.union([
  apiKeyAnswersSchema,
  serviceAccountAnswersSchema,
  oauthAnswersSchema
]);

const authTypeSchema = z.object({
  authType: baseAnswerShape.authType
});

type AuthType = ReturnType<typeof authTypeSchema.parse>['authType'];
type ProfileAnswers = ReturnType<typeof profileAnswersSchema.parse>;

function getAuthType(answers: unknown): AuthType | undefined {
  const parsed = authTypeSchema.safeParse(answers);
  return parsed.success ? parsed.data.authType : undefined;
}

export async function createProfileInteractive(profileManager: ProfileManager) {
  console.log('\nNo profiles found. Let\'s create one!\n');

  const answers = await inquirer.prompt<ProfileAnswers>([
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
        { name: 'Service Account (JSON key)', value: 'serviceAccount' },
        { name: 'OAuth (User)', value: 'oauth' }
      ]
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key:',
      when: (answers) => getAuthType(answers) === 'apiKey',
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
      when: (answers) => getAuthType(answers) === 'serviceAccount',
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
      when: (answers) => getAuthType(answers) === 'serviceAccount',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Private key is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'oauthClientId',
      message: 'OAuth client ID:',
      when: (answers) => getAuthType(answers) === 'oauth',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'OAuth client ID is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'oauthClientSecret',
      message: 'OAuth client secret:',
      when: (answers) => getAuthType(answers) === 'oauth',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'OAuth client secret is required';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'oauthRefreshToken',
      message: 'OAuth refresh token:',
      when: (answers) => getAuthType(answers) === 'oauth',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'OAuth refresh token is required';
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

  const profile = (() => {
    switch (answers.authType) {
      case 'apiKey':
        return {
          name: answers.name.trim(),
          priority: answers.priority,
          isDefault: answers.isDefault,
          authType: 'apiKey',
          apiKey: answers.apiKey.trim()
        } satisfies Profile;
      case 'serviceAccount':
        return {
          name: answers.name.trim(),
          priority: answers.priority,
          isDefault: answers.isDefault,
          authType: 'serviceAccount',
          clientEmail: answers.clientEmail.trim(),
          privateKey: answers.privateKey.trim()
        } satisfies Profile;
      case 'oauth':
        return {
          name: answers.name.trim(),
          priority: answers.priority,
          isDefault: answers.isDefault,
          authType: 'oauth',
          oauthClientId: answers.oauthClientId.trim(),
          oauthClientSecret: answers.oauthClientSecret.trim(),
          oauthRefreshToken: answers.oauthRefreshToken.trim()
        } satisfies Profile;
      default:
        throw new Error('Invalid authentication type');
    }
  })()

  await profileManager.addProfile(profile);
  console.log(`\n✓ Profile "${profile.name}" created successfully!\n`);

  return profile;
}

export async function addProfileCommand(profileManager: ProfileManager) {
  await createProfileInteractive(profileManager);
}
