/* Entrada pelo PNCP (busca com filtros e seleção) e análise prévia (edital, anexos, esclarecimentos → participar ou arquivar) */
{
const K=window.KB;const {S,CM,EMP,$,brl,dt,dth,esc,norm,plural,toast,go,render,top,partsAll,fact,HOJE,UF}=K;
const DECS=window.KB_DATA.DECS;const DOCS=window.KB_DATA.DOCS;
const ANALISE='Em análise preliminar';
const STATUS=[['recebendo_proposta','A receber / recebendo proposta'],['propostas_encerradas','Em julgamento / propostas encerradas'],['encerradas','Encerradas'],['todos','Todos']];
const MODS=[['','Todas'],['6','Pregão eletrônico'],['4','Concorrência eletrônica'],['8','Dispensa'],['7','Pregão presencial'],['5','Concorrência presencial'],['12','Credenciamento'],['9','Inexigibilidade'],['1','Leilão eletrônico']];
const LIMITE=30;
const dh=s=>s?dth(String(s).slice(0,16)):'—';
const d10=s=>s?dt(String(s).slice(0,10)):'—';
const addD=(d,n)=>{const x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};

/* ---------- abas da tela de importação ---------- */
K.T2.impTabs=t=>`<div class="tabs" role="tablist">${[['pncp','Buscar no PNCP'],['csv','Planilha CSV']].map(([k,l])=>`<button role="tab" aria-selected="${(t.modo||'pncp')===k}" data-act="pvmodo" data-k="${k}">${l}</button>`).join('')}</div>`;
K.act('pvmodo',a=>{const t=top();lerForm(t);t.modo=a.dataset.k;render()});

/* ---------- busca no PNCP ---------- */
function lerForm(t){const f=t.f;if(!f||!$('#pvq'))return;f.q=$('#pvq').value.trim();f.de=$('#pvde').value;f.ate=$('#pvate').value;f.mod=$('#pvmod').value;const st=document.querySelector('input[name="pvst"]:checked');if(st)f.status=st.value}
K.view('imp',{label:()=>'Importar edital',render(t){
 if(S.emp==='ALL')return '<div class="callout warn">Escolha uma empresa (CNPJ) antes de importar: toda inclusão identifica o CNPJ ativo.</div>';
 if((t.modo||'pncp')==='csv')return K.T2.impCSV.render(t);
 const f=t.f=t.f||{q:'',status:'recebendo_proposta',ufs:[],mod:'',de:addD(HOJE,-30),ate:HOJE};
 const proj=Object.entries((EMP[S.emp]||{}).proj||{});t.proj=t.proj??(proj[0]?proj[0][0]:'');t.sel=t.sel||{};
 const r=t.res;let out='';
 if(t.buscando)out='<p class="note" style="margin-top:16px">Consultando o PNCP… pode levar alguns segundos.</p>';
 else if(r&&r.situacao!=='ok')out=`<div class="callout warn" style="margin-top:16px">${esc(r.mensagem||'O PNCP não respondeu.')}</div>`;
 else if(r){const its=r.itens;const nsel=Object.keys(t.sel).length;
  out=`<h3 style="margin-top:20px">${its.length} ${plural(its.length,['licitação encontrada','licitações encontradas'])}</h3>
  <p class="small mut">O PNCP encontrou ${r.total.toLocaleString('pt-BR')} para a palavra-chave e os filtros; ${r.lidos} foram lidos${f.status==='recebendo_proposta'?' e só ficaram as divulgadas com prazo de propostas ainda aberto (disputa não iniciada)':''}${f.de||f.ate?', publicadas no período escolhido':''}. Ordem: prazo de propostas mais próximo primeiro.${r.fonte==='consulta'?` <b>A busca do portal do PNCP não respondeu; usamos a consulta geral do PNCP${r.modalidades&&r.modalidades.length>1?' (pregão eletrônico e concorrência eletrônica)':''}, que é mais lenta.</b>`:''}${r.truncado?' <b>Há mais resultados do que os lidos: refine a palavra-chave, as UFs ou o período.</b>':''}</p>
  ${its.length?`<div class="scroll"><table class="stack"><thead><tr><th><input type="checkbox" data-chg="pvall" aria-label="Selecionar todas" style="width:18px;height:18px"></th><th>Órgão</th><th>Objeto</th><th>Publicação</th><th>Propostas até</th><th class="r">Valor estimado</th><th>Situação</th></tr></thead><tbody>
  ${its.map((x,i)=>{const minha=x.noSistema&&x.noSistema.minha;return `<tr><td>${minha?'':`<input type="checkbox" class="pvck" data-chg="pvsel" data-i="${i}" ${t.sel[x.controle]?'checked':''} aria-label="Selecionar ${esc(x.orgao)}" style="width:18px;height:18px">`}</td>
   <td data-l="Órgão"><b>${esc(x.orgao||'')}</b><br><span class="small mut">${esc(x.municipio||'')}/${esc(x.uf||'')} · ${esc(x.modalidade||'')} ${esc(String(x.numero||''))}</span></td>
   <td data-l="Objeto" class="small">${esc(String(x.objeto||'').slice(0,260))}${String(x.objeto||'').length>260?'…':''}<br><a href="${esc(x.portal)}" target="_blank" rel="noopener" class="small">Ver no PNCP ↗</a></td>
   <td data-l="Publicação" class="num small">${d10(x.publicacao)}</td><td data-l="Propostas até" class="num small">${x.encerramento?dh(x.encerramento):'—'}</td>
   <td data-l="Valor estimado" class="r num small">${x.valorEstimado?brl(x.valorEstimado):'sigiloso ou não informado'}</td>
   <td data-l="Situação" class="small">${esc(x.situacao||'')}${minha?' <span class="pill ok">Já na carteira</span>':x.noSistema?' <span class="pill">No sistema</span>':''}</td></tr>`}).join('')}</tbody></table></div>
  <div class="acts" style="margin-top:12px"><button class="btn pri" id="pvgo" data-act="pvinserir" ${nsel?'':'disabled'}>${rotulo(nsel)}</button><span class="small mut">Até ${LIMITE} por vez. As escolhidas entram na carteira de ${EMP[S.emp].curto} e vão para a aba Análise prévia.</span></div>`:'<p class="note">Nada encontrado com esses filtros. Tente outra palavra-chave, mais UFs ou outro período.</p>'}`}
 return `<div class="mod"><div class="mhead"><div><h1>Importar edital</h1><p class="mut small">Empresa ativa: <b>${EMP[S.emp].nome} · CNPJ ${EMP[S.emp].cnpj}</b></p></div></div>${K.T2.impTabs(t)}
 <div class="form" style="max-width:none">
  <div class="grid2"><label>Palavra-chave<input id="pvq" type="search" value="${esc(f.q)}" placeholder="Ex.: mobiliário escolar, cadeira, armário de aço"></label>
  <fieldset style="border:0;padding:0;margin:0"><legend class="small mut" style="margin-bottom:6px">Status</legend><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px">${STATUS.map(([k,l])=>`<label style="display:flex;gap:8px;align-items:center;color:var(--ink)"><input type="radio" name="pvst" value="${k}" ${f.status===k?'checked':''} style="width:18px;height:18px">${l}</label>`).join('')}</div></fieldset></div>
  <div><span class="small mut">UFs ${f.ufs.length?`(${f.ufs.join(', ')})`:'(todas)'}</span><div class="qf" style="margin-top:6px">${Object.keys(UF).map(u=>`<button class="chip" data-act="pvuf" data-k="${u}" aria-pressed="${f.ufs.includes(u)}" title="${UF[u][0]}">${u}</button>`).join('')}${f.ufs.length?'<button class="chip" data-act="pvuf" data-k="">Limpar</button>':''}</div></div>
  <div class="grid2" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))"><label>Modalidade<select id="pvmod">${MODS.map(([k,l])=>`<option value="${k}" ${f.mod===k?'selected':''}>${l}</option>`).join('')}</select></label>
  <label>Publicação de<input id="pvde" type="date" value="${f.de}"></label><label>Publicação até<input id="pvate" type="date" value="${f.ate}"></label>
  <label>Projeto de destino<select data-chg="t2proj">${proj.length?'':'<option value="">Sem projeto (opcional)</option>'}${proj.map(([k,v])=>`<option value="${k}" ${t.proj===k?'selected':''}>${esc(v)}</option>`).join('')}</select></label></div>
  <div class="acts"><button class="btn pri" data-act="pvbuscar">Pesquisar</button><button class="btn" data-act="pvlimpar">Limpar campos</button><span class="small mut">Mesma busca da tela de editais do portal do PNCP. “A receber / recebendo proposta” mostra só licitações vigentes ou futuras, ainda sem disputa aberta.</span></div>
 </div>${out}</div>`}});
const rotulo=n=>n?`Inserir ${n} ${plural(n,['licitação selecionada','licitações selecionadas'])}`:'Selecione as licitações para inserir';
const atualizaBotao=()=>{const t=top();const n=Object.keys(t.sel).length;const b=$('#pvgo');if(b){b.disabled=!n;b.textContent=rotulo(n)}};
K.act('pvuf',a=>{const t=top();lerForm(t);const f=t.f;const k=a.dataset.k;f.ufs=!k?[]:f.ufs.includes(k)?f.ufs.filter(x=>x!==k):[...f.ufs,k];render()});
K.act('pvlimpar',()=>{const t=top();t.f={q:'',status:'recebendo_proposta',ufs:[],mod:'',de:'',ate:''};t.res=null;t.sel={};render()});
K.act('pvbuscar',async()=>{const t=top();lerForm(t);const f=t.f;
 if(!f.q&&!f.ufs.length&&!f.de)return toast('Informe uma palavra-chave, uma UF ou a data inicial de publicação.');
 if(f.de&&f.ate&&f.de>f.ate)return toast('A data inicial de publicação é posterior à final.');
 t.buscando=true;t.sel={};render();
 const qs=new URLSearchParams({busca:'1',q:f.q,status:f.status,ufs:f.ufs.join(','),mod:f.mod,de:f.de,ate:f.ate,emp:S.emp});
 try{const r=await fetch('/api/pncp?'+qs);const j=await r.json();t.res=r.ok?j:{situacao:'erro',mensagem:j.erro}}catch(e){t.res={situacao:'erro',mensagem:'Não foi possível consultar o PNCP agora. Tente de novo em instantes.'}}
 t.buscando=false;if(top()===t)render()});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target&&e.target.id==='pvq'){e.preventDefault();const b=document.querySelector('[data-act="pvbuscar"]');if(b)b.click()}});
