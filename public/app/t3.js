/* Template 3 — Acervo da empresa, habilitação e peças jurídicas */
{
const K=window.KB;const {S,CM,EMP,USERS,$,NF,brl,dt,dth,esc,norm,plural,toast,go,render,top,scope,partsAll,fact,HOJE,PART}=K;
const PASTAS=[['jur','Regularidade jurídica'],['fis','Regularidade fiscal'],['eco','Qualificação econômico-financeira'],['tec','Qualificação técnica (incluindo atestados)'],['dec','Declarações e modelos'],['out','Outros']];
const PN=Object.fromEntries(PASTAS);
let SEQ=1;
const D=(emp,pasta,tipo,emissor,emi,val,extra={})=>({id:'DOC-'+emp+'-'+Date.now().toString(36).toUpperCase()+(SEQ++),emp,pasta,tipo,emissor,emi,val,v:1,arq:norm(tipo).replace(/[^a-z0-9]+/g,'-').slice(0,40)+'-v1.pdf',conf:true,arqd:false,hist:[],...extra});
const ACV=K.ACV;
K.PASTAS=PASTAS;
const addD=K.T2.addD;
const status=(d,ref)=>{ref=ref||HOJE;if(d.arqd)return 'arq';if(!d.conf)return 'conf';if(d.val===null)return 'sem';if(d.val==='desconhecida')return 'desc';if(d.val<ref)return 'venc';if(d.val<=addD(ref,30))return 'avenc';return 'vig'};
const STL={vig:['ok','Vigente'],avenc:['warn','A vencer'],venc:['bad','Vencido'],sem:['comp','Sem prazo de validade'],desc:['ind','Validade desconhecida'],conf:['warn','Pendente de conferência'],arq:['conc','Arquivado']};
const pill=s=>`<span class="pill ${STL[s][0]}">${STL[s][1]}</span>`;
const content=(d,v)=>`Arquivo de demonstração\n${d.tipo}\nTitular: ${EMP[d.emp].nome} · CNPJ ${EMP[d.emp].cnpj}\nEmissor: ${d.emissor}\nVersão: ${v||d.v}\nEmissão: ${dt(d.emi)}\nValidade: ${d.val===null?'sem prazo':d.val==='desconhecida'?'desconhecida':dt(d.val)}\n`;
K.T3={ACV,status,STL,PN,content};

/* ---------- acervo ---------- */
K.view('acervo',{label:()=>'Certidões e documentos',render(t){
 if(S.emp==='ALL')return '<div class="mod"><h1>Certidões e documentos</h1><div class="callout warn">O acervo é de cada empresa. Escolha um CNPJ no topo.</div></div>';
 t.p=t.p||'fis';t.f=t.f||'todos';const docs=ACV.filter(d=>d.emp===S.emp);const ed=K.can('preparar');
 const cnt=k=>docs.filter(d=>d.pasta===k&&!d.arqd).length;
 const F={todos:['Todos',d=>!d.arqd],vig:['Vigentes',d=>['vig','sem'].includes(status(d))],avenc:['A vencer (30 dias)',d=>status(d)==='avenc'],venc:['Vencidos',d=>status(d)==='venc'],conf:['Pendentes de conferência',d=>status(d)==='conf'||status(d)==='desc'],arq:['Arquivados',d=>d.arqd]};
 const list=docs.filter(d=>(t.f!=='todos'||d.pasta===t.p)&&F[t.f][1](d));
 return `<div class="mod"><div class="mhead"><div><h1>Certidões e documentos</h1><p class="mut small">${EMP[S.emp].nome} · CNPJ ${EMP[S.emp].cnpj} · ${docs.filter(d=>!d.arqd).length} documentos ativos</p></div>${ed?'<button class="btn pri" data-act="t3new">Carregar documento</button>':''}</div>
 <div class="folders">${PASTAS.map(([k,l])=>`<button data-act="t3p" data-k="${k}" aria-pressed="${t.p===k&&t.f==='todos'}"><b>${l}</b><small>${cnt(k)} ${plural(cnt(k),['documento','documentos'])}${docs.some(d=>d.pasta===k&&['venc','avenc'].includes(status(d)))?' · atenção':''}</small></button>`).join('')}</div>
 <div class="qf">${Object.entries(F).map(([k,v])=>`<button class="chip" data-act="t3f" data-k="${k}" aria-pressed="${t.f===k}">${v[0]}<span class="c">${docs.filter(v[1]).length}</span></button>`).join('')}</div>
 ${t.newf?form(t):''}
 <div class="scroll"><table class="stack"><thead><tr><th>Documento</th>${t.f!=='todos'?'<th>Pasta</th>':''}<th>Emissor</th><th>Emissão</th><th>Validade</th><th>Versão</th><th>Situação</th><th></th></tr></thead><tbody>
 ${list.map(d=>`<tr><td data-l="Documento">${esc(d.tipo)}${d.modelo?` <span class="pill warn">Modelo: ${d.modelo==='assinar'?'precisa de assinatura':'preencher'}</span>`:''}</td>${t.f!=='todos'?`<td data-l="Pasta">${PN[d.pasta]}</td>`:''}<td data-l="Emissor">${esc(d.emissor)}</td><td data-l="Emissão" class="num">${d.emi?dt(d.emi):'—'}</td><td data-l="Validade" class="num">${d.val===null?'sem prazo':d.val==='desconhecida'?'desconhecida':dt(d.val)}</td><td data-l="Versão">v${d.v}${d.hist.length?` <span class="mut small">(${d.hist.length} anterior${d.hist.length>1?'es':''})</span>`:''}</td><td data-l="Situação">${pill(status(d))}</td>
 <td data-l="Ações"><span class="acts"><button class="btn link" data-act="t3dl" data-id="${d.id}">Baixar</button>${ed&&!d.arqd?`<button class="btn link" data-act="t3ren" data-id="${d.id}">Renovar</button>${!d.conf||d.val==='desconhecida'?`<button class="btn link" data-act="t3conf" data-id="${d.id}">Conferir</button>`:''}<button class="btn link" data-act="t3arq" data-id="${d.id}">Arquivar</button>`:''}${d.hist.length?`<button class="btn link" data-act="t3hist" data-id="${d.id}">Histórico</button>`:''}</span></td></tr>
 ${t.hist===d.id?`<tr><td colspan="8"><ul class="tl">${d.hist.map(h=>`<li>v${h.v} · ${h.arq} · emissão ${dt(h.emi)} · validade ${h.val?dt(h.val):'—'} · substituída por ${h.by} em ${dt(h.d)} <button class="btn link" data-act="t3dlh" data-id="${d.id}" data-v="${h.v}">Baixar v${h.v}</button></li>`).join('')}</ul></td></tr>`:''}
 ${t.ren===d.id?`<tr><td colspan="8">${form(t,d)}</td></tr>`:''}`).join('')||'<tr><td colspan="8" class="mut">Nenhum documento neste filtro.</td></tr>'}</tbody></table></div>
 <p class="note">“Sem prazo de validade” e “validade desconhecida” são situações diferentes. Renovar cria nova versão e preserva a anterior; pacotes de licitação já gerados guardam a cópia exata que usaram.</p></div>`}});
function form(t,d){return `<div class="box"><h3>${d?'Renovar: '+esc(d.tipo):'Carregar documento'}</h3><div class="form" style="max-width:none"><div class="grid2">
 ${d?'':`<label>Pasta<select id="t3pa">${PASTAS.map(([k,l])=>`<option value="${k}" ${t.p===k?'selected':''}>${l}</option>`).join('')}</select></label><label>Tipo<input type="text" id="t3ti" placeholder="Ex.: Certidão negativa estadual"></label><label>Emissor<input type="text" id="t3em"></label>`}
 <label>Emissão<input type="date" id="t3emi" value="${HOJE}"></label><label>Validade<input type="date" id="t3val" value="${d&&d.val&&d.val!=='desconhecida'?addD(HOJE,180):''}"></label><label>Situação da validade<select id="t3vt"><option value="data">Data informada</option><option value="sem">Sem prazo de validade</option><option value="desc">Validade desconhecida</option></select></label><label>Arquivo<input type="file" id="t3arq"></label></div>
 <div class="acts"><button class="btn pri" data-act="t3save" data-id="${d?d.id:''}">${d?'Salvar nova versão':'Salvar'}</button><button class="btn" data-act="t3cancel">Cancelar</button></div></div></div>`}
K.act('t3p',a=>{const t=top();t.p=a.dataset.k;t.f='todos';render()});K.act('t3f',a=>{top().f=a.dataset.k;render()});
K.act('t3new',()=>{top().newf=1;render()});K.act('t3cancel',()=>{const t=top();t.newf=0;t.ren=null;render()});
K.act('t3ren',a=>{top().ren=a.dataset.id;render()});K.act('t3hist',a=>{const t=top();t.hist=t.hist===a.dataset.id?null:a.dataset.id;render()});
K.act('t3conf',a=>{const d=ACV.find(x=>x.id===a.dataset.id);d.conf=true;if(d.val==='desconhecida')toast('Conferido. A validade continua desconhecida até ser informada; renove para registrar a data.');render()});
K.act('t3arq',a=>{const d=ACV.find(x=>x.id===a.dataset.id);d.arqd=true;toast('Documento arquivado. Pacotes anteriores continuam com a cópia original.');render()});
K.act('t3save',async a=>{const t=top();const vt=$('#t3vt').value;const val=vt==='sem'?null:vt==='desc'?'desconhecida':$('#t3val').value;if(vt==='data'&&!val)return toast('Informe a validade ou escolha “sem prazo” ou “desconhecida”.');
 const f=$('#t3arq').files[0];const emi=$('#t3emi').value;let up=null;if(f){try{up=await K.upload(f,S.emp)}catch(e){return toast(e.message)}}
 if(a.dataset.id){const d=ACV.find(x=>x.id===a.dataset.id);d.hist.unshift({v:d.v,emi:d.emi,val:d.val,arq:d.arq,arqId:d.arqId,by:K.uname(S.user),d:HOJE});d.v++;d.emi=emi;d.val=val;d.arq=f?f.name:d.arq.replace(/-v\d+\.pdf$/,'')+'-v'+d.v+'.pdf';d.arqId=up?up.id:undefined;d.conf=true;t.ren=null;toast(`${d.tipo}: versão ${d.v} salva. A versão ${d.v-1} segue no histórico.`)}
 else{const ti=$('#t3ti').value.trim();if(!ti)return toast('Informe o tipo do documento.');const d=D(S.emp,$('#t3pa').value,ti,$('#t3em').value||'não informado',emi,val,{conf:false});if(up){d.arq=f.name;d.arqId=up.id}ACV.push(d);t.newf=0;t.p=d.pasta;toast('Documento carregado. Fica pendente de conferência.')}
 render()});
const dlDoc=async(d,v)=>{const h=v&&v!==d.v?d.hist.find(x=>x.v===v):null;const id=h?h.arqId:d.arqId;try{if(id)return await K.save(h?h.arq:d.arq,await K.arquivo(id));await K.save((h?h.arq:d.arq).replace(/\.pdf$/,'.txt'),content(d,v))}catch(e){toast(e.message)}};
K.act('t3dl',a=>{if(!K.can('consultar'))return toast('Sem permissão.');dlDoc(ACV.find(x=>x.id===a.dataset.id))});
K.act('t3dlh',a=>dlDoc(ACV.find(x=>x.id===a.dataset.id),+a.dataset.v));

/* ---------- pacote de habilitação da participação ---------- */
const PKG=K.PKG;
const snap=d=>({id:d.id,pasta:d.pasta,tipo:d.tipo,v:d.v,val:d.val,emi:d.emi,arq:d.arq,arqId:d.arqId,modelo:d.modelo});

const REQMAP=[['falência','falencia'],['atestado'],['NBR','conformidade'],['liquidez','balanço'],['certificação ISO','iso'],['PMP','coordenador']];
function matchReq(r,docs){const n=norm(r.req);if(n.includes('falencia'))return docs.filter(d=>norm(d.tipo).includes('falencia'));if(n.includes('atestado'))return docs.filter(d=>d.pasta==='tec'&&norm(d.tipo).startsWith('atestado'));if(n.includes('nbr'))return docs.filter(d=>norm(d.tipo).includes('nbr'));if(n.includes('liquidez')||n.includes('indices'))return docs.filter(d=>norm(d.tipo).includes('balanco'));return []}
K.view('pac',{label:()=>'Documentos da participação',scoped:t=>scope().includes(t.emp),render(t){
 const c=CM[t.crt];const emp=t.emp;const pk=PKG[emp+'|'+c.id]||[];t.data=t.data||(c.ses?c.ses.slice(0,10):HOJE);
 if(!t.sel){const ds=ACV.filter(d=>d.emp===emp&&!d.arqd&&['jur','fis','eco','tec','dec'].includes(d.pasta));t.sel=Object.fromEntries(ds.map(d=>[d.id,true]))}
 const pool=ACV.filter(d=>d.emp===emp&&!d.arqd);const chosen=pool.filter(d=>t.sel[d.id]);const ed=K.can('preparar',emp);
 const st=d=>status(d,t.data);const venc=chosen.filter(d=>st(d)==='venc'),mods=chosen.filter(d=>d.modelo);
 const reqs=Object.entries(K.T2.REQ).filter(([k])=>k.startsWith(c.id+'|')).flatMap(([k,v])=>v.map(r=>({...r,lote:k.split('|')[1]})));
 const falt=reqs.filter(r=>/atestado|falencia|nbr|liquidez/.test(norm(r.req))&&!matchReq(r,chosen).length);
 return `<div class="mod"><div class="mhead"><div><h1>Documentos da participação</h1><p class="mut">${c.mod} nº ${c.num} · ${esc(c.org)} · ${EMP[emp].nome} · CNPJ ${EMP[emp].cnpj}</p></div></div>
 ${pk.length?`<div class="sec"><h3>Pacotes gerados</h3><div class="scroll"><table class="stack"><thead><tr><th>Versão</th><th>Gerado em</th><th>Responsável</th><th>Arquivos</th><th>Apresentação</th><th></th></tr></thead><tbody>${pk.map((p,i)=>`<tr><td data-l="Versão">v${p.v}</td><td data-l="Gerado" class="num">${dt(p.d)}</td><td data-l="Responsável">${p.by}</td><td data-l="Arquivos">${p.items.length}</td><td data-l="Apresentação">${p.apres?`<span class="pill ok">Apresentado em ${dt(p.apres)}</span> ${esc(p.comp||'')}`:'<span class="pill comp">Preparado</span>'}${p.irr?'<br><span class="small">Irregularidade registrada: '+esc(p.irr)+'</span>':''}</td><td data-l="Ações"><span class="acts"><button class="btn link" data-act="t3pdl" data-i="${i}">Baixar ZIP</button><button class="btn link" data-act="t3pview" data-i="${i}">Ver conteúdo</button>${!p.apres&&ed?`<button class="btn link" data-act="t3papr" data-i="${i}">Registrar apresentação</button>`:''}</span></td></tr>${t.pv===i?`<tr><td colspan="6"><div class="pkg">${p.items.map(s=>`${PN[s.pasta]}/${s.arq} · v${s.v} · validade ${s.val===null?'sem prazo':s.val==='desconhecida'?'desconhecida':dt(s.val)}`).join('\n')}</div><p class="small">Baixar um documento isolado: ${p.items.slice(0,40).map((s,j)=>`<button class="btn link" data-act="t3pone" data-i="${i}" data-j="${j}">${esc(s.tipo)} v${s.v}</button>`).join(' · ')}</p></td></tr>`:''}`).join('')}</tbody></table></div></div>`:''}
 ${ed?`<div class="sec"><h3>Vincular documentos da empresa ${pk.length?'(nova montagem cria a versão '+(pk.length+1)+')':''}</h3>
 <div class="form" style="max-width:420px"><label>Data de apresentação considerada<input type="date" data-chg="t3pdata" value="${t.data}"></label></div>
 ${venc.length||falt.length||mods.length?`<div class="callout warn">${venc.length?`<b>${venc.length} vencido(s) na data de apresentação:</b> ${venc.map(d=>esc(d.tipo)).join('; ')}.<br>`:''}${falt.length?`<b>${falt.length} exigência(s) sem documento correspondente:</b> ${falt.map(r=>'cl. '+r.cl+' (lote '+r.lote+')').join('; ')}.<br>`:''}${mods.length?`<b>Modelos a completar:</b> ${mods.map(d=>esc(d.tipo)+' ('+(d.modelo==='assinar'?'assinatura':'preenchimento')+')').join('; ')}.`:''}</div>`:'<div class="callout ok">Seleção sem pendências na data de apresentação.</div>'}
 ${PASTAS.map(([k,l])=>{const ds=pool.filter(d=>d.pasta===k);return `<details ${k!=='out'?'open':''} class="box" style="padding:10px 14px"><summary><b>${l}</b> · ${ds.filter(d=>t.sel[d.id]).length} de ${ds.length} selecionados${k==='out'?' (entra só por escolha expressa)':''}</summary>${ds.map(d=>`<label style="display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid var(--line)"><input type="checkbox" data-chg="t3sel" data-id="${d.id}" ${t.sel[d.id]?'checked':''} style="width:18px;height:18px"><span style="flex:1">${esc(d.tipo)} · v${d.v}</span>${pill(st(d))}</label>`).join('')||'<p class="note">Vazia.</p>'}</details>`}).join('')}
 ${reqs.length?`<h3 style="margin-top:14px">Requisitos por cláusula × documentos selecionados</h3><div class="scroll"><table class="stack"><thead><tr><th>Cláusula</th><th>Exigência</th><th>Documento vinculado</th><th>Situação da análise</th></tr></thead><tbody>${reqs.map(r=>{const m=matchReq(r,chosen);return `<tr><td data-l="Cláusula">${r.cl} · lote ${r.lote}</td><td data-l="Exigência">${r.req}</td><td data-l="Documento">${m.map(d=>esc(d.tipo)+' '+pill(st(d))).join('<br>')||'<span class="mut">—</span>'}</td><td data-l="Análise">${r.st}</td></tr>`}).join('')}</tbody></table></div>`:''}
 <div class="form" style="max-width:none;margin-top:12px"><label>Registrar irregularidade conhecida (opcional)<input type="text" id="t3irr" placeholder="Ex.: certidão municipal vencida; apresentar na diligência"></label>
 <button class="btn pri" data-act="t3gen">Gerar ZIP da participação com ${chosen.length} arquivos</button></div></div>`:'<div class="callout">Seu perfil pode consultar e baixar os pacotes desta empresa, mas não montá-los.</div>'}</div>`}});
K.act('t3pdata',a=>{top().data=a.value;render()});K.act('t3sel',a=>{top().sel[a.dataset.id]=a.checked;render()});
K.act('t3pview',a=>{const t=top();t.pv=t.pv===+a.dataset.i?null:+a.dataset.i;render()});
async function pkgBlob(p,c,emp){const idx=['arquivo;pasta;versao;emissao;validade;gerado_em;responsavel'].concat(p.items.map(s=>`${s.arq};${PN[s.pasta]};v${s.v};${s.emi||''};${s.val||''};${p.d};${p.by}`)).join('\n');
 const fs=[];for(const s of p.items){if(s.arqId){try{fs.push({path:PN[s.pasta]+'/'+s.arq,data:await K.arquivo(s.arqId)});continue}catch(e){}}fs.push({path:PN[s.pasta]+'/'+s.arq.replace(/\.pdf$/,'.txt'),data:s.txt||content({...s,emp:p.emp||S.emp,emissor:'',tipo:s.tipo},s.v)})}return K.zip(fs.concat([{path:'INDICE.csv',data:idx}]))}
K.pkgBlob=pkgBlob;
K.act('t3pdl',async a=>{const t=top();const p=PKG[t.emp+'|'+t.crt][+a.dataset.i];try{const b=await pkgBlob(p);await K.save(`participacao-${t.crt}-${t.emp}-v${p.v}.zip`,b)}catch(e){toast('Falha ao gerar o ZIP: '+e.message)}});
K.act('t3pone',async a=>{const t=top();const s=PKG[t.emp+'|'+t.crt][+a.dataset.i].items[+a.dataset.j];try{if(s.arqId)return await K.save(s.arq,await K.arquivo(s.arqId));await K.save(s.arq.replace(/\.pdf$/,'.txt'),s.txt||content({...s,emp:t.emp,emissor:''},s.v))}catch(e){toast(e.message)}});
K.act('t3gen',async()=>{const t=top();const ids=ACV.filter(d=>d.emp===t.emp&&!d.arqd&&t.sel[d.id]).map(d=>d.id);try{const r=await K.api('pacote',{emp:t.emp,crt:t.crt,ids,irr:($('#t3irr')||{}).value||''});const k=t.emp+'|'+t.crt;const pk=PKG[k]=PKG[k]||[];const p={v:r.v,d:r.d,by:r.by,items:r.items,irr:($('#t3irr')||{}).value||''};pk.push(p);K.marcar('pacote',k+'|'+p.v,p);
 PART.forEach(x=>{if(x.crt===t.crt&&x.emp===t.emp)Object.values(x.L).forEach(lp=>{if(lp.prep)lp.prep.hab='Pacote v'+p.v+' preparado'})});t.sel=null;toast(`Pacote v${p.v} gerado com ${ids.length} arquivos e índice.`);render()}catch(e){toast(e.message)}});
K.act('t3papr',a=>{const t=top();const p=PKG[t.emp+'|'+t.crt][+a.dataset.i];p.apres=HOJE;p.comp='Comprovante registrado por '+K.uname(S.user);toast('Versão '+p.v+' marcada como efetivamente apresentada.');render()});

/* ---------- peças jurídicas com IA (papel timbrado, representante legal e aprendizado de estilo) ---------- */
const PECAS={esc:['Pedido de esclarecimento','Formular perguntas objetivas e explicar qual informação é necessária à elaboração da proposta.'],imp:['Impugnação ao edital','Redigir com o ponto impugnado, sua repercussão, a fundamentação verificável e a providência solicitada.'],rec:['Recurso administrativo','Identificar a decisão recorrida, os lotes e a vencedora; confrontar cada requisito questionado com a evidência apresentada; redigir razões e pedidos.'],ctr:['Contrarrazões','Organizar as alegações por recorrente e lote e responder ponto a ponto, com referência ao recurso e à prova.']};
const MIN=K.MIN;const IDENT=K.IDENT;const MODELOS=K.MODELOS;
const MARCA='---- NOTAS INTERNAS';
const semNotas=tx=>{const i=tx.indexOf(MARCA);return(i<0?tx:tx.slice(0,i)).trim()};
const v_=(o,k)=>esc((o&&o[k])||'');
function painelIdent(t,emp,ed){const id=IDENT[emp]||{rep:{}};const r=id.rep||{};const falta=!id.timbrado||!r.nome||!id.cid;const dis=ed?'':'disabled';
 return `<details class="box" style="margin:12px 0" ${falta&&ed?'open':''}><summary style="cursor:pointer"><b>Papel timbrado e representante legal</b> · ${id.timbrado?'timbrado: '+esc(id.timbrado.nome):'<span class="pill warn">sem papel timbrado</span>'} · ${r.nome?esc(r.nome)+(r.cargo?' ('+esc(r.cargo)+')':''):'<span class="pill warn">sem representante legal</span>'}</summary>
 <p class="small mut" style="margin-top:8px">Valem para todas as peças de ${esc(EMP[emp].nome)}: o documento sai no modelo Word da empresa (cabeçalho, rodapé e logotipo preservados) e termina com local, data e assinatura do representante.</p>
 <div class="grid2"><div class="form" style="max-width:none">
 ${ed?'<label>Papel timbrado (modelo Word .docx)<input type="file" accept=".docx" id="t3tim"></label>':''}
 <p class="small mut">Opcional: escreva <b>{{CORPO}}</b> numa linha do modelo para indicar onde o texto entra; sem isso, o corpo do modelo é substituído e cabeçalho e rodapé ficam.${id.timbrado?' <button class="btn link" data-act="t3timbx">Baixar modelo atual</button>':''}</p>
 <label>Cidade do fecho<input type="text" id="t3cid" value="${v_(id,'cid')}" placeholder="Ex.: Curitiba/PR" ${dis}></label>
 <label>Endereço completo da empresa<input type="text" id="t3end" value="${v_(id,'end')}" placeholder="Rua, número, bairro, cidade/UF, CEP" ${dis}></label></div>
 <div class="form" style="max-width:none">
 <label>Nome do representante legal<input type="text" id="t3rn" value="${v_(r,'nome')}" ${dis}></label>
 <label>Cargo<input type="text" id="t3rc" value="${v_(r,'cargo')}" placeholder="Ex.: Sócio-administrador" ${dis}></label>
 <div class="grid2"><label>CPF<input type="text" id="t3rcpf" value="${v_(r,'cpf')}" ${dis}></label><label>RG<input type="text" id="t3rrg" value="${v_(r,'rg')}" ${dis}></label></div>
 <div class="grid2"><label>E-mail<input type="text" id="t3rem" value="${v_(r,'email')}" ${dis}></label><label>Telefone<input type="text" id="t3rtel" value="${v_(r,'telefone')}" ${dis}></label></div></div></div>
 ${ed?'<div class="acts"><button class="btn pri" data-act="t3ident">Salvar dados da empresa</button></div>':''}</details>`}
function painelModelos(t,emp,key,ed){const mods=(MODELOS[emp]||[]).filter(m=>m.tipo===t.tipo);
 const prot=Object.entries(MIN).filter(([k,vs])=>k.startsWith(emp+'|')&&k.endsWith('|'+t.tipo)&&k!==key&&vs.some(x=>x.prot)).length;
 return `<details class="box" style="margin:12px 0"><summary style="cursor:pointer"><b>Aprendizado de estilo</b> · ${mods.length} ${plural(mods.length,['peça-modelo','peças-modelo'])} · ${prot} ${plural(prot,['peça protocolada','peças protocoladas'])} no sistema</summary>
 <p class="small mut" style="margin-top:8px">Para escrever ${PECAS[t.tipo][0].toLowerCase()}, a IA segue as instruções definidas na Administração e usa como referência de estilo e argumentação até 3 peças-modelo deste tipo e as 2 últimas protocoladas pela empresa (nunca copia fatos, nomes ou números delas).</p>
 ${mods.length?`<ul class="list">${mods.map(m=>`<li style="padding:6px 0;display:flex;justify-content:space-between;gap:8px"><span>${esc(m.titulo)} · ${esc(m.by||'')} · ${dt(m.d)} · ${Math.max(1,Math.round(m.chars/1000))} mil caracteres</span>${ed?`<button class="btn link" data-act="t3modrm" data-id="${m.id}">Remover</button>`:''}</li>`).join('')}</ul>`:''}
 ${ed?`<div class="form" style="max-width:none"><div class="grid2"><label>Título da peça-modelo<input type="text" id="t3modt" placeholder="Ex.: Esclarecimento sobre amostras, Pregão 12/2025"></label><label>Arquivo (Word, PDF com texto ou .txt)<input type="file" accept=".docx,.pdf,.txt" id="t3modf"></label></div><div class="acts"><button class="btn" data-act="t3modadd">Enviar peça-modelo</button></div></div>`:''}</details>`}
K.view('peca',{label:t=>PECAS[t.tipo][0],scoped:t=>scope().includes(t.emp),render(t){
 const c=CM[t.crt];const emp=t.emp;const key=emp+'|'+c.id+'|'+t.tipo;const vs=MIN[key]=MIN[key]||[];t.files=t.files||[];
 const procDocs=(K.T2.DOCS[c.id]||[]).map(d=>({nome:d.nome+' v'+d.v,tipo:d.pncp?'PNCP':'Processo',parte:'Órgão'}));
 t.instr=t.instr??{esc:'Pergunte se a entrega pode ser parcelada em duas remessas e se a amostra pode ser apresentada em 10 dias úteis.',imp:'Impugne a exigência de entrega integral em 30 dias, que restringe a competição sem justificativa técnica no TR.',rec:'Recorra da habilitação da vencedora: o atestado apresentado não comprova a quantidade mínima exigida.',ctr:'Responda ao recurso da concorrente que alega inexequibilidade do nosso preço; nossa planilha demonstra margem positiva.'}[t.tipo];
 const cur=vs[vs.length-1];const ed=K.can('preparar',emp)||K.can('juridico',emp);const id=IDENT[emp]||{rep:{}};const r=id.rep||{};
 return `<div class="mod"><div class="mhead"><div><div class="tags"><span class="pill fut">${PECAS[t.tipo][0]}</span><span class="pill comp">${t.tipo==='esc'||t.tipo==='imp'?'Frente de esclarecimentos e impugnações':'Frente recursal'}</span></div><h1>${PECAS[t.tipo][0]}</h1><p class="mut">${c.mod} nº ${c.num} · ${esc(c.org)} · parte representada: ${EMP[emp].nome} · CNPJ ${EMP[emp].cnpj}</p></div>
 <div class="acts">${Object.entries(PECAS).map(([k,v])=>`<button class="chip" data-act="t3tipo" data-k="${k}" aria-pressed="${t.tipo===k}">${v[0]}</button>`).join('')}</div></div>
 ${painelIdent(t,emp,ed)}${painelModelos(t,emp,key,ed)}
 <div class="grid2"><div class="form" style="max-width:none"><label>Lote<select id="t3lote">${c.lotes.map(l=>`<option>${l.n} · ${esc(l.d)}</option>`).join('')}</select></label>
 <label>Instruções para esta minuta<textarea id="t3ins" rows="5">${esc(t.instr)}</textarea></label>
 <p class="small mut">Orientação da peça: ${PECAS[t.tipo][1]} As instruções completas de cada tipo ficam na Administração.</p></div>
 <div><h3>Documentos para análise</h3><ul class="list">${procDocs.map(d=>`<li style="padding:8px 0">${esc(d.nome)} · ${d.tipo} · parte: ${d.parte}</li>`).join('')||'<li class="small mut" style="padding:8px 0">Nenhum documento do edital guardado no processo. Carregue-os na ficha da licitação para a IA ler.</li>'}${t.files.map((f,i)=>`<li style="padding:8px 0;display:flex;justify-content:space-between;gap:8px"><span>${esc(f.name)} · ${f.parte} · ${f.txt?'lido':'<span class="pill warn">aqui só arquivos .txt são lidos; carregue PDF ou Word no processo</span>'}</span><button class="btn link" data-act="t3rmf" data-i="${i}">Remover</button></li>`).join('')}</ul>
 <div class="form"><label>Parte de origem dos arquivos<select id="t3parte"><option>Nossa empresa</option><option>Empresa vencedora</option><option>Recorrente</option><option>Órgão</option></select></label><label>Adicionar arquivos (vários)<input type="file" multiple data-chg="t3files"></label></div></div></div>
 <div class="acts" style="margin:14px 0">${ed?`<button class="btn pri" data-act="t3gerar" ${t.busy?'disabled':''}>${vs.length?'Gerar nova versão':'Gerar minuta'}</button>`:''}${t.busy?'<span class="small">Gerando… <button class="btn link" data-act="t3stop">Parar</button></span>':''}</div>
 ${t.err?`<div class="callout bad">${esc(t.err)} O prompt, a seleção de anexos e o rascunho anterior foram preservados.</div>`:''}
 ${t.busy?`<div class="box"><h3 id="t3etapa">${esc(t.etapa||'Preparando…')}</h3><div class="pkg">${esc(t.stream||'')}</div></div>`:''}
 ${cur?`<div class="sec"><h3>Minuta v${cur.v} <span class="mut small">· ${cur.origem} · ${cur.by} · ${dt(cur.d)} · ${esc(cur.model||'')}${cur.ex?' · '+cur.ex+' '+plural(cur.ex,['referência de estilo','referências de estilo']):''}</span></h3>
 <div class="callout warn">Revisão humana obrigatória. Trechos [VERIFICAR] exigem fonte antes do protocolo. O que estiver abaixo da linha “${MARCA} …” é só para conferência e não sai no documento.</div>
 <textarea class="editor" id="t3ed" rows="18">${esc(cur.text)}</textarea>
 <p class="small mut">Fecho automático no documento: “${esc(id.cid||'[cidade]')}, data por extenso” · assinatura de ${esc(r.nome||'[representante legal]')}${r.cargo?', '+esc(r.cargo):''}${r.cpf?', CPF '+esc(r.cpf):''} · ${esc(EMP[emp].nome)}, CNPJ ${EMP[emp].cnpj}.${id.timbrado?'':' Sem papel timbrado cadastrado: o Word sai em folha simples.'}</p>
 <div class="acts" style="margin-top:8px">${ed?'<button class="btn" data-act="t3savemin">Salvar edição como nova versão</button>':''}<button class="btn pri" data-act="t3docx">Baixar no papel timbrado (Word)</button><button class="btn" data-act="t3copia">Copiar texto da peça</button>${ed&&!cur.prot?'<button class="btn" data-act="t3prot">Registrar protocolo</button>':''}</div>
 <p class="small mut">Para PDF: abra o Word e use Arquivo › Salvar como › PDF. O protocolo é feito no sistema de origem da licitação (Compras.gov.br, BNC, BLL etc.).</p>
 ${cur.prot?`<div class="callout ok">Protocolado em ${dt(cur.prot)}. Esta peça passa a servir de referência de estilo para as próximas da empresa.</div>`:''}
 <details style="margin-top:10px"><summary>Versões (${vs.length})</summary><ul class="tl">${vs.map(v=>`<li>v${v.v} · ${v.origem} · ${v.by} · ${dt(v.d)}${v.model?' · '+esc(v.model):''}${v.prompt?' · prompt: “'+esc(v.prompt.slice(0,80))+'…”':''} · arquivos: ${(v.files||[]).join(', ')||'—'}</li>`).join('')}</ul></details></div>`:''}</div>`},after(t){}});
K.act('t3tipo',a=>{const t=top();t.tipo=a.dataset.k;t.instr=null;t.err='';render()});
K.act('t3files',async a=>{const t=top();const parte=$('#t3parte').value;for(const f of a.files){let txt=null;if(/\.(txt|md|csv)$/i.test(f.name))txt=(await f.text()).slice(0,60000);t.files.push({name:f.name,parte,txt})}t.instr=$('#t3ins').value;render()});
K.act('t3rmf',a=>{const t=top();t.files.splice(+a.dataset.i,1);t.instr=$('#t3ins').value;render()});
K.act('t3ident',async()=>{const t=top();const emp=t.emp;const id=IDENT[emp]||{};const fi=$('#t3tim');const f=fi&&fi.files&&fi.files[0];t.instr=$('#t3ins').value;
 try{let timbradoId;if(f){if(!/\.docx$/i.test(f.name))return toast('O papel timbrado deve ser um arquivo Word (.docx).');timbradoId=(await K.upload(f,emp)).id}
  const r=await K.api('identidade',{emp,rev:id.rev||0,timbradoId,cidade:$('#t3cid').value,endereco:$('#t3end').value,rep:{nome:$('#t3rn').value,cargo:$('#t3rc').value,cpf:$('#t3rcpf').value,rg:$('#t3rrg').value,email:$('#t3rem').value,telefone:$('#t3rtel').value}});
  IDENT[emp]=r.ident;toast('Papel timbrado e representante legal salvos.');render()}catch(e){toast(e.message)}});
K.act('t3timbx',async()=>{const id=IDENT[top().emp];try{await K.save(id.timbrado.nome||'timbrado.docx',await K.arquivo(id.timbrado.id))}catch(e){toast(e.message)}});
K.act('t3modadd',async()=>{const t=top();const f=$('#t3modf').files[0];if(!f)return toast('Escolha o arquivo da peça-modelo.');t.instr=$('#t3ins').value;
 try{toast('Enviando e lendo a peça-modelo…');const up=await K.upload(f,t.emp);const r=await K.api('peca_modelo',{emp:t.emp,tipo:t.tipo,titulo:$('#t3modt').value,arqId:up.id});(MODELOS[t.emp]=MODELOS[t.emp]||[]).push(r.modelo);toast('Peça-modelo incluída no aprendizado.');render()}catch(e){toast(e.message)}});
K.act('t3modrm',async a=>{const t=top();if(!confirm('Remover esta peça-modelo do aprendizado?'))return;t.instr=$('#t3ins').value;
 try{await K.api('peca_modelo_desativar',{id:a.dataset.id});MODELOS[t.emp]=(MODELOS[t.emp]||[]).filter(m=>m.id!==a.dataset.id);toast('Peça-modelo removida.');render()}catch(e){toast(e.message)}});
let ctl=null;K.act('t3stop',()=>{ctl&&ctl.abort()});
function fallback(t,c,ins,lote){const P=PECAS[t.tipo][0].toUpperCase();const id=IDENT[t.emp]||{rep:{}};const r=id.rep||{};return `${P}

Ao(À) Agente de Contratação / Pregoeiro(a) do(a) ${c.org}
${c.mod} nº ${c.num} · ${lote}

${EMP[t.emp].nome}, inscrita no CNPJ sob o nº ${EMP[t.emp].cnpj}, com sede em ${id.end||'[VERIFICAR: endereço]'}, neste ato representada por ${r.nome||'[VERIFICAR: representante legal]'}${r.cargo?', '+r.cargo:''}${r.cpf?', CPF nº '+r.cpf:''}, vem apresentar ${PECAS[t.tipo][0].toLowerCase()}, nos termos a seguir.

# I. DOS FATOS
- Objeto: ${c.obj}.
- [VERIFICAR] Cláusula e página do edital relacionadas ao ponto: informar.

# II. DOS PONTOS
${ins}

# III. DA FUNDAMENTAÇÃO
[VERIFICAR] Indicar dispositivo da Lei 14.133/2021 e do edital, com fonte oficial conferida.

# IV. DO PEDIDO
[VERIFICAR] Redigir a providência solicitada.

Nestes termos, pede deferimento.`}
/* geração no servidor: linhas JSON com etapas, trechos do texto e o resultado final */
async function gerarPeca(t,lote,ins,onTxt,signal){
 let r;try{r=await fetch('/api/ia/peca',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({emp:t.emp,crt:t.crt,tipo:t.tipo,lote,instr:ins,anexos:t.files.filter(f=>f.txt).map(f=>({nome:f.name,parte:f.parte,texto:f.txt}))})})}
 catch(e){if(e&&e.name==='AbortError')throw {code:'cancelled'};throw {code:'upstream_error',message:'sem conexão com o servidor'}}
 if(!r.ok){const j=await r.json().catch(()=>({}));throw {code:r.status===503?'not_granted':'upstream_error',message:j.erro||'Falha na IA'}}
 const rd=r.body.getReader(),dec=new TextDecoder();let buf='',text='',fim=null;
 try{for(;;){const {value,done}=await rd.read();if(done)break;buf+=dec.decode(value,{stream:true});const ls=buf.split('\n');buf=ls.pop();
  for(const l of ls){if(!l.trim())continue;let ev;try{ev=JSON.parse(l)}catch(x){continue}
   if(ev.t==='txt'){text+=ev.d;onTxt(text,null)}else if(ev.t==='etapa')onTxt(text,ev.msg);else if(ev.t==='fim')fim=ev;else if(ev.t==='erro')throw {code:'upstream_error',message:ev.msg,text}}}}
 catch(e){if(e&&e.name==='AbortError')throw {code:'cancelled',text};throw e}
 if(!fim)throw {code:'upstream_error',message:'A conexão caiu antes do fim da geração',text};return fim}
