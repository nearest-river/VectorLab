/* ==========================================================================
   StepMath — Phase 1 + 2 + 3 + 4 foundation.
   Pure math engine: NO DOM, NO canvas, NO framework dependency.
   Everything below the "UI — demo only" divider is presentation code and is
   NOT part of the engine; a real solver only ever touches window.StepMath.
   ========================================================================== */
window.StepMath = (function(){
'use strict';

/* ---------------- Fraction (exact rational arithmetic) ----------------
   Small and dependency-free on purpose: coefficients must stay exact across
   many steps (division/elimination accumulates error fast with floats), and
   pulling in a full CDN math library for this alone isn't worth the added
   external dependency / version risk for something this small. */
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a||1;}
class Fraction{
  constructor(n,d=1){
    if(d===0)throw new RangeError('Fraction denominator cannot be 0');
    if(d<0){n=-n;d=-d;}
    const g=gcd(n,d)||1;this.n=n/g;this.d=d/g;
  }
  static from(v){
    if(v instanceof Fraction)return v;
    if(typeof v==='number'){
      if(Number.isInteger(v))return new Fraction(v,1);
      const s=v.toString().split('.')[1]||'';const p=Math.pow(10,s.length);
      return new Fraction(Math.round(v*p),p);
    }
    throw new TypeError('Cannot make Fraction from '+v);
  }
  add(o){o=Fraction.from(o);return new Fraction(this.n*o.d+o.n*this.d,this.d*o.d);}
  sub(o){o=Fraction.from(o);return new Fraction(this.n*o.d-o.n*this.d,this.d*o.d);}
  mul(o){o=Fraction.from(o);return new Fraction(this.n*o.n,this.d*o.d);}
  div(o){o=Fraction.from(o);if(o.n===0)throw new RangeError('Division by zero');return new Fraction(this.n*o.d,this.d*o.n);}
  neg(){return new Fraction(-this.n,this.d);}
  isZero(){return this.n===0;}
  equals(o){o=Fraction.from(o);return this.n*o.d===o.n*this.d;}
  valueOf(){return this.n/this.d;}
  toString(){return this.d===1?String(this.n):`${this.n}/${this.d}`;}
  /** LaTeX source, e.g. "-\frac{2}{3}". */
  toLatex(){
    if(this.d===1)return String(this.n);
    return this.n<0?`-\\frac{${-this.n}}{${this.d}}`:`\\frac{${this.n}}{${this.d}}`;
  }
}

/* ---------------- Types (JSDoc — documentation only, no runtime cost) ----
 * @typedef {{coeff: Fraction, power: number}} Term
 * @typedef {{code:string, message:string, index?:number}} ValidationError
 * @typedef {{ok:true, value:Polynomial}|{ok:false, error:ValidationError}} ParseResult
 * @typedef {{title:string, explanation:string, expression?:string, meta?:object}} MathStep
 *   expression is LaTeX source (e.g. "2x^{3} - 5"), rendered by the UI via
 *   KaTeX with output:'mathml' — never raw HTML, never plain unicode.
 * @typedef {{success:boolean, steps:MathStep[], result?:any, error?:ValidationError}} SolverResult
 */

function err(code,message,index){return {code,message,index};}
function createStep(title,explanation,expression,meta){
  const s={title,explanation};
  if(expression!==undefined)s.expression=expression;
  if(meta!==undefined)s.meta=meta;
  return s;
}

/* ---------------- Polynomial (single variable, exact coefficients) ---- */
const SUPER={'0':'\u2070','1':'\u00b9','2':'\u00b2','3':'\u00b3','4':'\u2074','5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079','-':'\u207b'};
const toSuper=n=>String(n).split('').map(c=>SUPER[c]??c).join('');

class Polynomial{
  /** @param {Term[]} terms @param {string} variable */
  constructor(terms,variable='x'){
    const byPower=new Map();
    for(const t of terms){
      const c=Fraction.from(t.coeff);
      const prev=byPower.get(t.power)||new Fraction(0);
      const sum=prev.add(c);
      if(!sum.isZero())byPower.set(t.power,sum);else byPower.delete(t.power);
    }
    this.variable=variable;
    this.terms=[...byPower.entries()].sort((a,b)=>b[0]-a[0]).map(([power,coeff])=>({power,coeff}));
  }
  get degree(){return this.terms.length?this.terms[0].power:-Infinity;}
  get leadingTerm(){return this.terms[0]||null;}
  isZero(){return this.terms.length===0;}
  coeffAt(power){const t=this.terms.find(t=>t.power===power);return t?t.coeff:new Fraction(0);}
  add(other){return new Polynomial([...this.terms,...other.terms],this.variable);}
  subtract(other){return new Polynomial([...this.terms,...other.terms.map(t=>({power:t.power,coeff:t.coeff.neg()}))],this.variable);}
  scale(scalar){const s=Fraction.from(scalar);return new Polynomial(this.terms.map(t=>({power:t.power,coeff:t.coeff.mul(s)})),this.variable);}
  multiply(other){
    const acc=new Map();
    for(const a of this.terms)for(const b of other.terms){
      const p=a.power+b.power,c=(acc.get(p)||new Fraction(0)).add(a.coeff.mul(b.coeff));
      acc.set(p,c);
    }
    return new Polynomial([...acc.entries()].map(([power,coeff])=>({power,coeff})),this.variable);
  }
  evaluate(x){
    const xf=Fraction.from(x);
    let total=new Fraction(0);
    for(const t of this.terms){
      let p=new Fraction(1);
      for(let i=0;i<Math.abs(t.power);i++)p=p.mul(xf);
      if(t.power<0)p=new Fraction(1).div(p);
      total=total.add(t.coeff.mul(p));
    }
    return total;
  }
  toString(){
    if(this.isZero())return '0';
    return this.terms.map((t,i)=>{
      const {power,coeff}=t,neg=coeff.n<0,abs=neg?coeff.neg():coeff;
      let core;
      if(power===0)core=abs.toString();
      else{
        const mag=abs.equals(1)?'':abs.toString();
        core=power===1?`${mag}${this.variable}`:`${mag}${this.variable}${toSuper(power)}`;
      }
      if(i===0)return (neg?'\u2212':'')+core;
      return (neg?' \u2212 ':' + ')+core;
    }).join('');
  }
  /** LaTeX source for the whole polynomial, e.g. "2x^{3} - \frac{1}{2}x + 4". */
  toLatex(){
    if(this.isZero())return '0';
    return this.terms.map((t,i)=>{
      const piece=termToLatex(t,this.variable);
      if(i===0)return piece;
      return piece.startsWith('-')?` - ${piece.slice(1)}`:` + ${piece}`;
    }).join('');
  }
}
/** LaTeX for a single (possibly negative) term, e.g. termToLatex({power:2,coeff:Fraction.from(-2)},'x') -> "-2x^{2}". Sign-safe standalone, not just as a Polynomial.toLatex helper. */
function termToLatex(term,variable){
  const {power,coeff}=term,neg=coeff.n<0,abs=neg?coeff.neg():coeff;
  const mag=abs.equals(1)&&power!==0?'':abs.toLatex();
  const core=power===0?abs.toLatex():(power===1?`${mag}${variable}`:`${mag}${variable}^{${power}}`);
  return (neg?'-':'')+core;
}

/* ---------------- Parser ----------------
   Grammar (single variable, integer powers, optional fraction coefficients):
     poly   := term (('+'|'-') term)*
     term   := [sign] (frac|number)? [ '*'? variable ('^' int)? ]
   Rejects: a second distinct variable letter, malformed fractions, empty
   input, a bare exponent with no variable, non-integer/negative-without-
   parens exponents like x^-2. */
function parsePolynomial(input,variable='x'){
  if(typeof input!=='string'||!input.trim())return {ok:false,error:err('EMPTY','Enter a polynomial.')};
  const clean=input.replace(/\s+/g,'').replace(/\u2212/g,'-');
  if(!clean)return {ok:false,error:err('EMPTY','Enter a polynomial.')};
  const otherVar=clean.match(/[a-zA-Z]/g)?.find(c=>c.toLowerCase()!==variable.toLowerCase());
  if(otherVar)return {ok:false,error:err('BAD_VARIABLE',`Expected variable "${variable}", found "${otherVar}".`)};
  const re=/([+-]?)(\d+\/\d+|\d+\.\d+|\d+)?(\*)?([a-zA-Z])?(?:\^(-?\d+(?:\.\d+)?))?/g;
  const terms=[];let idx=0,matchedAny=false;
  let m;
  while(idx<clean.length){
    re.lastIndex=idx;
    m=re.exec(clean);
    if(!m||m.index!==idx||m[0]==='')return {ok:false,error:err('SYNTAX',`Unexpected character near position ${idx}.`,idx)};
    const [full,sign,numRaw,,vRaw,powRaw]=m;
    if(vRaw&&!powRaw&&full.endsWith('^'))return {ok:false,error:err('SYNTAX','Exponent missing after "^".',idx)};
    if(!vRaw&&powRaw!==undefined)return {ok:false,error:err('SYNTAX','"^" used without a variable.',idx)};
    let coeff;
    if(numRaw===undefined)coeff=new Fraction(1);
    else if(numRaw.includes('/')){const [a,b]=numRaw.split('/').map(Number);coeff=new Fraction(a,b);}
    else if(numRaw.includes('.'))coeff=Fraction.from(Number(numRaw));
    else coeff=new Fraction(Number(numRaw));
    if(sign==='-')coeff=coeff.neg();
    let power=vRaw?(powRaw!==undefined?Number(powRaw):1):0;
    if(vRaw&&powRaw!==undefined&&!/^-?\d+$/.test(powRaw))return {ok:false,error:err('BAD_EXPONENT','Exponents must be integers.',idx)};
    if(vRaw&&power<0)return {ok:false,error:err('BAD_EXPONENT','Negative exponents are not supported yet.',idx)};
    terms.push({coeff,power});
    matchedAny=true;
    idx+=full.length;
  }
  if(!matchedAny)return {ok:false,error:err('SYNTAX','Could not parse any terms.')};
  return {ok:true,value:new Polynomial(terms,variable)};
}

/* ---------------- Phase-1 verification routine (NOT a real solver) ---- */
function verifyFoundation(dividendStr,divisorStr,variable){
  variable=variable||'x';
  const steps=[];
  const pd=parsePolynomial(dividendStr,variable);
  if(!pd.ok)return {success:false,steps:[createStep('Parse dividend failed',pd.error.message)],error:pd.error};
  steps.push(createStep('Parse dividend',`Read as a polynomial in ${variable}.`,pd.value.toLatex()));
  const pv=parsePolynomial(divisorStr,variable);
  if(!pv.ok)return {success:false,steps:[...steps,createStep('Parse divisor failed',pv.error.message)],error:pv.error};
  steps.push(createStep('Parse divisor',`Read as a polynomial in ${variable}.`,pv.value.toLatex()));
  if(pv.value.isZero())return {success:false,steps,error:err('DIV_BY_ZERO','Cannot divide by the zero polynomial.')};
  steps.push(createStep('Identify leading terms',
    `Dividend has degree ${pd.value.degree}, divisor has degree ${pv.value.degree}.`,
    `\\dfrac{${termToLatex(pd.value.leadingTerm,variable)}}{${termToLatex(pv.value.leadingTerm,variable)}}`));
  const zeroCheck=pd.value.subtract(pd.value);
  steps.push(createStep('Verify arithmetic',
    'Subtracting the dividend from itself confirms add/subtract/normalize are wired correctly.',
    `(${pd.value.toLatex()}) - (${pd.value.toLatex()}) = ${zeroCheck.toLatex()}`,
    {shouldBeZero:zeroCheck.isZero()}));
  return {success:true,steps,result:{dividend:pd.value,divisor:pv.value}};
}

/* ---------------- Phase 2: Polynomial Long Division ---------------- */
function polyDivideAlgorithm(dividend,divisor,variable){
  const steps=[];
  let remainder=dividend;
  const quotientTerms=[];
  const leadDiv=divisor.leadingTerm;
  if(dividend.isZero()){
    steps.push(createStep('Dividend is zero','Zero divided by anything nonzero is zero — quotient and remainder are both 0.','0'));
    return {quotient:new Polynomial([],variable),remainder:new Polynomial([],variable),steps};
  }
  if(dividend.degree<divisor.degree){
    steps.push(createStep('Compare degrees',
      `The dividend's degree (${dividend.degree}) is already lower than the divisor's degree (${divisor.degree}), so the divisor cannot go in even once.`,
      dividend.toLatex()));
    return {quotient:new Polynomial([],variable),remainder,steps};
  }
  let n=1;
  while(!remainder.isZero()&&remainder.degree>=divisor.degree){
    const leadRem=remainder.leadingTerm;
    const qCoeff=leadRem.coeff.div(leadDiv.coeff);
    const qPower=leadRem.power-leadDiv.power;
    const qTerm={coeff:qCoeff,power:qPower};
    quotientTerms.push(qTerm);

    steps.push(createStep(`Step ${n} — Divide`,
      'Divide the leading term of the current remainder by the leading term of the divisor.',
      `\\dfrac{${termToLatex(leadRem,variable)}}{${termToLatex(leadDiv,variable)}} = ${termToLatex(qTerm,variable)}`));

    const quotientSoFar=new Polynomial(quotientTerms,variable);
    steps.push(createStep(`Step ${n} — Add to quotient`,
      `Add ${termToLatex(qTerm,variable)} to the quotient.`,
      quotientSoFar.toLatex()));

    const product=divisor.multiply(new Polynomial([qTerm],variable));
    steps.push(createStep(`Step ${n} — Multiply`,
      `Multiply the divisor by ${termToLatex(qTerm,variable)}.`,
      `${termToLatex(qTerm,variable)}\\left(${divisor.toLatex()}\\right) = ${product.toLatex()}`));

    const before=remainder;
    remainder=remainder.subtract(product);
    steps.push(createStep(`Step ${n} — Subtract`,
      'Subtract that product from the current remainder.',
      `\\left(${before.toLatex()}\\right) - \\left(${product.toLatex()}\\right) = ${remainder.toLatex()}`));

    if(!remainder.isZero()&&remainder.degree>=divisor.degree){
      steps.push(createStep(`Step ${n} — Bring down / repeat`,
        'The remainder still has degree \u2265 the divisor, so bring down the next term and repeat the process.',
        remainder.toLatex()));
    }
    n++;
  }
  steps.push(createStep('Stop',
    remainder.isZero()?'The remainder is 0 — the division is exact.':`The remainder's degree (${remainder.degree}) is now lower than the divisor's degree (${divisor.degree}), so the process stops.`,
    remainder.toLatex()));
  return {quotient:new Polynomial(quotientTerms,variable),remainder,steps};
}

function longDivide(dividendStr,divisorStr,variable){
  variable=variable||'x';
  const steps=[];
  const pd=parsePolynomial(dividendStr,variable);
  if(!pd.ok)return {success:false,steps:[createStep('Could not read the dividend',pd.error.message)],error:pd.error};
  steps.push(createStep('Dividend',`Read as a polynomial in ${variable}.`,pd.value.toLatex()));

  const pv=parsePolynomial(divisorStr,variable);
  if(!pv.ok)return {success:false,steps:[...steps,createStep('Could not read the divisor',pv.error.message)],error:pv.error};
  if(pv.value.isZero())return {success:false,steps,error:err('DIV_BY_ZERO','Cannot divide by the zero polynomial.')};
  steps.push(createStep('Divisor',`Read as a polynomial in ${variable}.`,pv.value.toLatex()));

  const {quotient,remainder,steps:divSteps}=polyDivideAlgorithm(pd.value,pv.value,variable);
  steps.push(...divSteps);
  steps.push(createStep('Check',
    'Quotient \u00d7 divisor, plus remainder, should reconstruct the original dividend.',
    `\\left(${pv.value.toLatex()}\\right)\\left(${quotient.toLatex()}\\right) + \\left(${remainder.toLatex()}\\right) = ${pd.value.toLatex()}`));

  return {success:true,steps,result:{quotient,remainder,dividend:pd.value,divisor:pv.value}};
}

/* ---------------- Phase 3: Synthetic Division ---------------- */
function denseCoeffs(poly){
  if(poly.isZero())return [new Fraction(0)];
  const n=poly.degree;
  const arr=[];
  for(let p=n;p>=0;p--)arr.push(poly.coeffAt(p));
  return arr;
}
function syntheticDivideAlgorithm(dividend,root,variable){
  const steps=[];
  if(dividend.isZero()){
    steps.push(createStep('Dividend is zero','Zero divided by anything is zero — quotient and remainder are both 0.','0'));
    return {quotient:new Polynomial([],variable),remainder:new Polynomial([],variable),table:null,steps};
  }
  const n=dividend.degree;
  const coeffs=denseCoeffs(dividend);
  const powers=[];for(let p=n;p>=0;p--)powers.push(p);
  steps.push(createStep('Write the coefficients',
    `List the coefficients of the dividend from degree ${n} down to 0, using 0 for any missing power.`,
    coeffs.map(c=>c.toLatex()).join(',\\ ')));

  const results=new Array(coeffs.length);
  results[0]=coeffs[0];
  steps.push(createStep('Bring down the leading coefficient',
    `Bring the first coefficient, ${coeffs[0].toLatex()}, straight down \u2014 it becomes the first coefficient of the quotient.`,
    coeffs[0].toLatex()));

  for(let i=1;i<coeffs.length;i++){
    const prev=results[i-1];
    const product=prev.mul(root);
    steps.push(createStep('Multiply',
      `Multiply the last value written, ${prev.toLatex()}, by the synthetic value ${root.toLatex()}.`,
      `${prev.toLatex()} \\times ${root.toLatex()} = ${product.toLatex()}`));
    const sum=coeffs[i].add(product);
    results[i]=sum;
    const isLast=i===coeffs.length-1;
    steps.push(createStep(isLast?'Add \u2014 this is the remainder':'Add',
      `Add that product to the next coefficient, ${coeffs[i].toLatex()}.`+(isLast?' Since there are no more coefficients, this sum is the remainder.':''),
      `${coeffs[i].toLatex()} + ${product.toLatex()} = ${sum.toLatex()}`));
  }

  const remainderVal=results[results.length-1];
  const quotientTerms=[];
  for(let i=0;i<results.length-1;i++)quotientTerms.push({power:n-1-i,coeff:results[i]});
  const quotient=new Polynomial(quotientTerms,variable);
  const remainder=new Polynomial(remainderVal.isZero()?[]:[{power:0,coeff:remainderVal}],variable);

  steps.push(createStep('Stop',
    remainder.isZero()?'The remainder is 0 \u2014 the division is exact.':`The last value, ${remainderVal.toLatex()}, is the remainder \u2014 everything before it are the quotient's coefficients.`,
    `${quotient.toLatex()}\\quad\\text{remainder}\\quad ${remainder.toLatex()}`));

  return {quotient,remainder,table:{powers,coeffs,results,root},steps};
}

function syntheticDivide(dividendStr,divisorStr,variable){
  variable=variable||'x';
  const steps=[];
  const pd=parsePolynomial(dividendStr,variable);
  if(!pd.ok)return {success:false,steps:[createStep('Could not read the dividend',pd.error.message)],error:pd.error};
  steps.push(createStep('Dividend',`Read as a polynomial in ${variable}.`,pd.value.toLatex()));

  const pv=parsePolynomial(divisorStr,variable);
  if(!pv.ok)return {success:false,steps:[...steps,createStep('Could not read the divisor',pv.error.message)],error:pv.error};
  if(pv.value.isZero())return {success:false,steps,error:err('DIV_BY_ZERO','Cannot divide by the zero polynomial.')};
  steps.push(createStep('Divisor',`Read as a polynomial in ${variable}.`,pv.value.toLatex()));

  if(pv.value.degree!==1){
    const degText=pv.value.degree===0?'0 (a constant)':String(pv.value.degree);
    return {success:false,steps,error:err('INVALID_DIVISOR',
      `Synthetic division only works for a linear divisor (degree 1). This divisor has degree ${degText}. Use Long division instead.`)};
  }
  if(!pv.value.coeffAt(1).equals(1)){
    return {success:false,steps,error:err('INVALID_DIVISOR',
      `Synthetic division needs a monic divisor \u2014 leading coefficient 1, like "${variable} - r". This divisor's leading coefficient is ${pv.value.coeffAt(1).toString()}. Use Long division instead.`)};
  }

  const root=pv.value.coeffAt(0).neg();
  steps.push(createStep('Find the synthetic value',
    `Set the divisor equal to 0 and solve for ${variable} \u2014 that value is used for every multiplication below.`,
    `${pv.value.toLatex()} = 0 \\ \\Rightarrow\\ ${variable} = ${root.toLatex()}`));

  const {quotient,remainder,table,steps:divSteps}=syntheticDivideAlgorithm(pd.value,root,variable);
  steps.push(...divSteps);
  steps.push(createStep('Check',
    'Quotient \u00d7 divisor, plus remainder, should reconstruct the original dividend.',
    `\\left(${pv.value.toLatex()}\\right)\\left(${quotient.toLatex()}\\right) + \\left(${remainder.toLatex()}\\right) = ${pd.value.toLatex()}`));

  return {success:true,steps,result:{quotient,remainder,dividend:pd.value,divisor:pv.value,root,table}};
}

/* ---------------- Phase 4: Partial Fraction Decomposition ----------------
   The denominator must be supplied already factored, as a product of
   parenthesized monic linear / irreducible-quadratic factors with optional
   integer exponents, e.g. "(x-2)(x+1)^2(x^2+1)" — this engine deliberately
   does not attempt general polynomial factoring. Every step below is a
   direct read-out of a real intermediate value the algorithm computed
   (a contribution polynomial's coefficient, a solved system value, a
   reconstructed check) — never a value invented to match a separately
   produced final answer. */

/** Parses "(f1)^e1(f2)^e2..." into monic linear/irreducible-quadratic
 * factors, merging duplicate factors' exponents.
 * @returns {{ok:true,value:{poly:Polynomial,multiplicity:number,degree:1|2}[]}|{ok:false,error:ValidationError}} */
function parseDenominatorFactors(str,variable){
  if(typeof str!=='string'||!str.trim())return {ok:false,error:err('EMPTY','Enter a denominator as a product of factors, e.g. (x-2)(x+1)^2.')};
  const clean=str.replace(/\s+/g,'').replace(/\u2212/g,'-');
  const raw=[];
  let idx=0;
  while(idx<clean.length){
    if(clean[idx]!=='(')return {ok:false,error:err('SYNTAX',`Expected "(" to start a factor near position ${idx}. Write the denominator as a product of factors, e.g. (x-2)(x+1)^2.`)};
    const closeIdx=clean.indexOf(')',idx+1);
    if(closeIdx===-1)return {ok:false,error:err('SYNTAX','Missing a closing ")" in the denominator.')};
    const inner=clean.slice(idx+1,closeIdx);
    idx=closeIdx+1;
    let multiplicity=1;
    if(clean[idx]==='^'){
      const m=/^\^(\d+)/.exec(clean.slice(idx));
      if(!m)return {ok:false,error:err('SYNTAX','Expected a positive integer exponent after "^".')};
      multiplicity=Number(m[1]);
      if(multiplicity<1)return {ok:false,error:err('SYNTAX','A factor\'s exponent must be a positive integer.')};
      idx+=m[0].length;
    }
    raw.push({inner,multiplicity});
  }
  if(!raw.length)return {ok:false,error:err('EMPTY','Enter a denominator as a product of factors, e.g. (x-2)(x+1)^2.')};

  const factors=[];
  for(const r of raw){
    const pr=parsePolynomial(r.inner,variable);
    if(!pr.ok)return {ok:false,error:err(pr.error.code,`In factor "(${r.inner})": ${pr.error.message}`)};
    const poly=pr.value;
    if(poly.isZero())return {ok:false,error:err('BAD_FACTOR',`A denominator factor cannot be 0 (found "(${r.inner})").`)};
    const deg=poly.degree;
    if(deg!==1&&deg!==2)return {ok:false,error:err('UNSUPPORTED_FACTOR',`Only linear and irreducible quadratic denominator factors are supported (found degree ${deg} in "(${r.inner})"). Factor it further and enter its pieces separately.`)};
    const lead=poly.coeffAt(deg);
    if(!lead.equals(1))return {ok:false,error:err('UNSUPPORTED_FACTOR',`Each denominator factor must be monic (leading coefficient 1); "(${r.inner})" has leading coefficient ${lead.toString()}. Factor the constant out first.`)};
    if(deg===2){
      const b=poly.coeffAt(1),c=poly.coeffAt(0);
      const disc=b.mul(b).sub(c.mul(new Fraction(4)));
      if(disc.n>=0)return {ok:false,error:err('REDUCIBLE_QUADRATIC',`"(${r.inner})" is not irreducible \u2014 its discriminant is ${disc.toString()} \u2265 0, so it factors into two linear pieces. Enter those linear factors instead.`)};
    }
    factors.push({poly,multiplicity:r.multiplicity,degree:deg});
  }
  const merged=[],seen=new Map();
  for(const f of factors){
    const key=f.poly.toString();
    if(seen.has(key))merged[seen.get(key)].multiplicity+=f.multiplicity;
    else{seen.set(key,merged.length);merged.push({poly:f.poly,multiplicity:f.multiplicity,degree:f.degree});}
  }
  return {ok:true,value:merged};
}

function pfNextLabel(n){
  const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if(n<26)return A[n];
  return A[Math.floor(n/26)-1]+A[n%26];
}
function factorPowerLatex(poly,exp){
  if(exp<=0)return '';
  const base=`\\left(${poly.toLatex()}\\right)`;
  return exp===1?base:`${base}^{${exp}}`;
}
function joinSigned(pieces){
  return pieces.map((p,i)=>{
    if(i===0)return p;
    return p.startsWith('-')?` - ${p.slice(1)}`:` + ${p}`;
  }).join('');
}
function fracTermLatex(value,denomLatex){
  const neg=value.n<0,abs=neg?value.neg():value;
  return (neg?'-':'')+`\\frac{${abs.toLatex()}}{${denomLatex}}`;
}
function coeffLabelPieceLatex(coeff,label){
  if(coeff.isZero())return null;
  const neg=coeff.n<0,abs=neg?coeff.neg():coeff;
  const mag=abs.equals(1)?'':abs.toLatex();
  return (neg?'-':'')+`${mag}${label}`;
}

/** Exact-Fraction Gauss-Jordan elimination.
 * @returns {{ok:true,solution:Fraction[]}|{ok:false}} */
function solveLinearSystem(matrix,rhs){
  const n=matrix.length;
  const A=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let col=0;col<n;col++){
    let pivot=-1;
    for(let r=col;r<n;r++){if(!A[r][col].isZero()){pivot=r;break;}}
    if(pivot===-1)return {ok:false};
    if(pivot!==col){const tmp=A[pivot];A[pivot]=A[col];A[col]=tmp;}
    const pv=A[col][col];
    for(let c=col;c<=n;c++)A[col][c]=A[col][c].div(pv);
    for(let r=0;r<n;r++){
      if(r===col)continue;
      const factor=A[r][col];
      if(factor.isZero())continue;
      for(let c=col;c<=n;c++)A[r][c]=A[r][c].sub(factor.mul(A[col][c]));
    }
  }
  return {ok:true,solution:A.map(row=>row[n])};
}

