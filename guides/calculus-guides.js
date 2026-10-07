/* Renders <span class="tex"> / <div class="tex tex-d"> as LaTeX (KaTeX, MathML output: no stylesheet needed). */
(function(){function go(){if(!window.katex)return;document.querySelectorAll('.tex').forEach(function(el){if(el.getAttribute('data-done'))return;
  try{katex.render(el.textContent,el,{output:'mathml',displayMode:el.classList.contains('tex-d'),throwOnError:false});el.setAttribute('data-done','1');}catch(e){}});}
if(window.katex)go();else window.addEventListener('load',go);})();
