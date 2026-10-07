/* ---- legal pages (Privacy / Cookies / Terms), hash-routed, no dependencies ---- */
const LEGAL={
  privacy:`<h2>Privacy Policy</h2><p class="upd">Last updated: September 2026</p>
    <p>VectorLab is an educational linear-algebra tool. It does not itself collect, transmit or store any personal information.</p>
    <h3>Matrix and vector inputs</h3><p>Every matrix, vector and calculation you enter stays in your browser's memory for the current session only. Nothing you type is sent to a server, saved to a database, or shared with anyone.</p>
    <h3>Advertising</h3><p>This site displays ads served by Google AdSense. Google and its partners may use cookies and similar technologies to serve ads based on your prior visits to this or other websites. You can opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>, or generally at <a href="https://www.aboutads.info/choices" target="_blank" rel="noopener">aboutads.info</a>. See Google's <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">how Google uses information from sites that use its services</a> for details.</p>
    <h3>Analytics</h3><p>This site does not run its own analytics or tracking scripts beyond what's needed to serve the ads above. If that ever changes, this policy will be updated first.</p>
    <h3>Contact</h3><p>Privacy questions can be sent to <a href="mailto:vectorlab.co.in@gmail.com">vectorlab.co.in@gmail.com</a>.</p>`,
  cookies:`<h2>Cookie Policy</h2><p class="upd">Last updated: September 2026</p>
    <p>VectorLab itself does not set or read cookies for its own functionality.</p>
    <h3>Advertising cookies</h3><p>This site shows ads through Google AdSense, which may set cookies (and use similar technologies) in your browser to measure ad performance and, where permitted, personalize the ads you see. These are set by Google and its advertising partners, not by VectorLab directly. You can review or opt out of this at <a href="https://adssettings.google.com" target="_blank" rel="noopener">Google Ads Settings</a>.</p>
    <h3>Local storage</h3><p>The site does not use browser localStorage or sessionStorage to remember data between visits — all matrix and vector state resets when you reload the page.</p>
    <h3>Essential vs. non-essential</h3><p>Advertising cookies are non-essential. Depending on where you're located (for example the EEA, UK, or under certain US state laws), you may be shown a consent banner before any non-essential cookies are set; that consent tool is provided separately from this page. If cookies or analytics beyond advertising are ever added, this page will be updated.</p>`,
  terms:`<h2>Terms of Use</h2><p class="upd">Last updated: September 2026</p>
    <p>VectorLab is provided for educational purposes, to help visualize concepts in linear algebra such as rank, span, linear independence, row reduction and null spaces.</p>
    <h3>No warranty on results</h3><p>Calculations use standard floating-point or exact rational arithmetic and are believed to be accurate, but VectorLab is provided "as is" without warranty of any kind. Independently verify any result you rely on for coursework, research, or other important purposes.</p>
    <h3>Limitation of liability</h3><p>To the extent permitted by applicable law, the creator of VectorLab is not liable for damages or losses arising from use of, or inability to use, this site.</p>
    <h3>Contact</h3><p>Questions about these terms can be sent to <a href="mailto:vectorlab.co.in@gmail.com">vectorlab.co.in@gmail.com</a>.</p>`
};
function showLegal(key){
  if(!LEGAL[key])return;
  $('#legalContent').innerHTML=LEGAL[key];$('#legalOverlay').hidden=false;document.body.style.overflow='hidden';
}
function hideLegal(){
  $('#legalOverlay').hidden=true;document.body.style.overflow='';
  if(location.hash&&LEGAL[location.hash.slice(1)])history.replaceState(null,'',location.pathname+location.search);
}
document.querySelectorAll('.legal-link[data-legal]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.hash=a.dataset.legal;}));
const legalCloseBtn=$('#legalClose');if(legalCloseBtn)legalCloseBtn.addEventListener('click',e=>{e.preventDefault();hideLegal();});
window.addEventListener('hashchange',()=>{const k=location.hash.slice(1);if(LEGAL[k])showLegal(k);else hideLegal();});
if(location.hash&&LEGAL[location.hash.slice(1)])showLegal(location.hash.slice(1));
