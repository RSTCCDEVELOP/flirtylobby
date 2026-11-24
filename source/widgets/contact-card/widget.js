(function(){
var W=window.WIDGET,D=window.WIDGET_DATA,root=document.getElementById('root');
var OK=/^(https?:|mailto:|tel:|\/|#)/i;
function tx(v){if(v&&typeof v==='object'){var l=window.WIDGET_LANG||'nl';return String(v[l]||v.nl||v[Object.keys(v)[0]]||'')}return v==null?'':String(v)}
function safe(u){return OK.test(u)?u:'#'}
function web(u){u=String(u||'').trim();return u&&!/^[a-z][a-z0-9+.-]*:/i.test(u)?'https://'+u:u}
function icon(p){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');var e=document.createElementNS('http://www.w3.org/2000/svg','path');e.setAttribute('d',p);s.appendChild(e);return s}
var IC={call:'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',mail:'M3 6h18v12H3zM3 7l9 6 9-6',wa:'M4 20l1.3-4.2A8 8 0 1 1 8.3 18.8z',route:'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'};
function get(){
  var use=W.source!=='own'&&D&&D.active&&D.items&&D.items.length;
  var c={name:W.name,role:W.role,phone:W.phone,email:W.email,website:W.website,address:W.address,empty:false};
  if(use){var e=D.items[0],a;
    if(W.location==='first'&&e.locations&&e.locations.length){var l=e.locations[0];
      a=[(l.street+' '+l.house_number).trim(),(l.postal_code+' '+l.city).trim()].filter(Boolean).join(', ');
      c.name=l.name||e.name;c.phone=l.phone||e.phone;c.email=l.email||e.email}
    else{a=[(e.street+' '+e.number).trim(),(e.zip+' '+e.city).trim()].filter(Boolean).join(', ');c.name=e.name;c.phone=e.phone;c.email=e.email}
    c.website=e.website;c.address=a}
  else if(W.source==='plugin')c.empty=true;
  return c}
function btn(href,label,ic,alt){var a=document.createElement('a');a.className='btn'+(alt?' alt':'');a.href=safe(href);a.target='_blank';a.rel='noopener';a.appendChild(icon(IC[ic]));a.appendChild(document.createTextNode(label));return a}
function render(){
  root.textContent='';root.className='cc '+(W.layout||'horizontal');
  var c=get();
  if(c.empty){var p=document.createElement('p');p.className='empty';p.textContent='Er zijn nog geen bedrijfsgegevens ingevuld.';root.appendChild(p);return}
  var card=document.createElement('div');card.className='card';
  var av=document.createElement('div');av.className='av';
  if(W.photo&&/^(https?:\/\/|\/)/i.test(W.photo)){var im=document.createElement('img');im.src=W.photo;im.alt='';av.appendChild(im)}
  else av.textContent=String(c.name||'?').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x.charAt(0).toUpperCase()}).join('');
  var b=document.createElement('div');b.className='body';
  var h=document.createElement('h3');h.textContent=c.name;b.appendChild(h);
  if(c.role){var r=document.createElement('p');r.className='role';r.textContent=c.role;b.appendChild(r)}
  if(W.show_details){var ul=document.createElement('ul');
    [['Tel.',c.phone,c.phone?'tel:'+c.phone.replace(/[^\d+]/g,''):''],['E-mail',c.email,c.email?'mailto:'+c.email:''],['Website',c.website,web(c.website)],['Adres',c.address,'']].forEach(function(x){
      if(!x[1])return;var li=document.createElement('li'),s=document.createElement('span');s.textContent=x[0];li.appendChild(s);
      if(x[2]){var a=document.createElement('a');a.href=safe(x[2]);a.target='_blank';a.rel='noopener';a.textContent=x[1];li.appendChild(a)}else li.appendChild(document.createTextNode(x[1]));ul.appendChild(li)});
    b.appendChild(ul)}
  var bt=document.createElement('div');bt.className='btns';
  if(W.show_call&&c.phone)bt.appendChild(btn('tel:'+c.phone.replace(/[^\d+]/g,''),W.call_label||'Bel','call'));
  if(W.show_mail&&c.email)bt.appendChild(btn('mailto:'+c.email,W.mail_label||'Mail','mail',true));
  var wa=String(W.whatsapp||'').replace(/\D/g,'');
  if(W.show_whatsapp&&wa)bt.appendChild(btn('https://wa.me/'+wa,'WhatsApp','wa',true));
  if(W.show_route&&c.address)bt.appendChild(btn('https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(c.address),W.route_label||'Route','route',true));
  if(bt.children.length)b.appendChild(bt);
  card.appendChild(av);card.appendChild(b);root.appendChild(card)}
render();
window.addEventListener('message',function(e){if(e.data&&e.data.widgetLang){window.WIDGET_LANG=e.data.widgetLang;render()}});
})();
