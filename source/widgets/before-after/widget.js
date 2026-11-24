(function(){
var W=window.WIDGET,ba=document.getElementById('ba'),hd=document.getElementById('hd'),before=document.getElementById('before'),after=document.getElementById('after');
var vert=W.orientation==='verticaal',pos=Math.min(100,Math.max(0,Number(W.start)));if(isNaN(pos))pos=50;
function okUrl(u){u=String(u||'').trim();return /^(https:\/\/|\/(?!\/))/i.test(u)?u:''}
function fill(el,url,alt,cls,txt){var u=okUrl(url);if(u){var i=document.createElement('img');i.alt=alt||'';i.draggable=false;i.src=u;el.appendChild(i)}else{el.className+=' ph '+cls;el.textContent=txt;el.setAttribute('role','img');el.setAttribute('aria-label',alt||txt)}}
fill(before,W.before_image,W.before_alt,'b',W.label_before||'Voor');
fill(after,W.after_image,W.after_alt,'a',W.label_after||'Na');
ba.className+=(vert?' v':'')+(W.handle_style==='streep'?' bar':'')+(W.fit==='contain'?' contain':'')+({'4:3':' r43','1:1':' r11','3:2':' r32'}[W.ratio]||'');
var lb=document.getElementById('lb'),la=document.getElementById('la');
lb.textContent=W.label_before||'Voor';la.textContent=W.label_after||'Na';lb.hidden=la.hidden=!W.show_labels;
hd.setAttribute('aria-orientation',vert?'vertical':'horizontal');hd.setAttribute('aria-label',(W.label_before||'Voor')+' / '+(W.label_after||'Na'));
function set(p){pos=Math.min(100,Math.max(0,p));var r=100-pos;
before.style.clipPath=vert?'inset(0 0 '+r+'% 0)':'inset(0 '+r+'% 0 0)';
if(vert){hd.style.top=pos+'%';hd.style.left=''}else{hd.style.left=pos+'%';hd.style.top=''}
hd.setAttribute('aria-valuenow',String(Math.round(pos)))}
function fromEvent(e){var r=ba.getBoundingClientRect();return vert?(e.clientY-r.top)/r.height*100:(e.clientX-r.left)/r.width*100}
var drag=false,timer=null;
function stopDemo(){if(timer){cancelAnimationFrame(timer);timer=null}}
ba.addEventListener('pointerdown',function(e){stopDemo();drag=true;try{ba.setPointerCapture(e.pointerId)}catch(x){}set(fromEvent(e));hd.focus({preventScroll:true});e.preventDefault()});
ba.addEventListener('pointermove',function(e){if(drag)set(fromEvent(e))});
function up(){drag=false}
ba.addEventListener('pointerup',up);ba.addEventListener('pointercancel',up);
hd.addEventListener('keydown',function(e){var k=e.key,d=0;
if(k==='ArrowLeft'||k==='ArrowUp')d=-5;else if(k==='ArrowRight'||k==='ArrowDown')d=5;else if(k==='Home'){stopDemo();set(0);e.preventDefault();return}else if(k==='End'){stopDemo();set(100);e.preventDefault();return}else if(k==='PageUp')d=-20;else if(k==='PageDown')d=20;else return;
stopDemo();set(pos+d);e.preventDefault()});
set(pos);
function demo(){if(!W.autoplay||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
var t0=null,from=pos,dur=2400;
function step(t){if(t0===null)t0=t;var k=Math.min(1,(t-t0)/dur);
var off=Math.sin(k*Math.PI*2)*25*(1-k*0.3);set(from+off);
if(k<1&&!drag)timer=requestAnimationFrame(step);else{timer=null;set(from)}}
timer=requestAnimationFrame(step)}
if(window.IntersectionObserver&&W.autoplay){var io=new IntersectionObserver(function(en){if(en[0].isIntersecting){io.disconnect();demo()}},{threshold:.5});io.observe(ba)}else demo();
})();
