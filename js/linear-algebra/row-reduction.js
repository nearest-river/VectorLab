/* ============ PHASE 3: ROW REDUCTION LAB ============ */
/* ---- number fields: exact rationals (BigInt) or floats with tolerance, one shared interface ---- */
const bgcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a;};
const mkQ=(n,d=1n)=>{if(d<0n){n=-n;d=-d;}const g=bgcd(n,d)||1n;return {n:n/g,d:d/g};};
const EXACT={id:'exact',partial:false,zero:mkQ(0n),one:mkQ(1n),
  add:(a,b)=>mkQ(a.n*b.d+b.n*a.d,a.d*b.d),mul:(a,b)=>mkQ(a.n*b.n,a.d*b.d),div:(a,b)=>mkQ(a.n*b.d,a.d*b.n),neg:a=>mkQ(-a.n,a.d),
  isZero:a=>a.n===0n,isOne:a=>a.n===1n&&a.d===1n,
  gtAbs:(a,b)=>(a.n<0n?-a.n:a.n)*b.d>(b.n<0n?-b.n:b.n)*a.d,
  sign:a=>a.n<0n?-1:a.n>0n?1:0,clean:a=>a,toNum:a=>Number(a.n)/Number(a.d)};
const NUM={id:'numeric',partial:true,tol:TOL,zero:0,one:1,
  add:(a,b)=>a+b,mul:(a,b)=>a*b,div:(a,b)=>a/b,neg:a=>-a||0,
  isZero:a=>Math.abs(a)<=NUM.tol,isOne:a=>Math.abs(a-1)<=1e-12,gtAbs:(a,b)=>Math.abs(a)>Math.abs(b),
  sign:a=>Math.sign(a),clean:a=>Math.abs(a)<=NUM.tol?0:a,toNum:a=>a};

/* ---- parsing and formatting (validation reuses parseVal; display reuses fmt, dec, neg) ---- */
function parseQ(s){
  const t=s.trim().replace(/\u2212/g,'-');
  if(t.length>24||isNaN(parseVal(t)))return null;
  const dq=x=>{
    const m=/^(-?)(\d*)\.?(\d*)(?:e(-?\d+))?$/i.exec(x);if(!m)return null;
    let n=BigInt((m[2]+m[3])||'0'),d=10n**BigInt(m[3].length);const e=+(m[4]||0);
    if(Math.abs(e)>30)return null;
    if(e>0)n*=10n**BigInt(e);else if(e<0)d*=10n**BigInt(-e);
    return mkQ(m[1]?-n:n,d);
  };
  const i=t.indexOf('/');let q;
  if(i>=0){const a=dq(t.slice(0,i)),b=dq(t.slice(i+1));if(!a||!b||b.n===0n)return null;q=mkQ(a.n*b.d,a.d*b.n);}
  else q=dq(t);
  if(!q)return null;
  const lim=1000000n,an=q.n<0n?-q.n:q.n;
  return an>lim*q.d?mkQ(q.n<0n?-lim:lim):q;
}
function qText(q){                       /* editable text: integer, terminating decimal, else n/d */
  if(q.d===1n)return neg(q.n.toString());
  let d=q.d,a=0,b=0;while(d%2n===0n){d/=2n;a++;}while(d%5n===0n){d/=5n;b++;}
  if(d!==1n)return neg(q.n+'/'+q.d);
  const k=Math.max(a,b),ng=q.n<0n,s=((ng?-q.n:q.n)*10n**BigInt(k)/q.d).toString().padStart(k+1,'0');
  return neg((ng?'-':'')+s.slice(0,-k)+'.'+s.slice(-k));
}
function qDec(q,pl=4){                   /* exact rational -> decimal rounded to pl places */
  const ng=q.n<0n,n=ng?-q.n:q.n,v=(n*10n**BigInt(pl)*2n+q.d)/(q.d*2n);
  if(v===0n&&n!==0n)return '\u2248'+'0';
  const s=v.toString().padStart(pl+1,'0'),f=s.slice(-pl).replace(/0+$/,'');
  return (ng?'-':'')+s.slice(0,-pl)+(f?'.'+f:'');
}
function showVal(F,x,disp){
  if(F.id==='exact')return x.d===1n?neg(x.n.toString()):disp==='dec'?neg(qDec(x)):neg(x.n+'/'+x.d);
  return disp==='dec'?dec(x):fmt(x);
}

