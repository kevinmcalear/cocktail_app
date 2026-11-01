/**
 * ponytail: STATUS lives in constants/tokens.ts now. This re-export stays only
 * for components/auth (human-gated); point those two files at tokens and
 * delete this file in the same gated PR as ctx/AuthContext.tsx's featureNews.
 */
export { STATUS } from './tokens';