K.act('pvsel',a=>{const t=top();const x=t.res.itens[+a.dataset.i];if(a.checked){if(Object.keys(t.sel).length>=LIMITE){a.checked=false;return toast('Até '+LIMITE+' licitações por vez.')}t.sel[x.controle]=1}else delete t.sel[x.controle];atualizaBotao()});
K.act('pvall',a=>{const t=top();t.sel={};if(a.checked)t.res.itens.filter(x=>!(x.noSistema&&x.noSistema.minha)).slice(0,LIMITE).forEach(x=>t.sel[x.controle]=1);document.querySelectorAll('.pvck').forEach(c=>{c.checked=!!t.sel[t.res.itens[+c.dataset.i].controle]});if(a.checked&&t.res.itens.length>LIMITE)toast('Selecionadas as primeiras '+LIMITE+'.');atualizaBotao()});
K.act('pvinserir',async a=>{const t=top();const refs=Object.keys(t.sel);if(!refs.length)return;if(S.emp==='ALL')return toast('Escolha uma empresa no seletor (canto inferior esquerdo) para importar.');a.disabled=true;a.textContent='Inserindo '+refs.length+'… (lendo itens e documentos no PNCP)';
 try{const r=await K.api('importar_pncp',{emp:S.emp,proj:t.proj,refs,prazo:addD(HOJE,3)});
  const ig=r.ignorados||[];toast(r.criados.length+' '+plural(r.criados.length,['licitação inserida','licitações inseridas'])+(ig.length?'; '+ig.length+' não inserida(s): '+ig.map(x=>x.ref+' ('+x.motivo+')').join('; '):'')+'. Abrindo a análise prévia…');
  sessionStorage.setItem('kb_ir','prev');setTimeout(()=>location.reload(),ig.length?4000:1200)}
 catch(e){toast(e.message);a.disabled=false;atualizaBotao()}});

