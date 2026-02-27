import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';

const CONFIG_DIR = path.join(os.homedir(), '.spreadsheet-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const baseProfileShape = {
  name: z.string(),
  priority: z.number(),
  isDefault: z.boolean()
};

const apiKeyProfileSchema = z
  .object({
    ...baseProfileShape,
    authType: z.literal('apiKey').optional().default('apiKey'),
    apiKey: z.string()
  })
  .strict();

const serviceAccountProfileSchema = z
  .object({
    ...baseProfileShape,
    authType: z.literal('serviceAccount').optional().default('serviceAccount'),
    clientEmail: z.string(),
    privateKey: z.string()
  })
  .strict();

const oauthProfileSchema = z
  .object({
    ...baseProfileShape,
    authType: z.literal('oauth').optional().default('oauth'),
    oauthClientId: z.string(),
    oauthClientSecret: z.string(),
    oauthRefreshToken: z.string()
  })
  .strict();

const profileSchema = z.union([
  apiKeyProfileSchema,
  serviceAccountProfileSchema,
  oauthProfileSchema
]);

const configSchema = z
  .object({
    profiles: z.array(profileSchema)
  })
  .strict();

export type Profile = ReturnType<typeof profileSchema.parse>;
type ProfileConfig = ReturnType<typeof configSchema.parse>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(issue => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'profile';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function normalizeProfile(raw: unknown) {
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Invalid profile configuration: ${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

export class ProfileManager {
  private config: ProfileConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): ProfileConfig {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    if (!fs.existsSync(CONFIG_FILE)) {
      const defaultConfig: ProfileConfig = { profiles: [] };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }

    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed: unknown = JSON.parse(data);
    const normalized = configSchema.safeParse(parsed);
    if (!normalized.success) {
      throw new Error(`Invalid config file format: ${formatZodError(normalized.error)}`);
    }
    return { profiles: normalized.data.profiles.map(normalizeProfile) };
  }

  private saveConfig() {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  getProfiles() {
    return this.config.profiles;
  }

  getProfilesSortedByPriority() {
    return [...this.config.profiles].sort((a, b) => a.priority - b.priority);
  }

  getDefaultProfile() {
    return this.config.profiles.find(p => p.isDefault);
  }

  getProfile(name: string) {
    return this.config.profiles.find(p => p.name === name);
  }

  addProfile(profile: Profile) {
    const existingIndex = this.config.profiles.findIndex(p => p.name === profile.name);
    
    if (existingIndex >= 0) {
      this.config.profiles[existingIndex] = profile;
    } else {
      this.config.profiles.push(profile);
    }

    if (profile.isDefault) {
      this.config.profiles.forEach(p => {
        if (p.name !== profile.name) {
          p.isDefault = false;
        }
      });
    }

    this.saveConfig();
  }

  setDefaultProfile(name: string) {
    const profile = this.getProfile(name);
    if (!profile) {
      return false;
    }

    this.config.profiles.forEach(p => {
      p.isDefault = p.name === name;
    });

    this.saveConfig();
    return true;
  }

  removeProfile(name: string) {
    const index = this.config.profiles.findIndex(p => p.name === name);
    if (index === -1) {
      return false;
    }

    this.config.profiles.splice(index, 1);
    this.saveConfig();
    return true;
  }

  hasProfiles() {
    return this.config.profiles.length > 0;
  }
}
