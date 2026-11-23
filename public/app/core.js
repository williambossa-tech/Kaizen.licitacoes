{
const HOJE=window.KB_DATA.hoje;
const PATHS=window.KB_PATHS;
const $=s=>document.querySelector(s);
const UF={AC:['Acre','N'],AL:['Alagoas','NE'],AP:['Amapá','N'],AM:['Amazonas','N'],BA:['Bahia','NE'],CE:['Ceará','NE'],DF:['Distrito Federal','CO'],ES:['Espírito Santo','SE'],GO:['Goiás','CO'],MA:['Maranhão','NE'],MT:['Mato Grosso','CO'],MS:['Mato Grosso do Sul','CO'],MG:['Minas Gerais','SE'],PA:['Pará','N'],PB:['Paraíba','NE'],PR:['Paraná','S'],PE:['Pernambuco','NE'],PI:['Piauí','NE'],RJ:['Rio de Janeiro','SE'],RN:['Rio Grande do Norte','NE'],RS:['Rio Grande do Sul','S'],RO:['Rondônia','N'],RR:['Roraima','N'],SC:['Santa Catarina','S'],SP:['São Paulo','SE'],SE:['Sergipe','NE'],TO:['Tocantins','N']};
const PSEUDO={MULTI:'Multiestadual sem rateio',SEMLOC:'Sem localização'};
const REG={N:'Norte',NE:'Nordeste',CO:'Centro-Oeste',SE:'Sudeste',S:'Sul'};
const D=window.KB_DATA;
const USERS=D.USERS,EMP=D.EMP,CRT=D.CRT,PART=D.PART,RES=D.RES,CTR=D.CTR;
const ALFA=EMP.A?EMP.A.nome:'',BETA=EMP.B?EMP.B.nome:'';
const ARQ='Arquivada',FORM='Formalizada';
const CM=Object.fromEntries(CRT.map(c=>[c.id,c]));
const KM=Object.fromEntries(CTR.map(k=>[k.id,k]));

/* ---------- métricas ---------- */
const MET={
crt:{l:'Certames da base importada',u:['certame','certames'],k:'count',ref:'data da sessão pública (sem sessão definida: data de publicação)'},
part:{l:'Participações da empresa',u:['lote','lotes'],k:'count',ref:'data da sessão pública',note:'Uma participação por lote em que a empresa decidiu participar.'},
win:{l:'Lotes ganhos',u:['lote ganho','lotes ganhos'],k:'count',ref:'data do resultado definitivo (homologação)',note:'Vencedor provisório não entra até o resultado definitivo.'},
exito:{l:'Taxa de êxito por lote',k:'ratio',ref:'data do resultado definitivo',note:'Vitórias ÷ lotes disputados com resultado definitivo. Certames revogados, anulados ou desertos ficam fora; lotes com resultado pendente aparecem à parte.'},
hom:{l:'Valor homologado',k:'money',ref:'data da homologação',note:'Somente lotes vencidos pela empresa.'},
ctr:{l:'Valor contratado',k:'money',ref:'data de assinatura do instrumento'},
fat:{l:'Faturado',k:'money',ref:'data de emissão da nota fiscal'},
rec:{l:'Recebido',k:'money',ref:'data do recebimento'},
mrg:{l:'Margem realizada',k:'ratio',div:true,ref:'competência da DRE gerencial',note:'Soma dos resultados ÷ soma das receitas líquidas das competências do período.'}
};
const PER={'2026':['2026-01-01','2026-12-31','2026'],'12m':['2025-12-01','2026-11-30','dez/2025–nov/2026'],'2025':['2025-01-01','2025-12-31','2025'],'2526':['2025-01-01','2026-12-31','2025–2026']};

/* ---------- estado ---------- */
const S={user:D.eu.slug,emp:(USERS[D.eu.slug].emp[0]||'A'),per:'2026',met:'crt',base:'exec',reg:'',proj:'',modal:'',conc:'',uf:null,qf:'todas',ex:false,q:'',pg:1,stack:[{v:'map'}],open:{},sheet:false,scroll:0,pscroll:0};
const PG=5;

/* ---------- utilidades ---------- */
const NF=new Intl.NumberFormat('pt-BR'),BRL=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const brl=v=>BRL.format(v);
const brlc=v=>{const a=Math.abs(v);if(a>=1e6)return 'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';if(a>=1e3)return 'R$ '+(v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';return brl(v)};
const pct=(x,d=1)=>x.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d})+'%';
const dt=d=>d?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):'não informada';
const dth=s=>s?dt(s.slice(0,10))+' às '+s.slice(11,16)+' (Brasília)':'não informada';
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const cmp=c=>MES[+c.slice(5,7)-1]+'/'+c.slice(0,4);
const esc=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const plural=(n,u)=>n===1?u[0]:u[1];
const per=()=>PER[S.per];
const inP=d=>!!d&&d.slice(0,10)>=per()[0]&&d.slice(0,10)<=per()[1];
const inPc=c=>c>=per()[0].slice(0,7)&&c<=per()[1].slice(0,7);
const scope=()=>S.emp==='ALL'?USERS[S.user].emp.slice():[S.emp];
const refC=c=>c.ses?c.ses.slice(0,10):c.pub;
const isPart=lp=>lp.dec==='participar'||lp.dec==='condicionada';
const ufsC=c=>S.base==='sede'?(c.sede?[c.sede]:[]):c.exec;
const ufL=(c,l)=>{if(S.base==='sede')return c.sede||'SEMLOC';const u=l.uf;if(Array.isArray(u))return u.length>1?'MULTI':u[0];return u||(c.exec.length===1?c.exec[0]:c.exec.length?'MULTI':'SEMLOC')};
const ufName=u=>UF[u]?UF[u][0]:PSEUDO[u];
const inReg=u=>!S.reg||(UF[u]&&UF[u][1]===S.reg);
const situ=c=>c.enc?'conc':!c.ses?'ind':c.ses.slice(0,10)>HOJE?'fut':'and';
const SIT={fut:'Futura',and:'Em andamento',conc:'Concluída',ind:'Enquadramento indeterminado'};
const ctrSt=k=>k.fim<HOJE?'enc':k.ass<=HOJE?'exec':'ini';
const CST={enc:'Encerrado',exec:'Em execução',ini:'Aguardando início'};
function passP(p){const c=CM[p.crt];if(S.proj&&p.proj!==S.proj)return false;if(S.modal&&c.mod!==S.modal)return false;
 if(S.conc&&!c.lotes.some(l=>(RES[c.id+'-L'+l.n]?.rows||[]).some(r=>r[1]===S.conc)))return false;return true}
const partsAll=()=>PART.filter(p=>scope().includes(p.emp));
const parts=()=>partsAll().filter(passP);
const crtIds=()=>[...new Set(parts().map(p=>p.crt))];
const ctrs=()=>{const ps=parts();return CTR.filter(k=>ps.some(p=>p.emp===k.emp&&p.crt===k.crt))};
const ours=()=>scope().map(e=>EMP[e].nome);

function contribs(m){
 const out=[],ps=parts();
 if(m==='crt'){const seen=new Set();for(const p of ps){if(seen.has(p.crt))continue;seen.add(p.crt);const c=CM[p.crt];if(!inP(refC(c)))continue;const u=ufsC(c);(u.length?u:['SEMLOC']).forEach(x=>out.push({crt:c.id,uf:x,v:1}))}}
 else if(['part','win','exito','hom'].includes(m)){for(const p of ps){const c=CM[p.crt];for(const [n,lp] of Object.entries(p.L)){const l=c.lotes[n-1],b={crt:c.id,uf:ufL(c,l),emp:p.emp,lot:+n};
  if(m==='part'&&isPart(lp)&&inP(refC(c)))out.push({...b,v:1});
  if(m==='win'&&lp.res==='venceu'&&inP(lp.rd))out.push({...b,v:1});
  if(m==='exito'){if(isPart(lp)&&(lp.res==='venceu'||lp.res==='perdeu')&&inP(lp.rd))out.push({...b,n:lp.res==='venceu'?1:0,d:1});else if(isPart(lp)&&lp.res==='pendente'&&inP(refC(c)))out.push({...b,pend:1,n:0,d:0})}
  if(m==='hom'&&lp.hv&&inP(lp.hd))out.push({...b,v:lp.hv})}}}
 else{for(const k of ctrs()){const c=CM[k.crt],b={crt:c.id,uf:ufL(c,c.lotes[k.lote-1]),emp:k.emp,lot:k.lote,ctr:k.id};
  if(m==='ctr'&&inP(k.ass))out.push({...b,v:k.v});
  if(m==='fat')k.nfs.forEach(f=>{if(inP(f[1]))out.push({...b,v:f[2]})});
  if(m==='rec')k.rec.forEach(r=>{if(inP(r[0]))out.push({...b,v:r[1]})});
  if(m==='mrg')k.dre.forEach(r=>{if(inPc(r[0]))out.push({...b,n:r[3],d:r[2]})})}}
 return out}
function sum(list,m){const e={v:0,n:0,d:0,pend:0,ids:new Set(),items:list.length};for(const x of list){e.v+=x.v||0;e.n+=x.n||0;e.d+=x.d||0;e.pend+=x.pend||0;e.ids.add(x.crt)}
 e.val=MET[m].k==='ratio'?(e.d?e.n/e.d*100:null):m==='crt'?e.ids.size:e.v;return e}
function agg(list,m){const g={};for(const x of list)(g[x.uf]=g[x.uf]||[]).push(x);const o={};for(const u in g)o[u]=sum(g[u],m);return o}
const empty=m=>sum([],m);
function fmtV(v,m,full){const k=MET[m].k;if(v===null||v===undefined)return 'sem base';if(k==='count')return NF.format(v);if(k==='money')return full?brl(v):brlc(v);return pct(v)}
function unitTxt(e,m){const M=MET[m];if(M.k==='count')return plural(e.val,M.u);if(m==='exito')return e.d?`${e.n} de ${e.d} ${plural(e.d,['lote','lotes'])}`:'nenhum lote com resultado definitivo';if(m==='mrg')return e.d?`${brlc(e.n)} de resultado sobre ${brlc(e.d)} de receita líquida`:'receita líquida zero no período';return ''}
function cov(u){if(!UF[u])return {ok:true,part:false,miss:[]};const miss=scope().filter(e=>EMP[e].semCob.includes(u));return {ok:miss.length<scope().length,part:miss.length>0&&miss.length<scope().length,miss}}

