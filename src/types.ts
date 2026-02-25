export interface Profile {
  name: string;
  apiKey?: string;
  clientEmail?: string;
  privateKey?: string;
  priority: number;
  isDefault: boolean;
}

export interface ProfileConfig {
  profiles: Profile[];
}
