import { raciocinio } from './ia';

/** Análise de exigências de habilitação por IA: prompt (ajustável na Administração), formato de resposta e chamada à OpenAI. */

export const CHAVE_PROMPT = 'prompt_exigencias';
export const GRUPOS = { jur: 'Regularidade jurídica', fis: 'Regularidade fiscal, social e trabalhista', eco: 'Qualificação econômico-financeira', tec: 'Capacidade técnico-operacional', dec: 'Declarações obrigatórias' } as const;
export const SITUACOES = ['atendido', 'parcial', 'pendente', 'vencido', 'incompat'] as const;

export const PROMPT_PADRAO = `Você é analista sênior de licitações públicas no Brasil (Lei 14.133/2021, arts. 62 a 70, e legislação correlata).
Leia o edital, o termo de referência, os anexos, os esclarecimentos e as respostas a impugnações fornecidos e extraia TODAS as exigências de habilitação que a licitante deverá cumprir para o lote indicado.

Classifique cada exigência em um dos cinco grupos:
1. jur · Regularidade jurídica (ato constitutivo, registro comercial, procuração, documentos dos administradores etc.)
2. fis · Regularidade fiscal, social e trabalhista (CNPJ, inscrições, certidões federal/estadual/municipal, FGTS, CNDT etc.)
3. eco · Qualificação econômico-financeira (balanço, índices de liquidez e solvência, patrimônio líquido ou capital mínimo, certidão de falência)
4. tec · Capacidade técnico-operacional e técnico-profissional (atestados com quantitativos e parcelas de maior relevância, registros em conselho, profissionais, certificações, amostras, visita técnica)
5. dec · Declarações obrigatórias (cumprimento dos requisitos de habilitação, art. 7º XXXIII da Constituição, reserva de cargos para PcD e reabilitados, ME/EPP, proposta independente, inexistência de fato impeditivo etc.)

Regras:
- Seja objetivo e mensurável: cite quantidades, percentuais, prazos de validade e o número da cláusula e a página quando houver.
- Considere que esclarecimentos e respostas a impugnações podem alterar o edital; prevaleça o texto mais recente e indique a origem.
- Compare cada exigência com o acervo de documentos da empresa informado. Só use como evidência documentos que constam do acervo, citando os ids.
- Documento vencido na data da sessão não atende. Sem documento correspondente, a situação é "pendente".
- Na capacidade técnica, avalie o grau de aderência (0 a 100%) entre os atestados da empresa e o objeto, os quantitativos e as parcelas de maior relevância, e diga exatamente o que precisa ser complementado.
- Não invente exigências: se algo não estiver claro, registre como ponto de atenção.
- Escreva em português do Brasil, em linguagem simples.`;

/** Formato de saída (JSON estrito). Não fica no campo editável para que o ajuste do prompt não quebre a tela. */
export const ESQUEMA = {
  type: 'object', additionalProperties: false, required: ['resumo', 'itens', 'atencao'],
  properties: {
    resumo: { type: 'string', description: 'Resumo executivo em até 5 frases: viabilidade da habilitação e o que precisa ser providenciado.' },
    atencao: { type: 'array', items: { type: 'string' }, description: 'Pontos de atenção: ambiguidades, exigências possivelmente restritivas, prazos.' },
    itens: {
      type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['grupo', 'cl', 'pg', 'fonte', 'req', 'docs', 'ev', 'st', 'grau', 'dif'],
        properties: {
          grupo: { type: 'string', enum: Object.keys(GRUPOS) },
          cl: { type: ['string', 'null'], description: 'Número da cláusula/item do edital ou do anexo' },
          pg: { type: ['string', 'null'], description: 'Página onde está a exigência' },
          fonte: { type: 'string', description: 'Documento de onde a exigência foi extraída (edital, TR, anexo, esclarecimento, resposta à impugnação)' },
          req: { type: 'string', description: 'Exigência, de forma mensurável' },
          docs: { type: 'array', items: { type: 'string' }, description: 'Ids dos documentos do acervo usados como evidência' },
          ev: { type: 'string', description: 'Evidência encontrada no acervo da empresa (ou a ausência dela)' },
          st: { type: 'string', enum: [...SITUACOES] },
          grau: { type: ['integer', 'null'], description: 'Só no grupo tec: aderência de 0 a 100. Nos demais, null.' },
          dif: { type: 'string', description: 'O que falta, o que complementar ou o cuidado a tomar. Vazio se atendido sem ressalvas.' }
        }
      }
    }
  }
} as const;