/* ---------- escala ---------- */
const SEQ=['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)'];
function niceStep(x){if(x<=0)return 1;const p=10**Math.floor(Math.log10(x));for(const k of [1,2,2.5,5,10])if(k*p>=x)return k*p;return 10*p}
function classes(m,max){
 const M=MET[m];
 if(M.div)return [{a:-Infinity,b:-5,c:'var(--n2)',t:'abaixo de −5%'},{a:-5,b:0,c:'var(--n1)',t:'−5% a 0%'},{a:0,b:5,c:'var(--s1)',t:'0% a 5%'},{a:5,b:10,c:'var(--s2)',t:'5% a 10%'},{a:10,b:15,c:'var(--s3)',t:'10% a 15%'},{a:15,b:Infinity,c:'var(--s5)',t:'15% ou mais'}];
 if(m==='exito')return [0,20,40,60,80].map((a,i)=>({a,b:a+20,c:SEQ[i],t:i===0?'acima de 0% até 20%':`acima de ${a}% até ${a+20}%`}));
 if(!max)return [];
 if(M.k==='count'&&max<=5)return Array.from({length:max},(_,i)=>({a:i,b:i+1,c:SEQ[Math.round(i*(4/Math.max(1,max-1)))],t:`${i+1}`}));
 let st=niceStep(max/5);if(M.k==='count')st=Math.ceil(st);const n=Math.ceil(max/st);
 return Array.from({length:n},(_,i)=>{const a=i*st,b=(i+1)*st;const f=M.k==='money'?brlc:NF.format;return {a,b,c:SEQ[Math.round(i*(4/Math.max(1,n-1)))],t:M.k==='count'?(st===1?`${b}`:`${a+1} a ${b}`):i===0?`até ${f(b)}`:`acima de ${f(a)} até ${f(b)}`}})}
function fillFor(v,m,cl){if(v===null)return 'var(--nob)';if(!MET[m].div&&v===0)return 'var(--zero)';for(const k of cl){if(MET[m].div?(v>=k.a&&v<k.b):(v>k.a&&v<=k.b))return k.c}return cl.length?cl[cl.length-1].c:'var(--zero)'}

/* ---------- mapa: montagem ---------- */
const gP=$('#gpaths'),gL=$('#glabels'),tip=$('#tip'),wrap=$('#mapwrap');
const NOLAB=['DF','SE','AL','RN','PB','ES','RJ'];
const OFF={GO:[-6,14],MG:[10,10],PA:[0,10],PI:[-4,14],MA:[4,10],RS:[8,0],PE:[22,2],CE:[0,4],TO:[0,10],BA:[8,8],SP:[10,6],SC:[8,0],RO:[0,6],AC:[4,8],RR:[0,6],AP:[0,8],AM:[0,0],MS:[0,4],MT:[0,4],PR:[2,0]};
const NS='http://www.w3.org/2000/svg';
for(const u of Object.keys(PATHS)){const p=document.createElementNS(NS,'path');p.setAttribute('d',PATHS[u]);p.id='uf-'+u;p.dataset.uf=u;p.setAttribute('tabindex','0');p.setAttribute('role','button');gP.appendChild(p)}
const BOX={};
for(const p of gP.children){const b=p.getBBox(),u=p.dataset.uf;BOX[u]=b;if(NOLAB.includes(u))continue;const o=OFF[u]||[0,0];const t=document.createElementNS(NS,'text');t.setAttribute('x',b.x+b.width/2+o[0]);t.setAttribute('y',b.y+b.height/2+o[1]);t.textContent=u;t.id='lb-'+u;gL.appendChild(t)}
function showTip(u,x,y){const M=MET[S.met],e=A_[u]||empty(S.met),cv=cov(u);let h=`<b>${UF[u][0]} (${u})</b><br>`;
 if(!cv.ok)h+='Sem cobertura da importação';else{h+=`${M.l}: <b>${fmtV(e.val,S.met)}</b>`;if(e.val===0&&!M.div)h+=' (zero confirmado)';if(cv.part)h+=`<br>Cobertura parcial: sem dados de ${cv.miss.map(x=>EMP[x].curto).join(', ')}`}
 if(!inReg(u))h+='<br>Fora do filtro de região';
 tip.innerHTML=h+'<br><span style="opacity:.8">Clique ou toque para abrir</span>';const W=wrap.clientWidth;tip.style.left=Math.min(Math.max(0,x+14),W-230)+'px';tip.style.top=Math.max(0,y-10)+'px';tip.classList.add('on')}
gP.addEventListener('pointermove',ev=>{const u=ev.target.dataset?.uf;if(!u)return;const r=wrap.getBoundingClientRect();showTip(u,ev.clientX-r.left,ev.clientY-r.top)});
gP.addEventListener('pointerleave',()=>tip.classList.remove('on'));
gP.addEventListener('click',ev=>{const u=ev.target.dataset?.uf;if(u){tip.classList.remove('on');selUF(u)}});
gP.addEventListener('keydown',ev=>{const u=ev.target.dataset?.uf;if(u&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();selUF(u)}});
gP.addEventListener('focusin',ev=>{const u=ev.target.dataset?.uf;if(!u)return;const svg=$('#map'),k=svg.clientWidth/613,b=BOX[u];showTip(u,(b.x+b.width/2)*k,(b.y+b.height/2)*k)});
gP.addEventListener('focusout',()=>tip.classList.remove('on'));
$('#uflist').innerHTML=Object.keys(UF).sort().map(u=>`<option value="${u} — ${UF[u][0]}">`).join('');
function findUF(q){q=norm(q).trim();if(!q)return null;const s=q.slice(0,2).toUpperCase();if(UF[s]&&(q.length===2||q.includes('—')||q.includes('-')))return s;for(const u in UF)if(norm(UF[u][0])===q)return u;for(const u in UF)if(norm(UF[u][0]).startsWith(q))return u;return null}
$('#ufq').addEventListener('change',e=>{const u=findUF(e.target.value);if(u){selUF(u);e.target.value=''}else toast('Nenhuma UF encontrada para “'+e.target.value+'”.')});
$('#ufq').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.dispatchEvent(new Event('change'))}});

/* ---------- navegação ---------- */
const NAV=[['dia','Meu dia'],['lic','Licitações'],['pre','Análise prévia'],['res','Resultados e concorrentes'],['map','Mapa'],['ctrs','Contratos'],['fin','Financeiro'],['docs','Documentos'],['proc','Processo'],['adm','Administração']];
const NAVV={dia:'dia',lic:'cart',pre:'prev',res:'conc',ctrs:'ctrs',fin:'fin',docs:'acervo',proc:'bpmn',adm:'adm'};
const V={},ACT={},HOOK={crt:[],lote:[],ctr:[]};
const PHT={docs:['Documentos','Acervo de certidões e documentos por empresa.','Template 3'],proc:['Processo','Documentação do processo e BPMN.','Template 2'],dia:['Meu dia','Prazos, decisões pendentes e sessões do dia por responsável.','Template 2 · Carteira, entrada e decisão de participação'],lic:['Licitações','Carteira operacional: grade com filtros rápidos (aguardando minha aprovação, orçamento pendente, em disputa, pós-disputa), lotes e etapas.','Template 2 · Carteira, entrada e decisão de participação'],res:['Resultados e concorrentes','Classificação de todos os participantes, histórico por concorrente e diferença de preço em disputas comparáveis.','Template 5 · Disputa, resultados e concorrência'],ctrs:['Contratos','Empenhos, saldos, aditivos, atas de registro de preços e postos de serviço.','Templates 6 e 7 · Contratos de bens, atas e serviços de TI'],fin:['Financeiro','DRE por contrato e competência, caixa e conciliação.','Template 9 · DRE, caixa e BI consolidado'],adm:['Administração','Empresas, usuários, vínculos de acesso, alçadas e permissões por CNPJ.','Etapa de implementação (após aprovação dos templates)']};
const top=()=>S.stack[S.stack.length-1];
let hashGuard='';
function setHash(v){v=v||'mapa';try{const h='#'+v;if(location.hash!==h){hashGuard=h;location.hash=h}}catch(e){}}
window.addEventListener('hashchange',()=>{const h=location.hash;if(h===hashGuard){hashGuard='';return}const v=h.slice(1)||'mapa';const name={mapa:'map',licitacao:'crt',lote:'lote',contrato:'ctr',modulo:'ph'}[v]||v;for(let i=S.stack.length-1;i>=0;i--){if(S.stack[i].v===name){if(i<S.stack.length-1){S.stack=S.stack.slice(0,i+1);render(true)}return}}});
const HN=new Proxy({map:'mapa',crt:'licitacao',lote:'lote',ctr:'contrato',ph:'modulo'},{get:(o,k)=>o[k]||k});
function go(e){if(top().v==='map'){S.scroll=window.scrollY;const pb=$('#pbody');S.pscroll=pb?pb.scrollTop:0}S.stack.push(e);setHash(HN[e.v]);render();window.scrollTo(0,0)}
function back(){if(S.stack.length>1){S.stack.pop();setHash(HN[top().v]);render(true)}}
function toLevel(i){S.stack=S.stack.slice(0,i+1);setHash(HN[top().v]);render(true)}
function goMap(){S.stack=[{v:'map'}];setHash('mapa');render(true)}
function selUF(u){S.uf=u;S.qf='todas';S.ex=false;S.q='';S.pg=1;S.sheet=true;render();const pb=$('#pbody');if(pb)pb.scrollTop=0;if(window.innerWidth>=900)$('#panel').scrollIntoView({block:'nearest'})}

