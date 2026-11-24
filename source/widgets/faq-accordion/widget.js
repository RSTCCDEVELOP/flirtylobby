(function(){
var W=window.WIDGET||{},root=document.querySelector('.fq'),ls=document.getElementById('ls'),se=document.getElementById('se'),em=document.getElementById('em'),uid=0;
function tx(v){if(v&&typeof v==='object'){var l=window.WIDGET_LANG||'nl';if(v[l])return String(v[l]);if(v.nl)return String(v.nl);var k=Object.keys(v);return k.length?String(v[k[0]]):''}return String(v||'')}
function items(){
  var D=window.WIDGET_DATA,use=W.source!=='own'&&D&&D.active&&D.items&&D.items.length;
  if(use)return D.items.map(function(i){return{q:tx(i.q),a:tx(i.a),c:W.categories?tx(i.c):''}}).filter(function(i){return i.q});
  if(W.source==='plugin')return[];
  return String(W.questions||'').split('\n').map(function(l){var p=l.split('|').map(function(x){return x.trim()});return p[0]&&p[1]?{q:p[0],a:p[1],c:p[2]||''}:null}).filter(Boolean);
}
root.className+=' '+({number:'nm',arrow:'ar'}[W.icon]||'pm')+(W.shape==='square'?' sq':'')+(W.animate?' an':'');
var openSet={},started=false;
function setOpen(it,open){
  it.el.className='it'+(open?' open':'');it.bt.setAttribute('aria-expanded',open?'true':'false');
  var p=it.pn;
  if(!W.animate||window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches){p.style.height=open?'auto':'0';p.hidden=!open;return}
  p.hidden=false;
  if(open){p.style.height=p.scrollHeight+'px';var done=function(){if(it.el.className.indexOf('open')>-1)p.style.height='auto';p.removeEventListener('transitionend',done)};p.addEventListener('transitionend',done)}
  else{p.style.height=p.scrollHeight+'px';p.offsetHeight;p.style.height='0'}
}
function render(){
  var all=items(),q=(se.value||'').toLowerCase().trim(),list=all.filter(function(i){return!q||(i.q+' '+i.a).toLowerCase().indexOf(q)>-1});
  ls.textContent='';var cats=[],lastC=null,n=0;
  se.hidden=!(W.search&&all.length>0);
  em.hidden=list.length>0;em.textContent=all.length?(W.no_results||''):(W.empty_text||'');
  list.forEach(function(i,idx){
    if(i.c&&i.c!==lastC){var h=document.createElement('h3');h.className='ct';h.textContent=i.c;ls.appendChild(h);lastC=i.c}
    n++;var id='fq'+(++uid);
    var el=document.createElement('div'),h3=document.createElement('h3'),bt=document.createElement('button'),qs=document.createElement('span'),ic=document.createElement('span'),pn=document.createElement('div'),inn=document.createElement('div');
    bt.type='button';bt.className='bt';bt.id=id+'b';bt.setAttribute('aria-controls',id+'p');bt.setAttribute('aria-expanded','false');
    qs.className='q';qs.textContent=i.q;ic.className='ic';ic.setAttribute('aria-hidden','true');if(W.icon==='number')ic.textContent=String(n);
    bt.appendChild(ic);bt.appendChild(qs);h3.appendChild(bt);
    pn.id=id+'p';pn.className='pn';pn.setAttribute('role','region');pn.setAttribute('aria-labelledby',id+'b');pn.style.height='0';pn.hidden=true;
    inn.className='in';inn.textContent=i.a;pn.appendChild(inn);el.className='it';el.appendChild(h3);el.appendChild(pn);ls.appendChild(el);
    var it={el:el,bt:bt,pn:pn};
    bt.addEventListener('click',function(){
      var open=el.className.indexOf('open')<0;
      if(open&&W.multi!=='several')[].forEach.call(ls.querySelectorAll('.it.open'),function(o){if(o!==el)o._it&&setOpen(o._it,false)});
      setOpen(it,open);
    });
    el._it=it;
    if(W.first_open&&!started&&idx===0&&!q){setOpen(it,true);pn.style.height='auto'}
  });
  started=true;
}
se.addEventListener('input',render);
window.addEventListener('message',function(e){if(e.data&&e.data.widgetLang){window.WIDGET_LANG=e.data.widgetLang;started=false;render()}});
render();
})();
