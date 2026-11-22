/* Persistência, arquivos, downloads, ZIP/DOCX e IA (versão conectada ao servidor) */
{
const K=window.KB;const D=window.KB_DATA;
Object.assign(K,{IDENT:D.IDENT||{},MODELOS:D.MODELOS||{},CFG:D.CFG||null,ACV:D.ACV,PKG:D.PKG,MIN:D.MIN,ATAS:D.ATAS,REC:D.REC,LANC:D.LANC});
for(const [k,m] of Object.entries(D.REQMETA||{}))if(D.REQ[k]){D.REQ[k]._emp=m.emp;D.REQ[k]._rev=m.rev}
for(const [k,r] of Object.entries(D.MINMETA||{}))if(D.MIN[k])D.MIN[k]._rev=r;

/* ---------- downloads e arquivos ---------- */
K.canSave=()=>true;
K.save=async(filename,data)=>{const blob=data instanceof Blob?data:new Blob([data]);const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);return true};
K.zip=async files=>{const z=new JSZip();for(const f of files)z.file(f.path,f.data);return z.generateAsync({type:'blob'})};
const xe=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
K.docx=async(title,text)=>{const paras=(title?[{t:title,b:1}]:[]).concat(text.split(/\n/).map(t=>({t,b:/^#+ /.test(t)})));
 const body=paras.map(p=>`<w:p>${p.b?'<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>':''}<w:r>${p.b?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${xe(p.t.replace(/^#+ /,''))}</w:t></w:r></w:p>`).join('');
 return K.zip([{path:'[Content_Types].xml',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
 {path:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
 {path:'word/document.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701"/></w:sectPr></w:body></w:document>`}])};
K.upload=async(file,emp)=>{const f=new FormData();f.append('arquivo',file);f.append('empresa',emp||K.S.emp);const r=await fetch('/api/arquivos',{method:'POST',body:f});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.erro||'Falha no envio do arquivo');return j};
K.arquivo=async id=>{const r=await fetch('/api/arquivos/'+id);if(!r.ok)throw new Error((await r.json().catch(()=>({}))).erro||'Arquivo indisponível');return r.blob()};
K.api=async(acao,corpo)=>{const r=await fetch('/api/acao',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({acao,hoje:K.HOJE,...corpo})});const j=await r.json().catch(()=>({ok:false,erro:'Resposta inválida do servidor'}));if(!r.ok||!j.ok){const e=new Error(j.erro||'Falha');e.status=r.status;throw e}return j};

/* ---------- IA pelo servidor (provedor configurado; chave só no servidor) ---------- */
K.hasAI=()=>true;
K.ai=async(prompt,onText,signal,ctx)=>{const t=K.top();const r=await fetch('/api/ia',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,emp:(ctx&&ctx.emp)||t.emp,crt:(ctx&&ctx.crt)||t.crt}),signal});
 if(!r.ok){const j=await r.json().catch(()=>({}));throw {code:r.status===503?'not_granted':'upstream_error',message:j.erro||'Falha na IA'}}
 const rd=r.body.getReader(),dec=new TextDecoder();let text='';for(;;){const {value,done}=await rd.read();if(done)break;text+=dec.decode(value,{stream:true});onText&&onText({text})}
 if(!text.trim())throw {code:'empty_completion',message:'Resposta vazia'};return {text}};

/* ---------- sincronização: cada entidade alterada na tela é gravada no servidor ---------- */
const rep=(k,v)=>k==='blob'||k==='file'||k==='_rev'||k==='_s'||k==='_emp'?undefined:v;
const ser=o=>JSON.stringify(o,rep);
function entidades(){const out=[];
 for(const p of K.PART)for(const [n,lp] of Object.entries(p.L))out.push(['lote',`${p.emp}|${p.crt}|${n}`,lp,lp,p.emp]);
 for(const d of K.ACV)out.push(['doc',d.id,d,d,d.emp]);
 for(const k of K.CTR)out.push(['contrato',k.id,{exec:k.exec,nfs:k.nfs},k,k.emp]);
 for(const a of K.ATAS)out.push(['ata',a.id,a,a,a.emp]);
 for(const [key,vs] of Object.entries(K.MIN))out.push(['minuta',key,vs,vs,key.split('|')[0]]);
 for(const r of K.REC)out.push(['nfrec',r.id,{kit:r.kit},r,r.emp]);
 for(const [key,ps] of Object.entries(K.PKG))for(const p of ps)out.push(['pacote',`${key}|${p.v}`,p,p,key.split('|')[0]]);
 if(K.T2){for(const [key,arr] of Object.entries(K.T2.REQ)){if(!arr._emp)continue;out.push(['analise',`${arr._emp}|${key}`,arr,arr,arr._emp])}
  for(const [crt,arr] of Object.entries(K.T2.DOCS))out.push(['certdocs',crt,arr,arr,null])}
 return out}
const BASE=new Map();
K.baseline=()=>{BASE.clear();for(const [t,k,o] of entidades())BASE.set(t+':'+k,ser(o))};
K.marcar=(tipo,chave,obj)=>BASE.set(tipo+':'+chave,ser(obj));
const escreve=emp=>{if(!emp)return K.can('preparar')||K.can('aprovar');const u=K.USERS[K.S.user];return !!(u.pe&&u.pe[emp]&&u.pe[emp].some(p=>p!=='consultar'))};
let fila=Promise.resolve(),pend=0;
function aviso(){let el=document.getElementById('kbsync');if(!el){el=document.createElement('div');el.id='kbsync';el.style.cssText='position:fixed;right:14px;bottom:14px;background:var(--surf);border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:13px;z-index:31';document.body.appendChild(el)}el.textContent=pend?'Salvando…':'Tudo salvo';el.style.opacity=pend?1:.75;clearTimeout(el._t);if(!pend)el._t=setTimeout(()=>{el.style.opacity=0},2500)}
K.flush=()=>{const mud=[];for(const [t,k,o,holder,emp] of entidades()){const key=t+':'+k;const j=ser(o);if(BASE.get(key)!==j){if(!escreve(emp)){BASE.set(key,j);continue}mud.push({t,k,o,holder,j,key})}}
 if(!mud.length)return fila;pend+=mud.length;aviso();
 fila=fila.then(async()=>{for(const m of mud){try{const r=await fetch('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:m.t,chave:m.k,rev:m.holder._rev||0,dados:JSON.parse(m.j)})});const j=await r.json().catch(()=>({}));
   if(r.ok&&j.ok){m.holder._rev=j.rev;BASE.set(m.key,m.j)}
   else{K.toast((j.erro||'Não foi possível salvar.')+' Recarregando os dados atuais…');setTimeout(()=>location.reload(),2200);pend=0;aviso();return}}
  catch(e){K.toast('Sem conexão com o servidor: a alteração não foi salva. Recarregando…');setTimeout(()=>location.reload(),2500);pend=0;aviso();return}
  pend--;aviso()}});return fila};
window.addEventListener('beforeunload',e=>{if(pend){e.preventDefault();e.returnValue=''}});
}