/* ---------- controles ---------- */
$('#met').innerHTML=Object.entries(MET).map(([k,m])=>`<option value="${k}">${m.l}</option>`).join('');
function fillCtl(){
 const pj=[['','Todos']];scope().forEach(e=>Object.entries(EMP[e].proj).forEach(([k,v])=>pj.push([k,(S.emp==='ALL'?EMP[e].curto+': ':'')+v])));
 $('#proj').innerHTML=pj.map(([k,v])=>`<option value="${k}">${v}</option>`).join('');$('#proj').value=S.proj;
 const cs=new Set();partsAll().forEach(p=>CM[p.crt].lotes.forEach(l=>(RES[p.crt+'-L'+l.n]?.rows||[]).forEach(r=>{if(!ours().includes(r[1]))cs.add(r[1])})));
 $('#conc').innerHTML='<option value="">Todos</option>'+[...cs].sort().map(c=>`<option>${c}</option>`).join('');$('#conc').value=S.conc;
 const U=USERS[S.user];{const us=$('#usr');if(D.demo&&D.demo.length){us.hidden=false;if(!us.options.length)us.innerHTML=D.demo.map(p=>`<option value="${p.slug}">${p.nome}${D.eu.real&&p.slug===D.eu.real.slug?' (você)':''}</option>`).join('');us.value=S.user}else{us.hidden=true}}$('#emp').innerHTML=U.emp.map(e=>`<option value="${e}">${EMP[e].nome}</option>`).join('')+(U.cons&&U.emp.length>1?'<option value="ALL">Consolidado ('+U.emp.map(e=>EMP[e].curto).join(' + ')+')</option>':'');$('#emp').value=S.emp;$('#urole').textContent=U.papel+(D.eu.real?' · modo demonstração por '+D.eu.real.nome:'');$('#per').value=S.per;$('#met').value=S.met;$('#reg').value=S.reg;$('#modal').value=S.modal;
 $('#b-exec').setAttribute('aria-pressed',S.base==='exec');$('#b-sede').setAttribute('aria-pressed',S.base==='sede');
 $('#fsum').textContent=per()[2]+' · '+MET[S.met].l;
 $('#cnpj').textContent=S.emp==='ALL'?scope().length+' CNPJs autorizados':'CNPJ '+EMP[S.emp].cnpj;
 const r0=S.stack[0];const cur=r0.v==='map'?'map':r0.v==='ph'?r0.k:Object.keys(NAVV).find(k=>NAVV[k]===r0.v);$('#nav').innerHTML=NAV.map(([k,l])=>`<button type="button" data-nav="${k}" ${k===cur?'aria-current="page"':''}>${l}</button>`).join('');const bi=r0.v==='map';$('#filters').hidden=!bi;$('#ftog').hidden=!bi}
$('#nav').addEventListener('click',e=>{const k=e.target.closest('button')?.dataset.nav;if(!k)return;if(k==='map')return goMap();const v=NAVV[k];if(top().v==='map'){S.scroll=window.scrollY}S.stack=V[v]?[{v}]:[{v:'ph',k}];setHash(V[v]?v:'modulo');render();window.scrollTo(0,0)});
$('#usr').addEventListener('change',async e=>{const slug=e.target.value;$('#busy').hidden=false;$('#busy').textContent='Trocando de perfil…';const r=await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug})});if(!r.ok){$('#busy').hidden=true;toast((await r.json()).erro||'Não foi possível trocar de perfil.');return}location.reload()});
$('#ftog').onclick=()=>{const f=$('#filters'),o=f.classList.toggle('open');$('#ftog').setAttribute('aria-expanded',o);$('#ftog span').textContent=o?'Fechar filtros':'Filtros'};
const on=(id,f)=>$(id).addEventListener('change',e=>{f(e.target.value);S.pg=1;render()});
on('#per',v=>S.per=v);on('#met',v=>S.met=v);on('#reg',v=>{S.reg=v;if(S.uf&&UF[S.uf]&&!inReg(S.uf))S.uf=null});on('#proj',v=>S.proj=v);on('#modal',v=>S.modal=v);on('#conc',v=>S.conc=v);
$('#b-exec').onclick=()=>{S.base='exec';if(S.uf==='MULTI')S.uf=null;render()};$('#b-sede').onclick=()=>{S.base='sede';if(S.uf==='MULTI')S.uf=null;render()};
$('#clear').onclick=()=>{S.reg='';S.proj='';S.modal='';S.conc='';S.pg=1;render();toast('Filtros de região, projeto, modalidade e concorrente limpos.')};
$('#emp').addEventListener('change',e=>{const nv=e.target.value,busy=$('#busy');busy.hidden=false;busy.textContent='Carregando o contexto de '+(nv==='ALL'?'todas as empresas (consolidado)':EMP[nv].nome)+'…';
 setTimeout(()=>{S.emp=nv;const cleared=[];const pj=scope().flatMap(x=>Object.keys(EMP[x].proj));if(S.proj&&!pj.includes(S.proj)){S.proj='';cleared.push('Projeto')}
  fillCtl();if(S.conc&&$('#conc').value!==S.conc){S.conc='';cleared.push('Concorrente')}
  const t=top();let moved=false;if(['crt','lote','ctr'].includes(t.v)){const ok=t.v==='ctr'?scope().includes(KM[t.id].emp):partsAll().some(p=>p.crt===t.crt);if(!ok){S.stack=[S.stack[0]];setHash(HN[S.stack[0].v]);moved=true}}else if(V[t.v]?.scoped&&!V[t.v].scoped(t)){S.stack=[S.stack[0]];setHash(HN[S.stack[0].v]);moved=true}
  S.pg=1;busy.hidden=true;render();toast((nv==='ALL'?'Visão consolidada das empresas autorizadas.':'Contexto: '+EMP[nv].nome+' · CNPJ '+EMP[nv].cnpj+'.')+(cleared.length?' Filtros incompatíveis limpos: '+cleared.join(', ')+'.':'')+(moved?' A ficha aberta não pertence a esta empresa; voltamos ao mapa.':''))},350)});
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),3800)}
/* visões salvas */
let VIEWS=[];try{VIEWS=JSON.parse(localStorage.getItem('kb2g-visoes')||'[]')}catch(e){}
function fillViews(){$('#views').innerHTML='<option value="">—</option>'+VIEWS.map((v,i)=>`<option value="${i}">${esc(v.nome)}</option>`).join('')}
fillViews();
$('#save').onclick=()=>{const v={nome:`${MET[S.met].l} · ${per()[2]}${S.uf?' · '+S.uf:''}${S.reg?' · '+REG[S.reg]:''}`,st:{emp:S.emp,per:S.per,met:S.met,base:S.base,reg:S.reg,proj:S.proj,modal:S.modal,conc:S.conc,uf:S.uf,qf:S.qf,ex:S.ex}};VIEWS.push(v);try{localStorage.setItem('kb2g-visoes',JSON.stringify(VIEWS))}catch(e){}fillViews();toast('Visão salva: '+v.nome)};
$('#views').addEventListener('change',e=>{const v=VIEWS[+e.target.value];if(!v)return;Object.assign(S,v.st,{pg:1,q:'',stack:[{v:'map'}]});render();toast('Visão aplicada: '+v.nome)});

