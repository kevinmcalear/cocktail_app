/**
 * expo-device's web build says true too, but it parses the user agent with
 * ua-parser-js (about 20 KB) at import, and each route chunk that asks kept its
 * own copy. The web callers decide the camera from the platform anyway.
 */
export const isDevice = true;
