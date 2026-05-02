// All shared types and constants for the application domain.

export const applicationAccessFields = [
  'neupid',
  'firstName',
  'lastName',
  'middleName',
  'displayName',
  'dateBirth',
  'age',
  'isMinor',
  'gender',
] as const;

export type ApplicationAccessField = (typeof applicationAccessFields)[number];

export type Application = {
  id: string;
  name: string;
  description: string;
  appSecret?: string;
  party?: 'first' | 'third';
  slug?: string;
  dataAccessed?: string[];
  icon?: 'app-window' | 'building' | 'bar-chart' | 'share-2';
  access?: ApplicationAccessField[];
  policies?: Array<{ name: string; policy: string }>;
  endpoints?: ApplicationEndpointConfig;
  ownerAccountId?: string;
};

export type ApplicationPolicyEntry = {
  name: string;
  policy: string;
};

export type ApplicationEndpointConfig = {
  dataDeletionApi?: string;
  dataDeletionPage?: string;
  accountBlock?: string;
  accountBlockApi?: string;
  logoutPage?: string;
  logoutApi?: string;
};

export type ManagedApplication = {
  id: string;
  name: string;
  createdAt: Date;
  hasSecretKey: boolean;
  access: ApplicationAccessField[];
  policies: ApplicationPolicyEntry[];
  endpoints: ApplicationEndpointConfig;
};
