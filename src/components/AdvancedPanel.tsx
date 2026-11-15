// Placeholder do Modo Avançado. Os controles reais entram no Marco 5.
const SECOES = [
  { titulo: 'Captura e Tratamento', itens: 'Canal, modo de captura, brilho, contraste, gama, ruído, camadas' },
  { titulo: 'Estrutura (mm)', itens: 'Estilo, relevo, largura, espessura da base, altura, margem, borda' },
  { titulo: 'Argola e Malha', itens: 'Posição, diâmetros, filtro de ilhas, resolução da malha' },
];

export default function AdvancedPanel() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="mx-auto flex h-[280px] w-[280px] max-w-full items-center justify-center rounded-lg border border-borda bg-fundo text-xs text-apoio">
        Prévia 2D
      </div>
      {SECOES.map((s) => (
        <section key={s.titulo} className="rounded-lg border border-borda p-3">
          <h2 className="text-sm font-semibold">{s.titulo}</h2>
          <p className="mt-1 text-xs text-apoio">{s.itens}</p>
        </section>
      ))}
    </div>
  );
}
