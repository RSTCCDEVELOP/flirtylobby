(function(){
var W=window.WIDGET||{},$=function(i){return document.getElementById(i)},cur=0,timer;
function lang(){return window.WIDGET_LANG||'nl'}
function num(v,o){try{return new Intl.NumberFormat(lang(),o).format(v)}catch(e){return new Intl.NumberFormat('nl',o).format(v)}}
function date(s){var d=new Date(s);if(isNaN(d))return'';try{return new Intl.DateTimeFormat(lang(),{dateStyle:'long',timeStyle:'short'}).format(d)}catch(e){return d.toLocaleString()}}
function money(v){var c=W.currency||'EUR';try{return num(v,{style:'currency',currency:c,minimumFractionDigits:v%1?2:0})}catch(e){return c+' '+v}}
var T={nl:{off:'korting',from:'vanaf',until:'Geldig tot',none:'Er is op dit moment geen kortingscode.'},en:{off:'off',from:'from',until:'Valid until',none:'There is no discount code at the moment.'},de:{off:'Rabatt',from:'ab',until:'Gültig bis',none:'Zurzeit gibt es keinen Rabattcode.'},fr:{off:'de réduction',from:'dès',until:'Valable jusqu\'au',none:'Aucun code de réduction pour le moment.'},es:{off:'de descuento',from:'desde',until:'Válido hasta',none:'No hay ningún código de descuento ahora.'}};
function t(k){return(T[lang()]||T.nl)[k]}
function list(){
  var D=window.WIDGET_DATA,use=W.source!=='own'&&D&&D.active&&D.items&&D.items.length;
  if(use)return D.items.filter(function(i){return i&&i.code}).map(function(i){return{code:String(i.code),title:W.title,text:String(i.text||W.text||''),kind:i.kind,value:+i.value||0,min:+i.min||0,until:i.until||''}});
  if(W.source==='plugin'||!W.code)return[];
  return[{code:String(W.code),title:W.title,text:W.text,kind:W.kind,value:+W.value||0,min:+W.min||0,until:W.until||''}];
}
function offer(i){if(!i.value)return'';return i.kind==='fixed'?money(i.value)+' '+t('off'):num(i.value/100,{style:'percent',maximumFractionDigits:2})+' '+t('off')}
function copy(code){
  var done=function(){var b=$('bt');b.textContent=W.copied_text||'';$('sr').textContent=W.copied_text||'';clearTimeout(timer);timer=setTimeout(function(){b.textContent=W.copy_text||'';$('sr').textContent=''},2000)};
  var fb=function(){var a=document.createElement('textarea');a.value=code;a.setAttribute('readonly','');a.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(a);done()};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(code).then(done,fb)}else fb();
}
function render(){
  var L=list(),first=W.which!=='all',tabs=$('tabs');
  var has=L.length>0;$('cp').hidden=!has;$('em').hidden=has;$('em').textContent=t('none');
  tabs.textContent='';tabs.hidden=!(has&&!first&&L.length>1);
  if(!has)return;
  if(cur>=L.length)cur=0;if(first)cur=0;
  if(!tabs.hidden)L.forEach(function(i,k){var b=document.createElement('button');b.type='button';b.className='tb';b.textContent=i.code;b.setAttribute('aria-pressed',k===cur?'true':'false');b.onclick=function(){cur=k;render()};tabs.appendChild(b)});
  var i=L[cur];
  $('off').textContent=offer(i);$('tx').textContent=i.text||'';
  $('cd').textContent=i.code;
  var mn=$('mn'),un=$('un');
  mn.hidden=!(W.show_min&&i.min>0);mn.textContent=mn.hidden?'':t('from')+' '+money(i.min);
  var d=i.until&&W.show_until?date(i.until):'';un.hidden=!d;un.textContent=d?t('until')+' '+d:'';
  $('bt').onclick=function(){copy(i.code)};
}
window.addEventListener('message',function(e){if(e.data&&e.data.widgetLang){window.WIDGET_LANG=e.data.widgetLang;render()}});
render();
})();
