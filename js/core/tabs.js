let tab = 1;
const redraw = () =>
  tab === 1
    ? draw()
    : tab === 2
    ? drawE()
    : tab === 3
    ? r3Draw()
    : tab === 4
    ? draw4()
    : tab === 6 && window.egvDraw
    ? egvDraw()
    : undefined;
function showTab(t) {
  tab = t;
  $("#p1").hidden = t !== 1;
  $("#p2").hidden = t !== 2;
  $("#p3").hidden = t !== 3;
  $("#p4").hidden = t !== 4;
  $("#p5").hidden = t !== 5;
  $("#p6").hidden = t !== 6;
  document.querySelectorAll("#tabs button").forEach((b) =>
    b.setAttribute("aria-pressed", +b.dataset.tab === t)
  );
  redraw();
}
document.querySelectorAll("#tabs button").forEach((b) =>
  b.onclick = () => showTab(+b.dataset.tab)
);
/* deep link: /#eigen-vector opens the Eigen Vector tab (/#eigenvectors kept as a legacy alias) (legal pages keep their own hashes) */
function openFromHash() {
  if (location.hash === "#eigen-vector" || location.hash === "#eigenvectors") {
    showCategory("linalg");
    showTab(6);
  }
}
window.addEventListener("hashchange", openFromHash);
let currentCat = "linalg";
function showCategory(cat) {
  currentCat = cat;
  const isLA = cat === "linalg",
    isAlgebra = cat === "calc",
    isCalculus = cat === "calculus";
  $("#secLinAlg").hidden = !isLA;
  $("#secCalc").hidden = !isAlgebra;
  $("#secCalculus").hidden = !isCalculus;
  $("#linalgNav").hidden = !isLA;
  document.querySelectorAll("#cats button").forEach((b) =>
    b.setAttribute("aria-pressed", b.dataset.cat === cat)
  );
  if (isLA) redraw();
}
document.querySelectorAll("#cats button").forEach((b) =>
  b.onclick = () => showCategory(b.dataset.cat)
);

renderVecs();
renderOpsSel();
setAB(1, 1);
renderAnalysis();
renderExpr();
new ResizeObserver(() => redraw()).observe($("#viz"));
new ResizeObserver(() => redraw()).observe($("#vizE"));
new ResizeObserver(() => redraw()).observe($("#rgeo"));
new ResizeObserver(() => {
  if (tab === 4) draw4();
}).observe($("#p4"));
r3Init();

renderInputs();
renderResults();
draw();
animate(I3, S.A, 1300, true);
openFromHash();
