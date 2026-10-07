(function(){
  const $=s=>document.querySelector(s);

  /* ---- shared rendering helpers (unchanged from Phase 2/3, taking their
     target elements as parameters so all three panels can reuse them) ---- */
  function splitTopLevel(latex){
    const parts=[];let cur='',depth=0;
    for(let i=0;i<latex.length;i++){
      const c=latex[i];
      if(c==='{'||c==='(')depth++;
      if(c==='}'||c===')')depth--;
      if(depth===0&&c===' '&&(latex[i+1]==='+'||latex[i+1]==='-'||latex[i+1]==='=')&&latex[i+2]===' '){
        if(cur.trim())parts.push(cur.trim());
        cur=latex[i+1]+' ';i+=2;continue;
      }
      cur+=c;
    }
    if(cur.trim())parts.push(cur.trim());
    return parts.length?parts:[latex];
  }
  function exprHtml(latex){
    if(!latex)return '';
    const spans=splitTopLevel(latex).map(part=>{
      if(window.katex){
        try{
          const mathml=katex.renderToString(part,{output:'mathml',displayMode:false,throwOnError:false})
            .replace(/<annotation[\s\S]*?<\/annotation>/,'');
          return `<span class="sm-term">${mathml}</span>`;
        }catch(e){/* fall through to plain text for just this piece */}
      }
      return `<span class="sm-term sm-expr-err">${part}</span>`;
    });
    return `<div class="sm-expr">${spans.join('')}</div>`;
  }
  function katexInline(latex){
    if(!window.katex)return `<span class="sm-term sm-expr-err">${latex}</span>`;
    try{
      const mathml=katex.renderToString(latex,{output:'mathml',displayMode:false,throwOnError:false})
        .replace(/<annotation[\s\S]*?<\/annotation>/,'');
      return `<span class="sm-term">${mathml}</span>`;
    }catch(e){return `<span class="sm-term sm-expr-err">${latex}</span>`;}
  }
  function stepKindClass(title){
    if(title.includes('Multiply'))return ' sm-step-multiply';
    if(title.includes('Subtract')||title.includes('Add'))return ' sm-step-subtract';
    if(title.includes('Selected pivot')||title.includes('No pivot'))return ' sm-step-pivot';
    if(title==='Row operation')return ' sm-step-swap';
    if(title.includes('inconsistent')||title.includes('No solution'))return ' sm-step-inconsistent';
    return '';
  }
  function renderSteps(steps,isError,outputEl){
    outputEl.innerHTML=steps.map(s=>`
      <div class="sm-step${isError?' sm-step-err':stepKindClass(s.title)}">
        <h3>${s.title}</h3>
        <p>${s.explanation}</p>
        ${exprHtml(s.expression)}
      </div>`).join('');
  }
  function renderResult(result,resultEl){
    if(!result){resultEl.innerHTML='';resultEl.className='';return;}
    const {quotient,remainder}=result;
    resultEl.innerHTML=`
      <div class="sm-rgroup"><span class="sm-rlabel">Quotient</span>${exprHtml(quotient.toLatex())}</div>
      <div class="sm-rgroup"><span class="sm-rlabel">Remainder</span>${exprHtml(remainder.toLatex())}</div>`;
    resultEl.className='sm-result';
  }
  function renderResultPFD(result,resultEl){
    if(!result){resultEl.innerHTML='';resultEl.className='';return;}
    const groups=[];
    if(!result.quotient.isZero())groups.push(`<div class="sm-rgroup"><span class="sm-rlabel">Quotient</span>${exprHtml(result.quotient.toLatex())}</div>`);
    groups.push(`<div class="sm-rgroup"><span class="sm-rlabel">Decomposition</span>${exprHtml(result.fullLatex)}</div>`);
    resultEl.innerHTML=groups.join('');
    resultEl.className='sm-result';
  }
  function renderResultGauss(result,resultEl){
    if(!result){resultEl.innerHTML='';resultEl.className='';return;}
    const {solutionType,names,values,exprs,freeNames,rank,numVars}=result;
    let inner='';
    if(solutionType==='none'){
      inner=`<div class="sm-rgroup"><span class="sm-rlabel">Result</span>${exprHtml('\\text{No solution}')}</div>`;
    }else if(solutionType==='unique'){
      inner=`<div class="sm-rgroup"><span class="sm-rlabel">Unique solution</span></div>
        <div class="sm-gauss-solset">${names.map((nm,i)=>exprHtml(`${nm} = ${values[i].toLatex()}`)).join('')}</div>`;
    }else{
      inner=`<div class="sm-rgroup"><span class="sm-rlabel">Infinitely many solutions</span><span style="color:var(--dim);font-size:12px">rank ${rank} of ${numVars} variables</span></div>
        <div class="sm-gauss-solset">${names.map((nm,i)=>exprHtml(`${nm} = ${StepMath.leToLatex(exprs[i],freeNames)}`)).join('')}</div>`;
    }
    resultEl.innerHTML=inner;
    resultEl.className='sm-result';
  }

  /* ---- Math input box: unchanged from Phase 2/3, reused as-is for all
     three panels. ---- */
  function boxToRaw(el){
    let out='';
    el.childNodes.forEach(n=>{
      if(n.nodeType===3)out+=n.textContent;
      else if(n.classList&&n.classList.contains('sm-pow'))out+='^'+n.textContent;
      else out+=n.textContent||'';
    });
    return out.replace(/\u200B/g,'');
  }
  function rawToBoxHtml(raw){
    const esc=raw.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return esc.replace(/\^(-?\d+)/g,(_,p)=>`<sup class="sm-pow">${p}</sup>`);
  }
  function supAncestor(node,root){
    while(node&&node!==root){
      if(node.nodeType===1&&node.classList&&node.classList.contains('sm-pow'))return node;
      node=node.parentNode;
    }
    return null;
  }
  function wireMathBox(box){
    box.innerHTML=rawToBoxHtml(boxToRaw(box)||box.textContent||'');
    box.addEventListener('keydown',e=>{
      const sel=window.getSelection();
      if(!sel.rangeCount)return;
      const range=sel.getRangeAt(0),sup=supAncestor(range.startContainer,box);
      if(e.key==='^'&&!sup){
        e.preventDefault();
        range.deleteContents();
        const supEl=document.createElement('sup');supEl.className='sm-pow';
        range.insertNode(supEl);
        const r2=document.createRange();r2.selectNodeContents(supEl);r2.collapse(true);
        sel.removeAllRanges();sel.addRange(r2);
        return;
      }
      if(sup){
        if(e.key==='Backspace'&&sup.textContent===''){
          e.preventDefault();
          const r2=document.createRange();r2.setStartBefore(sup);r2.collapse(true);
          sup.remove();sel.removeAllRanges();sel.addRange(r2);
          return;
        }
        const exit=[' ','+','-','Enter','ArrowRight'];
        if(exit.includes(e.key)){
          e.preventDefault();
          const atEnd=e.key!=='ArrowRight'||range.startOffset>=(range.startContainer.textContent||'').length;
          if(e.key==='ArrowRight'&&!atEnd)return;
          const r2=document.createRange();r2.setStartAfter(sup);r2.collapse(true);
          if(e.key===' '||e.key==='+'||e.key==='-'){
            const tn=document.createTextNode(e.key);r2.insertNode(tn);r2.setStartAfter(tn);
          }
          sel.removeAllRanges();sel.addRange(r2);
          return;
        }
        if(e.key.length===1&&!/^[0-9-]$/.test(e.key)){e.preventDefault();}
      }
    });
  }

  /* ---- sub-tabs: Long division / Synthetic division / Partial fractions ---- */
  $('#sm-subtabs').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-sm]');
    if(!btn)return;
    const which=btn.dataset.sm;
    $('#sm-subtabs').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));
    $('#sm-panel-long').hidden=which!=='long';
    $('#sm-panel-synthetic').hidden=which!=='synthetic';
    $('#sm-panel-pfd').hidden=which!=='pfd';
  });

  /* ---- Panel 1: Long division (unchanged behavior from Phase 2/3) ---- */
  function solveLong(){
    const variable=$('#sm-var').value.trim()||'x';
    const dividendStr=boxToRaw($('#sm-dividend'));
    const divisorStr=boxToRaw($('#sm-divisor'));
    const status=$('#sm-status');
    if(!dividendStr.trim()||!divisorStr.trim()){
      status.textContent='Enter both a dividend and a divisor.';status.className='sm-status err';
      renderResult(null,$('#sm-result'));$('#sm-output').innerHTML='';return;
    }
    const r=StepMath.longDivide(dividendStr,divisorStr,variable);
    if(r.success){
      status.textContent=`Divided in ${r.steps.length} steps. Degree of quotient: ${r.result.quotient.isZero()?'\u2014':r.result.quotient.degree}.`;
      status.className='sm-status ok';
      renderResult(r.result,$('#sm-result'));
      renderSteps(r.steps,false,$('#sm-output'));
    }else{
      status.textContent='Could not divide: '+r.error.message;
      status.className='sm-status err';
      renderResult(null,$('#sm-result'));
      renderSteps(r.steps,true,$('#sm-output'));
    }
  }
  $('#sm-run').addEventListener('click',solveLong);
  $('#sm-clear').addEventListener('click',()=>{
    $('#sm-dividend').innerHTML='';$('#sm-divisor').innerHTML='';
    $('#sm-status').textContent='';$('#sm-status').className='sm-status';
    renderResult(null,$('#sm-result'));$('#sm-output').innerHTML='';
    $('#sm-dividend').focus();
  });
  wireMathBox($('#sm-dividend'));$('#sm-dividend').innerHTML=rawToBoxHtml('x^3 + 2x^2 - 5x + 6');
  wireMathBox($('#sm-divisor'));$('#sm-divisor').innerHTML=rawToBoxHtml('x - 2');

  /* ---- Panel 2: Synthetic division (unchanged behavior from Phase 3) ---- */
  function renderSynTable(table,variable){
    const el=$('#sm2-table');
    if(!table){el.innerHTML='';return;}
    const {coeffs,results,root}=table;
    const n=coeffs.length;
    const coefRow=coeffs.map(c=>`<td>${katexInline(c.toLatex())}</td>`).join('');
    const prodRow=['<td class="sm-syn-blank">\u2014</td>'];
    for(let i=1;i<n;i++)prodRow.push(`<td>${katexInline(results[i-1].mul(root).toLatex())}</td>`);
    const sumRow=results.map((r,i)=>`<td${i===n-1?' class="sm-syn-remainder"':''}>${katexInline(r.toLatex())}</td>`).join('');
    el.innerHTML=`
      <div class="sm-syn-wrap">
        <div class="sm-syn-root">Synthetic value &nbsp;${katexInline(`${variable} = ${root.toLatex()}`)}</div>
        <div class="sm-syn-tablewrap">
          <table class="sm-syn-table">
            <tbody>
              <tr class="sm-syn-coef">${coefRow}</tr>
              <tr class="sm-syn-prod">${prodRow.join('')}</tr>
              <tr class="sm-syn-sum">${sumRow}</tr>
            </tbody>
          </table>
        </div>
      </div>`;
  }
  function solveSynthetic(){
    const variable=$('#sm2-var').value.trim()||'x';
    const dividendStr=boxToRaw($('#sm2-dividend'));
    const divisorStr=boxToRaw($('#sm2-divisor'));
    const status=$('#sm2-status');
    if(!dividendStr.trim()||!divisorStr.trim()){
      status.textContent='Enter both a dividend and a divisor.';status.className='sm-status err';
      renderResult(null,$('#sm2-result'));$('#sm2-output').innerHTML='';renderSynTable(null);return;
    }
    const r=StepMath.syntheticDivide(dividendStr,divisorStr,variable);
    if(r.success){
      status.textContent=`Divided in ${r.steps.length} steps. Degree of quotient: ${r.result.quotient.isZero()?'\u2014':r.result.quotient.degree}.`;
      status.className='sm-status ok';
      renderResult(r.result,$('#sm2-result'));
      renderSynTable(r.result.table,variable);
      renderSteps(r.steps,false,$('#sm2-output'));
    }else{
      status.textContent='Could not divide: '+r.error.message;
      status.className='sm-status err';
      renderResult(null,$('#sm2-result'));
      renderSynTable(null);
      renderSteps(r.steps,true,$('#sm2-output'));
    }
  }
  $('#sm2-run').addEventListener('click',solveSynthetic);
  $('#sm2-clear').addEventListener('click',()=>{
    $('#sm2-dividend').innerHTML='';$('#sm2-divisor').innerHTML='';
    $('#sm2-status').textContent='';$('#sm2-status').className='sm-status';
    renderResult(null,$('#sm2-result'));$('#sm2-output').innerHTML='';renderSynTable(null);
    $('#sm2-dividend').focus();
  });
  wireMathBox($('#sm2-dividend'));$('#sm2-dividend').innerHTML=rawToBoxHtml('x^3 + 2x^2 - 5x + 6');
  wireMathBox($('#sm2-divisor'));$('#sm2-divisor').innerHTML=rawToBoxHtml('x - 2');

  /* ---- Panel 3: Partial fraction decomposition ---- */
  function solvePFD(){
    const variable=$('#sm3-var').value.trim()||'x';
    const numStr=boxToRaw($('#sm3-num'));
    const denStr=boxToRaw($('#sm3-den'));
    const status=$('#sm3-status');
    if(!numStr.trim()||!denStr.trim()){
      status.textContent='Enter both a numerator and a factored denominator.';status.className='sm-status err';
      renderResultPFD(null,$('#sm3-result'));$('#sm3-output').innerHTML='';return;
    }
    const r=StepMath.partialFractionDecompose(numStr,denStr,variable);
    if(r.success){
      status.textContent=`Decomposed in ${r.steps.length} steps across ${r.result.factors.length} factor${r.result.factors.length===1?'':'s'}.`;
      status.className='sm-status ok';
      renderResultPFD(r.result,$('#sm3-result'));
      renderSteps(r.steps,false,$('#sm3-output'));
    }else{
      status.textContent='Could not decompose: '+r.error.message;
      status.className='sm-status err';
      renderResultPFD(null,$('#sm3-result'));
      renderSteps(r.steps,true,$('#sm3-output'));
    }
  }
  $('#sm3-run').addEventListener('click',solvePFD);
  $('#sm3-clear').addEventListener('click',()=>{
    $('#sm3-num').innerHTML='';$('#sm3-den').innerHTML='';
    $('#sm3-status').textContent='';$('#sm3-status').className='sm-status';
    renderResultPFD(null,$('#sm3-result'));$('#sm3-output').innerHTML='';
    $('#sm3-num').focus();
  });
  wireMathBox($('#sm3-num'));$('#sm3-num').innerHTML=rawToBoxHtml('3x + 5');
  wireMathBox($('#sm3-den'));$('#sm3-den').innerHTML=rawToBoxHtml('(x-1)(x+2)');

  /* ---- Panel 4: Gaussian elimination ---- */
  function gaussVarNames(cols){
    const raw=$('#sm4-varnames').value.trim();
    if(raw){
      const parts=raw.split(',').map(s=>s.trim()).filter(Boolean);
      if(parts.length===cols)return parts;
    }
    return Array.from({length:cols},(_,i)=>`x${i+1}`);
  }
  function buildGrid(){
    const rows=Math.max(1,Math.min(6,parseInt($('#sm4-rows').value,10)||3));
    const cols=Math.max(1,Math.min(6,parseInt($('#sm4-cols').value,10)||3));
    $('#sm4-rows').value=rows;$('#sm4-cols').value=cols;
    const old={};
    document.querySelectorAll('#sm4-grid input[data-r]').forEach(inp=>{old[`${inp.dataset.r}-${inp.dataset.c}`]=inp.value;});
    const names=gaussVarNames(cols);
    let html='<tr>'+names.map(nm=>`<td class="sm-mat-varname">${nm}</td>`).join('')+'<td class="sm-mat-varname sm-mat-aug">b</td></tr>';
    for(let r=0;r<rows;r++){
      html+='<tr>';
      for(let c=0;c<=cols;c++){
        const val=old[`${r}-${c}`]!==undefined?old[`${r}-${c}`]:'';
        html+=`<td${c===cols?' class="sm-mat-aug"':''}><input type="text" autocomplete="off" data-r="${r}" data-c="${c}" value="${val.replace(/"/g,'&quot;')}"></td>`;
      }
      html+='</tr>';
    }
    $('#sm4-grid').innerHTML=html;
  }
  function readGrid(){
    const rows=parseInt($('#sm4-rows').value,10)||3;
    const cols=parseInt($('#sm4-cols').value,10)||3;
    const grid=[];
    for(let r=0;r<rows;r++){
      const row=[];
      for(let c=0;c<=cols;c++){
        const inp=$(`#sm4-grid input[data-r="${r}"][data-c="${c}"]`);
        row.push(inp?inp.value.trim():'');
      }
      grid.push(row);
    }
    return {rows,cols,grid};
  }
  function solveGauss(){
    const {cols,grid}=readGrid();
    const status=$('#sm4-status');
    if(grid.some(row=>row.some(cell=>!cell))){
      status.textContent='Fill in every cell (use 0 for a missing term).';status.className='sm-status err';
      renderResultGauss(null,$('#sm4-result'));$('#sm4-output').innerHTML='';return;
    }
    const rawNames=$('#sm4-varnames').value.trim();
    let varNames=null;
    if(rawNames){
      const parts=rawNames.split(',').map(s=>s.trim()).filter(Boolean).map(s=>s.length>1?`\\text{${s}}`:s);
      if(parts.length===cols)varNames=parts;
    }
    const r=StepMath.gaussianEliminate(grid,cols,varNames);
    if(r.success){
      const st=r.result.solutionType;
      status.textContent = st==='unique' ? `Solved \u2014 unique solution (rank ${r.result.rank}).`
        : st==='infinite' ? `Solved \u2014 infinitely many solutions (rank ${r.result.rank} of ${cols} variables).`
        : 'Solved \u2014 the system is inconsistent (no solution).';
      status.className='sm-status ok';
      renderResultGauss(r.result,$('#sm4-result'));
      renderSteps(r.steps,false,$('#sm4-output'));
    }else{
      status.textContent='Could not solve: '+r.error.message;
      status.className='sm-status err';
      renderResultGauss(null,$('#sm4-result'));
      renderSteps(r.steps,true,$('#sm4-output'));
    }
  }
  $('#sm4-build').addEventListener('click',buildGrid);
  $('#sm4-run').addEventListener('click',solveGauss);
  $('#sm4-clear').addEventListener('click',()=>{
    document.querySelectorAll('#sm4-grid input').forEach(inp=>inp.value='');
    $('#sm4-status').textContent='';$('#sm4-status').className='sm-status';
    renderResultGauss(null,$('#sm4-result'));$('#sm4-output').innerHTML='';
  });
  $('#sm4-rows').addEventListener('change',buildGrid);
  $('#sm4-cols').addEventListener('change',buildGrid);
  $('#sm4-varnames').addEventListener('change',buildGrid);

  const gaussExamples=[
    {rows:3,cols:3,grid:[['0','2','1','1'],['1','1','1','6'],['2','1','1','9']]},   // zero pivot -> row swap
    {rows:3,cols:3,grid:[['1','1','1','6'],['2','2','2','12'],['1','-1','2','5']]}, // dependent rows -> free variable
    {rows:3,cols:3,grid:[['1','1','1','6'],['0','0','0','5'],['1','-1','2','5']]},  // inconsistent
    {rows:2,cols:2,grid:[['1/2','-3','4'],['-2','6','-8']]}                          // fractions, no unique solution
  ];
  let gaussExampleIdx=0;
  function loadGaussExample(ex){
    $('#sm4-rows').value=ex.rows;$('#sm4-cols').value=ex.cols;$('#sm4-varnames').value='';
    buildGrid();
    ex.grid.forEach((row,r)=>row.forEach((val,c)=>{
      const inp=$(`#sm4-grid input[data-r="${r}"][data-c="${c}"]`);if(inp)inp.value=val;
    }));
  }
  $('#sm4-example').addEventListener('click',()=>{
    loadGaussExample(gaussExamples[gaussExampleIdx%gaussExamples.length]);
    gaussExampleIdx++;
  });

  loadGaussExample(gaussExamples[0]);
  gaussExampleIdx=1;

  solveLong();
  solveSynthetic();
  solvePFD();
  solveGauss();
})();