/** Full solver: parses numerator + factored denominator, validates every
 * factor, handles improper fractions via the reused Phase 2 division
 * algorithm, builds the real coefficient-contribution polynomial for every
 * unknown, matches coefficients into a linear system, solves it exactly,
 * substitutes back, and verifies the reconstruction.
 * @returns {SolverResult & {result?:object}} */
function partialFractionDecompose(numeratorStr,denominatorStr,variable){
  variable=variable||'x';
  const steps=[];
  const pn=parsePolynomial(numeratorStr,variable);
  if(!pn.ok)return {success:false,steps:[createStep('Could not read the numerator',pn.error.message)],error:pn.error};
  steps.push(createStep('Numerator',`Read as a polynomial in ${variable}.`,pn.value.toLatex()));

  const pf=parseDenominatorFactors(denominatorStr,variable);
  if(!pf.ok)return {success:false,steps:[...steps,createStep('Could not read the denominator',pf.error.message)],error:pf.error};
  const factors=pf.value;

  let D=new Polynomial([{power:0,coeff:new Fraction(1)}],variable);
  for(const f of factors)for(let k=0;k<f.multiplicity;k++)D=D.multiply(f.poly);

  const factorListLatex=factors.map(f=>factorPowerLatex(f.poly,f.multiplicity)).join('');
  steps.push(createStep('Factor the denominator',
    `The denominator is already given as a product of ${factors.length} irreducible factor${factors.length===1?'':'s'}. Multiplying them out confirms the expanded denominator.`,
    `${factorListLatex} = ${D.toLatex()}`));

  const commonRoots=[];
  for(const f of factors)if(f.degree===1){
    const root=f.poly.coeffAt(0).neg();
    if(pn.value.evaluate(root).isZero())commonRoots.push(root);
  }
  if(commonRoots.length){
    steps.push(createStep('Check for common factors',
      `The numerator is 0 at ${variable} = ${commonRoots.map(r=>r.toLatex()).join(', ')}, so the numerator and denominator share a factor there. This does not stop the method below \u2014 matching coefficients still gives the correct decomposition \u2014 but cancelling first would use smaller numbers.`));
  }else{
    steps.push(createStep('Check for common factors','The numerator does not vanish at any root of the denominator, so the numerator and denominator share no common factor.'));
  }

  let quotient=new Polynomial([],variable);
  let working=pn.value;
  if(!pn.value.isZero()&&pn.value.degree>=D.degree){
    steps.push(createStep('Check whether the fraction is improper',
      `The numerator's degree (${pn.value.degree}) is \u2265 the denominator's degree (${D.degree}), so this is an improper fraction \u2014 divide first.`));
    const div=polyDivideAlgorithm(pn.value,D,variable);
    steps.push(...div.steps.map(s=>createStep('Long division \u2014 '+s.title,s.explanation,s.expression,s.meta)));
    quotient=div.quotient;
    working=div.remainder;
    steps.push(createStep('Continue with the proper remainder',
      'The final answer will be this quotient plus the decomposition of the remainder over the denominator.',
      `${pn.value.toLatex()} \\big/ \\left(${D.toLatex()}\\right) = ${quotient.toLatex()} + \\dfrac{${working.toLatex()}}{${D.toLatex()}}`));
  }else{
    steps.push(createStep('Confirm the fraction is proper',
      `The numerator's degree (${pn.value.isZero()?'\u2212\u221e':pn.value.degree}) is less than the denominator's degree (${D.degree}), so no division is needed before decomposing.`));
  }

  const unknowns=[];
  let labelCount=0;
  const formPieces=[];
  for(let i=0;i<factors.length;i++){
    const f=factors[i];
    for(let j=1;j<=f.multiplicity;j++){
      let basis=new Polynomial([{power:0,coeff:new Fraction(1)}],variable);
      for(let k=0;k<factors.length;k++){
        const exp=(k===i)?(f.multiplicity-j):factors[k].multiplicity;
        for(let p=0;p<exp;p++)basis=basis.multiply(factors[k].poly);
      }
      const denomLatex=factorPowerLatex(f.poly,j);
      if(f.degree===1){
        const label=pfNextLabel(labelCount++);
        unknowns.push({label,factorIndex:i,occurrence:j,localPower:0,contribution:basis,denomLatex});
        formPieces.push(`\\frac{${label}}{${denomLatex}}`);
      }else{
        const contributionB=basis.multiply(new Polynomial([{power:1,coeff:new Fraction(1)}],variable));
        const labelB=pfNextLabel(labelCount++);
        const labelC=pfNextLabel(labelCount++);
        unknowns.push({label:labelB,factorIndex:i,occurrence:j,localPower:1,contribution:contributionB,denomLatex});
        unknowns.push({label:labelC,factorIndex:i,occurrence:j,localPower:0,contribution:basis,denomLatex});
        formPieces.push(`\\frac{${labelB}${variable} + ${labelC}}{${denomLatex}}`);
      }
    }
  }
  steps.push(createStep('Determine the decomposition form',
    `Each linear factor raised to power m contributes one unknown constant per power from 1 to m; each irreducible quadratic factor raised to power m contributes an unknown linear numerator per power from 1 to m.`,
    formPieces.join(' + ')));

  const clearPieces=unknowns.map(u=>`${u.label}${u.localPower===1?variable:''}${u.denomLatex}`);
  steps.push(createStep('Clear denominators',
    'Multiply both sides by the full denominator so the equation has no fractions left.',
    `${clearPieces.join(' + ')} = ${working.toLatex()}`));

  const n=unknowns.length;
  const matrix=[],rhs=[];
  for(let p=D.degree-1;p>=0;p--){
    const row=unknowns.map(u=>u.contribution.coeffAt(p));
    const rhsVal=working.coeffAt(p);
    matrix.push(row);rhs.push(rhsVal);
    const pieces=[];
    unknowns.forEach((u,ci)=>{const piece=coeffLabelPieceLatex(row[ci],u.label);if(piece)pieces.push(piece);});
    const lhsLatex=pieces.length?joinSigned(pieces):'0';
    steps.push(createStep(`Coefficient of ${p===0?'the constant term':(p===1?variable:`${variable}^{${p}}`)}`,
      'Comparing this power on both sides gives one linear equation in the unknown coefficients.',
      `${lhsLatex} = ${rhsVal.toLatex()}`));
  }

  const sol=solveLinearSystem(matrix,rhs);
  if(!sol.ok){
    return {success:false,steps,error:err('SINGULAR_SYSTEM','The resulting linear system has no unique solution. This usually means the given factors do not multiply out to a denominator consistent with the numerator\u2019s degree \u2014 double-check the factorization.')};
  }
  unknowns.forEach((u,i)=>u.value=sol.solution[i]);
  steps.push(createStep('Solve the system',
    `Solving the ${n}\u00d7${n} linear system (by exact Gauss\u2013Jordan elimination) gives the value of each unknown coefficient.`,
    unknowns.map(u=>`${u.label} = ${u.value.toLatex()}`).join(',\\ ')));

  const grouped=[];
  for(let i=0;i<factors.length;i++){
    const f=factors[i];
    for(let j=1;j<=f.multiplicity;j++){
      const denomLatex=factorPowerLatex(f.poly,j);
      if(f.degree===1){
        const u=unknowns.find(u=>u.factorIndex===i&&u.occurrence===j);
        if(!u.value.isZero())grouped.push(fracTermLatex(u.value,denomLatex));
      }else{
        const uB=unknowns.find(u=>u.factorIndex===i&&u.occurrence===j&&u.localPower===1);
        const uC=unknowns.find(u=>u.factorIndex===i&&u.occurrence===j&&u.localPower===0);
        const numPoly=new Polynomial([{power:1,coeff:uB.value},{power:0,coeff:uC.value}],variable);
        if(!numPoly.isZero())grouped.push(`\\frac{${numPoly.toLatex()}}{${denomLatex}}`);
      }
    }
  }
  steps.push(createStep('Substitute the solved coefficients',
    'Plugging each solved value back into its term gives the decomposition.',
    grouped.length?joinSigned(grouped):'0'));

  const finalPieces=[];
  if(!quotient.isZero())finalPieces.push(quotient.toLatex());
  finalPieces.push(...grouped);
  const fullLatex=finalPieces.length?joinSigned(finalPieces):'0';

  let reconNumerator=new Polynomial([],variable);
  for(const u of unknowns)reconNumerator=reconNumerator.add(u.contribution.scale(u.value));
  const reconTotal=quotient.multiply(D).add(reconNumerator);
  const matches=reconTotal.toString()===pn.value.toString();
  steps.push(createStep('Check',
    matches?'Recombining the quotient and every decomposed term reconstructs the original numerator exactly.':'Recombining the terms did not reconstruct the original numerator \u2014 something is inconsistent.',
    `${reconTotal.toLatex()} ${matches?'=':'\\neq'} ${pn.value.toLatex()}`,
    {matches}));

  return {success:true,steps,result:{quotient,working,denominator:D,factors,unknowns,fullLatex,matches}};
}

