/**
 * What first run's Welcome (canvas Prod-first, 1) draws before anyone signs
 * in: the three hero drinks' drawing inputs, as the catalog's item_sketches
 * hold them (Negroni, Martini, Clover Club), and the sky's colours, which the
 * board takes from an Aperol Spritz, a Martini and a Negroni. Carried here so
 * Welcome draws with no network and nothing to read signed out.
 */
export const WELCOME_HERO = [
  { seed: 'welcome-negroni', raw: { v: 2, ice: 'large', fizz: false, foam: null, bleed: null, float: null, from: { ice: 'rules', glass: 'rules', liquid: 'rules', method: 'rules', garnish: 'data' }, glass: 'rocks', liquid: { hex: '#a01c26', alpha: 1 }, method: 'stir', garnish: 'orange_peel', coverage: 1 } },
  { seed: 'welcome-martini', raw: { v: 2, ice: 'none', fizz: false, foam: null, bleed: null, float: null, from: { ice: 'rules', glass: 'data', liquid: 'rules', method: 'rules', garnish: 'data' }, glass: 'martini', liquid: { hex: '#e3caa5', alpha: 0.14 }, method: 'stir', garnish: 'lemon_peel', coverage: 1 } },
  { seed: 'welcome-clover', raw: { v: 2, ice: 'none', fizz: false, foam: 'cap', bleed: null, float: null, from: { ice: 'rules', glass: 'rules', liquid: 'rules', method: 'rules', garnish: 'data' }, glass: 'coupe', liquid: { hex: '#da838c', alpha: 1 }, method: 'shake', garnish: 'berries', coverage: 1 } },
] as const;

/** Spritz, Martini, Negroni, left to right: the catalog's liquid colours, as Tonight's sky takes them. */
export const WELCOME_SKY = ['#E8743A', '#e3caa5', '#a01c26'] as const;
