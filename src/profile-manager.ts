import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { CONFIG_DIR, CONFIG_FILE } from './config.ts';
import { zodAuthTypeLiterals } from './schema.ts';

const baseProfileShape = {
  name: z.string(),
  priority: z.number()
};

const apiKeyProfileSchema = z
  .object({
    ...baseProfileShape,
    authType: zodAuthTypeLiterals.apiKey.optional().default('apiKey'),
    apiKey: z.string()
  })
  .strict();

const serviceAccountProfileSchema = z
  .object({
    ...baseProfileShape,
    authType: zodAuthTypeLiterals.serviceAccount.optional().default('serviceAccount'),
    clientEmail: z.string(),
    privateKey: z.string()
  })
  .strict();

const oauthCredentialsProfileSchema = z
  .object({
    ...baseProfileShape,
    authType: zodAuthTypeLiterals.oauthCredentials.optional().default('oauthCredentials'),
    command: z.string()
  })
  .strict();

const profileSchema = z.union([
  apiKeyProfileSchema,
  serviceAccountProfileSchema,
  oauthCredentialsProfileSchema
]);

const configSchema = z
  .object({
    profiles: z.array(profileSchema)
  })
  .strict();

export type Profile = ReturnType<typeof profileSchema.parse>;
type ProfileConfig = ReturnType<typeof configSchema.parse>;
export type ProfileManager = Awaited<ReturnType<typeof createProfileManager>>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'profile';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig() {
  if (!(await pathExists(CONFIG_DIR))) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }

  if (!(await pathExists(CONFIG_FILE))) {
    const defaultConfig = { profiles: [] };
    await writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    return defaultConfig;
  }

  const data = await readFile(CONFIG_FILE, 'utf-8');
  const parsed: unknown = JSON.parse(data);
  const normalized = configSchema.safeParse(parsed);
  if (!normalized.success) {
    console.warn(`Invalid config file format: ${formatZodError(normalized.error)}`);
    return { profiles: [] };
  }
  return normalized.data;
}

async function saveConfig(config: ProfileConfig) {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getProfiles(config: ProfileConfig) {
  return config.profiles;
}

function getProfilesSortedByPriority(config: ProfileConfig) {
  return [...config.profiles].sort((a, b) => a.priority - b.priority);
}

function getProfile(config: ProfileConfig, name: string) {
  return config.profiles.find(p => p.name === name);
}

async function addProfile(config: ProfileConfig, profile: Profile) {
  const existingIndex = config.profiles.findIndex(p => p.name === profile.name);

  if (existingIndex >= 0) {
    config.profiles[existingIndex] = profile;
  } else {
    config.profiles.push(profile);
  }

  await saveConfig(config);
}

async function removeProfile(config: ProfileConfig, name: string) {
  const index = config.profiles.findIndex(p => p.name === name);
  if (index === -1) {
    return false;
  }
  config.profiles.splice(index, 1);
  await saveConfig(config);
  return true;
}

async function clearProfiles(config: ProfileConfig) {
  config.profiles = [];
  await saveConfig(config);
}

function hasProfiles(config: ProfileConfig) {
  return config.profiles.length > 0;
}

type DropConfigArg<F extends (...args: any[]) => unknown> =
  Parameters<F> extends [ProfileConfig, ...infer Rest] ? Rest : never;

export async function createProfileManager() {
  const config = await loadConfig();

  return {
    getProfiles: () => getProfiles(config),
    getProfilesSortedByPriority: () => getProfilesSortedByPriority(config),
    getProfile: (...args: DropConfigArg<typeof getProfile>) =>
      getProfile(config, ...args),
    addProfile: (...args: DropConfigArg<typeof addProfile>) =>
      addProfile(config, ...args),
    removeProfile: (...args: DropConfigArg<typeof removeProfile>) =>
      removeProfile(config, ...args),
    hasProfiles: () => hasProfiles(config),
    clearProfiles: () => clearProfiles(config)
  };
}