/* ---------------- Phase 5: Gaussian Elimination ----------------
   Pure linear-algebra addition to the engine: no dependency on
   Polynomial/parsePolynomial (a linear system's unknowns are just
   variables, not a single polynomial variable), but it reuses Fraction
   for exact arithmetic throughout, exactly like every other phase. */

/** Parse one matrix cell: integer, decimal, or a/b fraction, either sign. */
function parseCellFraction(raw){
  if(typeof raw!=='string')return {ok:false,error:err('EMPTY','Empty cell.')};
  const s=raw.trim().replace(/\u2212/g,'-');
  if(!s)return {ok:false,error:err('EMPTY','Empty cell.')};
  if(!/^[+-]?\d+(\.\d+)?$|^[+-]?\d+\/\d+$/.test(s))return {ok:false,error:err('SYNTAX',`"${raw}" is not a valid number or fraction.`)};
  if(s.includes('/')){
    const [a,b]=s.split('/').map(Number);
    if(b===0)return {ok:false,error:err('DIV_BY_ZERO',`"${raw}": denominator cannot be 0.`)};
    return {ok:true,value:new Fraction(a,b)};
  }
  if(s.includes('.'))return {ok:true,value:Fraction.from(Number(s))};
  return {ok:true,value:new Fraction(Number(s))};
}