K.act('t3gerar',async()=>{const t=top();const c=CM[t.crt];const ins=$('#t3ins').value;const lote=$('#t3lote').value;t.instr=ins;t.err='';const key=t.emp+'|'+t.crt+'|'+t.tipo;const vs=MIN[key];
 const files=(K.T2.DOCS[c.id]||[]).map(d=>d.nome+' v'+d.v).concat(t.files.map(f=>f.name));const by=K.uname(S.user);
 t.busy=1;t.stream='';t.etapa='Preparando os documentos…';render();ctl=new AbortController();
 const mostra=(text,msg)=>{t.stream=text;if(msg)t.etapa=msg;else if(text)t.etapa='A IA está redigindo…';if(top()!==t)return;const b=document.querySelector('.box .pkg');if(b){b.textContent=text;b.scrollTop=b.scrollHeight}const h=document.getElementById('t3etapa');if(h)h.textContent=t.etapa};
 try{const r=await gerarPeca(t,lote,ins,mostra,ctl.signal);vs.push({v:vs.length+1,text:r.texto,origem:r.parcial?'Gerada por IA (resposta incompleta)':'Gerada por IA',by,d:HOJE,model:r.modelo,ex:(r.exemplos||[]).length,prompt:ins,files})}
 catch(e){if(e.code==='not_granted'){vs.push({v:vs.length+1,text:fallback(t,c,ins,lote),origem:'Modelo de texto (IA não configurada no servidor)',by,d:HOJE,model:'—',prompt:ins,files});toast('IA ainda não configurada: criei um rascunho por modelo para edição.');t.busy=0;t.stream='';return render()}
  t.err=e.code==='cancelled'?'Geração interrompida.':'Falha na geração: '+(e.message||e.code||'erro')+'.';if(e.text)vs.push({v:vs.length+1,text:e.text,origem:'Rascunho parcial (geração interrompida)',by,d:HOJE,model:'—',prompt:ins,files})}
 t.busy=0;t.stream='';render()});
