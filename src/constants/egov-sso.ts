import * as Linking from 'expo-linking';

/**
 * PLACEHOLDER — the eGov SSO team has not yet published the citizen-facing
 * login/authorize URL for the hackathon sandbox. Swap this single constant
 * for the real one once confirmed; nothing else in the sign-in flow needs
 * to change.
 */
export const EGOV_SSO_AUTHORIZE_URL = 'https://hackathon-sso.e.gov.ph/authorize';

const EGOV_SSO_REDIRECT_PATH = 'auth/callback';

export function getEgovSsoRedirectUri(): string {
  return Linking.createURL(EGOV_SSO_REDIRECT_PATH);
}
