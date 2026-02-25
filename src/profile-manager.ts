import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Profile, ProfileConfig } from './types';

const CONFIG_DIR = path.join(os.homedir(), '.spreadsheet-cli');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

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
    return JSON.parse(data);
  }

  private saveConfig(): void {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  getProfiles(): Profile[] {
    return this.config.profiles;
  }

  getProfilesSortedByPriority(): Profile[] {
    return [...this.config.profiles].sort((a, b) => a.priority - b.priority);
  }

  getDefaultProfile(): Profile | undefined {
    return this.config.profiles.find(p => p.isDefault);
  }

  getProfile(name: string): Profile | undefined {
    return this.config.profiles.find(p => p.name === name);
  }

  addProfile(profile: Profile): void {
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

  setDefaultProfile(name: string): boolean {
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

  removeProfile(name: string): boolean {
    const index = this.config.profiles.findIndex(p => p.name === name);
    if (index === -1) {
      return false;
    }

    this.config.profiles.splice(index, 1);
    this.saveConfig();
    return true;
  }

  hasProfiles(): boolean {
    return this.config.profiles.length > 0;
  }
}
