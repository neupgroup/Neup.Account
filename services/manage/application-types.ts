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

export type Application = {
  id: string;
  name: string;
  description: string;
  appSecret?: string;
  party?: 'first' | 'third';
  slug?: string;
  dataAccessed?: string[];
  icon?: 'app-window' | 'building' | 'bar-chart' | 'share-2';
  access?: Array<'neupid' | 'firstName' | 'lastName' | 'middleName' | 'displayName' | 'dateBirth' | 'age' | 'isMinor' | 'gender'>;
  policies?: Array<{ name: string; policy: string }>;
  endpoints?: {
    dataDeletionApi?: string;
    dataDeletionPage?: string;
    accountBlock?: string;
    accountBlockApi?: string;
    logoutPage?: string;
    logoutApi?: string;
  };
  ownerAccountId?: string;
};

/**
 * Type ApplicationAccessField.
 */
export type ApplicationAccessField = (typeof applicationAccessFields)[number];


/**
 * Type ApplicationPolicyEntry.
 */
export type ApplicationPolicyEntry = {
  name: string;
  policy: string;
};


/**
 * Type ApplicationEndpointConfig.
 */
export type ApplicationEndpointConfig = {
  dataDeletionApi?: string;
  dataDeletionPage?: string;
  accountBlock?: string;
  accountBlockApi?: string;
  logoutPage?: string;
  logoutApi?: string;
};


/**
 * Type ManagedApplication.
 */
export type ManagedApplication = {
  id: string;
  name: string;
  createdAt: Date;
  hasSecretKey: boolean;
  access: ApplicationAccessField[];
  policies: ApplicationPolicyEntry[];
  endpoints: ApplicationEndpointConfig;
};