/* ---- row-reduction engine: forward pass (REF), then optional back pass (RREF).
   Every step stores a snapshot of the matrix, the pivots confirmed so far and the operation applied. ---- */
function rowReduce(A0,F,gj=true){
  const m=A0.length,n=m?A0[0].length:0,A=A0.map(r=>r.slice()),pivots=[],steps=[];
  let skips=0;
  const snap=()=>A.map(r=>r.slice()),pv=()=>pivots.map(p=>p.slice());
  const push=o=>steps.push({...o,A:snap(),pivots:pv(),skips});
  const addRow=(i,j,k)=>{for(let x=0;x<n;x++)A[i][x]=F.clean(F.add(A[i][x],F.mul(k,A[j][x])));};
  push({kind:'init',phase:'start'});
  let r=0;
  for(let c=0;c<n&&r<m;c++){
    let p=-1;
    for(let i=r;i<m;i++){
      if(F.isZero(A[i][c]))continue;
      if(p<0||(F.partial&&F.gtAbs(A[i][c],A[p][c])))p=i;
      if(!F.partial)break;
    }
    if(p<0){for(let i=r;i<m;i++)A[i][c]=F.zero;skips++;push({kind:'skip',phase:'fwd',pr:r,pc:c});continue;}
    pivots.push([r,c]);let fresh=true;
    if(p!==r){
      const zeroAtPivot=F.isZero(A[r][c]);[A[r],A[p]]=[A[p],A[r]];
      push({kind:'swap',phase:'fwd',i:r,j:p,pr:r,pc:c,zeroAtPivot,newPivot:true});fresh=false;
    }
    for(let i=r+1;i<m;i++){
      if(F.isZero(A[i][c])){A[i][c]=F.zero;continue;}
      const k=F.neg(F.div(A[i][c],A[r][c]));addRow(i,r,k);A[i][c]=F.zero;
      push({kind:'add',phase:'fwd',i,j:r,k,pr:r,pc:c,newPivot:fresh,zeroRow:A[i].every(F.isZero)});fresh=false;
    }
    if(fresh)push({kind:'pivot',phase:'fwd',pr:r,pc:c,newPivot:true});
    r++;
  }
  const ref=snap(),out=()=>({steps,ref,pivots:pv(),rank:pivots.length});
  if(!gj){push({kind:'done',phase:'done',gj:false});return out();}
  for(let q=pivots.length-1;q>=0;q--){
    const [pr,pc]=pivots[q],p0=A[pr][pc];
    if(!F.isOne(p0)){
      const k=F.div(F.one,p0);for(let x=0;x<n;x++)A[pr][x]=F.clean(F.mul(A[pr][x],k));A[pr][pc]=F.one;
      push({kind:'scale',phase:'back',i:pr,k,pv:p0,pr,pc});
    }
    for(let i=pr-1;i>=0;i--){
      if(F.isZero(A[i][pc])){A[i][pc]=F.zero;continue;}
      const k=F.neg(A[i][pc]);addRow(i,pr,k);A[i][pc]=F.zero;
      push({kind:'add',phase:'back',i,j:pr,k,pr,pc});
    }
  }
  push({kind:'done',phase:'done',gj:true});
  return {...out(),rref:snap()};
}

