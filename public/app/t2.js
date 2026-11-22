/* Template 2 — Carteira, entrada e decisão de participação */
{
const K=window.KB;const {S,CM,CRT,PART,RES,EMP,USERS,$,NF,brl,brlc,pct,dt,dth,esc,norm,plural,toast,go,render,top,scope,partsAll,situ,SIT,DEC,fact,HOJE,UF}=K;
const ARQ='Arquivada';
/* ---------- dados operacionais (responsáveis, prazos, frentes) ---------- */
const OPS={
'A|CRT-PR-0101|1':{resp:'ana',prazo:'2026-11-25',acao:'Decidir participação',aprov:['carlos','william']},
'A|CRT-PR-0101|2':{resp:'ana',prazo:'2026-11-24',acao:'Concluir análise preliminar'},
'A|CRT-PR-0102|1':{resp:'ana',prazo:'2026-11-24',acao:'Responder diligência de habilitação'},
'A|CRT-SP-0108|1':{resp:'ana',prazo:'2026-11-26',acao:'Acompanhar reabertura da sessão'},
'A|CRT-SP-0109|1':{resp:'ana',prazo:'2026-12-02',acao:'Concluir análise preliminar'},
'A|CRT-RJ-0112|1':{resp:'marina',prazo:'2026-11-24',acao:'Apresentar contrarrazões'},
'A|CRT-PE-0115|1':{resp:'ana',prazo:'2026-11-27',acao:'Aprovar orçamento (colegiado)',prep:{orc:'Aguardando aprovação',hab:'Em andamento'}},
'A|CRT-AM-0116|1':{resp:'ana',prazo:'2026-11-28',acao:'Concluir análise preliminar'},
'A|CRT-XX-0199|1':{resp:'ana',prazo:'2026-11-26',acao:'Completar localização e analisar'},
'B|CRT-DF-0304|1':{resp:'ana',prazo:'2026-11-23',acao:'Registrar resultado da negociação'},
'B|CRT-DF-0305|1':{resp:'ana',prazo:'2026-11-26',acao:'Decidir participação',aprov:['bruno','william']},
'B|CRT-SP-0308|1':{resp:'ana',prazo:'2026-11-30',acao:'Elaborar orçamento',prep:{orc:'A elaborar',hab:'Em andamento'}},
'B|CRT-CE-0309|1':{resp:'marina',prazo:'2026-11-25',acao:'Acompanhar recurso da concorrente'}};
const ETS=['Prospectada','Em análise preliminar','Aguardando aprovação da participação','Participação aprovada','Em preparação','Proposta apresentada','Em disputa','Acompanhamento pós-disputa','Adjudicada','Homologada','Aguardando assinatura','Formalizada'];
const addD=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
function seed(){for(const p of PART){const c=CM[p.crt];for(const [n,lp] of Object.entries(p.L)){if(lp._s)continue;lp._s=1;Object.assign(lp,OPS[p.emp+'|'+p.crt+'|'+n]||{});if(!lp.resp)lp.resp='ana';
  let path;if(lp.dec==='declinar')path=['Prospectada','Em análise preliminar','Aguardando aprovação da participação',ARQ];
  else if(lp.et===ARQ)path=ETS.slice(0,8).concat(lp.res==='cancelado'?[]:['Homologada']).concat([ARQ]);
  else{const i=ETS.indexOf(lp.et);path=ETS.slice(0,i+1)}
  const d0=c.pub,d1=c.enc?c.enc.d:(c.ses&&c.ses.slice(0,10)<HOJE?HOJE:addD(c.pub,8));const span=Math.max(1,(new Date(d1)-new Date(d0))/864e5);
  lp.hist=path.map((et,i)=>({et,d:addD(d0,Math.round(span*i/Math.max(1,path.length-1))),by:i===0?'Importação':i===2||i===3?(lp.aprov?K.uname(lp.aprov[0]):'Gestor do cliente'):K.uname(lp.resp)}));
  if(lp.dec==='participar'&&!lp.decisao)lp.decisao={by:p.emp==='A'?'carlos':'bruno',d:lp.hist[Math.min(3,lp.hist.length-1)].d,just:'Aprovada após análise preliminar.',v:1}}}}
const lotsAll=()=>{const r=[];partsAll().forEach(p=>Object.entries(p.L).forEach(([n,lp])=>r.push({p,emp:p.emp,crt:p.crt,n:+n,lp,c:CM[p.crt]})));return r};
const QF={mine:['Aguardando minha aprovação para participar',x=>x.lp.dec==='pendente'&&x.lp.et==='Aguardando aprovação da participação'&&(x.lp.aprov||[]).includes(S.user)],
orc:['Orçamento pendente',x=>x.lp.prep&&['A elaborar','Em ajuste','Aguardando aprovação'].includes(x.lp.prep.orc)],
disp:['Em disputa',x=>x.lp.et==='Em disputa'],pos:['Acompanhamento pós-disputa',x=>x.lp.et==='Acompanhamento pós-disputa']};
const closed=lp=>lp.et===ARQ||lp.et==='Formalizada';
const etq=et=>`<span class="pill ${et===ARQ?'conc':et==='Formalizada'?'ok':et.startsWith('Aguardando')?'warn':'fut'}">${et}</span>`;
function comps(lp){const a=[];if(lp.comp)a.push(lp.comp);if(lp.prep){a.push('Proposta/orçamento: '+lp.prep.orc);a.push('Habilitação: '+lp.prep.hab)}if(lp.recon&&lp.recon.st==='pendente')a.push('Reconfirmação de preço pendente');return a}
function resumo(ls){const cnt={};ls.forEach(x=>cnt[x.lp.et]=(cnt[x.lp.et]||0)+1);const k=Object.keys(cnt);return k.length===1?(ls.length>1?ls.length+' lotes · ':'')+k[0]:k.map(e=>cnt[e]+' '+e.toLowerCase()).join(' · ')}
const RESPN=k=>K.uname(k);
K.T2={lotsAll,QF,comps,etq,OPS,addD,resumo};

/* ---------- carteira ---------- */
K.view('cart',{label:()=>'Licitações',render(t){
 t.qf=t.qf||'todas';t.q=t.q||'';t.open=t.open||{};
 const all=lotsAll();const by={};all.forEach(x=>(by[x.crt]=by[x.crt]||[]).push(x));
 const cnt={todas:Object.keys(by).length};for(const k in QF)cnt[k]=Object.keys(by).filter(id=>by[id].some(QF[k][1])).length;
 let ids=Object.keys(by);if(t.qf!=='todas')ids=ids.filter(id=>by[id].some(QF[t.qf][1]));
 if(t.q){const q=norm(t.q);ids=ids.filter(id=>{const c=CM[id];return norm(c.org+' '+c.obj+' '+c.num+' '+id).includes(q)})}
 const nxt=id=>{const ls=by[id].filter(x=>!closed(x.lp)&&x.lp.prazo).sort((a,b)=>a.lp.prazo.localeCompare(b.lp.prazo));return ls[0]};
 ids.sort((a,b)=>{const A=by[a].every(x=>closed(x.lp)),B=by[b].every(x=>closed(x.lp));if(A!==B)return A?1:-1;const na=nxt(a),nb=nxt(b);return (na?na.lp.prazo:'9')<(nb?nb.lp.prazo:'9')?-1:1});
 const hit=x=>t.qf!=='todas'&&QF[t.qf][1](x);
 return `<div class="mod"><div class="mhead"><div><h1>Carteira de licitações</h1><p class="mut small">${S.emp==='ALL'?'Consolidado Alfa + Beta':EMP[S.emp].nome+' · CNPJ '+EMP[S.emp].cnpj} · ${cnt.todas} licitações no escopo autorizado</p></div>
 <div class="acts">${K.can('preparar')&&S.emp!=='ALL'?'<button class="btn pri" data-act="t2imp">Importar edital</button>':''}<button class="btn" data-act="t2dia">Meu dia</button><button class="btn" data-act="t2bpmn">Documentação do processo</button></div></div>
 <div class="qf" role="group" aria-label="Filtros rápidos">${[['todas','Todas'],...Object.entries(QF).map(([k,v])=>[k,v[0]])].map(([k,l])=>`<button class="chip" data-act="t2qf" data-k="${k}" aria-pressed="${t.qf===k}">${l}<span class="c">${cnt[k]}</span></button>`).join('')}</div>
 <input type="search" data-inp="t2q" value="${esc(t.q)}" placeholder="Buscar por órgão, objeto ou número" style="width:min(100%,460px);margin-bottom:10px" aria-label="Buscar licitações">
 <div class="lrow h"><span>Licitação e órgão</span><span>Etapa</span><span>Responsável</span><span>Próximo prazo</span><span>Próxima ação</span><span></span></div>
 ${ids.length?ids.map(id=>{const c=CM[id],ls=by[id],nx=nxt(id),op=t.open[id]??(t.qf!=='todas');const tags=[...new Set(ls.flatMap(x=>comps(x.lp)))];
  return `<div class="lrow"><button class="tbtn" data-act="t2proc" data-crt="${id}" style="display:grid;text-align:left"><span class="t">${esc(c.org)}</span><span class="small mut">${c.mod} ${c.num} · ${esc(c.obj)}${S.emp==='ALL'?' · '+[...new Set(ls.map(x=>EMP[x.emp].curto))].join(' e '):''}</span></button>
  <span>${ls.length===1?etq(ls[0].lp.et):`<span class="small">${resumo(ls)}</span>`}${tags.length?'<br>'+tags.map(x=>`<span class="pill comp small">${x}</span>`).join(' '):''}</span>
  <span class="small">${[...new Set(ls.filter(x=>!closed(x.lp)).map(x=>RESPN(x.lp.resp)))].join(', ')||'—'}</span>
  <span class="small num">${nx?dt(nx.lp.prazo):c.ses&&situ(c)==='fut'?'Sessão '+dt(c.ses):'—'}</span>
  <span class="small">${nx?nx.lp.acao:ls.every(x=>closed(x.lp))?'Concluída':'Acompanhar'}</span>
  <button class="exp" data-act="t2exp" data-crt="${id}" aria-expanded="${!!op}" aria-label="Lotes de ${esc(c.org)}">${op?'▾':'▸'}</button></div>
  ${op?ls.map(x=>`<div class="lrow sub ${hit(x)?'hit':''}"><button class="tbtn" data-act="t2dec" data-crt="${id}" data-n="${x.n}" style="text-align:left">Lote ${x.n} · ${esc(c.lotes[x.n-1].d)}</button><span>${etq(x.lp.et)}${comps(x.lp).map(y=>` <span class="pill comp small">${y}</span>`).join('')}</span><span class="small">${closed(x.lp)?'—':RESPN(x.lp.resp)}</span><span class="small num">${x.lp.prazo&&!closed(x.lp)?dt(x.lp.prazo):'—'}</span><span class="small">${closed(x.lp)?(x.lp.mot||x.lp.et):x.lp.acao||'Acompanhar'}</span><span></span></div>`).join(''):''}`}).join(''):'<p class="note">Nenhuma licitação com esses filtros.</p>'}
 <p class="note">Os contadores mostram licitações distintas; uma licitação aparece em mais de um filtro quando seus lotes estão em situações diferentes.</p></div>`}});
K.act('t2qf',a=>{top().qf=a.dataset.k;render()});
K.act('t2exp',a=>{const t=top();const id=a.dataset.crt;t.open[id]=!(t.open[id]??(t.qf!=='todas'));render()});
K.act('t2q',a=>{const t=top();t.q=a.value;const pos=a.selectionStart;render();const i=document.querySelector('[data-inp="t2q"]');i.focus();try{i.setSelectionRange(pos,pos)}catch(e){}});
K.act('t2proc',a=>go({v:'proc',crt:a.dataset.crt}));
K.act('t2dec',a=>go({v:'dec',crt:a.dataset.crt,n:+a.dataset.n,tab:'exig'}));
K.act('t2imp',()=>go({v:'imp'}));K.act('t2dia',()=>{S.stack=[{v:'dia'}];K.setHash('dia');render()});K.act('t2bpmn',()=>go({v:'bpmn'}));

/* ---------- ficha do processo ---------- */
K.procActions=[];
K.view('proc',{label:t=>CM[t.crt].mod.replace(' eletrônico','').replace(' eletrônica','')+' '+CM[t.crt].num,scoped:t=>partsAll().some(p=>p.crt===t.crt),render(t){
 const c=CM[t.crt];const ls=lotsAll().filter(x=>x.crt===t.crt);if(!ls.length)return '<p>Registro fora do escopo.</p>';
 const wait=[];ls.forEach(x=>{const lp=x.lp;if(lp.et==='Aguardando aprovação da participação')wait.push(`Lote ${x.n}: aguardando decisão de ${(lp.aprov||[]).map(RESPN).join(' ou ')} (alçada: decidir participação).`);
  if(lp.prep&&lp.prep.orc==='Aguardando aprovação'){const d=lp.delib;wait.push(`Lote ${x.n}: orçamento aguardando deliberação${d?': '+d.parts.map(p=>RESPN(p)+' '+(d.votos[p]?'✓':'pendente')).join(', '):' do colegiado'}.`)}
  if(lp.comp==='Fase recursal')wait.push(`Lote ${x.n}: prazo recursal em curso; jurídico (${RESPN(lp.resp)}) acompanha.`);
  if(lp.comp==='Sessão suspensa')wait.push(`Lote ${x.n}: sessão suspensa pelo órgão; aguardando reabertura.`)});
 return `<div class="mod"><div class="mhead"><div><div class="tags">${[...new Set(ls.map(x=>x.lp.et))].map(etq).join('')}${[...new Set(ls.flatMap(x=>comps(x.lp)))].map(x=>`<span class="pill comp">${x}</span>`).join('')}</div>
 <h1>${c.mod} nº ${c.num}</h1><p class="mut">${esc(c.org)} · ${esc(c.un)}</p></div>
 <div class="small mut" style="text-align:right">Participação de<br><b style="color:var(--ink)">${[...new Set(ls.map(x=>x.emp))].map(e=>EMP[e].nome+' · CNPJ '+EMP[e].cnpj).join('<br>')}</b></div></div>
 <div class="acts" style="margin-bottom:14px"><button class="btn pri" data-act="t2dec" data-crt="${c.id}" data-n="${ls[0].n}">Decisão de participação</button>${K.procActions.map(f=>f(c,ls)).join('')}<button class="btn" data-act="t2pub" data-crt="${c.id}">Ficha pública e BI</button><button class="btn" data-act="t2bpmn">Documentação do processo</button></div>
 <dl class="facts">${fact('Objeto',esc(c.obj))}${fact('Situação oficial do órgão',c.sit)}${fact('Sessão pública',dth(c.ses))}${fact('Portal',c.portal)}${fact('Modalidade e critério',c.mod+' · '+c.crit)}${fact('Fonte',c.src||'Adaptador de demonstração (integração simulada)')}</dl>
 ${wait.length?`<div class="callout warn"><b>Atividades em espera</b><br>${wait.join('<br>')}</div>`:''}
 <div class="sec"><h3>Lotes, etapas e frentes paralelas</h3><div class="scroll"><table class="stack"><thead><tr><th>Lote</th>${S.emp==='ALL'?'<th>Empresa</th>':''}<th>Etapa interna</th><th>Frentes em andamento</th><th>Responsável</th><th>Prazo</th><th>Próxima ação</th><th></th></tr></thead><tbody>
 ${ls.map(x=>`<tr><td data-l="Lote">${x.n} · ${esc(c.lotes[x.n-1].d)}</td>${S.emp==='ALL'?`<td data-l="Empresa">${EMP[x.emp].curto}</td>`:''}<td data-l="Etapa">${etq(x.lp.et)}</td><td data-l="Frentes">${comps(x.lp).join('<br>')||'—'}</td><td data-l="Responsável">${closed(x.lp)?'—':RESPN(x.lp.resp)}</td><td data-l="Prazo" class="num">${x.lp.prazo&&!closed(x.lp)?dt(x.lp.prazo):'—'}</td><td data-l="Próxima ação">${closed(x.lp)?(x.lp.mot||'—'):x.lp.acao||'Acompanhar'}</td><td><button class="btn link" data-act="t2dec" data-crt="${c.id}" data-n="${x.n}">Abrir ›</button></td></tr>`).join('')}</tbody></table></div></div>
 <div class="sec"><h3>Histórico de etapas</h3>${ls.map(x=>`<details ${ls.length===1?'open':''}><summary>Lote ${x.n}${S.emp==='ALL'?' · '+EMP[x.emp].curto:''}: ${x.lp.hist.length} marcos</summary><ul class="tl" style="margin:8px 0 12px">${x.lp.hist.map(h=>`<li><b class="num">${dt(h.d)}</b> · ${h.et} <span class="mut small">por ${h.by}</span></li>`).join('')}</ul></details>`).join('')}
 <p class="note">Marcos registrados por usuário e data; os anteriores à implantação vêm da carga de demonstração.</p></div></div>`}});
K.act('t2pub',a=>go({v:'crt',crt:a.dataset.crt}));
K.HOOK.crt.push(c=>partsAll().some(p=>p.crt===c.id)?`<div class="acts" style="margin:-6px 0 16px"><button class="btn" data-act="t2proc" data-crt="${c.id}">Abrir processo na carteira</button><button class="btn" data-act="t2dec" data-crt="${c.id}" data-n="${c.lotes.find(l=>partsAll().some(p=>p.crt===c.id&&p.L[l.n]))?.n||1}">Decisão de participação</button></div>`:'');

/* ---------- análise do edital: documentos, exigências, histórico ---------- */
const DOCS=window.KB_DATA.DOCS;
const REQ=window.KB_DATA.REQ;
const ST={atendido:['ok','Atendido'],parcial:['warn','Parcial'],pendente:['warn','Pendente de evidência'],incompat:['bad','Incompatível'],novo:['ind','Requisito novo'],revisar:['bad','Revisar após retificação']};
const PERFIL={A:'Alfa · Mobiliário escolar e administrativo · perfil v3 (01/10/2026)',B:'Beta · Serviços de TI · perfil v2 (15/09/2026)'};
const FAM=[['armário','armario'],['conjunto aluno','cja','carteira escolar','conjunto infantil'],['cadeira'],['mesa'],['estante'],['arquivo'],['service desk','posto'],['ust','infraestrutura'],['pf','pontos de função','desenvolvimento'],['governança']];
function famOf(txt){const n=norm(txt);return FAM.findIndex(f=>f.some(w=>n.includes(norm(w))))}
function comparables(c,l){const f=famOf(l.d+' '+c.obj);const out=[];for(const lid in RES){const [cid,ln]=[lid.slice(0,lid.lastIndexOf('-L')),+lid.slice(lid.lastIndexOf('-L')+2)];const cc=CM[cid];if(!cc||cid===c.id)continue;const ll=cc.lotes[ln-1];if(famOf(ll.d+' '+cc.obj)!==f||f<0)continue;
 const r=RES[lid];const w=r.rows.find(x=>x[2].startsWith('Vencedor'));const me=r.rows.find(x=>K.ours().includes(x[1]));out.push({c:cc,l:ll,r,w,me,unit:w?w[4]/ll.q:null})}return out}
const med=a=>{const s=[...a].sort((x,y)=>x-y);const m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const DECS=window.KB_DATA.DECS;
K.T2.REQ=REQ;K.T2.DOCS=DOCS;K.T2.comparables=comparables;

K.view('dec',{label:t=>'Decisão · lote '+t.n,scoped:t=>partsAll().some(p=>p.crt===t.crt),render(t){
 const c=CM[t.crt];const ls=lotsAll().filter(x=>x.crt===t.crt);const x=ls.find(y=>y.n===t.n)||ls[0];if(!x)return '<p>Fora do escopo.</p>';t.n=x.n;const lp=x.lp,l=c.lotes[x.n-1];
 const tabs=[['proc','1. Processo'],['exig','2. Exigências'],['hist','3. Disputas semelhantes'],['sim','4. Simular preço'],['dec','5. Registrar decisão']];
 const canD=K.can('decidir',x.emp);
 let body='';
 if(t.tab==='proc'){const ds=DOCS[c.id]||[];body=`<div class="grid2"><div><h3>Documentos do processo</h3><div class="scroll"><table><thead><tr><th>Documento</th><th>Versão</th><th>Publicação</th><th class="r">Páginas</th></tr></thead><tbody>${ds.length?ds.map(d=>`<tr><td>${d.arqId?`<button class="btn link" data-act="t2dl" data-id="${d.arqId}" data-n="${esc(d.nome)}">${esc(d.nome)}</button>`:esc(d.nome)}${d.ret?' <span class="pill warn">retificação</span>':''}</td><td>v${d.v}</td><td class="num">${dt(d.d)}</td><td class="r">${d.pg||'—'}</td></tr>`).join(''):'<tr><td colspan="4" class="mut">Nenhum documento carregado.</td></tr>'}</tbody></table></div>
  <p class="note">Fonte: ${c.src||'adaptador de demonstração'} · identificador ${c.id}</p>
  ${K.can('preparar',x.emp)?`<label class="small mut" style="display:grid;gap:4px;margin-top:10px">Carregar arquivo oficial (PDF)<input type="file" accept=".pdf" data-chg="t2up"></label>
  ${c.id==='CRT-PR-0101'&&!ds.some(d=>d.ret)?'<button class="btn" style="margin-top:10px" data-act="t2ret">Simular retificação do edital (v2)</button>':''}`:''}</div>
  <div><h3>Consulta pública sob demanda (PNCP)</h3><div class="form"><label>Link ou número de controle PNCP<input type="text" id="pncpq" placeholder="Ex.: 00394460000141-1-000045/2026"></label><button class="btn" data-act="t2pncp">Consultar</button></div><div id="pncpr"></div>
  <p class="note">Consulta direta à API pública do PNCP. Se a fonte estiver indisponível, siga pelo fluxo manual com o arquivo oficial.</p></div></div>`}
 if(t.tab==='exig'){const rq=REQ[c.id+'|'+x.n];const old=t.old&&rq&&rq.some(r=>r.prev);const rows=rq?rq.map(r=>old&&r.prev?r.prev:r):null;
  const crit=rows?rows.filter(r=>r.st!=='atendido'):[];
  body=rows?`<div class="callout"><b>Resumo executivo.</b> ${esc(c.obj)} · lote ${x.n} (${NF.format(l.q)} ${l.u}, referência ${brl(l.ref)}). ${crit.length} de ${rows.length} exigências pedem ação: ${crit.map(r=>'cl. '+r.cl+' ('+ST[r.st][1].toLowerCase()+')').join(', ')}. Prazo para resolver: antes da sessão de ${dth(c.ses)}. Impacto: ${crit.some(r=>r.st==='incompat')?'há requisito incompatível; participar exige condicionante ou declínio.':crit.length?'participação viável com condicionantes.':'sem impedimentos.'}</div>
  ${rq.some(r=>r.prev)?`<div class="callout warn">Retificação v2 publicada: a cláusula 5.4 mudou. Só esse requisito voltou à revisão; a análise v1 continua consultável. <button class="btn link" data-act="t2old">${old?'Ver análise atual':'Ver análise anterior (v1)'}</button></div>`:''}
  <p class="small mut">Análise ${old?'v1':'v'+(rq.some(r=>r.prev)?2:1)} · perfil comparado: ${PERFIL[x.emp]} · elaborada por Ana Ribeiro</p>
  <div class="scroll"><table class="stack"><thead><tr><th>Cláusula</th><th>Exigência mensurável</th><th>Evidência do CNPJ</th><th>Diferença apurada</th><th>Situação</th><th>Revisão humana</th></tr></thead><tbody>
  ${rows.map((r,i)=>`<tr><td data-l="Cláusula" class="num">${r.cl} · p. ${r.pg} · v${r.v}</td><td data-l="Exigência">${r.req}</td><td data-l="Evidência">${r.ev}</td><td data-l="Diferença">${r.dif}</td><td data-l="Situação"><span class="pill ${ST[r.st][0]}">${ST[r.st][1]}</span></td><td data-l="Revisão">${old?'—':r.rev?`✓ ${r.rev}`:K.can('preparar',x.emp)?`<button class="btn link" data-act="t2rev" data-i="${i}">Marcar revisado</button>`:'pendente'}</td></tr>`).join('')}</tbody></table></div>`
  :`<div class="callout warn">A análise de exigências deste lote ainda não foi feita. Carregue o edital na aba Processo; a leitura automática por IA chega na implementação.</div>`}
 if(t.tab==='hist'){const cs=comparables(c,l);const us=cs.filter(y=>y.unit);const q=t.hq||'';
  body=`<div class="form" style="max-width:none"><label>Consultar histórico<input type="search" data-inp="t2hq" value="${esc(q)}" placeholder="Ex.: armário, service desk, inabilitação por atestado"></label></div>
  <div class="qf">${['Preço unitário dos vencedores neste tipo de objeto','Lotes em que ficamos entre os 3 primeiros','Inabilitações por atestado'].map((s,i)=>`<button class="chip" data-act="t2hqs" data-i="${i}">${s}</button>`).join('')}</div>
  ${t.hans?`<div class="callout">${t.hans}</div>`:''}
  ${us.length?`<div class="kpis"><div><small>Mediana do preço unitário vencedor</small><b>${brl(med(us.map(y=>y.unit)))}</b><small>${us.length} ${plural(us.length,['observação','observações'])}</small></div><div><small>Faixa observada</small><b class="small">${brl(Math.min(...us.map(y=>y.unit)))} a ${brl(Math.max(...us.map(y=>y.unit)))}</b></div><div><small>Referência deste lote</small><b>${brl(l.ref/l.q)}</b><small>por ${l.u}</small></div></div>${us.length<4?'<p class="note">Amostra pequena: confira os casos individuais abaixo antes de usar a mediana.</p>':''}`:''}
  <div class="scroll"><table class="stack"><thead><tr><th>Órgão</th><th>Lote</th><th class="r">Qtd.</th><th class="r">Preço unitário vencedor</th><th>Vencedor</th><th>Nossa posição</th><th>Data</th></tr></thead><tbody>
  ${cs.filter(y=>!q||norm(y.c.org+' '+y.l.d+' '+y.r.rows.map(r=>r[6]).join(' ')).includes(norm(q))).map(y=>`<tr class="click" data-act="t2histopen" data-crt="${y.c.id}"><td data-l="Órgão">${esc(y.c.org)}</td><td data-l="Lote">${esc(y.l.d)}</td><td data-l="Qtd." class="r num">${NF.format(y.l.q)}</td><td data-l="Unitário" class="r num">${y.unit?brl(y.unit):'—'}</td><td data-l="Vencedor">${y.w?esc(y.w[1]):'—'}${y.r.prov?' (provisório)':''}</td><td data-l="Nossa posição">${y.me?(y.me[0]?y.me[0]+'º':y.me[2]):'não participou'}</td><td data-l="Data" class="num">${dt(y.c.enc?y.c.enc.d:y.c.ses)}</td></tr>`).join('')||'<tr><td colspan="7" class="mut">Sem disputas comparáveis na base.</td></tr>'}</tbody></table></div>
  <p class="note">Comparáveis: mesma família de objeto; período, unidade e quantidade aparecem em cada linha para evitar comparar objetos incompatíveis. Consultas em linguagem natural por IA chegam na implementação; aqui a busca é por palavra-chave.</p>`}
 if(t.tab==='sim'){const s=t.sim||(t.sim={cu:Math.round(l.ref/l.q*0.62),fr:Math.round(l.ref*0.02),tr:9.25,dv:3,mg:15,lance:''});const q=l.q;
  const cu=s.cu+s.fr/q,den=1-(s.tr+s.dv+s.mg)/100,pu=den>0?cu/den:null,piso=cu/(1-(s.tr+s.dv)/100);
  const lance=+s.lance||null;const rl=lance?lance*(1-(s.tr+s.dv)/100):null,mr=lance?(rl-cu)/lance*100:null;
  const cs=comparables(c,l).filter(y=>y.unit);const md=cs.length?med(cs.map(y=>y.unit)):null;
  const inp=(k,lab,st)=>`<label>${lab}<input type="number" step="${st||'any'}" data-inp="t2sim" data-k="${k}" value="${s[k]}"></label>`;
  body=`<div class="sim"><div class="form">${inp('cu','Custo variável por '+l.u+' (R$)')}${inp('fr','Frete e despesas únicas do lote (R$)')}${inp('tr','Tributos sobre a receita (%)')}${inp('dv','Despesas variáveis (%)')}${inp('mg','Margem-alvo sobre a receita (%)')}${inp('lance','Simular um lance por '+l.u+' (R$)')}</div>
  <div class="res"><small class="mut">Preço necessário por ${l.u}</small><div class="bigv">${pu?brl(pu):'—'}</div><p class="small mut">Total do lote: ${pu?brl(pu*q):'—'} · referência ${brl(l.ref/q)} por ${l.u}${md?' · mediana histórica '+brl(md):''}</p>
  <dl class="kv"><dt>Custo por ${l.u} (com rateio do frete)</dt><dd>${brl(cu)}</dd><dt>Piso econômico (margem zero)</dt><dd>${brl(piso)}</dd>${lance?`<dt>Receita líquida do lance</dt><dd>${brl(rl)}</dd><dt>Resultado do lote</dt><dd>${brl((rl-cu)*q)}</dd><dt class="tot">Margem do lance</dt><dd class="tot">${pct(mr,2)}</dd>`:''}</dl>
  ${md&&md<piso?'<div class="callout bad" style="margin-top:10px">A faixa histórica fica abaixo do piso econômico desta composição.</div>':''}
  ${lance&&lance<piso?'<div class="callout bad" style="margin-top:10px">O lance simulado está abaixo do piso econômico.</div>':''}</div></div>
  <p class="note">Simulação preliminar: margem calculada sobre a receita de venda. A composição completa, o piso de lance do decisor e as versões aprovadas ficam no Template 4. Custos sugeridos a partir da referência do edital, sem comprovação: substitua pelos reais.</p>`}
 if(t.tab==='dec'){const d=lp.decisao;const rq=REQ[c.id+'|'+x.n];const stale=rq&&rq.some(r=>r.st==='revisar');
  body=`${d?`<div class="callout ${lp.dec==='declinar'?'warn':'ok'}"><b>Decisão registrada: ${DEC[lp.dec]}</b> por ${K.uname(d.by)} em ${dt(d.d)}${d.v?' · análise v'+d.v:''}.<br>${esc(d.just||'')}${d.cond?'<br>Condicionantes: '+esc(d.cond):''}${d.sim?'<br>Cenário consultado: '+d.sim:''}</div>`:''}
  ${stale&&d?'<div class="callout bad">A retificação alterou a cláusula 5.4. Revise esse requisito e confirme ou reabra a decisão; as demais conclusões continuam válidas.</div>':''}
  ${canD&&(!d||stale||lp.dec==='pendente')?`<div class="form"><div class="radios" role="radiogroup" aria-label="Decisão">${['participar','condicionada','declinar'].map(k=>`<label><input type="radio" name="t2d" value="${k}" ${t.dsel===k?'checked':''} data-chg="t2dsel">${DEC[k]}</label>`).join('')}</div>
  ${t.dsel==='condicionada'?'<label>Condicionantes<textarea id="t2cond" placeholder="Ex.: entrega parcelada aceita pelo órgão; emitir certidão de falência até 05/12"></textarea></label>':''}
  <label>Justificativa (obrigatória)<textarea id="t2just" placeholder="Motivos da decisão"></textarea></label>
  <p class="small mut">Decisor: ${USERS[S.user].nome} · ${EMP[x.emp].nome} · CNPJ ${EMP[x.emp].cnpj}. ${t.sim?'O cenário da aba 4 será anexado.':''}</p>
  <button class="btn pri" data-act="t2save">Registrar decisão do lote ${x.n}</button></div>`:!d||lp.dec==='pendente'?`<div class="callout">Seu perfil (${USERS[S.user].papel}) pode consultar a análise, mas a decisão é de ${(lp.aprov||[]).map(K.uname).join(' ou ')||'um usuário com alçada'}.</div>`:''}
  <h3 style="margin-top:18px">Decisões registradas neste processo</h3><ul class="tl">${DECS.filter(y=>y.crt===c.id).map(y=>`<li><b>${dt(y.d)}</b> · lote ${y.n} · ${DEC[y.dec]} por ${K.uname(y.by)}${y.reab?' (reaberta após retificação)':''}</li>`).join('')||'<li class="fut">Nenhuma decisão nesta sessão da prévia.</li>'}</ul>`}
 return `<div class="mod"><div class="mhead"><div><div class="tags">${etq(lp.et)}${comps(lp).map(y=>`<span class="pill comp">${y}</span>`).join('')}</div><h1>Decisão de participação</h1><p class="mut">${c.mod} nº ${c.num} · ${esc(c.org)} · ${EMP[x.emp].nome}</p></div>
 <div class="acts">${ls.filter(y=>y.emp===x.emp).map(y=>`<button class="chip" data-act="t2lot" data-n="${y.n}" aria-pressed="${y.n===x.n}">Lote ${y.n}</button>`).join('')}</div></div>
 <dl class="facts">${fact('Lote',x.n+' · '+esc(l.d))}${fact('Quantidade e referência',NF.format(l.q)+' '+l.u+' · '+brl(l.ref))}${fact('Sessão',dth(c.ses))}${fact('Prazo interno',lp.prazo?dt(lp.prazo)+' · '+(lp.acao||''):'—')}</dl>
 <div class="tabs" role="tablist">${tabs.map(([k,l])=>`<button role="tab" aria-selected="${t.tab===k}" data-act="t2tab" data-k="${k}">${l}</button>`).join('')}</div>${body}</div>`}});
K.act('t2tab',a=>{top().tab=a.dataset.k;render()});K.act('t2lot',a=>{const t=top();t.n=+a.dataset.n;t.dsel=null;render()});
K.act('t2old',()=>{top().old=!top().old;render()});
K.act('t2rev',a=>{const t=top();REQ[t.crt+'|'+t.n][+a.dataset.i].rev=K.uname(S.user)+' em '+dt(HOJE);render()});
K.act('t2dsel',a=>{top().dsel=a.value;render()});
K.act('t2sim',a=>{const t=top();t.sim[a.dataset.k]=a.value===''?'':+a.value;const k=a.dataset.k,pos=a.selectionStart;render();const i=document.querySelector(`[data-inp="t2sim"][data-k="${k}"]`);if(i){i.focus()}});
K.act('t2hq',a=>{const t=top();t.hq=a.value;t.hans='';render();const i=document.querySelector('[data-inp="t2hq"]');i.focus()});
K.act('t2hqs',a=>{const t=top();const i=+a.dataset.i;let ans='';const mine=Object.entries(RES).map(([lid,r])=>({lid,r,me:r.rows.find(x=>K.ours().includes(x[1]))})).filter(y=>y.me);
 if(i===0){const c=CM[t.crt],l=c.lotes[t.n-1];const cs=comparables(c,l).filter(y=>y.unit);ans=cs.length?`Preço unitário vencedor em ${cs.length} lotes comparáveis: mediana ${brl(med(cs.map(y=>y.unit)))}, mínimo ${brl(Math.min(...cs.map(y=>y.unit)))}, máximo ${brl(Math.max(...cs.map(y=>y.unit)))}. Registros na tabela abaixo.`:'Sem lotes comparáveis.'}
 if(i===1){const top3=mine.filter(y=>y.me[0]&&y.me[0]<=3);ans=`${top3.length} de ${mine.length} lotes disputados pelas empresas do escopo terminaram entre os 3 primeiros (numerador: posição oficial 1º a 3º; denominador: lotes com classificação publicada).`}
 if(i===2){const ina=mine.filter(y=>/inabilit/i.test(y.me[2])&&/atestado/i.test(y.me[6]));ans=`${ina.length} inabilitação(ões) por atestado entre ${mine.length} lotes avaliados: ${ina.map(y=>CM[y.lid.slice(0,y.lid.lastIndexOf('-L'))].org+' ('+y.me[6]+')').join('; ')||'nenhuma'}. Causa documental: recomenda revisar o acervo, não o preço.`}
 t.hans=ans;render()});
K.act('t2histopen',a=>go({v:'crt',crt:a.dataset.crt}));
K.act('t2pncp',async()=>{const v=$('#pncpq').value.trim();const box=$('#pncpr');if(!v)return toast('Informe o link ou o número de controle.');box.innerHTML='<p class="note">Consultando o PNCP…</p>';
 try{const r=await fetch('/api/pncp?ref='+encodeURIComponent(v));const j=await r.json();if(!r.ok){box.innerHTML=`<div class="callout warn">${esc(j.erro)}</div>`;return}
  if(j.situacao!=='ok'){box.innerHTML=`<div class="callout warn"><b>${j.situacao==='nao_localizado'?'Ausência de publicação localizada':'Fonte indisponível'}.</b> ${esc(j.mensagem||'')} Você pode seguir pelo fluxo manual carregando o arquivo oficial.</div>`;return}
  const c=j.contratacao;top().pncp=j;box.innerHTML=`<div class="box" style="margin-top:10px"><b>${esc(c.orgao||'')}</b><br><span class="small">${esc(c.modalidade||'')} ${esc(c.numero||'')} · ${esc(c.situacao||'')} · consultado em ${dt(j.consultadoEm.slice(0,10))}</span><p class="small">${esc(c.objeto||'')}</p>
  ${j.documentos.length?`<p class="small"><b>${j.documentos.length} documento(s) publicados</b> — marque os que deseja baixar e versionar:</p>${j.documentos.map((d,i)=>`<label style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" class="pncpd" value="${i}" style="width:18px;height:18px"> ${esc(d.titulo||'Documento')} <span class="mut small">${esc(d.tipo||'')} · ${d.data?dt(String(d.data).slice(0,10)):''}</span></label>`).join('')}<button class="btn pri" data-act="t2pncpdl">Baixar e versionar selecionados</button>`:'<p class="note">Nenhum documento publicado localizado para esta contratação.</p>'}</div>`}
 catch(e){box.innerHTML='<div class="callout warn">Fonte indisponível no momento. Siga pelo fluxo manual.</div>'}});
K.act('t2pncpdl',async()=>{const t=top();const j=t.pncp;const sel=[...document.querySelectorAll('.pncpd:checked')].map(x=>j.documentos[+x.value]);if(!sel.length)return toast('Marque ao menos um documento.');const p=partsAll().find(p=>p.crt===t.crt);
 const r=await fetch('/api/pncp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:$('#pncpq').value,crt:t.crt,emp:p.emp,docs:sel})});const x=await r.json();if(!r.ok)return toast(x.erro);
 const ds=DOCS[t.crt]=DOCS[t.crt]||[];x.salvos.filter(y=>!y.erro).forEach(y=>ds.push({nome:y.titulo,v:y.versao,d:HOJE,arqId:y.arqId}));K.marcar('certdocs',t.crt,ds);toast(x.salvos.filter(y=>!y.erro).length+' documento(s) baixado(s) e versionado(s).');render()});
K.act('t2up',async a=>{const f=a.files[0];if(!f)return;const t=top();const p=partsAll().find(p=>p.crt===t.crt);try{const up=await K.upload(f,p.emp);const ds=DOCS[t.crt]=DOCS[t.crt]||[];const same=ds.filter(d=>d.nome===f.name);ds.push({nome:f.name,v:same.length+1,d:HOJE,pg:null,arqId:up.id});toast('Arquivo registrado como versão '+(same.length+1)+': '+f.name);render()}catch(e){toast(e.message)}});
K.act('t2dl',async a=>{try{await K.save(a.dataset.n,await K.arquivo(a.dataset.id))}catch(e){toast(e.message)}});
K.act('t2ret',()=>{const t=top();DOCS[t.crt].push({nome:'Edital',v:2,d:HOJE,pg:46,ret:1});const r=REQ[t.crt+'|1'].find(x=>x.cl==='5.4');r.prev={...r};Object.assign(r,{v:2,req:'Entrega de 1.200 conjuntos em até 45 dias corridos (retificado)',dif:'Capacidade de 900 por mês atende em cerca de 40 dias; confirmar',st:'revisar',rev:null});
 PART.forEach(p=>{if(p.crt===t.crt&&p.L[1].decisao)p.L[1].comp='Decisão a revisar (retificação)'});toast('Retificação v2 registrada: só a cláusula 5.4 voltou à revisão.');render()});
K.act('t2save',()=>{const t=top();const p=partsAll().find(y=>y.crt===t.crt&&y.L[t.n]);const lp=p.L[t.n];const just=($('#t2just')||{}).value?.trim();if(!t.dsel)return toast('Escolha participar, participar com condicionantes ou declinar.');if(!just)return toast('A justificativa é obrigatória.');
 const reab=!!lp.decisao;const s=t.sim;lp.dec=t.dsel;lp.decisao={by:S.user,d:HOJE,just,cond:($('#t2cond')||{}).value||'',v:(REQ[t.crt+'|'+t.n]||[]).some(r=>r.prev)?2:1,sim:s?`custo ${brl(+s.cu)}, margem-alvo ${s.mg}%`:''};
 if(t.dsel==='declinar'){lp.et=ARQ;lp.mot='Declinado: '+just;lp.prep=null;lp.hist.push({et:ARQ,d:HOJE,by:K.uname(S.user)})}
 else{if(lp.et!=='Em preparação'){lp.hist.push({et:'Participação aprovada',d:HOJE,by:K.uname(S.user)},{et:'Em preparação',d:HOJE,by:'Sistema'});lp.et='Em preparação';lp.prep={orc:'A elaborar',hab:'Em andamento'};lp.acao='Elaborar orçamento e documentos';lp.prazo=K.T2.addD(HOJE,5)}}
 if(lp.comp==='Decisão a revisar (retificação)')lp.comp=null;const rq=REQ[t.crt+'|'+t.n];if(rq)rq.forEach(r=>{if(r.st==='revisar')r.st='parcial'});
 DECS.push({crt:t.crt,n:t.n,dec:t.dsel,by:S.user,d:HOJE,reab});t.dsel=null;toast('Decisão registrada: '+DEC[lp.dec]+' no lote '+t.n+'. A carteira e o mapa já refletem a nova etapa.');render()});

/* ---------- importação ---------- */
const SAMPLE=`orgao;unidade;numero;modalidade;objeto;uf;sessao;link;lote;descricao_lote;quantidade;unidade_medida;valor_referencia
Prefeitura Municipal de Londrina;Secretaria Municipal de Educação;90210/2026;Pregão eletrônico;Mobiliário para centros de educação infantil;PR;2026-12-16 09:00;https://exemplo.gov.br/londrina/90210;1;Conjunto infantil: mesa e 4 cadeiras;400;conjunto;236000
Prefeitura Municipal de Londrina;Secretaria Municipal de Educação;90210/2026;Pregão eletrônico;Mobiliário para centros de educação infantil;PR;2026-12-16 09:00;https://exemplo.gov.br/londrina/90210;2;Armário baixo para sala de aula;120;un;96000
Universidade Federal do Paraná;Pró-Reitoria de Administração;90118/2026;Pregão eletrônico;Armários de aço e estantes para bibliotecas;PR;2026-11-18 09:00;https://exemplo.gov.br/ufpr/90118;1;Armário de aço 2 portas;80;un;108000
Prefeitura Municipal de Blumenau;Secretaria de Educação;90077/2026;Pregão eletrônico;Cadeiras escolares;SC;2026-13-02 09:00;https://exemplo.gov.br/blumenau/90077;1;Cadeira escolar empilhável;600;un;114000
Prefeitura Municipal de Florianópolis;Secretaria de Administração;90301/2026;Pregão eletrônico;Armários de aço para arquivo;SC;2026-12-18 10:00;https://exemplo.gov.br/floripa/90301;1;Armário de aço 2 portas;150;un;`;
const FIELDS=[['orgao','Órgão',1],['unidade','Unidade compradora',0],['numero','Número/ano',1],['modalidade','Modalidade',0],['objeto','Objeto',1],['uf','UF de execução',1],['sessao','Data da sessão',1],['link','Link de origem',0],['lote','Lote',1],['descricao_lote','Descrição do lote',1],['quantidade','Quantidade',1],['unidade_medida','Unidade',0],['valor_referencia','Valor de referência',0]];
const IMPLOG=window.KB_DATA.IMPLOG;
function parseCSV(txt){const lines=txt.replace(/\r/g,'').split('\n').filter(x=>x.trim());const sep=lines[0].includes(';')?';':',';return {head:lines[0].split(sep).map(x=>x.trim()),rows:lines.slice(1).map(l=>l.split(sep).map(x=>x.trim()))}}
function validate(t){const {head,rows}=t.csv;const mp=t.map;const g=(r,f)=>{const i=mp[f];return i>=0?r[i]||'':''};const out=[];const seen={};
 rows.forEach((r,i)=>{const o={i:i+2,org:g(r,'orgao'),num:g(r,'numero'),uf:g(r,'uf').toUpperCase(),ses:g(r,'sessao'),lote:+g(r,'lote')||0,desc:g(r,'descricao_lote'),q:+g(r,'quantidade')||0,un:g(r,'unidade_medida')||'un',ref:g(r,'valor_referencia'),obj:g(r,'objeto'),unid:g(r,'unidade'),link:g(r,'link'),mod:g(r,'modalidade')||'Pregão eletrônico',err:[],warn:[]};
  FIELDS.filter(f=>f[2]&&mp[f[0]]<0).forEach(f=>o.err.push('coluna “'+f[1]+'” não mapeada'));
  if(!UF[o.uf])o.err.push('UF inválida: '+(o.uf||'vazia'));
  const m=o.ses.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);if(!m||+m[2]>12||+m[3]>31)o.err.push('data da sessão inválida: '+o.ses);
  if(!o.q)o.err.push('quantidade ausente');if(!o.ref)o.warn.push('valor de referência ausente (pode ser sigiloso)');
  const key=norm(o.org)+'|'+o.num;const dup=CRT.find(c=>norm(c.org)+'|'+c.num===key);if(dup&&partsAll().some(p=>p.crt===dup.id&&p.emp===S.emp))o.dup=dup.id;
  if(seen[key+'|'+o.lote])o.err.push('lote repetido no arquivo');seen[key+'|'+o.lote]=1;
  o.st=o.err.length?'erro':o.dup?'duplicado':'novo';out.push(o)});return out}
K.T2.impCSV={label:()=>'Importar edital',render(t){
 if(S.emp==='ALL')return '<div class="callout warn">Escolha uma empresa (CNPJ) antes de importar: toda inclusão identifica o CNPJ ativo.</div>';
 t.txt=t.txt??SAMPLE;const proj=Object.entries(EMP[S.emp].proj);t.proj=t.proj||proj[0][0];
 let prev='';if(t.csv){const v=validate(t);t.val=v;const n=v.filter(o=>o.st==='novo');const ng=new Set(n.map(o=>norm(o.org)+'|'+o.num)).size;
  prev=`<h3 style="margin-top:18px">Mapeamento de colunas</h3><div class="grid2" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">${FIELDS.map(f=>`<label class="small mut" style="display:grid;gap:3px">${f[1]}${f[2]?' *':''}<select data-chg="t2map" data-f="${f[0]}"><option value="-1">— não importar —</option>${t.csv.head.map((h,i)=>`<option value="${i}" ${t.map[f[0]]===i?'selected':''}>${esc(h)}</option>`).join('')}</select></label>`).join('')}</div>
  <h3 style="margin-top:18px">Prévia linha a linha</h3><div class="scroll"><table class="stack"><thead><tr><th>Linha</th><th>Órgão</th><th>Número</th><th>UF</th><th>Sessão</th><th>Lote</th><th>Situação</th></tr></thead><tbody>
  ${v.map(o=>`<tr><td data-l="Linha">${o.i}</td><td data-l="Órgão">${esc(o.org)}</td><td data-l="Número">${esc(o.num)}</td><td data-l="UF">${esc(o.uf)}</td><td data-l="Sessão">${esc(o.ses)}</td><td data-l="Lote">${o.lote} · ${esc(o.desc)}</td><td data-l="Situação">${o.st==='erro'?`<span class="pill bad">Erro</span> ${o.err.join('; ')}`:o.st==='duplicado'?`<span class="pill warn">Duplicado</span> já existe (${o.dup}); será ignorado`:`<span class="pill ok">Novo</span>`}${o.warn.length?' <span class="pill warn">Aviso</span> '+o.warn.join('; '):''}</td></tr>`).join('')}</tbody></table></div>
  <div class="callout ${n.length?'':'warn'}" style="margin-top:12px">${n.length} ${plural(n.length,['linha nova','linhas novas'])} (${ng} ${plural(ng,['licitação','licitações'])}) · ${v.filter(o=>o.st==='duplicado').length} duplicada(s) ignorada(s) · ${v.filter(o=>o.st==='erro').length} com erro (não importadas).</div>
  ${n.length?`<button class="btn pri" data-act="t2impgo">Importar ${ng} ${plural(ng,['licitação','licitações'])} para ${EMP[S.emp].curto} · CNPJ ${EMP[S.emp].cnpj}</button>`:''}`}
 return `<div class="mod"><div class="mhead"><div><h1>Importar edital</h1><p class="mut small">CSV com uma linha por lote · empresa ativa: <b>${EMP[S.emp].nome} · CNPJ ${EMP[S.emp].cnpj}</b></p></div></div>${K.T2.impTabs?K.T2.impTabs(t):''}
 <div class="form" style="max-width:none"><div class="grid2"><label>Arquivo CSV<input type="file" accept=".csv,.txt" data-chg="t2file"></label><label>Projeto de destino<select data-chg="t2proj">${proj.map(([k,v])=>`<option value="${k}" ${t.proj===k?'selected':''}>${v}</option>`).join('')}</select></label></div>
 <label>Conteúdo (exemplo já preenchido com 1 licitação nova de 2 lotes, 1 duplicada, 1 com erro de data e 1 com aviso)<textarea id="t2txt" rows="7" style="font-family:ui-monospace,Menlo,monospace;font-size:13px">${esc(t.txt)}</textarea></label>
 <div class="acts"><button class="btn pri" data-act="t2prev">Pré-visualizar</button><span class="small mut">XLSX entra na implementação; a integração por API ou webhook com o fornecedor de prospecção usa a mesma prévia.</span></div></div>${prev}
 ${IMPLOG.length?`<h3 style="margin-top:20px">Importações desta sessão</h3><ul class="tl">${IMPLOG.map(l=>`<li><b>${dt(l.d)}</b> · ${l.n} licitação(ões) · ${l.e} erro(s) · ${l.u} · ${EMP[l.emp].curto}</li>`).join('')}</ul>`:''}</div>`}};
K.act('t2file',a=>{const f=a.files[0];if(!f)return;f.text().then(x=>{const t=top();t.txt=x;t.csv=null;render()})});
K.act('t2proj',a=>{top().proj=a.value});
K.act('t2prev',()=>{const t=top();t.txt=$('#t2txt').value;t.csv=parseCSV(t.txt);t.map={};FIELDS.forEach(f=>{t.map[f[0]]=t.csv.head.findIndex(h=>norm(h)===f[0])});render()});
K.act('t2map',a=>{const t=top();t.map[a.dataset.f]=+a.value;render()});
K.act('t2impgo',async()=>{const t=top();const n=t.val.filter(o=>o.st==='novo');const groups={};n.forEach(o=>(groups[norm(o.org)+'|'+o.num]=groups[norm(o.org)+'|'+o.num]||[]).push(o));
 const grupos=Object.values(groups).map(g=>({linhas:g.sort((a,b)=>a.lote-b.lote).map(x=>({org:x.org,unid:x.unid,num:x.num,mod:x.mod,obj:x.obj,uf:x.uf,ses:x.ses,link:x.link,lote:x.lote,desc:x.desc,q:x.q,un:x.un,ref:x.ref}))}));
 try{const r=await K.api('importar',{emp:S.emp,proj:t.proj,grupos,prazo:K.T2.addD(HOJE,3),errosPrevia:t.val.filter(o=>o.st==='erro').length});toast(r.criados.length+' licitação(ões) importada(s)'+(r.ignorados.length?', '+r.ignorados.length+' já existente(s)':'')+'. Atualizando…');sessionStorage.setItem('kb_ir','prev');setTimeout(()=>location.reload(),900)}
 catch(e){toast(e.message)}});

/* ---------- Meu dia ---------- */
K.view('dia',{label:()=>'Meu dia',render(){const U=USERS[S.user];const all=lotsAll();
 const mine=all.filter(x=>!closed(x.lp)&&(x.lp.resp===S.user||((S.user==='william')&&x.lp.prazo)));
 const decs=all.filter(x=>QF.mine[1](x));const orc=all.filter(x=>x.lp.prep&&x.lp.prep.orc==='Aguardando aprovação'&&(x.lp.delib?x.lp.delib.parts.includes(S.user)&&!x.lp.delib.votos[S.user]:(['carlos','paula','william','bruno'].includes(S.user))));
 const recon=all.filter(x=>x.lp.recon&&x.lp.recon.st==='pendente'&&x.lp.recon.parts.includes(S.user)&&!x.lp.recon.votos[S.user]);
 const ses=CRT.filter(c=>partsAll().some(p=>p.crt===c.id)&&c.ses&&c.ses.slice(0,10)>=HOJE&&c.ses.slice(0,10)<=K.T2.addD(HOJE,21)).sort((a,b)=>a.ses.localeCompare(b.ses));
 const row=(x,act)=>`<li><button class="rowb" data-act="${act||'t2dec'}" data-crt="${x.crt}" data-n="${x.n}"><span class="rowtop"><span class="org">${esc(x.c.org)}</span><span class="meta num">${x.lp.prazo?'prazo '+dt(x.lp.prazo):''}</span></span><span>Lote ${x.n} · ${esc(x.c.lotes[x.n-1].d)}</span><span class="meta">${x.lp.acao||x.lp.et} · ${EMP[x.emp].curto} · ${brl(x.c.lotes[x.n-1].ref)}</span></button></li>`;
 const isCons=U.perm.length===1;
 return `<div class="mod"><div class="mhead"><div><h1>Bom dia, ${U.nome.split(' ')[0]}</h1><p class="mut small">${U.papel} · ${dt(HOJE)} · ${S.emp==='ALL'?'Alfa + Beta':EMP[S.emp].nome}</p></div></div><div class="grid2">
 ${decs.length||U.perm.includes('decidir')?`<section class="box"><h3>Decisões pendentes com você (${decs.length})</h3><ul class="list">${decs.map(x=>row(x)).join('')||'<li class="note">Nenhuma decisão aguardando você.</li>'}</ul></section>`:''}
 ${orc.length?`<section class="box"><h3>Orçamentos aguardando sua confirmação (${orc.length})</h3><ul class="list">${orc.map(x=>row(x,'t4open')).join('')}</ul></section>`:''}
 ${recon.length?`<section class="box"><h3>Reconfirmações de preço (${recon.length})</h3><ul class="list">${recon.map(x=>row(x,'t5open')).join('')}</ul></section>`:''}
 ${!isCons&&(U.perm.includes('preparar')||U.perm.includes('juridico')||S.user==='william')?`<section class="box"><h3>${S.user==='william'?'Prazos da equipe':'Meus prazos'} (${mine.length})</h3><ul class="list">${mine.sort((a,b)=>(a.lp.prazo||'9').localeCompare(b.lp.prazo||'9')).map(x=>row(x)).join('')||'<li class="note">Sem prazos sob sua responsabilidade.</li>'}</ul></section>`:''}
 ${isCons?`<section class="box"><h3>Andamento das licitações</h3><ul class="list">${all.filter(x=>!closed(x.lp)).map(x=>`<li style="padding:10px 0"><b>${esc(x.c.org)}</b> · lote ${x.n}<br><span class="small">${x.lp.et} · responsável ${K.uname(x.lp.resp)} · última atualização ${dt(x.lp.hist[x.lp.hist.length-1].d)}</span></li>`).join('')}</ul></section>`:''}
 <section class="box"><h3>Sessões nos próximos 21 dias</h3><ul class="list">${ses.map(c=>`<li><button class="rowb" data-act="t2proc" data-crt="${c.id}"><span class="rowtop"><span class="org">${esc(c.org)}</span><span class="meta num">${dth(c.ses)}</span></span><span class="meta">${c.mod} ${c.num}</span></button></li>`).join('')||'<li class="note">Nenhuma sessão agendada.</li>'}</ul></section></div></div>`}});

/* ---------- Administração: vínculos e acesso ---------- */
K.view('adm',{label:()=>'Administração',render(){const U=USERS[S.user];
 const EMPS=[['Alfa Mobiliário e Equipamentos Ltda','11.222.333/0001-81','Cliente externo','Não','Sim'],['Beta Sistemas e Serviços de TI Ltda','44.555.666/0001-02','Ecossistema Kaizen','Sim (30%)','Sim'],['Gama Participações S.A.','77.888.999/0001-10','Nenhum','Sim (15%)','Não']];
 return `<div class="mod"><div class="mhead"><div><h1>Administração</h1><p class="mut small">Vínculos e autorizações por empresa. O vínculo societário, sozinho, não concede acesso.</p></div></div>
 <h3>Empresas</h3><div class="scroll"><table class="stack"><thead><tr><th>Empresa</th><th>CNPJ</th><th>Vínculo comercial</th><th>Participação societária da Kaizen</th><th>Autorização operacional</th></tr></thead><tbody>${EMPS.map(e=>`<tr><td data-l="Empresa">${e[0]}</td><td data-l="CNPJ" class="num">${e[1]}</td><td data-l="Comercial">${e[2]}</td><td data-l="Societária">${e[3]}</td><td data-l="Autorização">${e[4]==='Sim'?'<span class="pill ok">Autorizada</span>':'<span class="pill bad">Sem autorização: dados inacessíveis</span>'}</td></tr>`).join('')}</tbody></table></div>
 <h3 style="margin-top:18px">Usuários e alçadas</h3><div class="scroll"><table class="stack"><thead><tr><th>Usuário</th><th>Papel</th><th>Empresas</th><th>Consultar</th><th>Preparar orçamento</th><th>Aprovar orçamento</th><th>Decidir participação</th><th>Definir preço</th></tr></thead><tbody>
 ${Object.entries(USERS).map(([k,u])=>`<tr ${k===S.user?'class="me"':''}><td data-l="Usuário">${u.nome}</td><td data-l="Papel">${u.papel}</td><td data-l="Empresas">${u.emp.map(e=>EMP[e].curto).join(', ')}${u.cons?' · consolida':''}</td>${['consultar','preparar','aprovar','decidir','preco'].map(p=>`<td data-l="${p}">${u.perm.includes(p)?'✓':'—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
 <p class="note">Troque o “perfil em teste” no topo para ver a tela como cada pessoa. Autenticação multifator, papéis por projeto e auditoria entram na implementação.</p></div>`}});
}
