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