/* ---- state ---- */
const R3={m:3,n:3,A:[],mode:'exact',disp:'frac',algo:'gj',geo:true,idx:0,timer:0,origin:null,cw:56,F:EXACT,M:[],Mf:[],run:null,full:null};
const R3_DEFAULT=[[0,2,1],[1,1,0],[2,4,1]];
const R3_PRESETS=[
  ['Identity',[[1,0],[0,1]]],['Dependent rows',[[1,2],[2,4]]],['Zero matrix',[[0,0],[0,0]]],
  ['Row swap needed',R3_DEFAULT],['Fractions',[[2,1,-1],[-3,-1,2],[-2,1,2]]],['Rank 2 (3×3)',[[1,2,3],[4,5,6],[7,8,9]]],
  ['Wide, rank 1',[[1,2,3],[2,4,6]]],['Wide, echelon',[[1,0,0],[0,1,0]]],['Tall, rank 2',[[1,2],[3,4],[5,6]]],
  ['Tall, rank 1',[[1,2],[2,4],[3,6]]],['3×4, free column',[[1,2,-1,3],[2,4,0,2],[3,6,-1,5]]],
  ['Decimals',[[0.1,0.2],[0.3,0.6]]],['Nearly dependent',[[1,2],[3,'6.000000000001']]]
];
const NW=['Zero','One','Two','Three','Four'];
const Rl=i=>'R'+SUB[i];

/* ---- compute + render ---- */
function r3Compute(){
  r3Stop();
  const {A,mode,algo}=R3;
  let F=EXACT,M=A;
  if(mode==='numeric'){M=A.map(r=>r.map(EXACT.toNum));NUM.tol=tolFor(M);F=NUM;}
  R3.F=F;R3.M=M;R3.Mf=A.map(r=>r.map(EXACT.toNum));
  R3.full=rowReduce(M,F,true);R3.run=algo==='gj'?R3.full:rowReduce(M,F,false);R3.idx=0;
  if(typeof nsCompute==='function'){try{nsCompute();}catch(e){console.error('Null space compute error',e);}}
  r3RenderAll();
}
function r3RenderAll(){
  const {F,disp}=R3;let L=1;
  const seen=[R3.full.ref,R3.full.rref,...R3.run.steps.map(s=>s.A)];
  seen.forEach(M=>M&&M.forEach(r=>r.forEach(x=>{L=Math.max(L,showVal(F,x,disp).length);})));
  R3.cw=Math.max(56,Math.min(150,L*11+16));
  r3RenderResults();r3RenderGeo();r3RenderStep(null);
}
function matHTML(A,o={}){
  const {F,disp,cw}=R3,{pivots=[],cur=null,prow=-1,pcol=-1,tgt=[],nopv=false}=o;
  let h=`<div class="rref rows" style="--n:${A[0].length};--cw:${cw}px" role="table" aria-label="Matrix">`;
  A.forEach((row,i)=>{
    h+=`<div class="mrow${i===prow?' prow':''}${tgt.includes(i)?' tgt':''}" role="row">`;
    row.forEach((x,j)=>{
      const isPv=pivots.some(p=>p[0]===i&&p[1]===j),isCur=cur&&cur[0]===i&&cur[1]===j;
      const cls=[isPv?'pv':'',isCur?(nopv?'nopv':'cur'):'',j===pcol?'pcol':''].filter(Boolean).join(' ');
      const s=showVal(F,x,disp),t=F.id==='exact'&&x.d!==1n?` title="${neg(x.n+'/'+x.d)}"`:'';
      h+=`<span class="${cls}" role="cell"${t}>${s}</span>`;
    });
    h+='</div>';
  });
  return h+'</div>';
}

