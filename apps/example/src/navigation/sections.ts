export type PlaygroundSection =
  | 'dashboard'
  | 'updates'
  | 'runtime'
  | 'bundle'
  | 'logs'
  | 'devtools'
  | 'settings'
  | 'about';

export interface SectionDef {
  key: PlaygroundSection;
  label: string;
  glyph: string;
}

export const SECTIONS: SectionDef[] = [
  { key: 'dashboard', label: 'Dashboard', glyph: '▦' },
  { key: 'updates', label: 'Updates', glyph: '⬆' },
  { key: 'runtime', label: 'Runtime Inspector', glyph: '⚙' },
  { key: 'bundle', label: 'Bundle Explorer', glyph: '\u{1F4E6}' },
  { key: 'logs', label: 'Logs', glyph: '≡' },
  { key: 'devtools', label: 'Developer Tools', glyph: '⚒' },
  { key: 'settings', label: 'Settings', glyph: '⚙︎' },
  { key: 'about', label: 'About', glyph: 'ℹ' },
];
