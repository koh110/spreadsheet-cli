import inquirer from 'inquirer'
import { z } from 'zod'
import type { Profile, ProfileManager } from './profile-manager.ts'
import { zodAuthTypeLiterals } from './schema.ts'

const authTypeChoices = [
  { name: 'API Key', value: 'apiKey' },
  { name: 'Service Account (JSON key)', value: 'serviceAccount' },
  { name: 'OAuth credentials command (User)', value: 'oauthCredentials' }
] as const

const baseAnswer = z.object({
  name: z.string(),
  authType: z.union([
    zodAuthTypeLiterals.apiKey,
    zodAuthTypeLiterals.serviceAccount,
    zodAuthTypeLiterals.oauthCredentials
  ]),
  priority: z.number()
})

const apiKeyAnswersSchema = z
  .object({
    ...baseAnswer.shape,
    authType: zodAuthTypeLiterals.apiKey,
    apiKey: z.string()
  })
  .strict()

const serviceAccountAnswersSchema = z
  .object({
    ...baseAnswer.shape,
    authType: zodAuthTypeLiterals.serviceAccount,
    clientEmail: z.string(),
    privateKey: z.string()
  })
  .strict()

const oauthCredentialsAnswersSchema = z
  .object({
    ...baseAnswer.shape,
    authType: zodAuthTypeLiterals.oauthCredentials,
    command: z.string()
  })
  .strict()

const profileAnswersSchema = z.union([
  apiKeyAnswersSchema,
  serviceAccountAnswersSchema,
  oauthCredentialsAnswersSchema
])

const authTypeSchema = z.object({
  authType: baseAnswer.shape.authType
})

type AuthType = ReturnType<typeof authTypeSchema.parse>['authType']
type ProfileAnswers = ReturnType<typeof profileAnswersSchema.parse>

type CreateProfileInteractiveOptions = {
  allowedAuthTypes?: readonly AuthType[]
  introMessage?: string
}

function getAuthType(answers: unknown): AuthType | undefined {
  const parsed = authTypeSchema.safeParse(answers)
  return parsed.success ? parsed.data.authType : undefined
}

function getAllowedAuthTypeChoices(allowedAuthTypes: readonly AuthType[]) {
  return authTypeChoices.filter((choice) =>
    allowedAuthTypes.includes(choice.value)
  )
}

export async function createProfileInteractive(
  profileManager: ProfileManager,
  options: CreateProfileInteractiveOptions = {}
) {
  const allowedAuthTypes =
    options.allowedAuthTypes ?? authTypeChoices.map((choice) => choice.value)

  console.log(
    options.introMessage ?? "\nNo profiles found. Let's create one!\n"
  )

  const answers = await inquirer.prompt<ProfileAnswers>([
    {
      type: 'input',
      name: 'name',
      message: 'Profile name:',
      default: 'default',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Profile name is required'
        }
        return true
      }
    },
    {
      type: 'list',
      name: 'authType',
      message: `Authentication type(${allowedAuthTypes.join('|')}):`,
      choices: getAllowedAuthTypeChoices(allowedAuthTypes)
    },
    {
      type: 'input',
      name: 'apiKey',
      message: 'API Key:',
      when: (answers) => getAuthType(answers) === 'apiKey',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'API Key is required'
        }
        return true
      }
    },
    {
      type: 'input',
      name: 'clientEmail',
      message: 'Service account email:',
      when: (answers) => getAuthType(answers) === 'serviceAccount',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Client email is required'
        }
        return true
      }
    },
    {
      type: 'input',
      name: 'privateKey',
      message:
        'Private key (paste the key including -----BEGIN/END PRIVATE KEY-----):',
      when: (answers) => getAuthType(answers) === 'serviceAccount',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Private key is required'
        }
        return true
      }
    },
    {
      type: 'list',
      name: 'command',
      message: 'Command to fetch OAuth credentials.json:',
      when: (answers) => getAuthType(answers) === 'oauthCredentials',
      validate: (input: string) => {
        if (!input || input.trim() === '') {
          return 'Command is required'
        }
        return true
      }
    },

    {
      type: 'number',
      name: 'priority',
      message: 'Priority (lower number = higher priority):',
      default: 1,
      validate: (input: number) => {
        if (isNaN(input) || input < 0) {
          return 'Priority must be a non-negative number'
        }
        return true
      }
    }
  ])

  const profile = (() => {
    const { authType } = answers
    switch (authType) {
      case 'apiKey':
        return {
          name: answers.name.trim(),
          priority: answers.priority,
          authType: 'apiKey',
          apiKey: answers.apiKey.trim()
        } satisfies Profile
      case 'serviceAccount':
        return {
          name: answers.name.trim(),
          priority: answers.priority,
          authType: 'serviceAccount',
          clientEmail: answers.clientEmail.trim(),
          privateKey: answers.privateKey.trim()
        } satisfies Profile
      case 'oauthCredentials': {
        return {
          name: answers.name.trim(),
          priority: answers.priority,
          authType: 'oauthCredentials',
          command: answers.command.trim()
        } satisfies Profile
      }
      default: {
        // biome-ignore lint/correctness/noUnusedVariables: unreachable check
        const unreachable: never = authType
        throw new Error('Invalid authentication type')
      }
    }
  })()

  await profileManager.addProfile(profile)
  console.log(`\n✓ Profile "${profile.name}" created successfully!\n`)

  return profile
}

export async function addProfileCommand(profileManager: ProfileManager) {
  await createProfileInteractive(profileManager)
}
