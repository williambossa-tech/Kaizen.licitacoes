/* Cadastro de empresas (consulta do CNPJ ou texto colado do comprovante) e de usuários. Usado na Administração e nos primeiros passos. */
(function(){
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $=s=>document.querySelector(s);
const D=()=>window.KB_DATA||{};
const PERMS=[['consultar','Consultar'],['preparar','Preparar (licitações, orçamento e documentos)'],['aprovar','Aprovar orçamento'],['decidir','Decidir participação'],['preco','Definir preço'],['juridico','Jurídico (peças)'],['financeiro','Financeiro'],['admin','Administrar a empresa']];
const COMERCIAL=['Cliente externo','Ecossistema Kaizen','Empresa própria (Kaizen)'];
const RECEITA='https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/Cnpjreva_Solicitacao.asp';
function aviso(m,tipo){const el=$('#cadmsg');if(!el)return;el.className='callout '+(tipo||'warn');el.textContent=m;el.hidden=!m}
async function post(url,corpo){const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(corpo)});const j=await r.json().catch(()=>({ok:false,erro:'Resposta inválida do servidor'}));if(!r.ok||!j.ok){const e=new Error(j.erro||'Falha');e.status=r.status;throw e}return j}
function modal(titulo,corpo){fechar();const w=document.createElement('div');w.id='cadmodal';w.style.cssText='position:fixed;inset:0;z-index:60;background:rgba(10,5,25,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px';
 w.innerHTML=`<div role="dialog" aria-modal="true" aria-label="${esc(titulo)}" style="background:var(--surf,#1c1036);color:inherit;border:1px solid var(--line,#36255f);border-radius:14px;max-width:880px;width:100%;padding:20px 22px"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><h2 style="margin:0">${esc(titulo)}</h2><button type="button" class="btn" data-cad="fechar">Fechar</button></div><div id="cadmsg" hidden></div>${corpo}</div>`;
 document.body.appendChild(w);w.addEventListener('click',clique);w.addEventListener('change',muda);return w}
