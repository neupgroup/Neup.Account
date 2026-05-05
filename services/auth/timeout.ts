export type AuthFlowType = 'signup' | 'signin' | 'forgot_password';

export function getAuthTimeoutDescription(flowType: AuthFlowType): string {
  if (flowType === 'signup') return 'Exceeded the time for SignUp.';
  if (flowType === 'signin') return 'Exceeded the time for SignIn.';
  return 'Exceeded the time for Forget Password.';
}

export function getAuthTimeoutError(flowType: AuthFlowType): string {
  return `Timeout Error: ${getAuthTimeoutDescription(flowType)}`;
}
