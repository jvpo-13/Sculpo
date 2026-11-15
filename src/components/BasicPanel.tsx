// Placeholder do Modo Básico. Os cards interativos entram no Marco 4.
const CONTROLES = [
  { titulo: 'Estilo', opcoes: 'Recorte no Contorno · Redondo · Quadrado · Placa Retangular' },
  { titulo: 'Tamanho', opcoes: 'P (40 mm) · M (55 mm) · G (70 mm)' },
  { titulo: 'Tipo de Relevo', opcoes: 'Alto-Relevo · Entalhado' },
  { titulo: 'Argola', opcoes: 'No Topo · Na Lateral · Sem Argola' },
];

export default function BasicPanel() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {CONTROLES.map((c) => (
        <section key={c.titulo} className="rounded-lg border border-borda p-3">
          <h2 className="text-sm font-semibold">{c.titulo}</h2>
          <p className="mt-1 text-xs text-apoio">{c.opcoes}</p>
        </section>
      ))}
    </div>
  );
}
