export const metadata = { title: 'Kaizen B2G', description: 'Licitações e rentabilidade contratual' };
export const viewport = { width: 'device-width', initialScale: 1 };
export default function Raiz({ children }: { children: React.ReactNode }) {
  return (<html lang="pt-BR"><body style={{ margin: 0, fontFamily: 'Public Sans, system-ui, sans-serif', background: '#fff', color: '#16202b' }}>{children}</body></html>);
}