/* ---------- roteiro ---------- */
const ROT=[
'Com <b>Alfa Mobiliário</b>, período <b>2026</b> e métrica <b>Certames da base importada</b>, clique no <b>PR</b> (ou digite “PR” em “Selecionar UF”). O painel deve listar <b>3 licitações</b>: uma futura (Prefeitura de Curitiba), uma em andamento (UFPR) e uma concluída (TJPR). O contador “3 de 3 compõem o indicador” deve bater com o mapa.',
'Ative <b>Com contrato em execução</b>: deve restar <b>1</b> (TJPR, Contrato 045/2026). Os filtros “Futuras”, “Em andamento” e “Concluídas” mostram 1 cada.',
'Abra a licitação do TJPR, depois o <b>Lote 1</b> e o <b>Contrato 045/2026</b>. Confira a trilha no topo. Use “Voltar” ou clique em “Paraná” na trilha: o painel volta com a mesma UF, filtro, página e posição.',
'Compare <b>AP</b> (hachurado: sem cobertura da importação) com <b>MS</b> (branco: zero confirmado). Mude o período para <b>2025</b>: SC passa a ter 1 certame. Volte para 2026: SC fica zero (sem dados no período).',
'Troque a empresa para <b>Beta Sistemas</b>: o mapa recarrega, o PR mostra 1 licitação (perdida), <b>RR</b> fica sem cobertura e AP volta a ter cobertura.',
'Ainda na Beta, escolha <b>Margem realizada</b>: o RJ aparece em laranja (margem negativa, escala divergente centrada em zero). Clique no RJ e abra o contrato para ver a DRE por competência.',
'Escolha <b>Consolidado (Alfa + Beta)</b> e a métrica de certames: a <b>BA</b> conta 1 certame, porque o mesmo edital está nas duas carteiras. Abra a ficha: cada lote mostra a empresa que participou.',
'Volte à Alfa, escolha <b>Valor homologado</b> e alterne <b>Local de execução</b> ↔ <b>Sede do órgão</b>: os R$ 455 mil do lote multiestadual do Ministério da Saúde saem de “Multiestadual sem rateio” e passam ao DF.',
'Com <b>Taxa de êxito por lote</b>, abra o SP: confira numerador e denominador. O certame revogado do Metrô e o lote com sessão suspensa não entram no denominador.',
'No celular: toque em uma UF, recolha e expanda o painel inferior, abra uma licitação, volte e confira que a UF e o filtro continuam selecionados. Salve a visão e reaplique-a pelo seletor “Visões salvas”.',
'<b>Template 2.</b> Em Licitações, toque em “Aguardando minha aprovação”, abra o lote 1 de Curitiba, percorra as 5 abas e registre “Participar” com justificativa. A etiqueta muda para “Em preparação” e o mapa reflete a etapa.',
'<b>Template 2.</b> Em “Importar edital”, clique em Pré-visualizar: 1 licitação nova (2 lotes), 1 duplicada, 1 erro de data e 1 aviso. Importe e veja o PR passar a 4 certames no mapa. Em Processo, confira os dois diagramas BPMN e baixe os arquivos.',
'<b>Template 3.</b> Em Documentos, renove o CRF do FGTS (nova versão; a anterior fica no histórico). Abra o processo do TJPR › Documentos da participação: o pacote v1 continua com a CND federal v1. No processo de Curitiba, gere o ZIP e veja os vencidos destacados.',
'<b>Template 3.</b> Na UFRJ, abra “Recurso ou contrarrazões”, gere a minuta (autorize o uso de IA), edite, salve como nova versão e exporte em DOCX.',
'<b>Template 4.</b> No Recife, como Carlos, confirme a versão 1 (liberação pendente); como Paula, confirme (aprovado). Em Curitiba › Precificação, aplique o cenário de aceite de 10 equipamentos: R$ 1.250; lance de R$ 1.200 → resultado R$ 2.000 e margem 16,67%.',
'<b>Template 5.</b> Na Beta, Prodam › Precificação › Orçamento do cliente: registre um PDF a R$ 100. Em Disputa, envie, inicie e encerre a R$ 96: redução de R$ 4 (4%) e reconfirmação para Bruno e William. Repita a R$ 100 e a R$ 101: sem alerta.',
'<b>Template 6.</b> Em Contratos › Contrato 045/2026, reproduza o cenário de 100 armários (75/25/0 → 75/15/10 → 75/0/25), teste um empenho divergente (pendência sem mover saldo) e os aditivos (o segundo é bloqueado pelo limite de 25%). Abra as duas atas: R$ 5.000 registrados, 60 disponíveis, 10 a entregar, R$ 1.500 faturados, R$ 500 a receber; e o alerta de baixo consumo.',
'<b>Template 7.</b> Na Beta, Contrato 08/2026: registre a saída de um posto (5 ocupados, 1 vago, 4 não acionados), abra a reposição, gere e protocole a dilação; o vencimento original se mantém. Contrato 004/2026: NF 2.977 de 12.000 UST deixa 188.000; reimportar não duplica. Contrato 2026/112: 700 PF a executar, 50 executados a faturar, 750 a faturar.',
'<b>Template 8.</b> Em Contratos › Notas fiscais e kits, simule uma falha (sem recibo), recepcione a nota, gere o kit (CND v2) e confirme o pacote da licitação ainda com a v1. Reimporte a mesma nota. Como Bruno, tente abrir REC-0001: acesso negado.',
'<b>Template 9.</b> Na Beta, Financeiro › Contrato 08/2026 › nov/2026: receita líquida R$ 90.000, contribuição R$ 36.000 (40%), resultado operacional R$ 18.000, após financeiro R$ 16.000 (17,78%); o recebimento aparece no caixa em dezembro. Clique em um custo realizado para chegar ao lançamento e ao documento. Teste as quatro perguntas de gestão.'];
let ROTD={};try{ROTD=JSON.parse(localStorage.getItem('kb2g-rot')||'{}')}catch(e){}
$('#rotl').innerHTML=ROT.map((t,i)=>`<li><input type="checkbox" id="r${i}" ${ROTD[i]?'checked':''}><label for="r${i}"><b>${i+1}.</b> ${t}</label></li>`).join('');
$('#rotl').addEventListener('change',e=>{ROTD[e.target.id.slice(1)]=e.target.checked;try{localStorage.setItem('kb2g-rot',JSON.stringify(ROTD))}catch(x){}});
$('#openrot').onclick=()=>{$('#rot').hidden=false;$('#closerot').focus()};$('#closerot').onclick=()=>{$('#rot').hidden=true};
$('#rot').addEventListener('click',e=>{if(e.target.id==='rot')$('#rot').hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#rot').hidden)$('#rot').hidden=true;else if(S.sheet&&window.innerWidth<900){S.sheet=false;render()}}});

/* ---------- linhas do painel ---------- */
let A_={},L_=[];
function lotsOf(id){const r=[];partsAll().filter(p=>p.crt===id).forEach(p=>Object.entries(p.L).forEach(([n,lp])=>r.push({emp:p.emp,n:+n,lp})));return r}
function active(c){const ds=[refC(c),c.pub,c.enc?.d];lotsOf(c.id).forEach(x=>ds.push(x.lp.rd,x.lp.hd));CTR.filter(k=>k.crt===c.id&&scope().includes(k.emp)).forEach(k=>{ds.push(k.ass);k.nfs.forEach(f=>ds.push(f[1]));k.rec.forEach(r=>ds.push(r[0]));k.dre.forEach(r=>ds.push(r[0]+'-15'))});return ds.some(inP)}
function rowsFor(u){return crtIds().filter(id=>{const c=CM[id];const loc=u==='SEMLOC'?!ufsC(c).length||L_.some(x=>x.crt===id&&x.uf==='SEMLOC'):u==='MULTI'?L_.some(x=>x.crt===id&&x.uf==='MULTI'):ufsC(c).includes(u);if(!loc)return false;return active(c)||L_.some(x=>x.crt===id&&x.uf===u)})}
const hasExec=id=>ctrs().some(k=>k.crt===id&&ctrSt(k)==='exec');
function etapas(id){const ls=lotsOf(id),cnt={};ls.forEach(x=>cnt[x.lp.et]=(cnt[x.lp.et]||0)+1);const ks=Object.keys(cnt);return ks.length===1&&ls.length===1?ks[0]:ks.map(k=>cnt[k]+' '+k.toLowerCase()).join(' · ')}
function desf(c){if(c.cancel)return c.enc.t;const ls=lotsOf(c.id);const w=ls.filter(x=>x.lp.res==='venceu').length,l=ls.filter(x=>x.lp.res==='perdeu').length,d=ls.filter(x=>x.lp.dec==='declinar').length;const a=[];if(w)a.push(w+' '+plural(w,['lote ganho','lotes ganhos']));if(l)a.push(l+' '+plural(l,['perdido','perdidos']));if(d)a.push(d+' '+plural(d,['declinado','declinados']));return a.join(' · ')||'sem participação'}
function dataRel(c){const s=situ(c);if(s==='conc')return c.enc.t+' em '+dt(c.enc.d);if(s==='ind')return 'Sessão não informada · publicado em '+dt(c.pub);return 'Sessão em '+dth(c.ses)}
function rowContrib(id,u){const l=L_.filter(x=>x.crt===id&&x.uf===u);if(!l.length)return null;const e=sum(l,S.met);return MET[S.met].k==='ratio'&&!e.d?null:e}
function contribTxt(e){const m=S.met,M=MET[m];if(!e)return null;if(m==='crt')return '1 certame';if(M.k==='count')return e.v+' '+plural(e.v,M.u);if(M.k==='money')return brl(e.v);if(m==='exito')return e.d?`${e.n} de ${e.d} ${plural(e.d,['lote','lotes'])} com resultado`:e.pend?`${e.pend} pendente(s), fora do denominador`:null;return e.d?`${brl(e.n)} sobre ${brl(e.d)}`:null}
function whyNot(c,u){const m=S.met;if(m==='exito'){if(L_.some(x=>x.crt===c.id&&x.pend))return 'resultado pendente, fora do denominador';if(c.cancel)return c.enc.t.toLowerCase()+', fora do denominador'}if(m==='crt')return !inP(refC(c))?'sessão em '+dt(refC(c))+', fora do período':'';if(u!=='MULTI'&&L_.some(x=>x.crt===c.id&&x.uf==='MULTI'))return 'valor no grupo “Multiestadual sem rateio”';return 'sem registro desta métrica com data no período'}

/* ---------- render: mapa ---------- */
function render(restore){
 fillCtl();renderCrumbs();
 const t=top();const isMap=t.v==='map';$('#vmap').hidden=!isMap;$('#vfic').hidden=isMap;document.body.classList.toggle('has-sheet',isMap);
 if(isMap){renderMap();if(restore){window.scrollTo(0,S.scroll);const pb=$('#pbody');if(pb)pb.scrollTop=S.pscroll}}
 else{const M_=V[t.v];$('#vfic').innerHTML=M_?M_.render(t):t.v==='crt'?fCrt(t.crt):t.v==='lote'?fLote(t.crt,t.n):t.v==='ctr'?fCtr(t.id):fPh(t.k);if(M_&&M_.after)M_.after(t)}}
const LBL=e=>V[e.v]?V[e.v].label(e):e.v==='crt'?CM[e.crt].mod.replace(' eletrônico','').replace(' eletrônica','')+' '+CM[e.crt].num:e.v==='lote'?'Lote '+e.n:e.v==='ctr'?KM[e.id].num:e.v==='map'?'Mapa':'Módulo';
function renderCrumbs(){const t=top(),c=$('#crumbs');if(S.stack[0].v!=='map'&&S.stack[0].v!=='ph'){c.innerHTML=(S.stack.length>1?`<button class="btn back" data-cr="back">‹ Voltar</button>`:'')+S.stack.map((e,i)=>i===S.stack.length-1?`<b aria-current="location">${esc(LBL(e))}</b>`:`<button data-lv="${i}">${esc(LBL(e))}</button><span class="sep">›</span>`).join('');return}if(t.v==='ph'){c.innerHTML=`<button class="btn back" data-cr="map">‹ Voltar ao mapa</button><b>${PHT[t.k][0]}</b>`;return}
 const parts_=[];parts_.push(['Brasil','brasil']);if(S.uf)parts_.push([ufName(S.uf),'uf']);
 let crt=t.crt||(t.v==='ctr'?KM[t.id].crt:null),n=t.n||(t.v==='ctr'?KM[t.id].lote:null);
 if(crt)parts_.push([CM[crt].mod.replace(' eletrônico','').replace(' eletrônica','')+' '+CM[crt].num,'crt']);if(n&&t.v!=='crt')parts_.push(['Lote '+n,'lote']);if(t.v==='ctr')parts_.push([KM[t.id].num,'ctr']);
 c.innerHTML=(S.stack.length>1?`<button class="btn back" data-cr="back">‹ Voltar</button>`:'')+parts_.map((p,i)=>i===parts_.length-1?`<b aria-current="location">${esc(p[0])}</b>`:`<button data-cr="${p[1]}">${esc(p[0])}</button><span class="sep">›</span>`).join('')}
$('#crumbs').addEventListener('click',e=>{const bb=e.target.closest('button');if(bb&&bb.dataset.lv)return toLevel(+bb.dataset.lv);const k=bb?.dataset.cr;if(!k)return;const t=top();
 if(k==='back')return back();if(k==='map')return goMap();
 if(k==='brasil'){S.uf=null;S.pg=1;return goMap()}if(k==='uf')return goMap();
 const crt=t.crt||KM[t.id]?.crt,n=t.n||KM[t.id]?.lote;
 if(k==='crt'){S.stack=[{v:'map'},{v:'crt',crt}];setHash('licitacao');render(true)}
 if(k==='lote'){S.stack=[{v:'map'},{v:'crt',crt},{v:'lote',crt,n}];setHash('lote');render(true)}});

function renderMap(){
 const m=S.met,M=MET[m];L_=contribs(m);A_=agg(L_,m);
 const inMap=u=>UF[u]&&inReg(u)&&cov(u).ok;
 const vals=Object.keys(UF).filter(inMap).map(u=>(A_[u]?.val)??(M.k==='ratio'?null:0));
 const max=Math.max(0,...vals.filter(v=>v!==null).map(Math.abs));const cl=classes(m,max);
 for(const p of gP.children){const u=p.dataset.uf,cv=cov(u),e=A_[u],v=e?e.val:(M.k==='ratio'?null:0);
  const f=!cv.ok?'url(#hatch)':fillFor(v,m,cl);p.setAttribute('fill',f);p.classList.toggle('dim',!inReg(u));p.classList.toggle('sel',S.uf===u);
  p.setAttribute('aria-label',`${UF[u][0]}: ${!cv.ok?'sem cobertura':fmtV(v,m)}`);p.setAttribute('aria-pressed',S.uf===u);
  const lb=$('#lb-'+u);if(lb){const dark=cv.ok&&v!==null&&(f==='var(--s4)'||f==='var(--s5)'||f==='var(--n2)');lb.setAttribute('class',dark?'d':'l')}}
 const sp=gP.querySelector('.sel');if(sp)gP.appendChild(sp);
 const LL=L_.filter(x=>!S.reg||inReg(x.uf));const T=sum(LL,m);
  $('#mtitle').textContent=`${M.l} por UF`;
 $('#msub').textContent=`${S.emp==='ALL'?'Consolidado das empresas autorizadas':EMP[S.emp].nome} · ${per()[2]} · referência: ${M.ref} · localização: ${S.base==='exec'?'local de execução':'sede da unidade compradora'}`;
 $('#bscope').textContent=S.reg?'Região '+REG[S.reg]:'Brasil';
 $('#btot').textContent=fmtV(T.val,m);
 let bn='';if(m==='crt'){const ufsum=LL.filter(x=>UF[x.uf]).length,loc=new Set(LL.filter(x=>UF[x.uf]).map(x=>x.crt)).size;bn=`${plural(T.val,M.u)} únicos`+(ufsum>loc?` · soma das UFs ${ufsum} (certames em mais de uma UF)`:'')}else bn=unitTxt(T,m);
 if(m==='exito'&&T.pend)bn+=` · ${T.pend} pendente(s) fora do denominador`;
 $('#bnote').textContent=bn;
 // legenda
 let lg=`<div class="small mut">${M.l} · ${per()[2]}${M.k==='money'?' · em reais':M.k==='ratio'?' · em %':''}</div>`;
 lg+=cl.map(k=>`<div class="row"><span class="sw" style="background:${k.c}"></span>${k.t}</div>`).join('');
 if(!M.div)lg+=`<div class="row"><span class="sw" style="background:var(--zero)"></span>Zero confirmado</div>`;
 if(M.k==='ratio')lg+=`<div class="row"><span class="sw" style="background:var(--nob)"></span>Sem base (denominador zero)</div>`;
 lg+=`<div class="row"><span class="sw hatch"></span>Sem cobertura da importação</div>`;
 if(m==='crt'&&S.base==='exec')lg+=`<div class="small mut" style="margin-top:4px">Um certame com entregas em várias UFs conta em cada uma; o total Brasil conta cada certame uma vez.</div>`;
 if(M.note)lg+=`<div class="small mut" style="margin-top:4px">${M.note}</div>`;
 $('#legend').innerHTML=lg;
 const semCob=Object.keys(UF).filter(u=>!cov(u).ok),sl=L_.filter(x=>x.uf==='SEMLOC').length,ml=A_.MULTI;
 $('#src').innerHTML=`Geometria: contornos simplificados das 27 UFs do pacote <a href="https://github.com/VictorCazanave/svg-maps/tree/master/packages/brazil">@svg-maps/brazil 2.0.0</a> (V. Cazanave, licença CC BY 4.0). Base: importação de demonstração (integração simulada), atualizada em 21/11/2026 às 08:00. Cobertura: ${27-semCob.length} de 27 UFs${semCob.length?' (sem cobertura: '+semCob.join(', ')+')':''}. Registros sem localização: ${new Set(L_.filter(x=>x.uf==='SEMLOC').map(x=>x.crt)).size||'nenhum'}${ml?' · multiestadual sem rateio: '+fmtV(ml.val,m):''}. Dados fictícios.`;
 renderFun();renderTab(cl);renderPanel(cl)}

function renderFun(){const u=S.uf;const f=(m)=>{const l=contribs(m);const ll=u?l.filter(x=>x.uf===u):l.filter(x=>!S.reg||inReg(x.uf));return sum(ll,m)};
 const a=f('crt'),b=f('part'),c=f('win'),k=f('ctr'),r=f('mrg');
 const cards=[['crt','Oportunidades identificadas',NF.format(a.val),plural(a.val,['certame','certames'])],['part','Participações',NF.format(b.val),plural(b.val,['lote','lotes'])],['win','Vitórias',NF.format(c.val),plural(c.val,['lote','lotes'])+' com resultado definitivo'],['ctr','Contratações',NF.format(k.items),plural(k.items,['instrumento','instrumentos'])+' · '+brlc(k.v)],['mrg','Resultado econômico',r.val===null?'sem base':pct(r.val),r.d?'margem realizada · '+brlc(r.n):'sem receita no período']];
 $('#fun').innerHTML=cards.map(([m,t,v,s])=>`<button type="button" data-m="${m}" aria-pressed="${S.met===m}"><small>${t}${u?' · '+u:''}</small><b>${v}</b><small>${s}</small></button>`).join('')}
$('#fun').addEventListener('click',e=>{const m=e.target.closest('button')?.dataset.m;if(m){S.met=m;S.pg=1;render()}});

function renderTab(cl){const m=S.met,M=MET[m];
 const ufv=u=>{const e=A_[u];return e?e.val:(M.k==='ratio'?null:0)};
 const maxU=Math.max(1e-9,...Object.keys(UF).map(u=>Math.abs(ufv(u)||0)));
 const regs=Object.keys(REG).filter(r=>!S.reg||r===S.reg);
 const rv=r=>{const l=L_.filter(x=>UF[x.uf]&&UF[x.uf][1]===r);return sum(l,m)};
 const maxR=Math.max(1e-9,...regs.map(r=>Math.abs(rv(r).val||0)));
 const bar=(v,mx)=>v===null||M.div?'':`<div class="bar" style="width:${Math.max(0,Math.abs(v)/mx*100).toFixed(1)}%;${M.div&&v<0?'background:var(--n2)':''}"></div>`;
 const reqOpen=r=>S.open[r]??(S.uf&&UF[S.uf]&&UF[S.uf][1]===r);
 let h=`<thead><tr><th>Região / UF</th><th class="r">${M.l}</th><th class="barcell"><span class="sr">Barra</span></th><th>Situação</th></tr></thead><tbody>`;
 for(const r of regs){const e=rv(r),op=reqOpen(r);const ufs=Object.keys(UF).filter(u=>UF[u][1]===r).sort((a,b)=>UF[a][0].localeCompare(UF[b][0]));
  h+=`<tr class="reg"><td><button class="tbtn" data-reg="${r}" aria-expanded="${!!op}">${op?'▾':'▸'} ${REG[r]} <span class="mut small">(${ufs.length} UFs)</span></button></td><td class="r num">${fmtV(e.val,m)}</td><td class="barcell">${bar(e.val,maxR)}</td><td></td></tr>`;
  if(op)for(const u of ufs){const cv=cov(u),v=ufv(u);h+=`<tr><td style="padding-left:22px"><button class="tbtn" data-uf="${u}">${UF[u][0]} (${u})</button></td><td class="r num">${cv.ok?fmtV(v,m):'—'}</td><td class="barcell">${cv.ok?bar(v,maxU):''}</td><td class="small">${!cv.ok?'<span class="pill warn">Sem cobertura</span>':cv.part?'<span class="pill comp">Cobertura parcial</span>':v===0?'<span class="mut">Zero confirmado</span>':v===null?'<span class="mut">Sem base</span>':''}${S.uf===u?' <span class="pill fut">Selecionada</span>':''}</td></tr>`}}
 for(const u of ['MULTI','SEMLOC'])if(A_[u]&&!S.reg)h+=`<tr class="reg"><td><button class="tbtn" data-uf="${u}">${PSEUDO[u]}</button></td><td class="r num">${fmtV(A_[u].val,m)}</td><td class="barcell"></td><td class="small mut">${u==='MULTI'?'lotes em várias UFs sem quantidades atribuíveis':'registros sem UF na importação'}</td></tr>`;
 $('#rtab').innerHTML=h+'</tbody>'}
$('#rtab').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.reg){const r=b.dataset.reg;S.open[r]=!(S.open[r]??(S.uf&&UF[S.uf]&&UF[S.uf][1]===r));renderTab()}else if(b.dataset.uf)selUF(b.dataset.uf)});

