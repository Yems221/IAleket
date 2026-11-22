"""Texture de papier froissé pour le fond de leketia (public/brand/paper-crumple.webp).

Observé sur de vraies photos (recherche « papier froissé blanc texture », 22 nov. 2026) : un papier presque
blanc, continu, fait de facettes planes à peu près triangulaires ; chaque pli est l'arête entre deux facettes,
avec une face claire et une face dans l'ombre. On le reproduit tel quel :
  - un relief en facettes triangulaires : une grille de sommets à hauteurs aléatoires, chaque case coupée en
    deux triangles par une diagonale tirée au hasard, le tout déformé doucement pour que les triangles soient
    irréguliers (les arêtes restent vives) ;
  - trois échelles superposées : grands plis, plis moyens, petits plis ;
  - tout est périodique, la texture se raccorde sans couture ;
  - une lumière rasante calcule la teinte de chaque facette ; le papier reste presque blanc.
Usage : python3 tools/paper/crumple.py
"""
import numpy as np
from PIL import Image

N = 1024
rng = np.random.default_rng(7)
y, x = np.mgrid[0:N, 0:N] / N  # coordonnées sur le tore [0, 1)

def smooth(kmax, count, scale):
    """Bruit doux et périodique (somme de sinus à fréquences entières)."""
    out = np.zeros((N, N))
    for _ in range(count):
        kx, ky = rng.integers(-kmax, kmax + 1, 2)
        if kx == 0 and ky == 0:
            continue
        out += np.sin(2 * np.pi * (kx * x + ky * y) + rng.random() * 6.283) * rng.random()
    return out / max(1, count) * scale

def facets(G, amp, warp):
    """Relief en facettes triangulaires sur une grille G × G (périodique), déformée par `warp`."""
    h = rng.normal(0, 1, (G, G))
    diag = rng.random((G, G)) < 0.5
    u = (x + smooth(2, 6, warp)) * G
    v = (y + smooth(2, 6, warp)) * G
    fi, fj = np.floor(u), np.floor(v)
    fu, fv = u - fi, v - fj
    i, j = fi.astype(int) % G, fj.astype(int) % G
    i1, j1 = (i + 1) % G, (j + 1) % G
    h00, h10, h01, h11 = h[j, i], h[j, i1], h[j1, i], h[j1, i1]
    a = np.where(fu > fv, h00 + fu * (h10 - h00) + fv * (h11 - h10), h00 + fv * (h01 - h00) + fu * (h11 - h01))
    b = np.where(fu + fv < 1, h00 + fu * (h10 - h00) + fv * (h01 - h00),
                 h11 + (1 - fu) * (h01 - h11) + (1 - fv) * (h10 - h11))
    return amp * np.where(diag[j, i], a, b) / G

H = facets(8, 1.0, 0.9 / 8) + facets(21, 0.5, 0.9 / 21) + facets(47, 0.2, 0.9 / 47)

gx = (np.roll(H, -1, 1) - np.roll(H, 1, 1)) * N / 2
gy = (np.roll(H, -1, 0) - np.roll(H, 1, 0)) * N / 2
strength = 1.15
nx, ny, nz = -gx * strength, -gy * strength, np.ones((N, N))
norm = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
light = np.array([-0.45, -0.6, 0.66]); light /= np.linalg.norm(light)
shade = (nx * light[0] + ny * light[1] + nz * light[2]) / norm
shade = (shade - np.median(shade)) / shade.std()

gray = np.clip(241 + shade * 13, 188, 255).astype(np.uint8)
Image.fromarray(gray, 'L').save('public/brand/paper-crumple.webp', 'WEBP', quality=82, method=6)
print('ok', gray.min(), int(np.median(gray)), gray.max())