K.act('t3savemin',()=>{const t=top();const vs=MIN[t.emp+'|'+t.crt+'|'+t.tipo];const cur=vs[vs.length-1];const tx=$('#t3ed').value;if(tx===cur.text)return toast('Sem alterações.');vs.push({...cur,v:vs.length+1,text:tx,origem:'Edição manual',by:K.uname(S.user),d:HOJE,prot:null});toast('Edição salva como versão '+vs.length+'.');render()});
K.act('t3docx',async()=>{const t=top();const c=CM[t.crt];const tx=$('#t3ed').value;
 try{const r=await fetch('/api/pecas/docx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emp:t.emp,crt:t.crt,tipo:t.tipo,texto:tx})});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).erro||'Falha ao gerar o Word');
  await K.save(`${PECAS[t.tipo][0]} - ${String(c.num).replace(/[^\w.-]+/g,'-')}.docx`,await r.blob());
  if(r.headers.get('X-Timbrado')!=='1')toast('Sem papel timbrado cadastrado: o Word saiu em folha simples.')}catch(e){toast(e.message)}});
K.act('t3copia',async()=>{try{await navigator.clipboard.writeText(semNotas($('#t3ed').value));toast('Texto da peça copiado (sem as notas internas).')}catch(e){toast('Não foi possível copiar: selecione o texto e use Ctrl+C.')}});
K.act('t3prot',()=>{const t=top();const vs=MIN[t.emp+'|'+t.crt+'|'+t.tipo];vs[vs.length-1].prot=HOJE;const p=PART.find(p=>p.crt===t.crt&&p.emp===t.emp);if(p)Object.values(p.L).forEach(lp=>{if(!['Arquivada','Formalizada'].includes(lp.et))lp.comp=PECAS[t.tipo][0]+' protocolado(a)'});toast('Protocolo registrado. A peça passa a servir de referência de estilo.');render()});
/* entradas a partir do processo e da ficha */
K.procActions.push((c,ls)=>{const emp=ls[0].emp;return `<button class="btn" data-act="t3pac" data-crt="${c.id}" data-emp="${emp}">Documentos da participação</button><button class="btn" data-act="t3peca" data-crt="${c.id}" data-emp="${emp}" data-k="esc">Esclarecimento ou impugnação</button><button class="btn" data-act="t3peca" data-crt="${c.id}" data-emp="${emp}" data-k="rec">Recurso ou contrarrazões</button>`});
K.act('t3pac',a=>go({v:'pac',crt:a.dataset.crt,emp:a.dataset.emp}));
K.act('t3peca',a=>go({v:'peca',crt:a.dataset.crt,emp:a.dataset.emp,tipo:a.dataset.k}));
}