export interface Fonte { nome: string; texto: string; escaneado?: boolean; pdf?: Uint8Array; paginas?: number }

/** Limita o volume enviado: edital e termo de referência primeiro, depois os demais, até o teto de caracteres. */
export function montarFontes(fontes: Fonte[], teto = 600000) {
  const peso = (n: string) => /edital/i.test(n) ? 0 : /termo de refer|\btr\b|projeto b[aá]sico/i.test(n) ? 1 : /esclarec|impugna|retifica|errata|aviso/i.test(n) ? 2 : 3;
  const ord = [...fontes].sort((a, b) => peso(a.nome) - peso(b.nome));
  let usado = 0; const textos: string[] = []; const cortados: string[] = [];
  for (const f of ord) {
    if (!f.texto) continue;
    const livre = teto - usado; if (livre < 2000) { cortados.push(f.nome); continue; }
    const t = f.texto.length > livre ? f.texto.slice(0, livre) + '\n[… texto cortado por limite de tamanho]' : f.texto;
    if (f.texto.length > livre) cortados.push(f.nome);
    textos.push(`=== DOCUMENTO: ${f.nome} ===\n${t}`); usado += t.length;
  }
  // PDFs escaneados (sem texto) seguem como arquivo, até 3 e 30 MB no total
  const arquivos: Fonte[] = []; let bytes = 0;
  for (const f of ord.filter((x) => x.escaneado && x.pdf)) { if (arquivos.length >= 3 || bytes + f.pdf!.byteLength > 30e6) { cortados.push(f.nome); continue; } arquivos.push(f); bytes += f.pdf!.byteLength; }
  return { textos, arquivos, cortados, caracteres: usado };
}

export function corpoRequisicao(o: { instrucoes: string; contexto: string; textos: string[]; arquivos: Fonte[]; modelo: string }) {
  const conteudo: any[] = [{ type: 'input_text', text: o.contexto }];
  for (const a of o.arquivos) conteudo.push({ type: 'input_file', filename: a.nome.replace(/[^\w.\-]+/g, '_').slice(-80).replace(/(\.pdf)?$/i, '.pdf'), file_data: 'data:application/pdf;base64,' + Buffer.from(a.pdf!).toString('base64') });
  conteudo.push({ type: 'input_text', text: 'DOCUMENTOS DO PROCESSO (texto extraído):\n\n' + (o.textos.join('\n\n') || '(nenhum texto extraído; veja os arquivos anexados)') });
  const corpo: any = {
    model: o.modelo, stream: true,
    instructions: o.instrucoes,
    input: [{ role: 'user', content: conteudo }],
    text: { format: { type: 'json_schema', name: 'analise_exigencias', strict: true, schema: ESQUEMA } }
  };
  const rz = raciocinio(o.modelo); if (rz) corpo.reasoning = rz;
  return corpo;
}

/** Mensagem compreensível para os erros mais comuns da OpenAI. */
export function erroOpenAI(status: number, corpo: string) {
  let msg = ''; try { msg = JSON.parse(corpo)?.error?.message || ''; } catch { /* corpo não é JSON */ }
  if (status === 401) return 'A OpenAI recusou a chave de acesso (401). Confira a variável OPENAI_API_KEY no Railway: chave válida, sem aspas nem espaços.';
  if (status === 429) return 'A OpenAI recusou por limite de uso ou falta de crédito (429). Confira o saldo em platform.openai.com › Billing.';
  if (status === 404 || /model/i.test(msg)) return `Modelo de IA indisponível para esta chave (${status}). Confira OPENAI_MODEL no Railway.` + (msg ? ' Detalhe: ' + msg.slice(0, 160) : '');
  if (status === 400 && /context|too long|tokens/i.test(msg)) return 'Os documentos passaram do tamanho que o modelo aceita. Remova anexos irrelevantes e tente de novo.';
  return `Falha na API de IA (${status}).` + (msg ? ' Detalhe: ' + msg.slice(0, 200) : '');
}