function fechar(){const w=$('#cadmodal');if(w)w.remove()}
let EST={};
/* ---------- empresa ---------- */
function empresa(e){e=e||null;const c=(e&&e.cad)||{};EST={tipo:'emp',id:e&&e.id,cad:e&&e.cad||null,socios:(c.socios||[])};
 const rep=(e&&e.rep)||{};
 modal(e?'Editar empresa':'Nova empresa',`
 <div class="form" style="max-width:none;margin-top:12px">
 <label>CNPJ<div style="display:flex;gap:8px"><input type="text" id="ce_cnpj" inputmode="numeric" placeholder="00.000.000/0000-00" value="${esc(e?e.cnpj:'')}" style="flex:1"><button type="button" class="btn pri" data-cad="consultar">Consultar CNPJ</button></div></label>
 <details id="ce_colar" ${e?'':''}><summary style="cursor:pointer" class="small">Consulta indisponível? Colar o texto do comprovante da Receita</summary>
  <p class="small mut">Abra o <a href="${RECEITA}" target="_blank" rel="noopener">comprovante de inscrição no site da Receita Federal</a> (ou outro site de consulta de CNPJ), selecione a página inteira (Ctrl+A), copie (Ctrl+C) e cole abaixo.</p>
  <textarea id="ce_texto" rows="6" placeholder="Cole aqui o texto do comprovante"></textarea>
  <div class="acts"><button type="button" class="btn" data-cad="colar">Preencher com o texto colado</button></div></details>
 <div id="ce_info" class="small mut">${c.situacao?info(c):''}</div>
 <div class="grid2"><label>Razão social<input type="text" id="ce_razao" value="${esc(e?e.nome:'')}"></label><label>Nome curto (aparece nos menus)<input type="text" id="ce_curto" value="${esc(e?e.curto:'')}"></label></div>
 <div class="grid2"><label>Endereço completo (vai na qualificação das peças)<input type="text" id="ce_end" value="${esc(e?e.end||'':'')}"></label><label>Cidade/UF (fecho das peças)<input type="text" id="ce_cid" value="${esc(e?e.cid||'':'')}" placeholder="Curitiba/PR"></label></div>
 <h3 style="margin-top:6px">Representante legal</h3>
 <div id="ce_socios">${socios(rep.nome)}</div>
 <div class="grid2"><label>Nome<input type="text" id="ce_rnome" value="${esc(rep.nome||'')}"></label><label>Cargo<input type="text" id="ce_rcargo" value="${esc(rep.cargo||'')}" placeholder="Sócio-administrador"></label></div>
 <div class="grid2"><label>CPF<input type="text" id="ce_rcpf" value="${esc(rep.cpf||'')}"></label><span></span></div>
 <h3 style="margin-top:6px">Relação com a Kaizen e acesso</h3>
 <div class="grid2"><label>Vínculo comercial<select id="ce_com">${COMERCIAL.concat(e&&e.comercial&&!COMERCIAL.includes(e.comercial)?[e.comercial]:[]).map(x=>`<option ${e&&e.comercial===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Participação societária da Kaizen<input type="text" id="ce_soc" value="${esc(e?e.societaria||'':'')}" placeholder="Ex.: Sim (30%) ou deixe em branco"></label></div>
 <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="ce_aut" ${!e||e.autorizada?'checked':''} style="width:auto"> Autorização operacional (sem ela, ninguém acessa os dados da empresa)</label>
 <div class="acts" style="margin-top:12px"><button type="button" class="btn pri" data-cad="salvaremp">${e?'Salvar alterações':'Cadastrar empresa'}</button></div>
 </div>`)}
function info(c){return `Fonte: ${esc(c.fonte||'')}${c.situacao?' · situação cadastral: '+(/ATIVA/i.test(c.situacao)?'<span class="pill ok">'+esc(c.situacao)+'</span>':'<span class="pill bad">'+esc(c.situacao)+'</span>'):''}${c.abertura?' · abertura '+esc(c.abertura):''}${c.cnae?' · '+esc(c.cnae):''}${c.natureza?' · '+esc(c.natureza):''}`}
function socios(sel){const ss=EST.socios||[];if(!ss.length)return '<p class="small mut">Sem quadro de sócios: preencha manualmente.</p>';
 return `<label>Escolher do quadro de sócios e administradores<select id="ce_socio"><option value="">—</option>${ss.map((s,i)=>`<option value="${i}" ${s.nome===sel?'selected':''}>${esc(s.nome)}${s.qual?' · '+esc(s.qual):''}</option>`).join('')}</select></label>`}
const cap=s=>String(s||'').toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g,m=>m.toLowerCase()).replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii)\b/g,m=>m.toUpperCase());
function endereco(c){const n=c.numero==='SN'?'s/n':c.numero;const l=[c.logradouro,n].filter(Boolean).join(', ');const cep=String(c.cep||'').replace(/\D/g,'').replace(/^(\d{5})(\d{3})$/,'$1-$2');return [cap(l),cap(c.complemento||''),cap(c.bairro||''),c.municipio?cap(c.municipio)+(c.uf?'/'+c.uf:''):'',cep?'CEP '+cep:''].filter(Boolean).join(', ')}
function preencher(c){EST.cad=c;EST.socios=c.socios||[];
 const set=(id,v,forca)=>{const el=$(id);if(el&&v&&(forca||!el.value.trim()))el.value=v};
 set('#ce_cnpj',c.cnpj,true);set('#ce_razao',c.razao,true);
 set('#ce_curto',c.fantasia&&c.fantasia.length<=40?cap(c.fantasia):cap(String(c.razao||'').split(/\s+/).slice(0,2).join(' ')));
 const end=endereco(c);if(end)set('#ce_end',end,true);if(c.municipio)set('#ce_cid',cap(c.municipio)+(c.uf?'/'+c.uf:''),true);
 $('#ce_info').innerHTML=info(c);$('#ce_socios').innerHTML=socios($('#ce_rnome').value);
 const adm=EST.socios.filter(s=>/administrador|diretor|presidente|titular/i.test(s.qual));if(adm.length===1&&!$('#ce_rnome').value){$('#ce_rnome').value=cap(adm[0].nome);$('#ce_rcargo').value=adm[0].qual;$('#ce_socio').value=String(EST.socios.indexOf(adm[0]))}
 const faltam=[!c.razao&&'razão social',!end&&'endereço',!EST.socios.length&&'representante'].filter(Boolean);
 aviso(`Dados preenchidos (${c.fonte}). Confira antes de salvar.`+(faltam.length?' Complete: '+faltam.join(', ')+'.':'')+(c.situacao&&!/ATIVA/i.test(c.situacao)?' Atenção: situação cadastral '+c.situacao+'.':''),c.situacao&&!/ATIVA/i.test(c.situacao)?'bad':'ok')}
/* ---------- usuário ---------- */
function usuario(u){u=u||null;EST={tipo:'usr',id:u&&u.id,eu:u&&u.eu};const emps=(D().empresasAdm||[]);const vm=Object.fromEntries((u?u.vinc:[]).map(v=>[v.emp,v]));
 modal(u?'Editar usuário':'Novo usuário',`
 <div class="form" style="max-width:none;margin-top:12px">
 <div class="grid2"><label>Nome<input type="text" id="cu_nome" value="${esc(u?u.nome:'')}"></label><label>E-mail (login)<input type="email" id="cu_email" value="${esc(u?u.email||'':'')}"></label></div>
 <div class="grid2"><label>Papel ou cargo<input type="text" id="cu_papel" value="${esc(u?u.papel:'')}" placeholder="Ex.: Analista de licitações"></label>
 <label>${u?'Nova senha (em branco mantém a atual)':'Senha inicial'}<div style="display:flex;gap:8px"><input type="text" id="cu_senha" autocomplete="new-password" style="flex:1"><button type="button" class="btn" data-cad="gerar">Gerar</button></div></label></div>
 <p class="small mut">Passe a senha à pessoa por um canal seguro. Mínimo de 8 caracteres.${u&&!u.login?' Este usuário ainda não tem login: defina uma senha.':''}</p>
 <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cu_adm" ${u&&u.admin?'checked':''} ${u&&u.eu?'disabled':''} style="width:auto"> Administrador do sistema (cadastra empresas, usuários e ajusta a IA)</label>
 <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cu_cons" ${u&&u.consolida?'checked':''} style="width:auto"> Vê a visão consolidada das empresas a que tem acesso</label>
 ${u?`<label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="cu_ativo" ${u.ativo!==false?'checked':''} ${u.eu?'disabled':''} style="width:auto"> Ativo (desmarque para bloquear o acesso)</label>`:''}
 <h3 style="margin-top:8px">Acesso por empresa</h3>
 ${emps.length?`<div class="scroll"><table class="stack"><thead><tr><th>Empresa</th>${PERMS.map(p=>`<th title="${esc(p[1])}">${esc(p[1].split(' (')[0])}</th>`).join('')}<th>Vota orçamento</th></tr></thead><tbody>
 ${emps.map(e=>{const v=vm[e.id]||{perms:[]};return `<tr><td data-l="Empresa">${esc(e.curto||e.nome)}${e.autorizada?'':' <span class="pill bad">sem autorização</span>'}</td>${PERMS.map(p=>`<td data-l="${esc(p[1])}"><input type="checkbox" data-emp="${esc(e.id)}" data-perm="${p[0]}" ${v.perms.includes(p[0])?'checked':''} style="width:auto"></td>`).join('')}<td data-l="Vota orçamento"><input type="checkbox" data-emp="${esc(e.id)}" data-des="1" ${v.designado?'checked':''} style="width:auto"></td></tr>`}).join('')}</tbody></table></div>
 <p class="small mut">"Vota orçamento": a pessoa é chamada a aprovar os orçamentos da empresa (alçada). Sem nenhuma marcação, o usuário entra mas não vê dados de empresa.</p>`:'<p class="small mut">Cadastre uma empresa primeiro para dar acesso.</p>'}
 <div class="acts" style="margin-top:12px"><button type="button" class="btn pri" data-cad="salvarusr">${u?'Salvar alterações':'Cadastrar usuário'}</button></div></div>`)}
function senha(){const a='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';const r=new Uint32Array(12);crypto.getRandomValues(r);return Array.from(r,x=>a[x%a.length]).join('').replace(/^(.{4})(.{4})/,'$1-$2-')}
/* ---------- eventos ---------- */
async function clique(ev){const b=ev.target.closest('[data-cad]');if(!b)return;const k=b.dataset.cad;
 if(k==='fechar')return fechar();
 if(k==='gerar'){$('#cu_senha').value=senha();return}
 b.disabled=true;try{
  if(k==='consultar'){aviso('Consultando o CNPJ nas bases públicas…','');const r=await post('/api/cnpj',{cnpj:$('#ce_cnpj').value});preencher(r.dados)}
  if(k==='colar'){const r=await post('/api/cnpj',{texto:$('#ce_texto').value});preencher(r.dados);if(r.dados.lidos)aviso('Lido do texto: '+r.dados.lidos.join(', ')+'. Confira e complete o que faltar antes de salvar.','ok')}
  if(k==='salvaremp'){const rep={nome:$('#ce_rnome').value,cargo:$('#ce_rcargo').value,cpf:$('#ce_rcpf').value};
   await post('/api/acao',{acao:'empresa_salvar',id:EST.id||undefined,cnpj:$('#ce_cnpj').value,razao:$('#ce_razao').value,curto:$('#ce_curto').value,comercial:$('#ce_com').value,societaria:$('#ce_soc').value,autorizada:$('#ce_aut').checked,endereco:$('#ce_end').value,cidade:$('#ce_cid').value,rep,cadastro:EST.cad||undefined});
   aviso('Empresa salva. Atualizando…','ok');setTimeout(()=>location.reload(),700)}
  if(k==='salvarusr'){const vinc={};document.querySelectorAll('#cadmodal input[data-emp]').forEach(i=>{const v=vinc[i.dataset.emp]=vinc[i.dataset.emp]||{emp:i.dataset.emp,perms:[],designado:false};if(!i.checked)return;if(i.dataset.des)v.designado=true;else v.perms.push(i.dataset.perm)});
   Object.values(vinc).forEach(v=>{if((v.perms.length||v.designado)&&!v.perms.includes('consultar'))v.perms.unshift('consultar')});
   const at=$('#cu_ativo');await post('/api/acao',{acao:'usuario_salvar',id:EST.id||undefined,nome:$('#cu_nome').value,email:$('#cu_email').value,papel:$('#cu_papel').value,senha:$('#cu_senha').value,administrador:EST.eu?true:$('#cu_adm').checked,consolida:$('#cu_cons').checked,ativo:at?(EST.eu?true:at.checked):true,vinculos:Object.values(vinc)});
   aviso('Usuário salvo. Atualizando…','ok');setTimeout(()=>location.reload(),700)}
 }catch(e){if(k==='consultar'){const d=$('#ce_colar');if(d)d.open=true}aviso(e.message,'bad')}finally{b.disabled=false}}
function muda(ev){if(ev.target.id==='ce_socio'){const s=EST.socios[+ev.target.value];if(s){$('#ce_rnome').value=cap(s.nome);$('#ce_rcargo').value=s.qual||''}}
 if(ev.target.id==='ce_cnpj'){const d=ev.target.value.replace(/\D/g,'');if(d.length===14)ev.target.value=d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5')}}
document.addEventListener('keydown',e=>{if(e.key==='Escape')fechar()});
window.KBCAD={empresa,usuario,fechar,PERMS};
})();
