export const metadata = { title: 'Kaizen B2G', description: 'Licitações e rentabilidade contratual' };
export const viewport = { width: 'device-width', initialScale: 1 };
export default function Raiz({ children }: { children: React.ReactNode }) {
  return (<html lang="pt-BR"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Public+Sans:wght@400;500;600;700&display=swap" /></head><body style={{ margin: 0, fontFamily: 'Public Sans, system-ui, sans-serif', background: '#130a26', color: '#efeaff' }}>{children}</body></html>);
}
