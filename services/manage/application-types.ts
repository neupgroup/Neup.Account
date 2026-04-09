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
