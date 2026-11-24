(function(){var W=WIDGET,prev=!!window.WIDGET_PREVIEW,root=document.getElementById('root'),shown=false,end=new Date(W.date).getTime();
var ICONS={megafoon:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',label:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',gift:'<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8c-2.5 0-4-1-4-2.5S9 3 10.5 4 12 8 12 8zm0 0c2.5 0 4-1 4-2.5S15 3 13.5 4 12 8 12 8z"/>'};
var ic=document.getElementById('ic');if(ICONS[W.icon]){ic.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+ICONS[W.icon]+'</svg>'}
var u=String(W.url||''),a=document.getElementById('btn');
if(!W.button){a.hidden=true}else{a.href=/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)?u:'#';if(/^https?:/i.test(a.getAttribute('href'))){a.target='_blank';a.rel='noopener'}}
var x=document.getElementById('x'),ok=document.getElementById('ok');x.hidden=!W.closable;ok.hidden=!(W.ack&&W.ack_text);
var cd=document.getElementById('cd');
function p(n){return n<10?'0'+n:String(n)}
function tick(){var l=end-Date.now();if(!W.countdown||isNaN(end)||l<=0){cd.hidden=true;return}var s=Math.floor(l/1000),d=Math.floor(s/86400);cd.textContent=(W.countdown_label?W.countdown_label+' ':'')+(d>0?d+'d ':'')+p(Math.floor(s%86400/3600))+':'+p(Math.floor(s%3600/60))+':'+p(s%60);cd.hidden=false}
if(W.countdown&&!isNaN(end)){tick();setInterval(tick,1000)}
function msg(o){o.widget=WIDGET_KEY;o.freq=String(W.frequency||'session');parent.postMessage(o,'*')}
function close(){if(!shown)return;shown=false;root.hidden=true;msg({widgetPopup:'close'})}
x.addEventListener('click',close);ok.addEventListener('click',close);
if(prev){document.documentElement.classList.add('preview');root.hidden=false;return}
root.hidden=true;
addEventListener('message',function(e){if(e.data&&e.data.widgetPopupShow){shown=true;root.hidden=false}});
msg({widgetPopup:'ready'});
setTimeout(function(){msg({widgetPopup:'open',pos:W.position==='onderaan'?'bottom':'top',w:0,h:window.innerWidth<520?72:56,scroll:Number(W.scroll)||0})},Math.max(0,Number(W.delay)||0)*1000);
})();
