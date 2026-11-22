"""Teste ponta a ponta contra o app local (next dev + Postgres local, AUTH_MODE=dev).
Uso: python3 tests/e2e_local.py  (requer playwright e o app em http://localhost:3000)"""
import asyncio, json, os
from playwright.async_api import async_playwright
BASE = os.environ.get('BASE', 'http://localhost:3000')
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')
ok = []; falhas = []
def check(nome, cond, extra=''):
    (ok if cond else falhas).append(nome); print(('OK   ' if cond else 'FALHA ') + nome + (' · ' + str(extra) if extra else ''))

async def entrar(b, slug):
    ctx = await b.new_context(viewport={'width': 1366, 'height': 900})
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    await pg.goto(BASE + '/login'); await pg.select_option('select[name=slug]', slug); await pg.click('button')
    await pg.wait_for_url('**/plataforma'); await pg.wait_for_function('window.KB && KB.S'); return pg

async def salvo(pg):
    await pg.wait_for_function('window.KB && true'); await pg.evaluate('KB.flush()'); await pg.wait_for_timeout(400)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        w = await entrar(b, 'william'); T = w.inner_text
        await w.click('#uf-PR'); check('T1: PR mostra 3 licitações (Alfa, certames)', '3 certames' in ' '.join((await T('.pval')).split()), await T('.pval'))
        # decisão persistida
        await w.evaluate("KB.go({v:'dec',crt:'CRT-PR-0101',n:1,tab:'dec'})"); await w.wait_for_timeout(200)
        await w.check('input[value="participar"]'); await w.fill('#t2just', 'Teste ponta a ponta: exigências atendidas.'); await w.click('[data-act="t2save"]'); await salvo(w)
        await w.reload(); await w.wait_for_function('window.KB')
        et = await w.evaluate("KB.T4.lpOf('CRT-PR-0101','A',1).et"); check('T2: decisão gravada no banco e mantida após recarregar', et == 'Em preparação', et)
        # Rui não grava (servidor recusa)
        r = await entrar(b, 'rui')
        resp = await r.evaluate("""fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:'lote',chave:'A|CRT-PR-0101|2',rev:KB.T4.lpOf('CRT-PR-0101','A',2)._rev,dados:{...KB.T4.lpOf('CRT-PR-0101','A',2),et:'Arquivada'}})}).then(r=>r.status)""")
        check('Permissão: perfil de consulta não altera lote (403)', resp == 403, resp)
        # Bruno não vê a Alfa, nem por URL direta
        bru = await entrar(b, 'bruno')
        d = await bru.evaluate("fetch('/api/dados').then(r=>r.json())")
        check('Isolamento: Bruno não recebe dados da Alfa', all(x['emp'] == 'B' for x in d['PART']) and 'A' not in d['EMP'] and not any(c['id'] == 'CRT-PR-0103' for c in d['CRT']))
        # deliberação: Carlos e Paula
        await w.evaluate("KB.go({v:'prec',crt:'CRT-PE-0115',emp:'A',n:1,tab:'apr'})")
        c = await entrar(b, 'carlos'); await c.evaluate("KB.go({v:'prec',crt:'CRT-PE-0115',emp:'A',n:1,tab:'apr'})"); await c.wait_for_timeout(150)
        # versão muda no servidor enquanto Carlos analisa (Ana ajusta)
        ana = await entrar(b, 'ana'); await ana.evaluate("KB.go({v:'prec',crt:'CRT-PE-0115',emp:'A',n:1,tab:'apr'})"); await ana.wait_for_timeout(150)
        await ana.click('[data-act="t4other"]'); await salvo(ana)
        await c.click('[data-act="t4vote"][data-ok="1"]'); await c.wait_for_timeout(1200)
        check('Versão: clique sobre números antigos é recusado pelo servidor', 'mudaram' in (await c.inner_text('#toast')), await c.inner_text('#toast'))
        await c.wait_for_timeout(2500); await c.wait_for_function('window.KB'); await c.evaluate("KB.go({v:'prec',crt:'CRT-PE-0115',emp:'A',n:1,tab:'apr'})"); await c.wait_for_timeout(200)
        await c.click('[data-act="t4vote"][data-ok="1"]'); await salvo(c)
        pa = await entrar(b, 'paula'); await pa.evaluate("KB.go({v:'prec',crt:'CRT-PE-0115',emp:'A',n:1,tab:'apr'})"); await pa.wait_for_timeout(150)
        await pa.click('[data-act="t4vote"][data-ok="1"]'); await salvo(pa); await pa.reload(); await pa.wait_for_function('window.KB')
        st = await pa.evaluate("(()=>{const o=KB.T4.lpOf('CRT-PE-0115','A',1).orc;return o.vers[o.vers.length-1].st})()")
        check('T4: aprovação só com os dois designados, persistida', st == 'aprovada', st)
        # upload, renovação e download do arquivo
        await w.evaluate("KB.S.stack=[{v:'acervo',p:'fis'}];KB.render()"); await w.click('[data-act="t3ren"][data-id="DOC-A-005"]')
        await w.set_input_files('#t3arq', files=[{'name': 'crf-fgts-renovado.pdf', 'mimeType': 'application/pdf', 'buffer': b'%PDF-1.4 teste e2e'}])
        await w.fill('#t3val', '2027-05-20'); await w.click('[data-act="t3save"]'); await w.wait_for_timeout(800); await salvo(w)
        await w.reload(); await w.wait_for_function('window.KB')
        doc = await w.evaluate("KB.ACV.find(d=>d.id==='DOC-A-005')")
        check('T3: renovação cria versão com arquivo e preserva histórico', doc['v'] == 2 and doc.get('arqId') and len(doc['hist']) == 1, (doc['v'], doc.get('arqId')))
        txt = await w.evaluate(f"fetch('/api/arquivos/{doc.get('arqId')}').then(r=>r.text())")
        check('Arquivo privado baixa para quem tem acesso', 'teste e2e' in txt)
        st_b = await bru.evaluate(f"fetch('/api/arquivos/{doc.get('arqId')}').then(r=>r.status)")
        check('Arquivo da Alfa inacessível para Bruno por URL direta (404)', st_b == 404, st_b)
        # pacote gerado no servidor
        await w.evaluate("KB.go({v:'pac',crt:'CRT-PR-0101',emp:'A'})"); await w.wait_for_timeout(200); await w.click('[data-act="t3gen"]'); await w.wait_for_timeout(800)
        n = await w.evaluate("fetch('/api/dados').then(r=>r.json()).then(d=>(d.PKG['A|CRT-PR-0101']||[]).length)")
        check('T3: pacote da participação gravado', n >= 1, n)
        # nota fiscal: falha sem recibo, recepção, reimportação idempotente
        await w.evaluate("KB.S.stack=[{v:'nf'}];KB.render()"); await w.wait_for_timeout(150)
        await w.check('#t8fail'); await w.click('[data-act="t8rec"]'); await w.wait_for_timeout(600)
        check('T8: falha de gravação não emite recibo', 'nenhum recibo' in (await w.inner_text('#vfic')))
        await w.uncheck('#t8fail'); await w.click('[data-act="t8rec"]'); await w.wait_for_timeout(800)
        check('T8: nota recepcionada com recibo', 'nota fiscal recepcionada pelo sistema' in (await w.inner_text('#vfic')).lower())
        await w.click('[data-act="t8kit"]'); await salvo(w)
        await w.click('[data-act="t8rec"]'); await w.wait_for_timeout(800)
        check('T8: reimportar a mesma nota recupera o registro', 'recuperado' in (await w.inner_text('#toast')))
        cnt = await w.evaluate("fetch('/api/dados').then(r=>r.json()).then(d=>[d.REC.length, !!d.REC[0].kit])")
        check('T8: kit gravado e nota sem duplicidade', cnt == [1, True], cnt)
        # contrato de bens: reserva persistida
        await w.evaluate("KB.go({v:'cb',id:'CTR-0103'})"); await w.wait_for_timeout(150)
        await w.select_option('[data-chg="t6samp"]', 'ok'); await w.click('[data-act="t6res"]'); await salvo(w)
        await w.reload(); await w.wait_for_function('window.KB')
        res = await w.evaluate("KB.T6.resv(KB.T6.goods(KB.KM['CTR-0103']))")
        check('T6: reserva de empenho persistida', res == 30, res)
        # importação
        await w.evaluate("KB.S.stack=[{v:'imp',modo:'csv'}];KB.render()"); await w.click('[data-act="t2prev"]'); await w.click('[data-act="t2impgo"]'); await w.wait_for_timeout(2500)
        await w.wait_for_function('window.KB'); await w.click('[data-nav="map"]'); await w.click('#uf-PR')
        check('T2: importação gravada e refletida no mapa (PR passa a 4)', '4 certames' in ' '.join((await w.inner_text('.pval')).split()), await w.inner_text('.pval'))
        # modo demonstração e auditoria
        aud = await w.evaluate("fetch('/api/dados').then(r=>r.ok)")
        check('Sem erros de script nas páginas', not (w.errs + c.errs + pa.errs + ana.errs + r.errs + bru.errs), (w.errs + c.errs)[:2])
        print(f'\n{len(ok)} aprovados, {len(falhas)} falhas'); await b.close()
if __name__ == "__main__":
    asyncio.run(main())