function renderPanel(){const P_=$('#panel'),m=S.met,M=MET[m];const u=S.uf;let h='';
 P_.classList.toggle('open',!!S.sheet);
 if(!u){const T=sum(L_.filter(x=>!S.reg||inReg(x.uf)),m);
  const rk=Object.keys(UF).filter(x=>inReg(x)&&A_[x]&&(A_[x].val||0)!==0).sort((a,b)=>Math.abs(A_[b].val)-Math.abs(A_[a].val)).slice(0,8);
  h=`<div class="sheeth"><button class="h" id="shb"><b>${S.reg?'Região '+REG[S.reg]:'Brasil'} · ${fmtV(T.val,m)}</b><span class="small mut">Toque em uma UF para abrir as licitações</span></button></div><div class="pbody" id="pbody">
  <h2>${S.reg?'Região '+REG[S.reg]:'Brasil'}</h2><div class="pval"><b>${fmtV(T.val,m)}</b><span class="mut">${m==='crt'?plural(T.val,M.u)+' únicos':unitTxt(T,m)}</span></div>
  <p class="note">Clique em uma UF no mapa ou na tabela para abrir o painel estadual com as licitações que formam o indicador.</p>
  <h3 style="margin-top:14px">Maiores valores no recorte</h3><div class="rank">${rk.length?rk.map((x,i)=>`<button data-uf="${x}"><span class="mut num">${i+1}º</span><span>${UF[x][0]} (${x})</span><b class="num">${fmtV(A_[x].val,m)}</b></button>`).join(''):'<p class="note">Nenhuma UF com valor neste recorte.</p>'}</div>
  ${['MULTI','SEMLOC'].filter(x=>A_[x]&&!S.reg).map(x=>`<div class="rank"><button data-uf="${x}"><span class="mut">·</span><span>${PSEUDO[x]}</span><b class="num">${fmtV(A_[x].val,m)}</b></button></div>`).join('')}
  </div>`;P_.innerHTML=h;return}
 const e=A_[u]||empty(m),cv=cov(u);const all=rowsFor(u).map(id=>CM[id]);
 const cnt={todas:0,fut:0,and:0,conc:0,ind:0};all.forEach(c=>{cnt.todas++;cnt[situ(c)]++});const nEx=all.filter(c=>hasExec(c.id)).length;
 let rows=all.filter(c=>S.qf==='todas'||situ(c)===S.qf);if(S.ex)rows=rows.filter(c=>hasExec(c.id));
 if(S.q){const q=norm(S.q);rows=rows.filter(c=>norm(c.org+' '+c.un+' '+c.obj+' '+c.num+' '+c.id).includes(q))}
 const ord={and:0,fut:1,ind:2,conc:3};rows.sort((a,b)=>ord[situ(a)]-ord[situ(b)]||(situ(a)==='conc'?b.enc.d.localeCompare(a.enc.d):(refC(a)).localeCompare(refC(b))));
 const pages=Math.max(1,Math.ceil(rows.length/PG));if(S.pg>pages)S.pg=pages;const pr=rows.slice((S.pg-1)*PG,S.pg*PG);
 const comp=all.filter(c=>rowContrib(c.id,u));
 const val=cv.ok?fmtV(e.val,m):'sem cobertura';
 h=`<div class="sheeth"><button class="h" id="shb" aria-expanded="${!!S.sheet}"><b>${ufName(u)} · ${val}</b><span class="small mut">${all.length} ${plural(all.length,['licitação','licitações'])} · ${S.sheet?'toque para recolher':'toque para expandir'}</span></button><button class="btn" id="clruf2" aria-label="Limpar UF">✕</button></div>
 <div class="pbody" id="pbody"><div class="phead"><div><h2>${ufName(u)}${UF[u]?` <span class="mut small">${u} · ${REG[UF[u][1]]}</span>`:''}</h2></div><button class="btn link" id="clruf">Limpar UF</button></div>
 <div class="pval"><b>${val}</b><span class="mut">${cv.ok?(m==='crt'?plural(e.val,M.u):unitTxt(e,m)):''}</span></div>
 <div class="note">${M.l} · ${per()[2]} · referência: ${M.ref}</div>
 ${!cv.ok?`<p class="recon">A importação não cobre ${UF[u][0]} para ${cv.miss.map(x=>EMP[x].curto).join(' e ')}. A ausência de registros aqui não significa zero.</p>`:''}
 ${cv.part?`<p class="note">Cobertura parcial: sem dados de ${cv.miss.map(x=>EMP[x].curto).join(', ')} nesta UF.</p>`:''}
 ${m==='exito'&&e.pend?`<p class="note">${e.pend} lote(s) com resultado pendente ficam fora do denominador.</p>`:''}
 ${cv.ok?`<p class="recon"><b>${comp.length} de ${all.length}</b> ${plural(all.length,['licitação listada compõe','licitações listadas compõem'])} o indicador${m==='crt'?` · soma = ${comp.length} ${comp.length===e.val?'✓':'≠'}`:M.k==='money'?` · soma = ${brl(e.v)} ✓`:M.k==='ratio'&&e.d?` · ${m==='exito'?e.n+' ÷ '+e.d:brl(e.n)+' ÷ '+brl(e.d)} ✓`:''}${u!=='MULTI'&&u!=='SEMLOC'&&m==='crt'&&S.base==='exec'?'. Contagens estaduais podem se sobrepor.':''}</p>`:''}
 <div class="qf" role="group" aria-label="Filtros rápidos">${[['todas','Todas'],['fut','Futuras'],['and','Em andamento'],['conc','Concluídas']].map(([k,l])=>`<button class="chip" data-qf="${k}" aria-pressed="${S.qf===k}">${l}<span class="c">${cnt[k]}</span></button>`).join('')}
 <button class="chip" data-ex="1" aria-pressed="${S.ex}">${S.ex?'✓ ':''}Com contrato em execução<span class="c">${nEx}</span></button></div>
 ${cnt.ind?`<p class="note"><span class="pill ind">Lacuna</span> ${cnt.ind} licitação(ões) sem data de sessão: enquadramento indeterminado, visível em “Todas”.</p>`:''}
 <label class="sr" for="pq">Buscar licitações</label><input type="search" id="pq" placeholder="Buscar por órgão, objeto ou número" value="${esc(S.q)}" style="width:100%">
 <ul class="list" id="plist">${pr.length?pr.map(c=>{const s=situ(c),rc=rowContrib(c.id,u),ct=contribTxt(rc),ks=ctrs().filter(k=>k.crt===c.id&&ctrSt(k)==='exec'),ls=lotsOf(c.id);
  return `<li><button class="rowb" data-crt="${c.id}"><span class="rowtop"><span class="pill ${s}">${SIT[s]}</span><span class="meta num">${dataRel(c)}</span></span>
  <span class="org">${esc(c.org)}</span><span>${esc(c.obj)}</span>
  <span class="meta">${c.mod} ${c.num} · ${c.lotes.length} ${plural(c.lotes.length,['lote','lotes'])}${ls.length<c.lotes.length?` (${ls.length} na carteira${S.emp==='ALL'?'':' da empresa'})`:''} · ${s==='conc'?'Desfecho: '+desf(c):'Etapa: '+etapas(c.id)}${S.emp==='ALL'?' · '+[...new Set(ls.map(x=>EMP[x.emp].curto))].join(' e '):''}</span>
  <span class="inind">${ct?`<span class="y">✓ Compõe o indicador</span><span class="num">${ct}</span>`:`<span class="n">Não compõe: ${whyNot(c,u)}</span>`}</span></button>
  ${ks.map(k=>`<div class="ctrlink"><button class="btn link" data-ctr="${k.id}">Contrato em execução: ${k.num} ›</button></div>`).join('')}</li>`}).join(''):`<li><p class="note" style="padding:12px 0">${all.length?'Nenhuma licitação com esses filtros.':cv.ok?'Nenhuma licitação desta UF no período e recorte selecionados.':'Sem cobertura da importação para esta UF.'}</p></li>`}</ul>
 ${rows.length>PG?`<div class="pager"><button class="btn" id="pprev" ${S.pg<=1?'disabled':''}>‹ Anterior</button><span>Página ${S.pg} de ${pages} · ${rows.length} registros</span><button class="btn" id="pnext" ${S.pg>=pages?'disabled':''}>Próxima ›</button></div>`:`<p class="note">${rows.length} ${plural(rows.length,['registro','registros'])}</p>`}
 </div>`;
 P_.innerHTML=h}
