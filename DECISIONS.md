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

## Marco 2
- Arquivos além dos listados no spec: `grid.ts` (morfologia binária, buracos, componentes), `resample.ts` (B.1), `params.ts` (clamps 3.5), `pipeline.ts` (orquestra B a E; é o que o worker vai chamar).
- A reamostragem para R=512 (B.1) roda uma vez por imagem, no `load`, pois não depende de parâmetros; o cache tonal cobre os passos B.2 a B.9.
- A imagem de trabalho guarda RGB já compostos sobre branco; `saturation` é calculada sobre esses valores compostos.
- Blur e Sobel replicam o pixel da borda; a morfologia ignora vizinhos fora da imagem.
- Tom fora do retângulo do conteúdo (a margem) vale 0 em todos os estilos; no entalhado a margem fica alta.
- Margem efetiva = min(margem, (largura - 4)/2): o conteúdo nunca fica menor que 4 mm (largura 20 + margem 10 zeraria o conteúdo).
- O disco inteiro da argola é plano (relevo 0), inclusive onde sobrepõe o corpo.
- Ponte da argola: meia-largura mínima de 0,75 célula, para a faixa ser contínua em grade grossa.
- Célula criada pela correção de pinças é corpo se as duas diagonais forem corpo; senão é argola.
- "Área < minIslandMm²" = área em mm² menor que `minIslandMm` ao quadrado.
- O aviso `contourFallback` só aparece no estilo contour (nos outros a figura não é usada).
- A borda protetora erode a ocupação inteira (corpo + argola), então não surge borda na junção com a argola.
- `layers = 1` é tratado como 0 (contínuo); `blurPx`, `morphology` e `meshResolution` são arredondados para inteiro.
- Origem da malha = canto inferior esquerdo da GRADE; a caixa total fica alinhada ao topo-esquerda, então pode sobrar menos de 1 célula vazia embaixo/à direita.
- Diagonal dos quads fixa (inferior-esquerdo -> superior-direito), igual no topo e no fundo.
- `lowContrast` entra em `stats.warnings` a partir da detecção guardada na fonte.
- O benchmark usa o melhor de 3 execuções, para medir o algoritmo e não o aquecimento do JIT.

## Marco 3
- `DedicatedWorkerGlobalScope` não existe na lib DOM: o worker declara uma interface local mínima com esse nome (sem adicionar a lib WebWorker).
- Fila do cliente: 1 em voo + 1 pendente POR TIPO (load, build, exportStl), para um build novo nunca derrubar uma exportação; prioridade load > build > exportStl.
- Requisição superada resolve com `null` (não é erro); um novo `load` invalida tudo o que estava em voo ou na fila.
- Timeout no próprio `load` NÃO reenvia o arquivo (repetiria o timeout para sempre); nos demais casos o arquivo é recarregado em silêncio no worker novo.
- Se o carregamento falha (decode/blank/timeout), a imagem e a malha anteriores são descartadas; se só a validação 3.1 falha, o modelo atual é mantido.
- Mensagens fora do spec: "Não foi possível ler esta imagem." (decode), "Não foi possível gerar o modelo." e "Algo deu errado. Tente novamente.".
- `file.type` vazio é rejeitado como formato não suportado (o spec exige tipo E bytes).
- A validação 3.1 mora em `src/core/validate.ts` (pura, testada em Node); a prévia 2D (`PreviewCanvas`) foi adiantada do Marco 5 para dar retorno visual antes do viewport.
- Arquivos do Marco 1 alterados: `store.ts` (ação `clearImage`), `Header.tsx`, `App.tsx` e `ViewportPlaceholder.tsx` (ligação ao worker).

## Marco 4
- Intensidades das luzes multiplicadas por PI: desde a r155 o three usa luzes fisicamente corretas e 0.6/0.8/0.2 ficariam ~3x mais escuras que o pretendido.
- Hemisfério: céu branco, chão #666666 (0.4 do branco), intensidade 0.6; a luz direcional vem de (40, -50, 120).
- Um plano com ShadowMaterial logo abaixo de z=0 recebe a sombra do modelo; some junto com as sombras se o fps cair.
- Queda de fps: 12 quadros seguidos acima de 33 ms durante a interação desligam as sombras (medido só enquanto o usuário gira, pois o render é sob demanda).
- A câmera pode ir para baixo da mesa (útil para conferir o fundo do chaveiro).
- O renderer é criado uma vez e o viewport fica sempre montado; o estado vazio é uma camada por cima.
- O estado vazio tem seu próprio input de arquivo: clicar no texto também abre o seletor.
- Miniaturas de exemplo: se o arquivo não existe, a miniatura some (no cabeçalho e no estado vazio).
- Avisos dispensados na faixa voltam se o conjunto de avisos mudar; o indicador "Processando…" fica na mesma faixa do topo.
- Cards do Modo Básico são radios nativos escondidos (setas do teclado funcionam sem código extra).
- Altura mínima do viewport no layout estreito: 420px.
- `ViewportPlaceholder.tsx` (Marcos 1 e 3) foi removido: substituído por `ViewportArea.tsx` + `src/three/`.
- Custo conhecido: `toCreasedNormals` roda na thread principal (~70 ms a 160, ~150–200 ms a 250). É o que o spec pede; mover para o worker é a otimização óbvia se incomodar.

## Marco 5
- Debounce de 50 ms só para mudanças de parâmetro dentro do Modo Avançado; troca de modo, nova imagem e cards do básico disparam o build na hora.
- "Níveis de Camada" em 0 ou 1 mostra "contínuo" (1 nível não existe; o core trata como 0).
- Controles da argola ficam desabilitados quando "Usar Argola" está desligado.
- Passos dos sliders onde o spec não diz: gama 0,05; mm 0,1 (margem e diâmetro externo 0,5); posição da argola 0,05; resolução 5.
- Rótulos dos canais: Luminosidade, Vermelho, Verde, Azul, Saturação, Transparência.
- Seletor de modo do cabeçalho segue o padrão de radiogroup (Tab entra no selecionado, setas trocam).
- O workflow de deploy roda `npm test` antes do build e usa Node 20.
- Arquivos de marcos anteriores alterados: `AdvancedPanel.tsx` (substitui o placeholder), `actions.ts` (debounce), `Header.tsx` (setas no seletor de modo), `README.md`.
