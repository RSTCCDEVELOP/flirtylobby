(function(){
var W=window.WIDGET,tl=document.getElementById('tl'),ls=document.getElementById('ls');
var max=Math.min(12,Math.max(1,Number(W.max_items)||12));
var cls={zigzag:'z',horizontaal:'h'}[W.orientation]||'v';
tl.className+=' '+cls+' '+({nummer:'num',ring:'ring'}[W.dot_style]||'stip')+(W.line_style==='stippellijn'?' dots':'')+(W.compact?' compact':'');
var rows=[];
String(W.items||'').split('\n').forEach(function(l){if(!l.trim())return;var p=l.split('|');rows.push({y:(p[0]||'').trim(),t:(p[1]||'').trim(),x:p.slice(2).join('|').trim()})});
rows=rows.slice(0,max);
function div(c,t){var d=document.createElement('div');d.className=c;d.textContent=t;return d}
rows.forEach(function(r,i){
var li=document.createElement('li');li.className='ev'+(W.highlight_last&&i===rows.length-1?' last':'');
var dt=document.createElement('span');dt.className='dt';dt.setAttribute('aria-hidden','true');if(W.dot_style==='nummer')dt.textContent=String(i+1);
var cd=document.createElement('div');cd.className='cd';
if(r.y)cd.appendChild(div('yr',r.y));if(r.t)cd.appendChild(div('hd',r.t));if(r.x)cd.appendChild(div('tx',r.x));
li.appendChild(dt);li.appendChild(cd);ls.appendChild(li)});
var evs=ls.children;
var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
if(W.animate&&!reduce&&window.IntersectionObserver&&evs.length){
tl.className+=' js-anim';
var io=new IntersectionObserver(function(en){en.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15});
Array.prototype.forEach.call(evs,function(e){io.observe(e)});
setTimeout(function(){Array.prototype.forEach.call(evs,function(e){e.classList.add('in')})},4000)}
})();