$('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
 if(b.id==='shb'){if(S.uf||window.innerWidth<900){S.sheet=!S.sheet;$('#panel').classList.toggle('open',S.sheet);const sb=$('#shb');sb.setAttribute('aria-expanded',S.sheet);const sm=sb.querySelector('.small');if(sm&&S.uf)sm.textContent=sm.textContent.replace(/toque para (recolher|expandir)/,S.sheet?'toque para recolher':'toque para expandir')}return}
 if(b.id==='clruf'||b.id==='clruf2'){S.uf=null;S.sheet=false;render();return}
 if(b.dataset.uf)return selUF(b.dataset.uf);
 if(b.dataset.qf){S.qf=b.dataset.qf;S.pg=1;renderPanel();return}
 if(b.dataset.ex){S.ex=!S.ex;S.pg=1;renderPanel();return}
 if(b.id==='pprev'){S.pg--;renderPanel();return}if(b.id==='pnext'){S.pg++;renderPanel();return}
 if(b.dataset.ctr)return go({v:'ctr',id:b.dataset.ctr});
 if(b.dataset.crt)return go({v:'crt',crt:b.dataset.crt})});
$('#panel').addEventListener('input',e=>{if(e.target.id==='pq'){S.q=e.target.value;S.pg=1;const pos=e.target.selectionStart;renderPanel();const i=$('#pq');i.focus();try{i.setSelectionRange(pos,pos)}catch(x){}}});

