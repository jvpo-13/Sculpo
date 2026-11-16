# Sculpo

Converte imagens (PNG, JPEG, WebP) em chaveiros 3D em relevo (`.stl` binário),
100% no navegador. Sem backend, sem IA: toda a conversão é matemática
determinística, então a mesma imagem com os mesmos parâmetros gera sempre o
mesmo arquivo, byte a byte.

## Rodar

Requer Node.js 18 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que o Vite mostrar (por padrão `http://localhost:5173`).

## Testar

```bash
npm run typecheck
npm test
npm run build
```

`npm test` roda o núcleo inteiro em Node (sem navegador): invariantes da malha
(fechada, 2-manifold, orientada), máscara, detecção, STL, cliente do worker e
um benchmark que falha se o build passar de 3x o alvo de tempo.

## Publicar

O projeto é uma SPA estática com `base: './'`, então funciona em qualquer
subcaminho.

**GitHub Pages (automático):** em *Settings → Pages*, escolha *Source: GitHub
Actions*. A cada push no `main`, o workflow `.github/workflows/deploy.yml`
roda os testes, faz o build e publica a pasta `dist`.

**Manual:** `npm run build` e sirva a pasta `dist` em qualquer hospedagem de
arquivos estáticos.

## Imagens de exemplo

As miniaturas do cabeçalho carregam `public/examples/logo.png`, `foto.jpg` e
`icone.png`. Se um arquivo não existir, a miniatura dele simplesmente não
aparece.

## Estrutura

- `src/core/` — funções puras (rodam em Node nos testes). Todo o algoritmo.
- `src/worker/` — casca do Web Worker e o cliente (fila, última-vence, timeout).
- `src/state/` — store Zustand e ações.
- `src/three/` — viewport 3D.
- `src/components/` — interface.

Decisões de projeto ficam em [DECISIONS.md](DECISIONS.md).

## Checklist manual

Seis casos para conferir antes de publicar. Executados em 15/11/2026 no
servidor de desenvolvimento, com imagens geradas na própria página:

| # | Caso | Esperado | Resultado |
|---|------|----------|-----------|
| 1 | PNG transparente | Canal de transparência, recorte no contorno | OK — alpha/threshold, 55 x 61 mm, 66.916 triângulos |
| 2 | Foto com fundo (JPEG 1600x1200) | Relevo contínuo | OK — luma/contínuo, 55 x 49 mm, 69.436 triângulos |
| 3 | Desenho preto em fundo branco | Threshold invertido (o desenho sobe) | OK — luma/threshold/invertido, 55 x 62 mm |
| 4 | Imagem 4096x4096 | Carrega sem travar a interface | OK — 235 ms entre soltar o arquivo e ter a malha |
| 5 | GIF | Rejeitado: "Formato não suportado. Use PNG, JPEG ou WebP." | OK — mensagem exibida, modelo anterior mantido |
| 6 | Imagem toda branca | "Não detectamos um desenho nesta imagem." | OK — mensagem exibida, download desabilitado |

Não coberto pela execução acima: abrir o STL num fatiador real (Cura,
PrusaSlicer). Os arquivos foram conferidos por script (arestas, volume,
`z` mínimo), mas vale abrir um antes de imprimir.
