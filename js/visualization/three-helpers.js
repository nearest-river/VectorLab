/* ============ PHASE 4: 3D VISUALIZATION, NULL SPACE, LEGAL ============ */
function draw4(){
  try{v3Draw();}catch(e){console.error('3D vector view error',e);}
  try{m3Draw();}catch(e){console.error('3D matrix view error',e);}
  try{nsDraw();}catch(e){console.error('Null space view error',e);}
}
function textSprite(text,color){
  const cvs=document.createElement('canvas'),ctx=cvs.getContext('2d'),fs=46;
  ctx.font=`600 ${fs}px Sora, sans-serif`;
  const w=Math.ceil(ctx.measureText(text).width)+22;cvs.width=w;cvs.height=fs+18;
  ctx.font=`600 ${fs}px Sora, sans-serif`;ctx.fillStyle='rgba(6,9,19,.82)';ctx.fillRect(0,0,w,cvs.height);
  ctx.fillStyle=color;ctx.textBaseline='top';ctx.fillText(text,9,5);
  const tex=new THREE.CanvasTexture(cvs);tex.minFilter=THREE.LinearFilter;
  const spr=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true,sizeAttenuation:true}));
  const s=0.0072;spr.scale.set(w*s,cvs.height*s,1);
  return spr;
}
function make3D(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(42,1,.1,100);
  const orb={r:9,theta:.55,phi:1.15};
  function updateCam(){
    camera.position.set(orb.r*Math.sin(orb.phi)*Math.cos(orb.theta),orb.r*Math.cos(orb.phi),orb.r*Math.sin(orb.phi)*Math.sin(orb.theta));
    camera.lookAt(0,0,0);
  }
  updateCam();
  scene.add(new THREE.AmbientLight(0xffffff,.85));
  const dl=new THREE.DirectionalLight(0xffffff,.5);dl.position.set(5,7,4);scene.add(dl);
  scene.add(new THREE.GridHelper(10,10,0x3a4270,0x1a1f3a));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(.05,12,12),new THREE.MeshBasicMaterial({color:0xe9edf8})));
  const AXCOL={x:0xff6b6b,y:0x5cf2b0,z:0x5b7cff};
  const axes=new THREE.Group();
  [['x',[1,0,0]],['y',[0,1,0]],['z',[0,0,1]]].forEach(([k,d])=>{
    const mat=new THREE.LineDashedMaterial({color:AXCOL[k],dashSize:.18,gapSize:.12});
    const pts=[new THREE.Vector3(-d[0]*6,-d[1]*6,-d[2]*6),new THREE.Vector3(d[0]*6,d[1]*6,d[2]*6)];
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),mat);line.computeLineDistances();axes.add(line);
  });
  scene.add(axes);
  const content=new THREE.Group();scene.add(content);
  let dragging=false,lx=0,ly=0;
  canvas.addEventListener('pointerdown',e=>{dragging=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{
    if(!dragging)return;const dx=e.clientX-lx,dy=e.clientY-ly;lx=e.clientX;ly=e.clientY;
    orb.theta-=dx*.007;orb.phi=Math.min(Math.PI-.08,Math.max(.08,orb.phi-dy*.007));
    updateCam();render();
  });
  const stop=()=>dragging=false;
  canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('pointerleave',stop);
  canvas.addEventListener('wheel',e=>{e.preventDefault();orb.r=Math.min(22,Math.max(3.5,orb.r*(1+e.deltaY*.001)));updateCam();render();},{passive:false});
  function resize(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,3));renderer.setSize(r.width,r.height,false);
    camera.aspect=r.width/r.height;camera.updateProjectionMatrix();return true;
  }
  function render(){renderer.render(scene,camera);}
  let fitMag=6;
  function setFit(mag){fitMag=Math.max(mag,.8)}
  function frame(){orb.r=Math.min(22,Math.max(4.5,fitMag*2.1+2.8));orb.theta=.55;orb.phi=1.15;updateCam();}
  function reset(){frame();render();}
  function clearContent(){
    /* traverse so nested parts (ArrowHelper line+cone) and label textures (Sprite maps) are released too;
       previously each redraw leaked a canvas texture per label */
    while(content.children.length){
      const o=content.children[content.children.length-1];content.remove(o);
      o.traverse(n=>{
        const mats=n.material?(Array.isArray(n.material)?n.material:[n.material]):[];
        mats.forEach(m=>{m.map&&m.map.dispose();m.dispose&&m.dispose();});
        if(!n.isSprite&&n.geometry)n.geometry.dispose();
      });
    }
  }
  /* keep the drawing buffer matched to the on-screen size (fixes blurry/stretched canvases that were never resized) */
  if(window.ResizeObserver)new ResizeObserver(()=>{if(resize())render();}).observe(canvas);
  return {content,orb,resize,render,reset,clearContent,setFit,frame};
}
function addArrow3(host,v,color,label){
  const len=Math.hypot(v[0],v[1],v[2]);if(len<1e-6)return;
  const dir=new THREE.Vector3(v[0],v[1],v[2]).normalize();
  const head=Math.min(.32,len*.28);
  host.content.add(new THREE.ArrowHelper(dir,new THREE.Vector3(0,0,0),len,color,head,head*.6));
  if(label){const spr=textSprite(label,'#'+color.toString(16).padStart(6,'0'));spr.position.set(v[0]*1.08,v[1]*1.08+.16,v[2]*1.08);host.content.add(spr);}
}
function addPointMarker(host,color){
  host.content.add(new THREE.Mesh(new THREE.SphereGeometry(.09,16,16),new THREE.MeshBasicMaterial({color})));
}
function addLineSpan(host,dir,color){
  const len=Math.hypot(dir[0],dir[1],dir[2]);if(len<1e-6)return;
  const u=[dir[0]/len,dir[1]/len,dir[2]/len],k=8;
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-u[0]*k,-u[1]*k,-u[2]*k),new THREE.Vector3(u[0]*k,u[1]*k,u[2]*k)]);
  host.content.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:true,opacity:.65})));
}
function addPlaneSpan(host,a,b,color){
  const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),k=6;
  const pts=[av.clone().multiplyScalar(-k).add(bv.clone().multiplyScalar(-k)),av.clone().multiplyScalar(k).add(bv.clone().multiplyScalar(-k)),
    av.clone().multiplyScalar(k).add(bv.clone().multiplyScalar(k)),av.clone().multiplyScalar(-k).add(bv.clone().multiplyScalar(k))];
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pts.flatMap(p=>[p.x,p.y,p.z])),3));
  geo.setIndex([0,1,2,0,2,3]);geo.computeVertexNormals();
  host.content.add(new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.16,side:THREE.DoubleSide})));
  host.content.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([...pts,pts[0]]),new THREE.LineBasicMaterial({color,transparent:true,opacity:.4})));
}
function addParallelepiped(host,a,b,c,color){
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),C=new THREE.Vector3(...c),O=new THREE.Vector3(0,0,0);
  // vertices: 0=O 1=v1 2=v2 3=v3 4=v1+v2 5=v1+v3 6=v2+v3 7=v1+v2+v3
  const P=[O,A,B,C,A.clone().add(B),A.clone().add(C),B.clone().add(C),A.clone().add(B).add(C)];
  // 6 planar quad faces (each a pair of vectors' parallelogram, near and far copy), consistently wound
  const idx=[
    0,1,4, 0,4,2,   // face v1,v2 through O
    3,7,5, 3,6,7,   // opposite face, offset by v3
    0,5,1, 0,3,5,   // face v1,v3 through O
    2,4,7, 2,7,6,   // opposite face, offset by v2
    0,2,3, 2,6,3,   // face v2,v3 through O
    1,7,4, 1,5,7    // opposite face, offset by v1
  ];
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(P.flatMap(p=>[p.x,p.y,p.z])),3));
  geo.setIndex(idx);geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,transparent:true,opacity:.22,side:THREE.DoubleSide,roughness:1,metalness:0,depthWrite:false}));
  host.content.add(mesh);
  host.content.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color,transparent:true,opacity:.7})));
}
