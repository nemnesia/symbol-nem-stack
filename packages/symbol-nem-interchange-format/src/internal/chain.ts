import type { SnifDocument } from '../types.js';

/** Chain-level interpretation is intentionally outside the transport codec. */
export const validateChainSemantics = (_document: SnifDocument): void => {};
