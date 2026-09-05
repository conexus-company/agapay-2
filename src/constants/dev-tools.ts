/**
 * True in local dev, and also true in hosted builds where
 * EXPO_PUBLIC_ENABLE_DEV_AUTH=true was set at export time — lets a "dev/test"
 * hosted deployment keep the sandbox exchange-code / quick-login screens,
 * while a real production export (env unset) hides them like __DEV__ always did.
 */
export const DEV_TOOLS_ENABLED = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH === 'true';