/* ---- operation text and explanations ---- */
function coefStr(k){
  const {F,disp}=R3,a=F.sign(k)<0?F.neg(k):k;if(F.isOne(a))return '';
  const s=showVal(F,a,disp);return s.includes('/')?`(${s})`:s;
}
function opText(s){
  const {F}=R3,sg=F.sign(s.k||F.one)<0;
  if(s.kind==='swap')return `${Rl(s.i)} \u2194 ${Rl(s.j)}`;
  if(s.kind==='add')return `${Rl(s.i)} \u2192 ${Rl(s.i)} ${sg?'\u2212':'+'} ${coefStr(s.k)}${Rl(s.j)}`;
  if(s.kind==='scale')return `${Rl(s.i)} \u2192 ${sg?'\u2212':''}${coefStr(s.k)}${Rl(s.i)}`;
  return s.kind==='init'?'Start':s.kind==='done'?(s.gj?'Reduced row echelon form reached':'Row echelon form reached'):'No operation';
}
function r3Explain(s,fin){
  const {F,disp,m,n}=R3,V_=x=>showVal(F,x,disp),k=s.pivots.length,cl=c=>'column '+(c+1);
  const found=s.newPivot?`A pivot was found in ${cl(s.pc)}. `:'';
  let why='';
  if(s.kind==='init')why='Matrix A as entered. Elimination works left to right, looking for a pivot (a usable nonzero entry) in each column.';
  else if(s.kind==='skip'){
    const zc=s.A.every(row=>F.isZero(row[s.pc]));
    why=`Column ${s.pc+1} has no nonzero entry ${s.pr<m-1?`from row ${s.pr+1} down`:`in row ${m}`}, so it has no pivot. `+(zc?'It is a zero column, so the columns are linearly dependent.':'It is a combination of the pivot columns to its left, so the columns are linearly dependent.');
  }
  else if(s.kind==='swap')why=found+(s.zeroAtPivot?`Position (${s.pr+1}, ${s.pc+1}) holds 0, so ${Rl(s.j)} is swapped up to put a nonzero entry there.`:`${Rl(s.j)} has the largest entry in the column, the most reliable pivot in floating point, so it is swapped up.`);
  else if(s.kind==='pivot')why=`A pivot was found in ${cl(s.pc)}: the entry ${V_(s.A[s.pr][s.pc])} in row ${s.pr+1}. `+(s.pr<m-1?'The entries below it are already zero.':'It is in the last row, so nothing lies below it.');
  else if(s.kind==='add'){
    if(s.phase==='fwd'){
      why=found+`Clears the entry below the pivot in ${cl(s.pc)}.`;
      if(s.zeroRow){const b=F.neg(s.k);why+=` ${Rl(s.i)} is now all zeros: before this step ${Rl(s.i)} = ${F.sign(b)<0?'\u2212':''}${coefStr(b)}${Rl(s.j)}, a multiple of another row, so it adds no new independent direction and the rows of A are linearly dependent.`;}
    }else why=`Clears the entry above the pivot in ${cl(s.pc)}, so the pivot is the only nonzero entry in its column.`;
  }
  else if(s.kind==='scale')why=`Divides ${Rl(s.i)} by the pivot ${V_(s.pv)} so the pivot becomes 1.`;
  else why=s.gj?'Every pivot is 1 and is the only nonzero entry in its column. The reduced row echelon form is unique.':'Zero rows (if any) are at the bottom and each pivot lies to the right of the one above it. Pivots are not scaled to 1, and this form is not unique.';
  const rank=fin?(k===0?'Zero pivots indicate rank 0: every entry of A is 0.':`${NW[k]} pivot${k>1?'s':''} indicate${k>1?'':'s'} rank ${k}.`):(k?`${k} pivot${k>1?'s':''} so far, so the rank is at least ${k}.`:'No pivot found yet.');
  const zr=s.A.some(row=>row.every(F.isZero));
  const rows=k===m?['independent',1]:fin||zr?['dependent',0]:['undecided',2];
  const cols=k===n?['independent',1]:fin||s.skips>0?['dependent',0]:['undecided',2];
  return {why,rank,rows,cols};
}

