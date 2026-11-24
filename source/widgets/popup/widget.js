(function(){var W=WIDGET,prev=!!window.WIDGET_PREVIEW,root=document.getElementById('root'),end=new Date(W.date).getTime(),shown=false;
var u=String(W.url||'');var a=document.getElementById('b');a.href=/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)?u:'#';if(a.getAttribute('href')!=='#'){a.target='_blank';a.rel='noopener'}
var cd=document.getElementById('cd');if(!W.countdown||isNaN(end))cd.hidden=true;
function p(n){return String(n)}
function tick(){var l=end-Date.now();if(l<=0){cd.hidden=true;return}var s=Math.floor(l/1000);document.getElementById('d').textContent=p(Math.floor(s/86400));document.getElementById('h').textContent=p(Math.floor(s%86400/3600));document.getElementById('m').textContent=p(Math.floor(s%3600/60));document.getElementById('s').textContent=p(s%60)}
if(W.countdown&&!isNaN(end)){tick();setInterval(tick,1000)}
function msg(o){o.widget=WIDGET_KEY;o.freq=String(W.frequency||'session');parent.postMessage(o,'*')}
function close(){if(!shown)return;shown=false;root.hidden=true;msg({widgetPopup:'close'})}
document.getElementById('x').addEventListener('click',close);
root.addEventListener('click',function(e){if(e.target===root)close()});
a.addEventListener('click',function(){setTimeout(close,50)});
addEventListener('keydown',function(e){if(e.key==='Escape')close()});
if(prev){document.documentElement.classList.add('preview');root.hidden=false;return}
root.hidden=true;
addEventListener('message',function(e){if(e.data&&e.data.widgetPopupShow){shown=true;root.hidden=false}});
msg({widgetPopup:'ready'});
setTimeout(function(){msg({widgetPopup:'open'})},Math.max(0,Number(W.delay)||0)*1000);
})();