/* ---------- fichas ---------- */
const fact=(t,d)=>`<div><dt>${t}</dt><dd>${d}</dd></div>`;
const DEC={participar:'Participar',condicionada:'Participar com condicionantes',declinar:'Declinar',pendente:'Decisão pendente'};
const RESL={venceu:'<span class="pill ok">Vencedor</span>',perdeu:'<span class="pill conc">Não vencedor</span>',pendente:'<span class="pill fut">Pendente</span>',cancelado:'<span class="pill conc">Certame revogado</span>'};
function indBox(c){const m=S.met,M=MET[m];const u=S.uf;const all=L_.filter(x=>x.crt===c.id);const here=u?all.filter(x=>x.uf===u):all;const e=here.length?sum(here,m):null;const ct=contribTxt(e);
 return `<div class="box ind"><b>No indicador atual:</b> ${M.l}, ${per()[2]}${u?', '+ufName(u):', Brasil'}. ${ct?'Esta licitação compõe o valor com <b>'+ct+'</b> (referência: '+M.ref+').':'Não compõe: '+whyNot(c,u||'')+'.'}</div>`}
function fCrt(id){const c=CM[id];const ls=lotsOf(id);if(!ls.length)return fNo();const s=situ(c);const ks=CTR.filter(k=>k.crt===id&&scope().includes(k.emp));
 const comps=[...new Set(ls.map(x=>x.lp.comp).filter(Boolean))];
 const ev=[[c.pub,'Publicação do edital'],[c.ses&&c.ses.slice(0,10),c.ses?'Sessão pública · '+dth(c.ses):null]];
 ls.forEach(x=>{if(x.lp.res==='pendente'&&x.lp.pos)ev.push([c.ses.slice(0,10),'Classificação provisória no lote '+x.n+': '+x.lp.pos+'º lugar'])});
 if(c.enc)ev.push([c.enc.d,c.enc.t]);ks.forEach(k=>ev.push([k.ass,'Assinatura: '+k.num+' ('+EMP[k.emp].curto+')']));
 const evs=ev.filter(x=>x[0]&&x[1]).sort((a,b)=>a[0].localeCompare(b[0]));
 return `<div class="ficha"><div class="fhead"><div><div class="tags"><span class="pill ${s}">${SIT[s]}</span>${s==='conc'?`<span class="pill comp">Desfecho: ${desf(c)}</span>`:`<span class="pill comp">Etapa: ${etapas(id)}</span>`}${comps.map(x=>`<span class="pill warn">${x}</span>`).join('')}</div>
 <h1>${c.mod} nº ${c.num}</h1><p class="mut" style="margin:0">${esc(c.org)} · ${esc(c.un)}</p></div>
 <div class="small mut" style="text-align:right">Participação privada de<br><b style="color:var(--ink)">${[...new Set(ls.map(x=>x.emp))].map(x=>EMP[x].nome+' · CNPJ '+EMP[x].cnpj).join('<br>')}</b></div></div>
 ${indBox(c)}${HOOK.crt.map(f=>f(c)).join('')}
 <dl class="facts">${fact('Objeto',esc(c.obj))}${fact('Sede da unidade compradora',c.sede?ufName(c.sede)+' ('+c.sede+')':'<span class="pill ind">Não informada</span>')}${fact('Local de execução',c.exec.length?c.exec.join(', ')+(c.exec.length>1?' · multiestadual':''):'<span class="pill ind">Não informado</span>')}${fact('Modalidade e critério',c.mod+' · '+c.crit)}${fact('Portal',c.portal)}${fact('Sessão pública',dth(c.ses))}${fact('Situação oficial',c.sit)}${fact('Identificador',id+' · fonte: adaptador de demonstração')}</dl>
 <div class="sec"><h3>Lotes</h3><div class="scroll"><table class="stack"><thead><tr><th>Lote</th><th>Descrição</th><th class="r">Quantidade</th><th>UF</th><th class="r">Referência</th>${S.emp==='ALL'?'<th>Empresa</th>':''}<th>Decisão</th><th>Etapa</th><th>Resultado</th><th class="r">Nossa oferta</th><th>Instrumento</th></tr></thead><tbody>
 ${c.lotes.map(l=>{const ps=ls.filter(x=>x.n===l.n);const lu=Array.isArray(l.uf)?l.uf.join(' e ')+' · sem rateio':(l.uf||'não informada');
  if(!ps.length)return `<tr class="click" data-lote="${l.n}"><td data-l="Lote">${l.n}</td><td data-l="Descrição">${esc(l.d)}</td><td data-l="Quantidade" class="r num">${NF.format(l.q)} ${l.u}</td><td data-l="UF">${lu}</td><td data-l="Referência" class="r num">${brl(l.ref)}</td>${S.emp==='ALL'?'<td data-l="Empresa">—</td>':''}<td data-l="Decisão" colspan="5"><span class="mut">Sem participação ${S.emp==='ALL'?'das empresas autorizadas':'da '+EMP[S.emp].curto} · resultado público disponível</span></td></tr>`;
  return ps.map(x=>{const lp=x.lp,k=lp.ctr&&KM[lp.ctr];return `<tr class="click" data-lote="${l.n}"><td data-l="Lote">${l.n}</td><td data-l="Descrição">${esc(l.d)}</td><td data-l="Quantidade" class="r num">${NF.format(l.q)} ${l.u}</td><td data-l="UF">${lu}</td><td data-l="Referência" class="r num">${brl(l.ref)}</td>${S.emp==='ALL'?`<td data-l="Empresa">${EMP[x.emp].curto}</td>`:''}<td data-l="Decisão">${DEC[lp.dec]}</td><td data-l="Etapa">${lp.et}${lp.comp?' · '+lp.comp:''}</td><td data-l="Resultado">${lp.res?RESL[lp.res]+(lp.pos?' '+lp.pos+'º':''):'—'}</td><td data-l="Nossa oferta" class="r num">${lp.of?brl(lp.of):'—'}</td><td data-l="Instrumento">${k?`<button class="btn link" data-ctr="${k.id}">${k.num} ›</button>`:'—'}</td></tr>`}).join('')}).join('')}
 </tbody></table></div><p class="note">Clique em um lote para ver a classificação de todos os participantes.</p></div>
 <div class="sec"><h3>Linha do tempo</h3><ul class="tl">${evs.map(x=>`<li class="${x[0]>HOJE?'fut':''}"><b class="num">${dt(x[0])}</b> · ${x[1]}${x[0]>HOJE?' <span class="mut">(previsto)</span>':''}</li>`).join('')}</ul></div>
 <p class="note">Ficha-resumo. Documentos, análise do edital, decisão por lote e histórico completo chegam no Template 2.</p></div>`}
function fLote(id,n){const c=CM[id],l=c.lotes[n-1];const ls=lotsOf(id);if(!ls.length)return fNo();const ps=ls.filter(x=>x.n===+n);const r=RES[id+'-L'+n];const our=ours();
 const lu=Array.isArray(l.uf)?l.uf.join(' e ')+' (sem quantidades por UF: valores vão ao grupo “Multiestadual sem rateio” quando a localização é pelo local de execução)':(l.uf?ufName(l.uf)+' ('+l.uf+')':'não informada');
 const win=r&&r.rows.find(x=>x[2].startsWith('Vencedor'));
 return `<div class="ficha"><div class="fhead"><div><div class="tags">${ps.map(x=>`<span class="pill comp">${S.emp==='ALL'?EMP[x.emp].curto+': ':''}${x.lp.et}</span>${x.lp.comp?`<span class="pill warn">${x.lp.comp}</span>`:''}`).join('')}</div>
 <h1>Lote ${n} · ${esc(l.d)}</h1><p class="mut" style="margin:0">${c.mod} nº ${c.num} · ${esc(c.org)}</p></div></div>
 <dl class="facts">${fact('Quantidade',NF.format(l.q)+' '+l.u)}${fact('Valor de referência',brl(l.ref))}${fact('Local de execução',lu)}${fact('Critério de julgamento',c.crit)}${fact('Situação oficial',c.sit)}</dl>
 ${ps.length?ps.map(x=>{const lp=x.lp,k=lp.ctr&&KM[lp.ctr];const dif=lp.of&&lp.vv?(lp.of-lp.vv)/lp.vv*100:null;return `<div class="box"><h3>Participação de ${EMP[x.emp].nome}</h3>
 <dl class="facts" style="margin:0 0 10px">${fact('Decisão',DEC[lp.dec])}${fact('Etapa interna',lp.et+(lp.comp?' · '+lp.comp:''))}${fact('Nossa melhor oferta',lp.of?brl(lp.of):'—')}${fact('Posição',lp.pos?lp.pos+'º'+(lp.res==='pendente'?' (provisória)':''):'—')}${fact('Resultado',lp.res?RESL[lp.res]:'—')}${dif!==null?fact('Diferença frente ao vencedor',`<span class="num">+${pct(dif,2)}</span> <span class="mut small">(nossa − vencedora) ÷ vencedora</span>`):''}</dl>
 ${lp.mot?`<p class="note">${lp.mot}</p>`:''}${k?`<button class="btn pri" data-ctr="${k.id}">Abrir ${k.num} ›</button>`:''}</div>`}).join(''):`<div class="box"><p class="note" style="margin:0">Lote sem participação ${S.emp==='ALL'?'das empresas autorizadas':'da '+EMP[S.emp].curto}. Abaixo, o resultado público.</p></div>`}
 ${HOOK.lote.map(f=>f(c,+n)).join('')}<div class="sec"><h3>Classificação de todos os participantes</h3>
 ${r?`<p class="note">Fonte: ${r.fonte}. Cobertura: <b>${r.cob}</b>${r.cob==='parcial'?' (campos ausentes ficam em branco; nada é preenchido com zero)':''}. ${r.prov?'<span class="pill fut">Classificação provisória</span> sujeita a habilitação e recursos.':'<span class="pill conc">Resultado definitivo</span>'}</p>
 <div class="scroll"><table class="stack"><thead><tr><th>Posição oficial</th><th>Fornecedor</th><th>Situação</th><th class="r">Oferta inicial</th><th class="r">Melhor oferta</th><th class="r">Valor aceito</th><th>Motivo</th></tr></thead><tbody>
 ${r.rows.map(x=>`<tr class="${our.includes(x[1])?'me':''}"><td data-l="Posição">${x[0]?x[0]+'º':'—'}</td><td data-l="Fornecedor">${esc(x[1])}${our.includes(x[1])?' <span class="pill fut">Nossa empresa</span>':''}</td><td data-l="Situação">${x[2]}</td><td data-l="Oferta inicial" class="r num">${x[3]===null?'<span class="mut">não informada</span>':brl(x[3])}</td><td data-l="Melhor oferta" class="r num">${brl(x[4])}</td><td data-l="Valor aceito" class="r num">${x[5]?brl(x[5]):'—'}</td><td data-l="Motivo">${x[6]||''}</td></tr>`).join('')}
 </tbody></table></div>${r.rows.some(x=>x[0]===null&&x[4]<(win?win[4]:Infinity))?'<p class="note">O menor preço pertence a uma proposta excluída; prevalece a posição oficial.</p>':''}`:`<p class="note">${c.cancel?c.enc.t+': não há classificação homologada.':situ(c)==='fut'||situ(c)==='ind'?'Sessão ainda não realizada.':'Resultado ainda não publicado pela fonte.'}</p>`}</div>
 <p class="note">Ficha-resumo. Lances, reconfirmação de preço e histórico por concorrente chegam no Template 5.</p></div>`}