/* ---- stepper ---- */
function r3RenderStep(prev){
  const steps=R3.run.steps,i=R3.idx,s=steps[i],last=steps.length-1,ex=r3Explain(s,i===last);
  const cur=s.pr!=null?[s.pr,s.pc]:null;
  const tgt=s.kind==='add'||s.kind==='scale'?[s.i]:s.kind==='swap'?[s.i,s.j]:[];
  $('#rmat').innerHTML=matHTML(s.A,{pivots:s.pivots,cur,prow:cur?s.pr:-1,pcol:cur?s.pc:-1,tgt,nopv:s.kind==='skip'});
  $('#rphase').innerHTML='<b>'+({start:'Start',fwd:'Forward elimination',back:'Back-substitution',done:'Finished'})[s.phase]+'</b>';
  $('#rcount').textContent=`Step ${i} of ${last}`;
  $('#rop').textContent=opText(s);
  const sc=$('#rscrub');sc.max=last;sc.value=i;$('#rscrubv').textContent=`${i} / ${last}`;
  $('#rprev').disabled=i===0;$('#rnext').disabled=$('#rend').disabled=i===last;
  const tag=([t,c])=>`<dd class="${c===1?'yes':c===0?'no':'mid'}">${t}</dd>`,k=s.pivots.length;
  $('#redu').innerHTML=`<p>${ex.why}</p><p class="m">${ex.rank}</p>
    <dl class="facts"><dt>Pivots found</dt><dd>${k}<small>${k?s.pivots.map(([r,c])=>`(${r+1}, ${c+1})`).join(', '):'none yet'}</small></dd>
    <dt>Rows</dt>${tag(ex.rows)}<dt>Columns</dt>${tag(ex.cols)}</dl>`;
  if(prev!=null&&!reduce&&Math.abs(i-prev)===1)r3Animate(i>prev?s:steps[prev],i>prev);
  r3Draw();
}
function r3Animate(s,fwd){
  const rows=[...$('#rmat').querySelectorAll('.mrow')];
  if(s.kind==='swap'){
    const a=rows[s.i],b=rows[s.j],dy=b.offsetTop-a.offsetTop;
    a.style.transform=`translateY(${dy}px)`;b.style.transform=`translateY(${-dy}px)`;a.getBoundingClientRect();
    [a,b].forEach(x=>{x.style.transition='transform .4s cubic-bezier(.3,.7,.2,1)';x.style.transform='';});
  }else if((s.kind==='add'||s.kind==='scale')&&rows[s.i]){
    if(fwd){rows[s.i].classList.add('flash');}
  }
}
function r3Go(i){R3.idx=Math.max(0,Math.min(R3.run.steps.length-1,i));}
function r3Move(to){const p=R3.idx;r3Go(to);r3RenderStep(p);}
function r3Stop(){clearInterval(R3.timer);R3.timer=0;const b=$('#rplay');if(b)b.textContent='Play';}
function r3Play(){
  if(R3.timer){r3Stop();return;}
  const last=R3.run.steps.length-1;
  if(R3.idx>=last)r3Move(0);
  $('#rplay').textContent='Pause';
  R3.timer=setInterval(()=>{r3Move(R3.idx+1);if(R3.idx>=last)r3Stop();},1000);
}

/* ---- results (rank, pivots, REF, RREF) ---- */
function r3RenderResults(){
  const {m,n,full,F,disp,mode}=R3,rk=full.rank,mn=Math.min(m,n),pv=full.pivots,pcs=pv.map(p=>p[1]);
  let note=mode==='exact'?'Exact arithmetic: every entry is a rational number, so nothing is rounded.'
    :`Floating point: entries with |x| ≤ ${NUM.tol.toExponential(1)} (1e-10 × the largest entry) count as 0.`;
  if(mode==='numeric'){const er=rowReduce(R3.A,EXACT,false).rank;if(er!==rk)note+=` Exact arithmetic gives rank ${er}: these entries are dependent only up to the tolerance.`;}
  $('#rres').innerHTML=`
    <h2>Rank and pivots</h2>
    <div class="hero"><div class="rk">${rk}</div><div>
      <div class="h">rank(A) = number of pivot positions</div>
      <div class="strip" role="img" aria-label="${rk} of ${n} columns have a pivot">${Array.from({length:n},(_,j)=>`<i class="${pcs.includes(j)?'on':'off'}"></i>`).join('')}</div>
      <div class="cap">${rk} of ${n} column${n>1?'s':''} ha${rk===1?'s':'ve'} a pivot; rank(A) ≤ min(${m}, ${n}) = ${mn}</div>
    </div></div>
    <dl class="facts">
      <dt>Size</dt><dd>${m}×${n}</dd>
      <dt>Pivots</dt><dd>${pv.length}<small>${pv.length?pv.map(([r,c])=>`(${r+1}, ${c+1})`).join(', '):'none'}</small></dd>
      <dt>Rows</dt><dd class="${rk===m?'yes':'no'}">${rk===m?'independent':'dependent'}</dd>
      <dt>Columns</dt><dd class="${rk===n?'yes':'no'}">${rk===n?'independent':'dependent'}</dd>
    </dl>
    <h2>Row echelon form (REF)</h2>
    <div class="rrefbox">${matHTML(full.ref,{pivots:pv})}</div>
    <div class="sub">Pivots are highlighted. A REF is not unique; this one is the result of the forward pass.</div>
    <h2 style="margin-top:14px">Reduced row echelon form (RREF)</h2>
    <div class="rrefbox">${matHTML(full.rref,{pivots:pv})}</div>
    <div class="sub">The RREF is unique for every matrix.</div>
    <div class="sub">${note}</div>`;
}

