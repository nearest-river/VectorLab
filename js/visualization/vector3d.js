
/* ---- 3D vector explorer ---- */
const T3COL=['#5cf2b0','#ff6b6b','#a78bfa','#4fd1ff','#d4e157','#f472b6'];
const T3={vecs:[{x:2,y:1,z:1,vis:true},{x:-1,y:2,z:0,vis:true},{x:0,y:-1,z:2,vis:true}]};
const t3name=i=>'v'+SUB[i];
function t3rnd(){let x,y,z;do{x=Math.round(Math.random()*6-3);y=Math.round(Math.random()*6-3);z=Math.round(Math.random()*6-3);}while(!x&&!y&&!z);return {x,y,z,vis:true};}
function v3Span(){
  const inc=T3.vecs.map((v,i)=>({...v,i})).filter(v=>v.vis);
  if(!inc.length)return {rank:0,k:0,basisIdx:[],independent:true,inc:[]};
  const M=[inc.map(v=>v.x),inc.map(v=>v.y),inc.map(v=>v.z)];
  const {rank,pivots}=rref(M);
  return {rank,k:inc.length,basisIdx:pivots.map(p=>inc[p[1]].i),independent:rank===inc.length,inc};
}
function v3RenderList(){
  const box=$('#v3list');if(!box)return;box.innerHTML='';
  if(!T3.vecs.length)box.innerHTML='<p class="hint">No vectors yet. Add one to start.</p>';
  T3.vecs.forEach((v,i)=>{
    const row=document.createElement('div');row.className='vrow3'+(v.vis?'':' off');
    const eye=document.createElement('input');eye.type='checkbox';eye.className='eye';eye.checked=v.vis;eye.setAttribute('aria-label','Include '+t3name(i));
    eye.onchange=()=>{v.vis=eye.checked;v3Update();};
    const nm=document.createElement('div');nm.className='vn';nm.innerHTML=`<b style="color:${T3COL[i%T3COL.length]}">${t3name(i)}</b>`;
    row.append(eye,nm);
    ['x','y','z'].forEach(k=>{
      const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.autocomplete='off';inp.className='vin';inp.dataset.k=k;
      inp.setAttribute('aria-label',`${t3name(i)} ${k} component`);inp.value=dec(v[k]);
      inp.addEventListener('input',()=>{
        const t=inp.value.trim();if(t===''||t==='-'||t==='.'||t==='\u2212')return;
        const n=parseVal(inp.value);if(isNaN(n)){inp.classList.add('bad');return;}
        inp.classList.remove('bad');v[k]=Math.max(-8,Math.min(8,n));v3Update();
      });
      inp.addEventListener('blur',()=>{inp.classList.remove('bad');inp.value=dec(v[k]);});
      row.append(inp);
    });
    const rm=document.createElement('button');rm.className='x';rm.textContent='\u00d7';rm.setAttribute('aria-label','Remove '+t3name(i));
    rm.onclick=()=>{T3.vecs.splice(i,1);v3RenderList();v3Update();};
    row.append(rm);box.append(row);
  });
  const add=$('#v3add');if(add)add.disabled=T3.vecs.length>=6;
}
function v3RenderFacts(){
  const el=$('#v3facts');if(!el)return;
  const info=v3Span();
  const spanTxt=info.rank===3?'all of ℝ³':info.rank===2?'a plane through the origin':info.rank===1?'a line through the origin':'{0}, the origin';
  el.innerHTML=`<dt>Included</dt><dd>${info.k} of ${T3.vecs.length}</dd>
    <dt>Rank</dt><dd>${info.rank}</dd>
    <dt>Independence</dt><dd class="${info.independent?'yes':'no'}">${info.independent?'independent':'dependent'}</dd>
    <dt>Span</dt><dd>${spanTxt}</dd>`;
}
function v3Draw(){
  if(!H3V||!H3V.resize())return;
  H3V.clearContent();
  const info=v3Span();
  T3.vecs.forEach((v,i)=>{
    const color=v.vis?parseInt(T3COL[i%T3COL.length].slice(1),16):0x4a5583;
    addArrow3(H3V,[v.x,v.y,v.z],color,v.vis?t3name(i):null);
  });
  const amber=0xffc857;
  if(info.rank===1){const b=info.inc.find(v=>v.i===info.basisIdx[0]);addLineSpan(H3V,[b.x,b.y,b.z],amber);}
  else if(info.rank===2){
    const p=info.inc.find(v=>v.i===info.basisIdx[0]),q=info.inc.find(v=>v.i===info.basisIdx[1]);
    addPlaneSpan(H3V,[p.x,p.y,p.z],[q.x,q.y,q.z],amber);
  }else if(info.rank===0&&info.k)addPointMarker(H3V,amber);
  const maxMag=Math.max(1,...T3.vecs.filter(v=>v.vis).map(v=>Math.hypot(v.x,v.y,v.z)));
  H3V.setFit(maxMag);
  if(!H3V._framed){H3V.frame();H3V._framed=true;}
  H3V.render();
}
function v3Update(){
  document.querySelectorAll('#v3list .vrow3').forEach((row,i)=>{
    const v=T3.vecs[i];if(!v)return;row.classList.toggle('off',!v.vis);
    row.querySelectorAll('.vin').forEach(el=>{if(document.activeElement!==el)el.value=dec(v[el.dataset.k]);});
  });
  v3RenderFacts();v3Draw();
}
if($('#v3add')){
  $('#v3add').onclick=()=>{if(T3.vecs.length>=6)return;T3.vecs.push(t3rnd());v3RenderList();v3Update();};
  $('#v3rand').onclick=()=>{T3.vecs=T3.vecs.map(v=>({...t3rnd(),vis:v.vis}));v3RenderList();v3Update();};
  $('#v3reset').onclick=()=>{T3.vecs=[{x:2,y:1,z:1,vis:true},{x:-1,y:2,z:0,vis:true},{x:0,y:-1,z:2,vis:true}];v3RenderList();v3Update();};
}