/* ---------- análise prévia: fila ---------- */
const naFila=()=>{const by={};K.T2.lotsAll().filter(x=>x.lp.et===ANALISE&&(!x.lp.dec||x.lp.dec==='pendente')).forEach(x=>{const k=x.emp+'|'+x.crt;(by[k]=by[k]||[]).push(x)});return Object.values(by)};
K.view('prev',{label:()=>'Análise prévia',render(t){
 const fila=naFila().sort((a,b)=>String(a[0].c.ses||'9').localeCompare(String(b[0].c.ses||'9')));
 return `<div class="mod"><div class="mhead"><div><h1>Análise prévia</h1><p class="mut small">${fila.length} ${plural(fila.length,['licitação aguardando','licitações aguardando'])} a decisão de participar ou arquivar · ${S.emp==='ALL'?'Consolidado das empresas autorizadas':EMP[S.emp].nome}</p></div>
 <div class="acts">${K.can('preparar')&&S.emp!=='ALL'?'<button class="btn pri" data-act="t2imp">Buscar no PNCP</button>':''}</div></div>
 ${fila.length?`<ul class="list">${fila.map(ls=>{const x=ls[0],c=x.c;const dias=c.ses?Math.round((new Date(c.ses.slice(0,10)+'T12:00:00')-new Date(HOJE+'T12:00:00'))/864e5):null;
  return `<li><button class="rowb" data-act="pvabrir" data-crt="${c.id}" data-emp="${x.emp}"><span class="rowtop"><span class="org">${esc(c.org)}</span><span class="meta num">${c.ses?'propostas até '+dh(c.ses):'sem data de sessão'}${dias!=null&&dias>=0&&dias<=5?' <span class="pill warn">'+(dias===0?'hoje':dias===1?'amanhã':'em '+dias+' dias')+'</span>':''}</span></span>
  <span>${esc(c.mod)} ${esc(c.num)} · ${esc(String(c.obj||'').slice(0,180))}</span><span class="meta">${c.sede||''} · ${ls.length} ${plural(ls.length,['lote','lotes'])} · ${EMP[x.emp].curto}${c.pncp?' · PNCP':''}</span></button></li>`}).join('')}</ul>`
 :`<p class="note">Nenhuma licitação aguardando análise prévia. Use “Buscar no PNCP” para trazer novas oportunidades.</p>`}</div>`}});
