// Le mot « leket » écrit en bits, gravé sur la panse de la calebasse.
// Une rangée par lettre, code ASCII sur 7 bits : un 1 est un carré gravé, un 0 une place vide.
//   l 1101100 · e 1100101 · k 1101011 · e 1100101 · t 1110100
// Source unique, utilisée par la planche de contrôle (navigateur) et le générateur de fichiers (Node).
export const WORD = 'leket';
export const ROYAL_BLUE = '#1F4BC9';     // bleu roi de la calebasse
export const FLESH = '#FFFFFF';          // bits gravés en blanc

// Silhouette du leket (repère 100 × 100), celle de la piste A3 validée.
export const BODY = 'M7.5 34H92.5Q94 34 94 35.5C94 60 79 80 57.5 82.5L42.5 82.5C20.5 80 6 60 6 35.5Q6 34 7.5 34Z';
export const RIGHT = [[94, 35.5], [94, 60], [79, 80], [57.5, 82.5]];
export const LEFT = [[6, 35.5], [6, 60], [20.5, 80], [42.5, 82.5]];

export const GRID = { size: 5, gap: 2, top: 41 };   // 7 colonnes × 5 rangées, centrées sur x = 50

export const ROWS = [...WORD].map((c) => c.charCodeAt(0).toString(2).padStart(7, '0'));

// Carrés gravés : [x, y, côté] pour chaque bit à 1.
export function bitSquares({ size, gap, top } = GRID) {
  const pitch = size + gap;
  const x0 = 50 - (7 * size + 6 * gap) / 2;
  const out = [];
  ROWS.forEach((row, r) => [...row].forEach((bit, c) => {
    if (bit === '1') out.push([+(x0 + c * pitch).toFixed(2), +(top + r * pitch).toFixed(2), size]);
  }));
  return out;
}

// Version petite taille (moins de 48 px) : les 35 bits se fondent ; trois gros carrés gardent l'idée.
export const SMALL = [[25, 51, 12], [44, 51, 12], [63, 51, 12]];

// Tracé une couleur : la silhouette avec les carrés en vrais trous (règle evenodd).
export function markPath(squares = bitSquares()) {
  return BODY + squares.map(([x, y, s]) => `M${x} ${y}h${s}v${s}h-${s}Z`).join('');
}
