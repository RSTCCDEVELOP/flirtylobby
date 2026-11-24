(function(){
var W=window.WIDGET||{},$=function(i){return document.getElementById(i)};
function lang(){return window.WIDGET_LANG||'nl'}
var T={nl:{left:'Nog {n} plaatsen',one:'Nog 1 plaats',none:'Er is op dit moment geen evenement.'},en:{left:'{n} places left',one:'1 place left',none:'There is no event at the moment.'},de:{left:'Noch {n} Plätze',one:'Noch 1 Platz',none:'Zurzeit gibt es keine Veranstaltung.'},fr:{left:'Encore {n} places',one:'Encore 1 place',none:'Aucun événement pour le moment.'},es:{left:'Quedan {n} plazas',one:'Queda 1 plaza',none:'No hay ningún evento ahora.'}};
function t(k){return(T[lang()]||T.nl)[k]}
function fmt(s){var d=new Date(s);if(isNaN(d))return'';try{return new Intl.DateTimeFormat(lang(),{dateStyle:'full',timeStyle:'short'}).format(d)}catch(e){return d.toLocaleString()}}
function ev(){
  var D=window.WIDGET_DATA,use=W.source!=='own'&&D&&D.active&&D.items&&D.items.length;
  if(use){
    var L=D.items.slice().sort(function(a,b){return new Date(a.start)-new Date(b.start)});
    if(W.which==='title'&&W.match_title){var m=String(W.match_title).toLowerCase();L=L.filter(function(i){return String(i.title).toLowerCase().indexOf(m)>-1})}
    var e=L[0];if(!e)return null;
    return{title:e.title,date:e.start,place:e.place,cap:e.capacity==null?0:+e.capacity,taken:+e.taken||0};
  }
  if(W.source==='plugin'||!(W.title||W.date))return null;
  return{title:W.title,date:W.date,place:W.place,cap:+W.capacity||0,taken:+W.taken||0};
}
function render(){
  var e=ev(),card=$('card'),em=$('em');
  card.hidden=!e;em.hidden=!!e;em.textContent=t('none');
  if(!e)return;
  $('ti').textContent=e.title||'';$('dt').textContent=fmt(e.date);$('pl').textContent=W.show_place?(e.place||''):'';
  var left=$('left'),bar=$('bar'),btn=$('btn'),unl=!(e.cap>0),rest=Math.max(0,e.cap-e.taken),full=!unl&&rest===0,warn=!unl&&!full&&rest<(+W.warn_below||0);
  left.hidden=bar.hidden=unl;
  if(!unl){
    left.textContent=full?(W.soldout_text||''):(rest===1?t('one'):t('left').replace('{n}',rest));
    left.className='left'+(warn||full?' warn':'');
    var pct=Math.min(100,Math.round(e.taken/e.cap*100));
    bar.hidden=!W.show_bar;bar.className='bar'+(warn||full?' warn':'');
    bar.setAttribute('aria-valuenow',pct);bar.setAttribute('aria-label',left.textContent);$('fill').style.width=pct+'%';
  }
  var u=String(W.button_url||'').trim(),ok=/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(u);
  btn.hidden=!(W.button_text&&ok);
  if(ok){btn.href=u;if(/^https?:/i.test(u)){btn.target='_blank';btn.rel='noopener'}else{btn.removeAttribute('target')}}
  btn.className='btn'+(full?' off':'');btn.setAttribute('aria-disabled',full?'true':'false');
}
window.addEventListener('message',function(x){if(x.data&&x.data.widgetLang){window.WIDGET_LANG=x.data.widgetLang;render()}});
render();
})();
