// Génère les logos vectoriels à partir de la définition unique (leket-bits.js).
//   node tools/logo/build-svg.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { markPath, SMALL, ROYAL_BLUE, FLESH, ROWS, WORD } from './leket-bits.js';

const brand = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'brand');
const legend = [...WORD].map((c, i) => `${c} ${ROWS[i]}`).join(' · ');

const svg = ({ d, fill, extra = '' }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 30 92 56" role="img" aria-labelledby="t">
  <title id="t">leketia</title>
  <!-- Le leket gravé : une calebasse de profil ; le mot « leket » écrit en bits (ASCII 7 bits, une rangée par lettre) :
       ${legend}. Chaque bit à 1 est un carré gravé, ici un trou dans la forme. -->
  <path fill="${fill}" fill-rule="evenodd" d="${d}"/>${extra}
</svg>
`;

await writeFile(join(brand, 'leketia-logo.svg'), svg({ d: markPath(), fill: ROYAL_BLUE }));
await writeFile(join(brand, 'leketia-logo-mono.svg'), svg({ d: markPath(), fill: 'currentColor' }));
await writeFile(join(brand, 'leketia-favicon.svg'), svg({
  d: markPath(SMALL), fill: ROYAL_BLUE,
  extra: `\n  <style>@media (prefers-color-scheme: dark) { path { fill: ${FLESH}; } }</style>`,
}));
console.log('leketia-logo.svg, leketia-logo-mono.svg, leketia-favicon.svg écrits dans public/brand');