/* ---- geometry: columns as vectors (Phase 1 drawing helpers are reused) ---- */
const spanName=(k,m)=>k===0?'only the origin {0}':k===1?'a line through the origin':k===m?`all of ℝ${SUP[m]}`:'a plane through the origin in ℝ³';
function r3RenderGeo(){
  const {m,n,full,F,disp}=R3,rk=full.rank,pv=full.pivots,pcs=pv.map(p=>p[1]);
  const prow=Object.fromEntries(pv.map(([r,c])=>[c,r])),Rn=full.rref.map(r=>r.map(F.toNum));
  const rels=Object.fromEntries(relations(Rn,pv,n).map(r=>[r.j,r.terms]));
  const term=(terms,j)=>!terms.length?'0':terms.map(([,c],k)=>{
    const x=full.rref[prow[c]][j],ng=F.sign(x)<0,a=ng?F.neg(x):x,one=F.isOne(a),s=showVal(F,a,disp),lab=(one?'':(s.includes('/')?`(${s})`:s)+'·')+'a'+SUB[c];
    return k===0?(ng?'\u2212':'')+lab:(ng?' \u2212 ':' + ')+lab;
  }).join('');
  let h=`<p class="m" style="margin:0 0 4px">Column space dimension = rank = ${rk}: the columns of A span ${spanName(rk,m)}.</p>`;
  for(let j=0;j<n;j++){
    const piv=pcs.includes(j),vec='('+R3.M.map(r=>showVal(F,r[j],disp)).join(', ')+')';
    h+=`<div class="colrow" style="--c:${VCOL[j]}"><b>a${SUB[j]}</b><span>${vec}<small>${piv?'pivot column: not a combination of the columns before it':`dependent: a${SUB[j]} = ${term(rels[j]||[],j)}`}</small></span></div>`;
  }
  h+=`<p class="rnote"><b>rank(A) is the dimension of the column space and of the row space.</b> Row operations preserve the row space, so the pivot count never changes. They do not preserve the column space or the column vectors themselves: watch the dashed vectors move. What they preserve are the linear relations among the columns, so the pivot columns of the original A are a basis of its column space.</p>`;
  if(m!==2)h+=`<p class="rnote">The columns live in ℝ${SUP[m]}, so there is no plane to draw; the analysis above still applies.</p>`;
  $('#rcols').innerHTML=h;
  $('#rcvwrap').hidden=m!==2;$('#rgeobox').classList.toggle('nocv',m!==2);
}
function r3Draw(){
  const c=$('#rcv');if(R3.m!==2||!c.getBoundingClientRect().width)return;
  fit(c);const ctx=c.getContext('2d');ctx.setTransform(c._d,0,0,c._d,0,0);base(ctx,c);
  const {n,full,F}=R3,A=R3.Mf,rk=full.rank,pcs=full.pivots.map(p=>p[1]),col=j=>[A[0][j],A[1][j]];
  if(n===2){tgrid(ctx,c,A);square(ctx,c,A);}                       /* Phase 1 transformation view */
  if(rk===2){
    ctx.fillStyle='rgba(255,200,87,.05)';ctx.fillRect(0,0,c._w,c._h);
    if(n>2){const p=col(pcs[0]),q=col(pcs[1]);tgrid(ctx,c,[[p[0],q[0]],[p[1],q[1]]],'rgba(255,200,87,.2)','rgba(255,200,87,.5)');}
  }else if(rk===1){const p=col(pcs[0]);infLine(ctx,c,p[0],p[1],'#ffc857',[],3);}
  else{const [ox,oy]=P(c,0,0);ctx.strokeStyle='#ffc857';ctx.lineWidth=2;ctx.beginPath();ctx.arc(ox,oy,9,0,7);ctx.stroke();}
  if(R3.geo){                                                       /* columns of the current matrix */
    const cur=R3.run.steps[R3.idx].A.map(r=>r.map(F.toNum));
    ctx.save();ctx.globalAlpha=.6;
    for(let j=0;j<n;j++){
      const x=cur[0][j],y=cur[1][j];if(Math.abs(x-A[0][j])+Math.abs(y-A[1][j])<1e-9)continue;
      arrow(ctx,c,x,y,VCOL[j],1.8,0,0,[4,4]);const [gx,gy]=P(c,x,y);ctx.fillStyle=VCOL[j];ctx.beginPath();ctx.arc(gx,gy,3.5,0,7);ctx.fill();
    }
    ctx.restore();
  }
  for(let j=0;j<n;j++){const [x,y]=col(j);arrow(ctx,c,x,y,VCOL[j],pcs.includes(j)?3.2:2);}
  for(let j=0;j<n;j++){const [x,y]=col(j);label(ctx,c,x,y,`a${SUB[j]} (${n2(x)}, ${n2(y)})${pcs.includes(j)?'':' dependent'}`,VCOL[j]);}
  for(let j=0;j<n;j++){
    const [x,y]=col(j),[hx,hy]=P(c,x,y),piv=pcs.includes(j);
    ctx.fillStyle=piv?VCOL[j]:'#0b1020';ctx.strokeStyle=piv?'#fff':VCOL[j];ctx.lineWidth=piv?1.5:2.2;
    ctx.beginPath();ctx.arc(hx,hy,piv?6:5.5,0,7);ctx.fill();ctx.stroke();
  }
  badge(ctx,c,'Columns span '+(rk===2?'ℝ²':rk===1?'a line':'{0}'),'#ffc857');
}