K.act('pvabrir',a=>go({v:'prevd',crt:a.dataset.crt,emp:a.dataset.emp,tab:'docs'}));

/* ---------- análise prévia: ficha ---------- */
const ESCL=/esclarec|impugna|questionament|pedido|resposta|recurso|errata|retifica|comunicado|aviso de (altera|suspens|prorroga)|adendo/i;
const meusLotes=t=>K.T2.lotsAll().filter(x=>x.crt===t.crt&&x.emp===t.emp);
async function carregar(t){const c=CM[t.crt];if(!c.pncp||t.det||t.carregando)return;t.carregando=true;
 try{const r=await fetch('/api/pncp?hist=1&ref='+encodeURIComponent(c.pncp));const j=await r.json();t.det=r.ok?j:{situacao:'erro',mensagem:j.erro}}catch(e){t.det={situacao:'erro',mensagem:'PNCP indisponível no momento.'}}
 t.carregando=false;if(top()===t)render()}
const docUrl=(c,d)=>{const m=c.pncp.match(/^(\d{14})-\d-(\d{1,6})\/(\d{4})$/);return m?`/api/pncp?arquivo=${m[1]}/${m[3]}/${+m[2]}/${d.sequencial}`:null};
K.view('prevd',{label:t=>'Análise prévia · '+CM[t.crt].num,scoped:t=>partsAll().some(p=>p.crt===t.crt&&p.emp===t.emp),render(t){
 const c=CM[t.crt];const ls=meusLotes(t);if(!ls.length)return '<p>Registro fora do escopo.</p>';
 const pend=ls.filter(x=>x.lp.et===ANALISE&&(!x.lp.dec||x.lp.dec==='pendente'));
 carregar(t);const det=t.det;const ok=det&&det.situacao==='ok';const cc=ok?det.contratacao:{};
 const docs=ok?det.documentos.filter(d=>d.ativo!==false):[];const hist=ok?(det.historico||[]):[];
 const edital=docs.filter(d=>/edital/i.test(d.tipo||'')&&!ESCL.test(d.titulo||''));const escl=docs.filter(d=>ESCL.test((d.titulo||'')+' '+(d.tipo||'')));const anexos=docs.filter(d=>!edital.includes(d)&&!escl.includes(d));
 const retif=hist.filter(h=>/retifica/i.test(h.tipo||'')||h.justificativa);
 const locais=DOCS[c.id]||[];const canP=K.can('preparar',t.emp);
 const tab=(lista,vazio)=>lista.length?`<div class="scroll"><table class="stack"><thead><tr>${canP?'<th></th>':''}<th>Documento</th><th>Tipo</th><th>Publicação</th><th></th></tr></thead><tbody>${lista.map(d=>{const i=docs.indexOf(d);const u=docUrl(c,d);
  return `<tr ${t.ver===i?'class="me"':''}>${canP?`<td><input type="checkbox" class="pvdoc" value="${i}" aria-label="Guardar ${esc(d.titulo)}" style="width:18px;height:18px"></td>`:''}<td data-l="Documento">${esc(d.titulo||'Documento')}</td><td data-l="Tipo" class="small">${esc(d.tipo||'')}</td><td data-l="Publicação" class="num small">${d10(d.data)}</td>
  <td>${u?`<button class="btn link" data-act="pvver" data-i="${i}">Visualizar</button> <a class="btn link" href="${u}" target="_blank" rel="noopener">Abrir em nova aba ↗</a>`:''}</td></tr>`}).join('')}</tbody></table></div>`:`<p class="note">${vazio}</p>`;
 const visor=t.ver!=null&&docs[t.ver]?`<div class="box" style="margin-top:12px;padding:0;overflow:hidden"><div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--line)"><b class="small">${esc(docs[t.ver].titulo||'')}</b><button class="btn link" data-act="pvver" data-i="">Fechar ✕</button></div>
  <iframe src="${docUrl(c,docs[t.ver])}" title="${esc(docs[t.ver].titulo||'Documento')}" style="width:100%;height:75vh;border:0;background:#fff"></iframe><p class="small mut" style="padding:6px 12px;margin:0">PDF abre aqui. ZIP, DOCX e outros formatos são baixados pelo navegador.</p></div>`:'';
 const tabs=[['docs',`Edital e anexos (${edital.length+anexos.length})`],['escl',`Esclarecimentos e impugnações (${escl.length+retif.length})`],['itens',`Lotes e itens (${ls.length})`],['hist',`Histórico no PNCP (${hist.length})`]];
 let body='';
 if(!c.pncp)body=`<div class="callout warn">Esta licitação entrou por planilha, sem número de controle do PNCP. Os documentos aparecem abaixo quando carregados no processo.</div>`;
 else if(!det||t.carregando)body='<p class="note">Consultando edital, anexos e histórico no PNCP…</p>';
 else if(!ok)body=`<div class="callout warn">${esc(det.mensagem||'PNCP indisponível no momento.')} <button class="btn link" data-act="pvrecarregar">Tentar de novo</button></div>`;
 else if(t.tab==='docs')body=`<h3>Edital</h3>${tab(edital,'O órgão não publicou um documento do tipo “Edital” no PNCP. Veja os anexos ou o sistema de origem.')}<h3 style="margin-top:16px">Anexos</h3>${tab(anexos,'Nenhum anexo publicado.')}${visor}
  ${canP&&docs.length?'<div class="acts" style="margin-top:10px"><button class="btn" data-act="pvguardar">Guardar os marcados no processo</button><span class="small mut">Cria uma cópia versionada no sistema, para consulta mesmo se o órgão alterar o PNCP.</span></div>':''}`;
 else if(t.tab==='escl')body=`<div class="callout">O PNCP não tem um campo próprio para pedidos de esclarecimento e impugnação. Aqui aparecem as respostas e avisos que o órgão publicou como documento, e as retificações registradas no histórico. A íntegra das perguntas e respostas fica no sistema de origem${cc.link?`: <a href="${esc(cc.link)}" target="_blank" rel="noopener">abrir ↗</a>`:''}.</div>
  <h3>Documentos publicados</h3>${tab(escl,'Nenhuma resposta de esclarecimento, impugnação ou aviso publicada como documento até agora.')}${visor}
  <h3 style="margin-top:16px">Retificações e justificativas</h3>${retif.length?`<div class="scroll"><table class="stack"><thead><tr><th>Data</th><th>Alteração</th><th>Justificativa</th></tr></thead><tbody>${retif.map(h=>`<tr><td data-l="Data" class="num small">${dh(h.data)}</td><td data-l="Alteração" class="small">${esc(h.tipo||'')} · ${esc(h.categoria||'')}${h.documento?': '+esc(h.documento):''}${h.item!=null?' (item '+h.item+')':''}</td><td data-l="Justificativa" class="small">${esc(h.justificativa||'—')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Nenhuma retificação registrada.</p>'}`;
 else if(t.tab==='itens')body=`<div class="scroll"><table class="stack"><thead><tr><th>Lote</th><th class="r">Quantidade</th><th class="r">Valor de referência</th><th>Etapa</th></tr></thead><tbody>${ls.map(x=>{const l=c.lotes[x.n-1]||{};return `<tr><td data-l="Lote" class="small">${x.n} · ${esc(l.d||'')}</td><td data-l="Quantidade" class="r num small">${l.q!=null?Number(l.q).toLocaleString('pt-BR'):'—'} ${esc(l.u||'')}</td><td data-l="Referência" class="r num small">${l.ref?brl(l.ref):'sigiloso ou não informado'}</td><td data-l="Etapa" class="small">${esc(x.lp.et)}</td></tr>`}).join('')}</tbody></table></div>`;
 else if(t.tab==='hist')body=hist.length?`<div class="scroll"><table class="stack"><thead><tr><th>Data</th><th>Evento</th><th>Detalhe</th><th>Por</th></tr></thead><tbody>${hist.map(h=>`<tr><td data-l="Data" class="num small">${dh(h.data)}</td><td data-l="Evento" class="small">${esc(h.tipo||'')} · ${esc(h.categoria||'')}</td><td data-l="Detalhe" class="small">${esc(h.documento||'')}${h.item!=null?' item '+h.item:''}${h.justificativa?' · '+esc(h.justificativa):''}</td><td data-l="Por" class="small">${esc(h.por||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="note">Sem histórico publicado.</p>';
 if(!c.pncp&&locais.length)body+=`<h3>Documentos no processo</h3><ul>${locais.map(d=>`<li>${d.arqId?`<button class="btn link" data-act="t2dl" data-id="${d.arqId}" data-n="${esc(d.nome)}">${esc(d.nome)}</button>`:esc(d.nome)} · v${d.v}</li>`).join('')}</ul>`;
 const canD=K.can('decidir',t.emp);
 const decisao=pend.length?`<div class="box" style="margin-top:18px"><h3>Decisão da análise prévia</h3>
  ${canD?`<label class="small mut" style="display:grid;gap:4px">Justificativa (obrigatória; fica registrada com seu nome)<textarea id="pvjust" rows="3" placeholder="Ex.: objeto aderente ao portfólio, prazo de entrega viável, atestados disponíveis.">${esc(t.just||'')}</textarea></label>
  <div class="acts" style="margin-top:10px"><button class="btn pri" data-act="pvdecidir" data-k="participar">Participar</button><button class="btn" data-act="pvdecidir" data-k="declinar">Arquivar</button><span class="small mut">Vale para ${pend.length} ${plural(pend.length,['lote','lotes'])} desta licitação. Para decidir lote a lote, use “Decisão por lote”.</span></div>`
  :`<p class="note">Seu perfil não decide participação em ${EMP[t.emp].curto}. A decisão cabe a quem tem a alçada “decidir participação”.</p>`}</div>`
  :`<div class="callout ok" style="margin-top:18px">Análise prévia concluída: ${[...new Set(ls.map(x=>x.lp.et))].join(', ')}.</div>`;
 return `<div class="mod"><div class="mhead"><div><div class="tags"><span class="pill">${ANALISE}</span>${c.pncp?' <span class="pill">PNCP</span>':''}</div><h1>${esc(c.mod)} nº ${esc(c.num)}</h1><p class="mut">${esc(c.org)}${c.un?' · '+esc(c.un):''}</p></div>
 <div class="acts"><button class="btn" data-act="t2dec" data-crt="${c.id}" data-n="${ls[0].n}">Decisão por lote</button>${c.portal?`<a class="btn" href="${esc(c.portal)}" target="_blank" rel="noopener">Ver no PNCP ↗</a>`:''}${cc.link?`<a class="btn" href="${esc(cc.link)}" target="_blank" rel="noopener">Sistema de origem ↗</a>`:''}</div></div>
 <dl class="facts">${fact('Objeto',esc(c.obj))}${fact('Local',esc((cc.municipio?cc.municipio+'/':'')+(c.sede||'')))}${fact('Publicação',d10(c.pub))}${fact('Propostas até (abertura da disputa)',c.ses?dh(c.ses):'não informada')}${fact('Situação no PNCP',esc(cc.situacao||c.sit||'—'))}${fact('Valor estimado',cc.valorEstimado?brl(cc.valorEstimado):'sigiloso ou não informado')}${fact('Empresa',EMP[t.emp].nome)}${c.pncp?fact('Nº de controle PNCP',esc(c.pncp)):''}</dl>
 ${decisao}
 <div class="tabs" role="tablist" style="margin-top:18px">${tabs.map(([k,l])=>`<button role="tab" aria-selected="${t.tab===k}" data-act="pvtab" data-k="${k}">${l}</button>`).join('')}</div>${body}</div>`}});
const guardaJust=t=>{const j=$('#pvjust');if(j)t.just=j.value};
K.act('pvtab',a=>{const t=top();guardaJust(t);t.tab=a.dataset.k;t.ver=null;render()});
K.act('pvver',a=>{const t=top();guardaJust(t);t.ver=a.dataset.i===''?null:+a.dataset.i;render()});
K.act('pvrecarregar',()=>{const t=top();t.det=null;render()});
K.act('pvguardar',async a=>{const t=top();const docs=t.det.documentos.filter(d=>d.ativo!==false);const sel=[...document.querySelectorAll('.pvdoc:checked')].map(x=>docs[+x.value]);if(!sel.length)return toast('Marque ao menos um documento.');
 a.disabled=true;a.textContent='Guardando '+sel.length+'…';
 try{const r=await fetch('/api/pncp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:CM[t.crt].pncp,crt:t.crt,emp:t.emp,docs:sel})});const x=await r.json();if(!r.ok)throw new Error(x.erro);
  const ds=DOCS[t.crt]=DOCS[t.crt]||[];const ok=x.salvos.filter(y=>!y.erro);ok.forEach(y=>ds.push({nome:y.titulo,v:y.versao,d:HOJE,arqId:y.arqId}));K.marcar&&K.marcar('certdocs',t.crt,ds);
  toast(ok.length+' documento(s) guardado(s) no processo'+(x.salvos.length>ok.length?'; '+(x.salvos.length-ok.length)+' falharam':'')+'.')}
 catch(e){toast(e.message)}a.disabled=false;a.textContent='Guardar os marcados no processo'});
K.act('pvdecidir',a=>{const t=top();guardaJust(t);const just=(t.just||'').trim();const k=a.dataset.k;
 if(!just)return toast('A justificativa é obrigatória.');
 const ls=meusLotes(t).filter(x=>x.lp.et===ANALISE&&(!x.lp.dec||x.lp.dec==='pendente'));if(!ls.length)return;
 const quem=K.uname(S.user);
 ls.forEach(x=>{const lp=x.lp;lp.dec=k;lp.decisao={by:S.user,d:HOJE,just,cond:'',v:1,sim:'',origem:'análise prévia'};
  if(k==='declinar'){lp.et='Arquivada';lp.mot='Arquivada na análise prévia: '+just;lp.prep=null;lp.acao=null;lp.hist.push({et:'Arquivada',d:HOJE,by:quem})}
  else{lp.hist.push({et:'Participação aprovada',d:HOJE,by:quem},{et:'Em preparação',d:HOJE,by:'Sistema'});lp.et='Em preparação';lp.prep={orc:'A elaborar',hab:'Em andamento'};lp.acao='Elaborar orçamento e documentos';lp.prazo=addD(HOJE,5)}
  DECS.push({crt:t.crt,n:x.n,dec:k,by:S.user,d:HOJE,reab:false})});
 t.just='';toast(k==='declinar'?`Licitação arquivada (${ls.length} ${plural(ls.length,['lote','lotes'])}).`:`Participação aprovada (${ls.length} ${plural(ls.length,['lote','lotes'])}): segue para preparação.`);
 if(k==='declinar'){S.stack=[{v:'prev'}];K.setHash('prev')}else{S.stack=[{v:'cart'},{v:'proc',crt:t.crt}];K.setHash('proc')}render()});
}
