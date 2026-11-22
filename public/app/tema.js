/* Tema claro/escuro (lembrado neste navegador) e tela cheia para toda tabela */
{
const raiz=document.documentElement;
const SOL='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7a5 5 0 110 10 5 5 0 010-10zm0-5l1.5 3h-3zm0 20l-1.5-3h3zM2 12l3-1.5v3zm20 0l-3 1.5v-3zM4.9 4.9l3.2 1-2.2 2.2zm14.2 14.2l-3.2-1 2.2-2.2zM4.9 19.1l1-3.2 2.2 2.2zM19.1 4.9l-1 3.2-2.2-2.2z"/></svg>';
const LUA='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.5A8.5 8.5 0 018.5 4 8.5 8.5 0 1020 15.5z"/></svg>';
const atual=()=>raiz.dataset.theme==='light'?'light':'dark';
function pinta(){const b=document.getElementById('tema');if(!b)return;const claro=atual()==='light';b.innerHTML=(claro?LUA:SOL)+'<span>'+(claro?'Modo escuro':'Modo claro')+'</span>';b.setAttribute('aria-label',claro?'Mudar para o modo escuro':'Mudar para o modo claro')}
document.getElementById('tema')?.addEventListener('click',()=>{const novo=atual()==='light'?'dark':'light';raiz.dataset.theme=novo;try{localStorage.setItem('kb_tema',novo)}catch(e){}pinta()});
pinta();

/* ---------- tela cheia: um botão sobre cada tabela ---------- */
const ICO='<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/></svg>';
const titulo=el=>{let n=el;for(let i=0;i<6&&n;i++){let p=n.previousElementSibling;while(p){if(/^H[1-4]$/.test(p.tagName))return p.textContent.trim();const h=p.querySelector&&p.querySelector('h1,h2,h3,h4');if(h&&p.tagName!=='TABLE')return h.textContent.trim();p=p.previousElementSibling}n=n.parentElement}return 'Tabela'};
function decorar(raizEl){
 raizEl.querySelectorAll('table').forEach(t=>{
  if(t.closest('.tfs')||t.closest('#rot')||t.rows.length<2)return;
  let box=t.parentElement;
  if(!(box.classList.contains('scroll')&&box.children.length===1)){box=document.createElement('div');t.parentNode.insertBefore(box,t);box.appendChild(t)}
  box.classList.add('tfs','tfs-tem');
  const tt=document.createElement('h3');tt.className='tfs-t';tt.textContent=titulo(box);box.prepend(tt);
  const b=document.createElement('button');b.type='button';b.className='tfs-b';b.innerHTML=ICO+'<span>Tela cheia</span>';b.setAttribute('aria-label','Ampliar a tabela '+tt.textContent+' em tela cheia');box.prepend(b)});
}
const ligado=box=>document.fullscreenElement===box||box.classList.contains('tfs-on');
function rotula(box){const b=box.querySelector(':scope>.tfs-b');if(b)b.querySelector('span').textContent=ligado(box)?'Sair da tela cheia':'Tela cheia'}
document.addEventListener('click',async e=>{const b=e.target.closest('.tfs-b');if(!b)return;e.preventDefault();e.stopPropagation();const box=b.parentElement;
 if(ligado(box)){if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});box.classList.remove('tfs-on');document.body.style.overflow='';rotula(box);return}
 if(box.requestFullscreen){try{await box.requestFullscreen();rotula(box);return}catch(err){}}
 box.classList.add('tfs-on');document.body.style.overflow='hidden';rotula(box)},true);
document.addEventListener('fullscreenchange',()=>document.querySelectorAll('.tfs').forEach(rotula));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const on=document.querySelector('.tfs.tfs-on');if(on){on.classList.remove('tfs-on');document.body.style.overflow='';rotula(on)}}});
const main=document.getElementById('main');
if(main){decorar(main);let pend=false;new MutationObserver(()=>{if(pend)return;pend=true;requestAnimationFrame(()=>{pend=false;decorar(main)})}).observe(main,{childList:true,subtree:true})}
}