function fCtr(id){const k=KM[id];if(!k||!scope().includes(k.emp))return fNo();const c=CM[k.crt],l=c.lotes[k.lote-1],st=ctrSt(k);
 const fat=k.nfs.reduce((a,f)=>a+f[2],0),rec=k.rec.reduce((a,r)=>a+r[1],0),rl=k.dre.reduce((a,r)=>a+r[2],0),res=k.dre.reduce((a,r)=>a+r[3],0),mr=rl?res/rl*100:null;
 const w=x=>(x/k.v*100).toFixed(2)+'%';
 return `<div class="ficha"><div class="fhead"><div><div class="tags"><span class="pill ${st==='exec'?'ok':'conc'}">${CST[st]}</span><span class="pill comp">${k.inst}</span></div>
 <h1>${k.num}</h1><p class="mut" style="margin:0">${esc(c.org)} · origem: <button class="btn link" data-go="crt">${c.mod} nº ${c.num}</button> · <button class="btn link" data-go="lote">Lote ${k.lote}</button></p></div>
 <div class="small mut" style="text-align:right">Empresa signatária<br><b style="color:var(--ink)">${EMP[k.emp].nome}<br>CNPJ ${EMP[k.emp].cnpj}</b></div></div>
 ${HOOK.ctr.map(f=>f(k)).join('')}<div class="kpis"><div><small>Contratado</small><b>${brl(k.v)}</b><small>${NF.format(k.q)} ${k.u}</small></div><div><small>Faturado</small><b>${brl(fat)}</b><small>${pct(fat/k.v*100)} do contratado</small></div><div><small>Recebido</small><b>${brl(rec)}</b></div><div><small>A receber</small><b>${brl(fat-rec)}</b></div><div><small>Saldo a faturar</small><b>${brl(k.v-fat)}</b></div></div>
 <div class="stackbar" role="img" aria-label="Recebido ${brl(rec)}, faturado a receber ${brl(fat-rec)}, a faturar ${brl(k.v-fat)}"><i style="width:${w(rec)};background:var(--s5)"></i><i style="width:${w(fat-rec)};background:var(--s3)"></i></div>
 <div class="leg2"><span style="--c:var(--s5)">Recebido</span><span style="--c:var(--s3)">Faturado a receber</span><span style="--c:var(--surf2)">A faturar</span></div>
 <dl class="facts" style="margin-top:16px">${fact('Vigência',dt(k.ass)+' a '+dt(k.fim))}${fact('Objeto do lote',esc(l.d))}${fact('Margem prevista na proposta',pct(k.mprev))}${fact('Margem realizada acumulada',mr===null?'sem base (sem receita reconhecida)':`<span style="color:${mr<0?'var(--red)':'inherit'}">${pct(mr,2)}</span>`)}${mr!==null?fact('Desvio frente à proposta',`<span class="num">${(mr-k.mprev>=0?'+':'')+(mr-k.mprev).toLocaleString('pt-BR',{maximumFractionDigits:2})} p.p.</span>`):''}</dl>
 <div class="cols"><div class="sec"><h3>Notas fiscais</h3><div class="scroll"><table><thead><tr><th>Nota</th><th>Emissão</th><th>Quantidade</th><th class="r">Valor</th></tr></thead><tbody>${k.nfs.length?k.nfs.map(f=>`<tr><td>${f[0]}</td><td class="num">${dt(f[1])}</td><td>${f[3]}</td><td class="r num">${brl(f[2])}</td></tr>`).join(''):'<tr><td colspan="4" class="mut">Nenhuma nota fiscal emitida.</td></tr>'}</tbody></table></div></div>
 <div class="sec"><h3>Recebimentos</h3><div class="scroll"><table><thead><tr><th>Data</th><th>Título</th><th class="r">Valor</th></tr></thead><tbody>${k.rec.length?k.rec.map(r=>`<tr><td class="num">${dt(r[0])}</td><td>${r[2]}</td><td class="r num">${brl(r[1])}</td></tr>`).join(''):'<tr><td colspan="3" class="mut">Nenhum recebimento registrado.</td></tr>'}</tbody></table></div></div></div>
 <div class="sec"><h3>DRE gerencial por competência (resumo)</h3><div class="scroll"><table><thead><tr><th>Competência</th><th class="r">Receita bruta</th><th class="r">Receita líquida</th><th class="r">Resultado</th><th class="r">Margem</th></tr></thead><tbody>
 ${k.dre.length?k.dre.map(r=>`<tr><td>${cmp(r[0])}</td><td class="r num">${brl(r[1])}</td><td class="r num">${brl(r[2])}</td><td class="r num">${brl(r[3])}</td><td class="r num">${pct(r[3]/r[2]*100,2)}</td></tr>`).join('')+`<tr><td><b>Acumulado</b></td><td class="r num"><b>${brl(k.dre.reduce((a,r)=>a+r[1],0))}</b></td><td class="r num"><b>${brl(rl)}</b></td><td class="r num"><b>${brl(res)}</b></td><td class="r num"><b>${pct(mr,2)}</b></td></tr>`:'<tr><td colspan="5" class="mut">Sem competências reconhecidas.</td></tr>'}</tbody></table></div>
 <p class="note">Margem acumulada = soma dos resultados ÷ soma das receitas líquidas. Ficha-resumo: saldos, empenhos, postos e lançamentos detalhados chegam nos Templates 6 a 9.</p></div></div>`}
function fNo(){return `<div class="ph"><h2>Registro indisponível para este contexto</h2><p>Esta ficha não pertence às empresas autorizadas no contexto atual.</p><button class="btn pri" data-go="map">Voltar ao mapa</button></div>`}
function fPh(k){const t=PHT[k]||['Módulo','Em desenvolvimento.',''];return `<div class="ph"><span class="pill fut">Em desenvolvimento</span><h1 style="margin-top:10px">${t[0]}</h1><p>${t[1]}</p><p class="mut">${t[2]}</p><button class="btn pri" data-go="map">Ir ao mapa (Template 1)</button></div>`}
$('#vfic').addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(a&&ACT[a.dataset.act]){e.preventDefault();ACT[a.dataset.act](a,e);return}const b=e.target.closest('button,tr.click');if(!b)return;const t=top();if(V[t.v])return;
 if(b.dataset.ctr){e.stopPropagation();return go({v:'ctr',id:b.dataset.ctr})}
 if(b.dataset.go==='map')return goMap();
 if(b.dataset.go==='crt'){const k=KM[t.id];return go({v:'crt',crt:k.crt})}
 if(b.dataset.go==='lote'){const k=KM[t.id];return go({v:'lote',crt:k.crt,n:k.lote})}
 if(b.dataset.lote)return go({v:'lote',crt:t.crt,n:+b.dataset.lote})});

window.KB={S,UF,REG,EMP,USERS,CRT,CM,PART,RES,CTR,KM,MET,HOJE,V,ACT,HOOK,$,NF,BRL,brl,brlc,pct,dt,dth,cmp,esc,norm,plural,toast,go,back,goMap,render,top,setHash,toLevel,scope,partsAll,parts,lotsOf,situ,SIT,ctrSt,CST,DEC,RESL,fact,ours,refC,ufName,isPart,ALFA,BETA,
 can:(p,e)=>{const u=USERS[S.user];e=e||S.emp;if(e==='ALL')return u.perm.includes(p)&&u.cons;return !!(u.pe&&u.pe[e]&&u.pe[e].includes(p))},
 uname:k=>USERS[k]?USERS[k].nome:k,
 view:(n,o)=>{V[n]=o},act:(n,f)=>{ACT[n]=(...a)=>{let r;try{r=f(...a)}catch(e){console.error(e);toast('Erro: '+e.message);return}Promise.resolve(r).then(()=>window.KB.flush&&window.KB.flush()).catch(e=>{console.error(e);toast('Erro: '+(e.message||e))})}}};
['change','input'].forEach(ev=>$('#vfic').addEventListener(ev,e=>{const a=e.target.closest(ev==='change'?'[data-chg]':'[data-inp]');if(a){const f=ACT[a.dataset[ev==='change'?'chg':'inp']];if(f)f(a,e)}}));
}