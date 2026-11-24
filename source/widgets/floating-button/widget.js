(function(){var W=WIDGET,prev=!!window.WIDGET_PREVIEW,root=document.getElementById('root'),fab=document.getElementById('fab'),shown=false;
var ICONS={telefoon:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>','e-mail':'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',chat:'<path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.500A8 8 0 1 1 21 12z"/>',agenda:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>'};
var has=!!ICONS[W.icon],ic=document.getElementById('ic'),label=String(W.label||'');
if(has){ic.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+ICONS[W.icon]+'</svg>'}
if(has)root.classList.add('has-ic');if(W.pulse)root.classList.add('pulse');if(W.hover_label)root.classList.add('hov');
if(label)fab.setAttribute('aria-label',label);
var u=String(W.url||'');fab.href=/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u)?u:'#';
if(/^https?:/i.test(fab.getAttribute('href'))){fab.target='_blank';fab.rel='noopener'}
else if(fab.getAttribute('href')==='#')fab.addEventListener('click',function(e){e.preventDefault()});
function msg(o){o.widget=WIDGET_KEY;o.freq=String(W.frequency||'always');parent.postMessage(o,'*')}
if(prev){document.documentElement.classList.add('preview');root.hidden=false;return}
function size(){root.classList.remove('hov');var r=fab.getBoundingClientRect(),w=Math.ceil(r.width),h=Math.ceil(r.height);if(W.hover_label)root.classList.add('hov');return{w:w+40,h:h+40}}
root.hidden=true;
addEventListener('message',function(e){if(e.data&&e.data.widgetPopupShow){shown=true;root.hidden=false}});
msg({widgetPopup:'ready'});
setTimeout(function(){root.hidden=false;root.style.visibility='hidden';var s=size();root.hidden=true;root.style.visibility='';
msg({widgetPopup:'open',pos:W.position==='linksonder'?'bl':'br',w:s.w,h:s.h,scroll:Number(W.scroll)||0})},Math.max(0,Number(W.delay)||0)*1000);
})();
