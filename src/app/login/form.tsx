'use client';
import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const campo: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, minHeight: 44, fontSize: 16, padding: '8px 10px', border: '1px solid #d3d9e0', borderRadius: 8, boxSizing: 'border-box' };
export default function FormLogin({ url, chave }: { url: string; chave: string }) {
  const [email, setEmail] = useState(''); const [senha, setSenha] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const sb = createBrowserClient(url, chave);
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    setBusy(false); if (error) return setMsg('E-mail ou senha inválidos.');
    window.location.href = '/plataforma';
  }
  async function link() {
    if (!email) return setMsg('Informe o e-mail.'); setBusy(true);
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/auth/callback', shouldCreateUser: false } });
    setBusy(false); setMsg(error ? 'Não foi possível enviar o link: ' + error.message : 'Enviamos um link de acesso para o seu e-mail.');
  }
  return (
    <form onSubmit={entrar} style={{ display: 'grid', gap: 12 }}>
      <label style={{ fontSize: 14, color: '#5a6573' }}>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={campo} autoComplete="email" /></label>
      <label style={{ fontSize: 14, color: '#5a6573' }}>Senha<input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} style={campo} autoComplete="current-password" /></label>
      <button disabled={busy} style={{ minHeight: 44, background: '#1559a8', color: '#fff', border: 0, borderRadius: 8, fontWeight: 600, fontSize: 16 }}>{busy ? 'Entrando…' : 'Entrar'}</button>
      <button type="button" onClick={link} disabled={busy} style={{ minHeight: 44, background: '#fff', color: '#1559a8', border: '1px solid #d3d9e0', borderRadius: 8, fontSize: 15 }}>Receber link de acesso por e-mail</button>
      {msg && <p style={{ fontSize: 14, color: '#5a6573', margin: 0 }}>{msg}</p>}
    </form>
  );
}
