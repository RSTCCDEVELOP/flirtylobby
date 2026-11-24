(function(){
var W=window.WIDGET,box=document.querySelector('.lg'),tr=document.getElementById('tr');
var al={links:'l-links',rechts:'l-rechts'}[W.align]||'l-midden';
box.className+=' '+al+(W.layout==='raster'?' raster':'')+(W.layout==='lopend'?' lopend':'')+(W.grayscale?' gs':'');
function okUrl(u){u=String(u||'').trim();return /^(https:\/\/|\/(?!\/))/i.test(u)?u:''}
function okLink(u){u=String(u||'').trim();return /^(https?:|mailto:|tel:|\/(?!\/)|#)/i.test(u)?u:''}
var items=[];
String(W.logos||'').split('\n').forEach(function(line){if(!line.trim())return;var p=line.split('|');items.push({img:okUrl(p[0]),name:(p[1]||'').trim(),link:okLink(p[2])})});
if(!items.length){['Bakkerij Vries','Bakker Advies','Slagerij De Wit','Kaashuis Noord','Groen & Co','Studio Linde'].forEach(function(n){items.push({img:'',name:n,link:''})})}
function make(it,dup){
if(!it.img&&(!W.show_names||!it.name))return null;
var el=document.createElement(it.link?'a':'div');el.className='it'+(it.img?'':' tile')+(dup?' dup':'');
if(it.link){el.href=it.link;el.target='_blank';el.rel='noopener'}
if(dup){el.setAttribute('aria-hidden','true');if(it.link)el.tabIndex=-1}
if(it.img){var i=document.createElement('img');i.src=it.img;i.alt=it.name;i.loading='lazy';el.appendChild(i)}else el.textContent=it.name;
return el}
var n=0;items.forEach(function(it){var e=make(it,false);if(e){tr.appendChild(e);n++}});
if(W.layout==='lopend'&&n){items.forEach(function(it){var e=make(it,true);if(e)tr.appendChild(e)});tr.style.setProperty('--d',Math.max(12,n*5)+'s')}
})();
