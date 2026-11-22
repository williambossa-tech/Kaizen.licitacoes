import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql };

/** Conexão única (pooler do Supabase em modo transação: sem prepared statements). */
export function sql(): postgres.Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    g.__sql = postgres(url, {
      prepare: false,
      max: 8,
      idle_timeout: 20,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? false : 'require',
      types: {
        numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
        date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
        ts: { to: 1114, from: [1114], serialize: (x: unknown) => String(x), parse: (x: string) => x.replace(' ', 'T').slice(0, 16) },
        tstz: { to: 1184, from: [1184], serialize: (x: unknown) => String(x), parse: (x: string) => x }
      }
    });
  }
  return g.__sql;
}

export type Tx = postgres.TransactionSql;

/**
 * Executa em transação com o papel "authenticated" e o perfil efetivo do usuário,
 * para que as políticas de RLS do banco valham também para o servidor.
 */
export async function comPerfil<T>(perfilId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await tx.unsafe('set local role authenticated');
    await tx`select set_config('app.perfil_id', ${perfilId}, true)`;
    return fn(tx);
  }) as Promise<T>;
}
