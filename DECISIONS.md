# Decisões

Uma linha por decisão tomada onde o spec é omisso ou tinha um erro real.

## Correções ao spec (Parte 9)
- Gama (4.B.6): clamp de `v` a 0..255 ANTES da potência; brilho/contraste podem deixar `v` negativo e `pow` daria NaN.
- Decodificação (3.3): `resizeWidth/Height` exige saber a dimensão antes de decodificar; decodifico uma vez e reduzo com `drawImage` (smoothing 'high') num OffscreenCanvas.
- Volume (5.2b): com 2 triângulos por célula o volume exato pesa a diagonal em dobro; o teste usa a fórmula da diagonal escolhida (fixa), não a média simples dos 4 cantos.
- Furo da argola (4.C.6): em grade grossa o disco do furo pode rasterizar em 0 células; nesse caso escavo a célula do centro para o furo nunca sumir.
- Configs (`vite.config.ts`, `tailwind.config.ts`) não usam APIs do Node, pois o tsconfig só tem lib DOM e `@types/node` não está na lista de dependências.

## Marco 1
- Trocar básico -> avançado reinicializa `advanced` com `deriveAdvanced` TODA vez (leitura literal do spec; o mais simples).
- Carregar uma nova imagem também reinicializa `advanced` a partir da nova detecção.
- Com argola 'none', `ringPosX/Y` ficam em (0,1); não são usados.
- Breakpoint de 900px exposto como screen Tailwind `largo`.
- `src/state/__tests__/store.spec.ts` cobre a regra dos params efetivos (além do teste pedido de `deriveAdvanced`).
- Versões: última patch dentro das majors fixadas pelo spec (`three` e `@types/three` presos em 0.160.x com `~`).
