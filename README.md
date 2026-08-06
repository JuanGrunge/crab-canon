# Crab Canon — BWV 1079

Visualizador web del Canon Cangrejo de J. S. Bach (Ofrenda Musical, BWV 1079),
en tres vistas sincronizadas: cinta plana con notación viva, banda de Möbius
en 3D y Cilindro Palíndromo.

**Ver en vivo:** https://JuanGrunge.github.io/crab-canon/

## Qué muestra

- **Cinta plana**: las dos voces en notación tradicional (VexFlow), siguiendo
  la reproducción en tiempo real.
- **Möbius**: la Voz 1 sobre una banda con medio giro; el retrógrado (Voz 2)
  aparece en el reverso por una propiedad matemática real de la superficie,
  sin dibujarse por separado.
- **Cilindro (Palíndromo)**: misma pieza sin torsión, con ambas voces
  escritas explícitamente, cada cara como superficie independiente.

Un botón de info en el header desarrolla el contexto completo: historia del
canon, el debate topológico detrás de elegir Möbius o Cilindro (con fuentes
citadas en APA 7), y la metodología seguida durante el proyecto.

## Stack

Zero-dependency, sin bundler: Three.js, Tone.js y VexFlow vía CDN. Estático,
pensado para GitHub Pages.