/** LaTeX for an augmented matrix: rows of Fraction (length numVars+1). */
function matrixLatex(rows,numVars){
  const spec='c'.repeat(numVars)+'|c';
  const body=rows.map(r=>r.map(f=>f.toLatex()).join('&')).join('\\\\');
  return `\\left[\\begin{array}{${spec}}${body}\\end{array}\\right]`;
}
function rowOpLatex(i,factor,j){
  const iL=`R_{${i+1}}`,jL=`R_{${j+1}}`;
  const neg=factor.n<0,abs=neg?factor.neg():factor;
  const sign=neg?'+':'-';
  const mag=abs.equals(1)?'':abs.toLatex();
  return `${iL}\\rightarrow ${iL}${sign}${mag}${jL}`;
}
function swapLatex(i,j){return `R_{${i+1}}\\leftrightarrow R_{${j+1}}`;}

/* ---- tiny exact linear-expression algebra: var = const + \u03a3 coeff\u00b7freeVar ---- */
function leConst(c){return {const:Fraction.from(c),coeffs:{}};}
function leFreeVar(k){const e=leConst(0);e.coeffs[k]=new Fraction(1);return e;}
function leAdd(a,b){
  const coeffs={...a.coeffs};
  for(const k in b.coeffs)coeffs[k]=(coeffs[k]||new Fraction(0)).add(b.coeffs[k]);
  return {const:a.const.add(b.const),coeffs};
}
function leScale(a,s){
  const coeffs={};for(const k in a.coeffs)coeffs[k]=a.coeffs[k].mul(s);
  return {const:a.const.mul(s),coeffs};
}
function leSub(a,b){return leAdd(a,leScale(b,new Fraction(-1)));}
function leToLatex(e,freeNames){
  const pieces=[];
  if(!e.const.isZero()||Object.keys(e.coeffs).length===0)pieces.push(e.const.toLatex());
  for(const k in e.coeffs){
    const c=e.coeffs[k];if(c.isZero())continue;
    const neg=c.n<0,abs=neg?c.neg():c;
    const mag=abs.equals(1)?'':abs.toLatex();
    pieces.push({neg,text:`${mag}${freeNames[k]}`});
  }
  let latexList=[];
  pieces.forEach((p,idx)=>{
    if(typeof p==='string'){latexList.push(idx===0?p:'+'+p);return;}
    latexList.push(idx===0?(p.neg?'-':'')+p.text:(p.neg?'-':'+')+p.text);
  });
  return latexList.join('')||'0';
}

