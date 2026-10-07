function rref(M0){
  const A=cp(M0),m=A.length,n=m?A[0].length:0,tol=tolFor(A),pivots=[];let r=0;
  for(let c=0;c<n&&r<m;c++){
    let p=r;for(let i=r+1;i<m;i++)if(Math.abs(A[i][c])>Math.abs(A[p][c]))p=i;
    if(Math.abs(A[p][c])<=tol){for(let i=r;i<m;i++)A[i][c]=0;continue;}
    [A[r],A[p]]=[A[p],A[r]];
    const pv=A[r][c];for(let j=0;j<n;j++)A[r][j]/=pv;A[r][c]=1;
    for(let i=0;i<m;i++){if(i===r)continue;const f=A[i][c];if(f!==0){for(let j=0;j<n;j++)A[i][j]-=f*A[r][j];A[i][c]=0;}}
    pivots.push([r,c]);r++;
  }
  for(const row of A)for(let j=0;j<n;j++){if(Math.abs(row[j])<=tol)row[j]=0;if(Object.is(row[j],-0))row[j]=0;}
  return {R:A,pivots,rank:pivots.length};
}
function det(M){
  if(M.length===2)return M[0][0]*M[1][1]-M[0][1]*M[1][0];
  return M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[0][1]*(M[1][0]*M[2][2]-M[1][2]*M[2][0])+M[0][2]*(M[1][0]*M[2][1]-M[1][1]*M[2][0]);
}
function relations(R,pivots,n){
  const pc=pivots.map(p=>p[1]),out=[];
  for(let j=0;j<n;j++){
    if(pc.includes(j))continue;
    const terms=[];pivots.forEach(([r,c])=>{if(R[r][j]!==0)terms.push([R[r][j],c]);});
    out.push({j,terms});
  }
  return out;
}

const comb=(a,u,b,v)=>[a*u[0]+b*v[0],a*u[1]+b*v[1]];
function spanInfo(vs){
  const k=vs.length;
  if(!k)return {k,rank:0,dim:0,independent:true,pivots:[],rels:[],dir:null,basis:[],zeros:[],angle:null};
  const M=[vs.map(v=>v[0]),vs.map(v=>v[1])],{R,pivots,rank}=rref(M),tol=tolFor(M);
  const zeros=[];vs.forEach((v,i)=>{if(Math.max(Math.abs(v[0]),Math.abs(v[1]))<=tol)zeros.push(i);});
  let dir=null,bn=0;vs.forEach(v=>{const l=Math.hypot(v[0],v[1]);if(l>bn){bn=l;dir=v;}});
  const basis=pivots.map(p=>p[1]);let angle=null;
  if(rank===2){const p=vs[basis[0]],q=vs[basis[1]];angle=Math.atan2(Math.abs(p[0]*q[1]-p[1]*q[0]),Math.abs(p[0]*q[0]+p[1]*q[1]))*180/Math.PI;}
  return {k,rank,dim:rank,independent:rank===k,pivots,rels:relations(R,pivots,k),dir:rank?dir:null,basis,zeros,angle};
}
/* ============ END MATH ============ */
