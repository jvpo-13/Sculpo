# Sculpo

Converte imagens (PNG, JPEG, WebP) em chaveiros 3D em relevo (`.stl` binário),
100% no navegador. Sem backend, sem IA: toda a conversão é matemática
determinística.

## Rodar

Requer Node.js 18 ou mais novo.

```bash
npm install
npm run dev
```

## Verificar

```bash
npm run typecheck
npm test
npm run build
```

## Estrutura

- `src/core/` — funções puras (rodam em Node nos testes). Todo o algoritmo.
- `src/worker/` — casca do Web Worker (Marco 3).
- `src/state/` — store Zustand.
- `src/three/` — viewport 3D (Marco 4).
- `src/components/` — interface.

Decisões de projeto ficam em [DECISIONS.md](DECISIONS.md).

## Estado

Marco 3 de 5: worker e cliente ligados; carregar imagem e baixar o STL funcionam de ponta a ponta. Ainda sem viewport 3D.