/* ---- matrix input ---- */
function r3Load(M,setOrigin){
  R3.m=M.length;R3.n=M[0].length;
  R3.A=M.map(r=>r.map(v=>parseQ(String(v))||mkQ(0n)));
  if(setOrigin)R3.origin=M.map(r=>r.map(String));
  r3RenderInputs();r3Compute();
}
function r3Resize(m,n){
  R3.A=Array.from({length:m},(_,i)=>Array.from({length:n},(_,j)=>(R3.A[i]&&R3.A[i][j])||mkQ(0n)));
  R3.m=m;R3.n=n;r3RenderInputs();r3Compute();
}
function r3Random(){
  const {m,n}=R3,ri=()=>Math.floor(Math.random()*9)-4,nz=()=>{let k;do{k=Math.floor(Math.random()*5)-2;}while(!k);return k;};
  const M=Array.from({length:m},()=>Array.from({length:n},ri));
  if(Math.random()<.45)M[m-1]=M[0].map((v,j)=>nz()*v+(m>2?nz()*M[1][j]:0));
  r3Load(M,true);
}
function r3RenderInputs(){
  const {m,n}=R3,box=$('#rsizes');box.innerHTML='';
  [[2,2],[2,3],[3,2],[3,3],[3,4]].forEach(([mm,nn])=>{
    const b=document.createElement('button');b.textContent=mm+'\u00d7'+nn;b.setAttribute('aria-pressed',mm===m&&nn===n);
    b.onclick=()=>r3Resize(mm,nn);box.appendChild(b);
  });
  $('#raddr').disabled=m>=3;$('#rdelr').disabled=m<=2;$('#raddc').disabled=n>=4;$('#rdelc').disabled=n<=2;
  const mx=$('#rmx');mx.innerHTML='';mx.style.gridTemplateColumns=`repeat(${n},auto)`;
  for(let i=0;i<m;i++)for(let j=0;j<n;j++){
    const inp=document.createElement('input');
    inp.type='text';inp.inputMode='decimal';inp.autocomplete='off';inp.dataset.i=i;inp.dataset.j=j;
    inp.setAttribute('aria-label',`Row ${i+1}, column ${j+1}`);inp.value=qText(R3.A[i][j]);inp.classList.toggle('long',inp.value.length>7);
    inp.addEventListener('input',()=>{
      const t=inp.value.trim();if(t===''||t==='-'||t==='.'||t==='\u2212')return;
      const q=parseQ(t);if(!q){inp.classList.add('bad');return;}
      inp.classList.remove('bad');inp.classList.toggle('long',inp.value.length>7);R3.A[i][j]=q;r3Compute();
    });
    inp.addEventListener('blur',()=>{inp.classList.remove('bad');inp.value=qText(R3.A[i][j]);inp.classList.toggle('long',inp.value.length>7);});
    inp.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();const all=[...mx.querySelectorAll('input')],k=all.indexOf(inp)+(e.shiftKey?-1:1);
        if(all[k]){all[k].focus();all[k].select();}return;
      }
      if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;e.preventDefault();
      const st=e.shiftKey?mkQ(1n,10n):mkQ(1n,2n),q=parseQ(inp.value)||R3.A[i][j];
      inp.value=qText(EXACT.add(q,e.key==='ArrowUp'?st:EXACT.neg(st)));inp.dispatchEvent(new Event('input'));
    });
    mx.appendChild(inp);
  }
  const ps=$('#rpresets');ps.innerHTML='';
  R3_PRESETS.forEach(([name,M])=>{
    const b=document.createElement('button');b.className='chip';b.textContent=name;
    b.title=M.length+'×'+M[0].length;b.onclick=()=>r3Load(M,true);ps.appendChild(b);
  });
}
function r3Init(){
  const seg=(id,key,after)=>$(id).addEventListener('click',e=>{
    const v=e.target.dataset.v;if(!v)return;R3[key]=v;
    $(id).querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.v===v));after();
  });
  seg('#rmode','mode',r3Compute);seg('#ralgo','algo',r3Compute);seg('#rdisp','disp',r3RenderAll);
  const rs=(dm,dn)=>()=>{const m=R3.m+dm,n=R3.n+dn;if(m>=2&&m<=3&&n>=2&&n<=4)r3Resize(m,n);};
  $('#raddr').onclick=rs(1,0);$('#rdelr').onclick=rs(-1,0);$('#raddc').onclick=rs(0,1);$('#rdelc').onclick=rs(0,-1);
  $('#rrand').onclick=r3Random;
  $('#rreset').onclick=()=>r3Load(R3.origin,false);
  $('#rclear').onclick=()=>{R3.A=R3.A.map(r=>r.map(()=>mkQ(0n)));r3RenderInputs();r3Compute();const f=$('#rmx input');f.focus();f.select();};
  $('#rprev').onclick=()=>{r3Stop();r3Move(R3.idx-1);};
  $('#rnext').onclick=()=>{r3Stop();r3Move(R3.idx+1);};
  $('#rend').onclick=()=>{r3Stop();r3Move(R3.run.steps.length-1);};
  $('#rrestart').onclick=()=>{r3Stop();r3Move(0);};
  $('#rplay').onclick=r3Play;
  $('#rscrub').addEventListener('input',e=>{r3Stop();r3Move(+e.target.value);});
  $('#rghost').onchange=e=>{R3.geo=e.target.checked;r3Draw();};
  $('#rangeR').addEventListener('input',e=>setRange(e.target.value));
  r3Load(R3_DEFAULT,true);
}

/* tabs */
