(function(){
var W=window.WIDGET,D=window.WIDGET_DATA,b=document.getElementById('b'),tt=document.getElementById('t');
function src(){var u=W.source!=='own'&&D&&D.active&&D.items&&D.items.length;return u?D.items[0]:W}
function rng(t){var o=[];String(t||'').split(',').forEach(function(p){var m=p.trim().match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);if(m)o.push([+m[1]*60+ +m[2],+m[3]*60+ +m[4]])});return o.sort(function(a,c){return a[0]-c[0]})}
function hm(x){x=x%1440;var h=Math.floor(x/60),m=x%60;return (h<10?'0':'')+h+':'+(m<10?'0':'')+m}
function wd(i){try{return new Date(2024,0,1+i).toLocaleDateString(window.WIDGET_LANG||'nl',{weekday:'long'})}catch(e){return ['maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag','zondag'][i]}}
function tick(){
  var s=src(),R=[],i;for(i=1;i<=7;i++)R.push(rng(s['d'+i]));
  var n=new Date(),d=(n.getDay()+6)%7,m=n.getHours()*60+n.getMinutes(),open=null;
  R[d].forEach(function(r){if(m>=r[0]&&m<r[1])open=r});
  var ot=s.open_text||W.open_text||'Nu geopend',ct=s.closed_text||W.closed_text||'Gesloten',txt;
  if(open){txt=ot+(W.show_time?', sluit om '+hm(open[1]):'')}
  else{var next=null;
    R[d].forEach(function(r){if(!next&&r[0]>m)next=['vandaag',r[0]]});
    for(var q=1;q<=7&&!next;q++){var dd=(d+q)%7;if(R[dd].length)next=[q===1?'morgen':wd(dd),R[dd][0][0]]}
    txt=ct+(W.show_time&&next?', opent '+next[0]+' om '+hm(next[1]):'')}
  tt.textContent=txt;
  b.className='b '+(open?'on':'off')+' '+(W.shape==='blok'?'blok':'pill')+' '+(W.size==='small'?'small':W.size==='large'?'large':'')+(W.pulse?' pulse':'')}
tick();setInterval(tick,30000);
window.addEventListener('message',function(e){if(e.data&&e.data.widgetLang){window.WIDGET_LANG=e.data.widgetLang;tick()}});
})();
