(function(){
var W=window.WIDGET,D=window.WIDGET_DATA,root=document.getElementById('root'),cur=0,copiedTimer;
var NS='http://www.w3.org/2000/svg';
function el(t,a,txt){var e=document.createElement(t);if(a)for(var k in a)e[k]=a[k];if(txt!=null)e.textContent=txt;return e}
function sv(t,a){var e=document.createElementNS(NS,t);for(var k in a)e.setAttribute(k,a[k]);return e}
function locs(){
  var use=W.source!=='own'&&D&&D.active&&D.items&&D.items.length,out=[];
  if(use){var e=D.items[0];
    out.push({name:'Hoofdadres',lines:[(e.street+' '+e.number).trim(),(e.zip+' '+e.city).trim(),e.country].filter(Boolean)});
    (e.locations||[]).forEach(function(l){var ls=[(l.street+' '+l.house_number).trim(),(l.postal_code+' '+l.city).trim(),l.country].filter(Boolean);if(ls.length)out.push({name:l.name||l.city||'Locatie',lines:ls})});
    if(!out[0].lines.length)out.shift()}
  else if(W.source!=='plugin'){var ls=[W.street,W.zipcity,W.country].filter(function(x){return x&&String(x).trim()});if(ls.length)out.push({name:'Hoofdadres',lines:ls})}
  return out}
function url(addr){var q=encodeURIComponent(addr);
  if(W.service==='apple')return 'https://maps.apple.com/?daddr='+q;
  if(W.service==='osm')return 'https://www.openstreetmap.org/directions?to='+q;
  return 'https://www.google.com/maps/dir/?api=1&destination='+q}
function art(){
  var a=el('div',{className:'art'});
  if(W.style!=='pin'){var s=sv('svg',{'class':'bg',viewBox:'0 0 400 130',preserveAspectRatio:'xMidYMid slice','aria-hidden':'true'});
    [[20,12,90,40],[130,12,110,40],[270,12,110,40],[20,82,70,36],[260,82,120,36]].forEach(function(r){s.appendChild(sv('rect',{x:r[0],y:r[1],width:r[2],height:r[3],rx:6}))});
    ['M0 62H400','M115 0V130','M250 0V130','M0 120L130 70L400 100'].forEach(function(d,i){s.appendChild(sv('path',{d:d,'class':i>1?'s':''}))});
    a.appendChild(s)}
  var p=sv('svg',{'class':'pin',viewBox:'0 0 24 24','aria-hidden':'true'});
  p.appendChild(sv('path',{d:'M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z'}));p.appendChild(sv('circle',{cx:12,cy:10,r:2.6,fill:'#fff',stroke:'none'}));
  a.appendChild(p);return a}
function copy(txt,b){
  function done(){b.textContent=W.copied_text||'Gekopieerd';clearTimeout(copiedTimer);copiedTimer=setTimeout(function(){b.textContent=W.copy_label||'Kopieer adres'},1800)}
  function fb(){var t=document.createElement('textarea');t.value=txt;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(t);done()}
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(done,fb);else fb()}
function render(){
  root.textContent='';var L=locs();
  if(!L.length){root.appendChild(el('p',{className:'empty'},'Er is nog geen adres ingevuld.'));return}
  if(cur>=L.length)cur=0;var l=L[cur],addr=l.lines.join(', ');
  var card=el('div',{className:'card'});card.appendChild(art());
  var b=el('div',{className:'body'});
  if(W.title)b.appendChild(el('h3',null,W.title));
  if(W.show_all&&L.length>1){var t=el('div',{className:'tabs'});
    L.forEach(function(x,i){var k=el('button',{type:'button',className:'tab'+(i===cur?' on':'')},x.name);k.onclick=function(){cur=i;render()};t.appendChild(k)});b.appendChild(t)}
  var ad=el('address',{className:'addr'});l.lines.forEach(function(x,i){if(i)ad.appendChild(document.createElement('br'));ad.appendChild(document.createTextNode(x))});b.appendChild(ad);
  if(W.show_note&&W.note)b.appendChild(el('p',{className:'note'},W.note));
  var bt=el('div',{className:'btns'});
  var r=el('a',{className:'btn',href:url(addr),target:'_blank',rel:'noopener'},W.button_label||'Route');bt.appendChild(r);
  if(W.show_copy){var c=el('button',{type:'button',className:'btn alt'},W.copy_label||'Kopieer adres');c.onclick=function(){copy(addr,c)};bt.appendChild(c)}
  b.appendChild(bt);card.appendChild(b);root.appendChild(card)}
render();
})();