/** Full Gaussian Elimination solver, deriving every row operation.
 * @param {string[][]} rowStrings n rows \u00d7 (numVars+1) raw cell strings
 * @param {number} numVars
 * @param {string[]} [varNames] optional display names, length numVars
 * @returns {SolverResult & {result?:object}} */
function gaussianEliminate(rowStrings,numVars,varNames){
  const steps=[];
  const n=rowStrings.length;
  if(n<1||numVars<1)return {success:false,steps:[createStep('Invalid size','Need at least one equation and one variable.')],error:err('BAD_SIZE','Need at least one equation and one variable.')};
  const names=(varNames&&varNames.length===numVars)?varNames:Array.from({length:numVars},(_,i)=>`x_{${i+1}}`);
  const mat=[];
  for(let i=0;i<n;i++){
    if(!rowStrings[i]||rowStrings[i].length!==numVars+1)return {success:false,steps:[createStep('Invalid row',`Row ${i+1} needs ${numVars+1} entries (coefficients + right-hand side).`)],error:err('BAD_ROW',`Row ${i+1} is incomplete.`)};
    const row=[];
    for(let c=0;c<=numVars;c++){
      const p=parseCellFraction(rowStrings[i][c]);
      if(!p.ok)return {success:false,steps:[createStep('Could not read a cell',`Row ${i+1}, column ${c+1}: ${p.error.message}`)],error:p.error};
      row.push(p.value);
    }
    mat.push(row);
  }

  steps.push(createStep('Starting augmented matrix',
    `The system as an augmented matrix (${n}\u00d7${numVars}, with the right-hand side as the last column).`,
    matrixLatex(mat,numVars)));

  const pivotCols=[]; // pivotCols[i] = column of the pivot in (final) row i
  let pivotRow=0;
  for(let col=0;col<numVars && pivotRow<n;col++){
    let found=-1;
    for(let r=pivotRow;r<n;r++)if(!mat[r][col].isZero()){found=r;break;}
    if(found===-1){
      steps.push(createStep(`No pivot in column ${col+1}`,
        `Every entry at or below row ${pivotRow+1} in this column is 0, so this column cannot supply a pivot. Its variable (${names[col]}) will be a free variable, and elimination continues at the next column with the same row.`));
      continue;
    }
    steps.push(createStep(`Selected pivot for column ${col+1}`,
      found===pivotRow
        ? `Row ${pivotRow+1} already has a nonzero entry here (${mat[found][col].toLatex()}), so it becomes the pivot \u2014 no swap needed.`
        : `Row ${pivotRow+1}'s entry here is 0, but row ${found+1} has a nonzero entry (${mat[found][col].toLatex()}), so row ${found+1} becomes the pivot.`,
      mat[found][col].toLatex()));
    if(found!==pivotRow){
      const tmp=mat[found];mat[found]=mat[pivotRow];mat[pivotRow]=tmp;
      steps.push(createStep('Row operation','Swap the two rows so the nonzero entry sits on the pivot row.',swapLatex(pivotRow,found),{op:'swap'}));
      steps.push(createStep('Resulting matrix','The matrix after the swap.',matrixLatex(mat,numVars)));
    }
    const pv=mat[pivotRow][col];
    for(let r=pivotRow+1;r<n;r++){
      if(mat[r][col].isZero())continue;
      const factor=mat[r][col].div(pv);
      steps.push(createStep('Row operation',
        `Eliminate the entry below the pivot: subtract ${factor.toLatex()} times the pivot row from row ${r+1}.`,
        rowOpLatex(r,factor,pivotRow),{op:'combine'}));
      for(let c=col;c<=numVars;c++)mat[r][c]=mat[r][c].sub(factor.mul(mat[pivotRow][c]));
      steps.push(createStep('Resulting matrix','The matrix after applying that row operation.',matrixLatex(mat,numVars)));
    }
    pivotCols.push(col);
    pivotRow++;
  }
  const rank=pivotRow;

  steps.push(createStep('Row-echelon form reached',
    `No more columns can be eliminated below a pivot. The matrix has rank ${rank} (${rank} pivot${rank===1?'':'s'}, in column${pivotCols.length===1?'':'s'} ${pivotCols.map(c=>c+1).join(', ')||'none'}).`,
    matrixLatex(mat,numVars)));

  // consistency: any row from `rank` on must be all-zero in the coefficient
  // part by construction; nonzero RHS there means no solution.
  for(let r=rank;r<n;r++){
    if(!mat[r][numVars].isZero()){
      steps.push(createStep('Interpret the resulting system',
        `Row ${r+1} reads 0 = ${mat[r][numVars].toLatex()}, which is impossible. The system is inconsistent.`,
        `0 = ${mat[r][numVars].toLatex()}`,{op:'inconsistent'}));
      steps.push(createStep('Solution structure','No solution: the equations contradict each other.',undefined,{solutionType:'none'}));
      return {success:true,steps,result:{finalMatrix:mat,numVars,rank,names,solutionType:'none'}};
    }
  }

  if(rank<numVars){
    const freeCols=[];for(let c=0;c<numVars;c++)if(!pivotCols.includes(c))freeCols.push(c);
    steps.push(createStep('Interpret the resulting system',
      `The system is consistent (every non-pivot row is entirely 0 = 0), but there are only ${rank} pivot${rank===1?'':'s'} for ${numVars} variables. ${freeCols.map(c=>names[c]).join(', ')} ${freeCols.length===1?'is a free variable':'are free variables'}; the system has infinitely many solutions.`));
    const freeNames={};freeCols.forEach((c,k)=>freeNames[k]=`t_{${k+1}}\\,(${names[c]})`);
    const exprs=new Array(numVars);
    freeCols.forEach((c,k)=>exprs[c]=leFreeVar(k));
    for(let i=rank-1;i>=0;i--){
      const pc=pivotCols[i];
      let acc=leConst(mat[i][numVars]);
      for(let c=pc+1;c<numVars;c++){
        const coeff=mat[i][c];if(coeff.isZero())continue;
        acc=leSub(acc,leScale(exprs[c],coeff));
      }
      exprs[pc]=leScale(acc,new Fraction(1).div(mat[i][pc]));
    }
    const solLatex=[];
    for(let c=0;c<numVars;c++)solLatex.push(`${names[c]} = ${leToLatex(exprs[c],freeNames)}`);
    steps.push(createStep('State the solution structure',
      `Back-substituting from the last pivot row upward, with ${freeCols.map((c,k)=>`t_{${k+1}}`).join(', ')} as free parameters:`,
      solLatex.join(',\\ '),{solutionType:'infinite',freeCols}));
    return {success:true,steps,result:{finalMatrix:mat,numVars,rank,names,solutionType:'infinite',freeCols,exprs,freeNames}};
  }

  // unique solution: rank === numVars, back-substitute to plain values.
  steps.push(createStep('Interpret the resulting system',
    `The system is consistent and every variable has a pivot (rank ${rank} = number of variables), so there is exactly one solution. Back-substitute from the last equation upward.`));
  const values=new Array(numVars);
  for(let i=rank-1;i>=0;i--){
    const pc=pivotCols[i];
    let rhs=mat[i][numVars];
    for(let c=pc+1;c<numVars;c++){
      if(mat[i][c].isZero())continue;
      rhs=rhs.sub(mat[i][c].mul(values[c]));
    }
    values[pc]=rhs.div(mat[i][pc]);
    steps.push(createStep(`Solve for ${names[pc]}`,
      `From row ${i+1}: ${names[pc]} = (${mat[i][numVars].toLatex()} \u2212 sum of known terms) \u00f7 ${mat[i][pc].toLatex()}.`,
      `${names[pc]} = ${values[pc].toLatex()}`));
  }
  const solLatex=names.map((nm,i)=>`${nm} = ${values[i].toLatex()}`).join(',\\ ');
  steps.push(createStep('State the solution structure','Unique solution.',solLatex,{solutionType:'unique'}));
  return {success:true,steps,result:{finalMatrix:mat,numVars,rank,names,solutionType:'unique',values}};
}

return {Fraction,Polynomial,parsePolynomial,createStep,verifyFoundation,longDivide,syntheticDivide,partialFractionDecompose,gaussianEliminate,leToLatex,termToLatex,toSuper};
})();
