/* =====================================================================
   COMPONENT-SCRIPT (klein, zonder dependencies) — meenemen naar sites
   ===================================================================== */
(function(){
  function emit(el,name,detail){el.dispatchEvent(new CustomEvent(name,{bubbles:true,detail:detail}));}
  function pad(n){return (n<10?'0':'')+n;}
  function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]});}

  /* ---- Kalender ---- */
  document.querySelectorAll('[data-e2e-calendar]').forEach(function(root){
    var events=[];try{events=JSON.parse(root.getAttribute('data-events')||'[]');}catch(e){}
    var today=new Date(),m=(root.getAttribute('data-month')||'').split('-');
    var view=m.length===2?new Date(+m[0],+m[1]-1,1):new Date(today.getFullYear(),today.getMonth(),1);
    var selected=null;
    function evFor(ds){return events.filter(function(e){return e.date===ds}).sort(function(a,b){return (a.time||'')<(b.time||'')?-1:1});}
    function render(){
      var y=view.getFullYear(),mo=view.getMonth(),first=new Date(y,mo,1),offset=(first.getDay()+6)%7;
      var days=new Date(y,mo+1,0).getDate(),cells=Math.ceil((offset+days)/7)*7;
      var title=first.toLocaleDateString('nl-NL',{month:'long',year:'numeric'});
      var h='<div class="e2e-cal__head"><h3 class="e2e-cal__title">'+title+'</h3><div class="e2e-row" style="gap:.3rem">'+
        '<button class="e2e-btn e2e-btn--ghost e2e-btn--sm" data-cal="today">Vandaag</button>'+
        '<button class="e2e-btn e2e-btn--outline e2e-btn--icon e2e-btn--sm" data-cal="-1" aria-label="Vorige maand">‹</button>'+
        '<button class="e2e-btn e2e-btn--outline e2e-btn--icon e2e-btn--sm" data-cal="1" aria-label="Volgende maand">›</button></div></div><div class="e2e-cal__grid">';
      ['ma','di','wo','do','vr','za','zo'].forEach(function(d){h+='<div class="e2e-cal__dow">'+d+'</div>'});
      for(var i=0;i<cells;i++){
        var d=new Date(y,mo,1-offset+i),ds=iso(d),list=evFor(ds),cls='e2e-cal__day';
        if(d.getMonth()!==mo)cls+=' is-out'; if(ds===iso(today))cls+=' is-today'; if(ds===selected)cls+=' is-selected';
        h+='<button class="'+cls+'" data-date="'+ds+'" aria-label="'+d.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})+(list.length?', '+list.length+' afspraken':'')+'"><span class="e2e-cal__num">'+d.getDate()+'</span>';
        list.slice(0,2).forEach(function(e){h+='<span class="e2e-cal__ev" data-variant="'+esc(e.variant||'primary')+'">'+esc((e.time?e.time+' ':'')+e.title)+'</span>'});
        if(list.length>2)h+='<span class="e2e-cal__more">+'+(list.length-2)+' meer</span>';
        h+='</button>';
      }
      h+='</div>';
      if(selected){
        var sl=evFor(selected),sd=new Date(selected+'T12:00');
        h+='<div class="e2e-cal__list" aria-live="polite"><h4>'+sd.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'})+'</h4>'+
          (sl.length?sl.map(function(e){return '<div class="e2e-cal__item"><i data-variant="'+esc(e.variant||'primary')+'"></i><small>'+esc(e.time||'')+'</small><span>'+esc(e.title)+'</span></div>'}).join('')
          :'<span class="e2e-hint">Geen afspraken op deze dag.</span>')+'</div>';
      }
      root.innerHTML=h;
    }
    root.addEventListener('click',function(e){
      var nav=e.target.closest('[data-cal]');
      if(nav){var v=nav.getAttribute('data-cal');view=v==='today'?new Date(today.getFullYear(),today.getMonth(),1):new Date(view.getFullYear(),view.getMonth()+(+v),1);if(v==='today')selected=iso(today);render();return;}
      var day=e.target.closest('[data-date]');
      if(day){selected=day.getAttribute('data-date');var dd=new Date(selected+'T12:00');if(dd.getMonth()!==view.getMonth())view=new Date(dd.getFullYear(),dd.getMonth(),1);render();emit(root,'e2e:date',{date:selected,events:evFor(selected)});}
    });
    render();
  });

  /* ---- Tijdslots (één keuze per groep) ---- */
  document.addEventListener('click',function(e){
    var s=e.target.closest('[data-e2e-slots] .e2e-slot');if(!s||s.disabled)return;
    var g=s.closest('[data-e2e-slots]');
    g.querySelectorAll('.e2e-slot').forEach(function(b){if(!b.disabled)b.setAttribute('aria-pressed',b===s)});
    emit(g,'e2e:slot',{value:s.textContent.trim()});
  });

  /* ---- Kanban (drag & drop) ---- */
  document.querySelectorAll('[data-e2e-kanban]').forEach(function(board){
    var drag=null;
    function counts(){board.querySelectorAll('.e2e-kanban__col').forEach(function(c){var n=c.querySelector('[data-count]');if(n)n.textContent=c.querySelectorAll('.e2e-task').length;});}
    board.addEventListener('dragstart',function(e){var t=e.target.closest('.e2e-task');if(!t)return;drag=t;t.classList.add('is-dragging');try{e.dataTransfer.setData('text/plain','');e.dataTransfer.effectAllowed='move';}catch(_){}} );
    board.addEventListener('dragend',function(){if(drag)drag.classList.remove('is-dragging');drag=null;board.querySelectorAll('.is-over').forEach(function(c){c.classList.remove('is-over')});});
    board.addEventListener('dragover',function(e){var col=e.target.closest('.e2e-kanban__col');if(!col||!drag)return;e.preventDefault();
      board.querySelectorAll('.is-over').forEach(function(c){if(c!==col)c.classList.remove('is-over')});col.classList.add('is-over');
      var after=[].slice.call(col.querySelectorAll('.e2e-task:not(.is-dragging)')).find(function(t){var r=t.getBoundingClientRect();return e.clientY<r.top+r.height/2;});
      if(after)col.insertBefore(drag,after);else col.appendChild(drag);});
    board.addEventListener('drop',function(e){var col=e.target.closest('.e2e-kanban__col');if(!col||!drag)return;e.preventDefault();col.classList.remove('is-over');counts();
      emit(board,'e2e:move',{task:drag.textContent.trim().replace(/\s+/g,' '),column:col.getAttribute('data-col')});});
  });

  /* ---- Audio- & videospeler ---- */
  var ICON_PLAY='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>';
  var ICON_PAUSE='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
  var ICON_VOL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var ICON_MUTE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m16 9 6 6M22 9l-6 6"/></svg>';
  function fmt(s){if(!isFinite(s))return '0:00';s=Math.floor(s);return Math.floor(s/60)+':'+pad(s%60);}
  function setP(r){r.style.setProperty('--p',((r.value-r.min)/(r.max-r.min)*100)+'%');}
  window.e2eMedia=function(root){
    if(root._e2e)return;root._e2e=1;
    var media=root.querySelector('audio,video'),seek=root.querySelector('[data-seek]'),vol=root.querySelector('[data-vol]');
    var cur=root.querySelector('[data-current]'),dur=root.querySelector('[data-duration]'),mute=root.querySelector('[data-mute]'),fs=root.querySelector('[data-fullscreen]');
    var plays=root.querySelectorAll('[data-play]'),seeking=false;
    function ui(){var p=!media.paused;root.classList.toggle('is-playing',p);
      plays.forEach(function(b){b.innerHTML=p?ICON_PAUSE:ICON_PLAY;b.setAttribute('aria-label',p?'Pauzeren':'Afspelen');});}
    function toggle(){if(media.paused){document.querySelectorAll('audio,video').forEach(function(m){if(m!==media)m.pause()});var pr=media.play();pr&&pr.catch(function(){});}else media.pause();}
    plays.forEach(function(b){b.addEventListener('click',toggle)});
    if(media.tagName==='VIDEO')media.addEventListener('click',toggle);
    ['play','pause','ended'].forEach(function(ev){media.addEventListener(ev,ui)});
    media.addEventListener('loadedmetadata',function(){if(dur)dur.textContent=fmt(media.duration)});
    media.addEventListener('timeupdate',function(){if(cur)cur.textContent=fmt(media.currentTime);
      if(seek&&!seeking&&media.duration){seek.value=media.currentTime/media.duration*1000;setP(seek);}});
    if(seek){seek.addEventListener('input',function(){seeking=true;setP(seek);if(cur&&media.duration)cur.textContent=fmt(seek.value/1000*media.duration);});
      seek.addEventListener('change',function(){if(media.duration)media.currentTime=seek.value/1000*media.duration;seeking=false;});setP(seek);}
    if(vol){media.volume=vol.value/100;vol.addEventListener('input',function(){media.volume=vol.value/100;media.muted=vol.value==0;setP(vol);});setP(vol);}
    if(mute){function mu(){mute.innerHTML=media.muted?ICON_MUTE:ICON_VOL;mute.setAttribute('aria-label',media.muted?'Geluid aan':'Geluid uit');}
      mute.addEventListener('click',function(){media.muted=!media.muted;mu();});media.addEventListener('volumechange',mu);mu();}
    if(fs)fs.addEventListener('click',function(){
      if(document.fullscreenElement)document.exitFullscreen();
      else if(root.requestFullscreen)root.requestFullscreen();
      else if(media.webkitEnterFullscreen)media.webkitEnterFullscreen();});
    // afspeellijst
    root.querySelectorAll('[data-src]').forEach(function(b){b.addEventListener('click',function(){
      root.querySelectorAll('[data-src]').forEach(function(x){x.classList.toggle('is-current',x===b)});
      media.src=b.getAttribute('data-src');
      var t=root.querySelector('[data-title]');if(t)t.innerHTML=esc(b.getAttribute('data-name')||'')+'<small>'+esc(b.getAttribute('data-sub')||'')+'</small>';
      if(seek){seek.value=0;setP(seek);} toggle();
    });});
    media.addEventListener('ended',function(){var c=root.querySelector('[data-src].is-current'),li=c&&c.closest('li'),n=li&&li.nextElementSibling;n&&n.querySelector('[data-src]').click();});
    ui();
  };
  document.querySelectorAll('[data-e2e-audio],[data-e2e-video]').forEach(function(r){e2eMedia(r)});

  // Tabs
  document.querySelectorAll('[data-e2e-tabs]').forEach(function(root){
    var tabs=[].slice.call(root.querySelectorAll('.e2e-tabs__tab'));
    var panels=[].slice.call(root.querySelectorAll('.e2e-tabs__panel'));
    function select(i){tabs.forEach(function(t,j){t.setAttribute('aria-selected',i===j);t.tabIndex=i===j?0:-1;panels[j]&&(panels[j].hidden=i!==j);});}
    tabs.forEach(function(t,i){
      t.addEventListener('click',function(){select(i)});
      t.addEventListener('keydown',function(e){var d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(d){var n=(i+d+tabs.length)%tabs.length;select(n);tabs[n].focus();}});
    });
    select(Math.max(0,tabs.findIndex(function(t){return t.getAttribute('aria-selected')==='true'})));
  });
  // Mobiel menu
  document.addEventListener('click',function(e){
    var tg=e.target.closest('[data-e2e-nav-toggle]');
    if(tg){var nav=tg.closest('.e2e-nav');var open=nav.classList.toggle('is-open');tg.setAttribute('aria-expanded',open);}
    var m=e.target.closest('[data-e2e-modal]');
    if(m){var d=document.getElementById(m.getAttribute('data-e2e-modal'));d&&d.showModal();}
    var c=e.target.closest('[data-e2e-close]');
    if(c){var dl=c.closest('dialog');dl&&dl.close();}
    var t=e.target.closest('[data-e2e-toast]');
    if(t){e2eToast(t.getAttribute('data-e2e-toast'));}
  });
  // Klik op backdrop sluit modal
  document.querySelectorAll('dialog.e2e-modal').forEach(function(d){d.addEventListener('click',function(e){if(e.target===d)d.close();});});
  window.e2eToast=function(msg){
    var wrap=document.getElementById('e2e-toasts');if(!wrap){wrap=document.createElement('div');wrap.id='e2e-toasts';wrap.className='e2e-toasts';document.body.appendChild(wrap);}
    var el=document.createElement('div');el.className='e2e-toast';el.innerHTML='<i class="e2e-dot"></i>';el.appendChild(document.createTextNode(msg));
    wrap.appendChild(el);setTimeout(function(){el.remove()},2800);
  };
})();

/* =====================================================================
   THEMA-SCRIPT (alleen voor deze showcase)
   ===================================================================== */
(function(){
  var root=document.documentElement;
  var keys=[
    ['primary','Primair'],['secondary','Secundair'],['accent','Accent'],
    ['bg','Achtergrond'],['surface','Vlak'],['text','Tekst']
  ];
  var presets={
    'easy2edit':{primary:'#F0833A',secondary:'#58595B',accent:'#1F2A37',bg:'#FFFFFF',surface:'#F7F5F2',text:'#1F2328'},
    'Oceaan':  {primary:'#0E8FB8',secondary:'#14B8A6',accent:'#0B2540',bg:'#FFFFFF',surface:'#F1F7FA',text:'#0F1C2B'},
    'Bos':     {primary:'#2F7D4F',secondary:'#A3B18A',accent:'#1E2A22',bg:'#FBFAF6',surface:'#F0EEE4',text:'#1E2A22'},
    'Bordeaux':{primary:'#8E1F3D',secondary:'#C9A66B',accent:'#2A1218',bg:'#FFFDFB',surface:'#F7F0EC',text:'#2A1A1E'},
    'Nacht':   {primary:'#F59A55',secondary:'#8B93A7',accent:'#0B0D12',bg:'#12151C',surface:'#1B1F29',text:'#E8EAF0'},
    'Paars':   {primary:'#7C4DFF',secondary:'#FF6B9A',accent:'#1A1033',bg:'#FFFFFF',surface:'#F5F2FF',text:'#1D1730'},
    'Citrus':  {primary:'#FFD23F',secondary:'#3BCEAC',accent:'#1B1B1B',bg:'#FFFFFF',surface:'#FFF8E1',text:'#1B1B1B'},
    'Mono':    {primary:'#111111',secondary:'#6B6B6B',accent:'#111111',bg:'#FFFFFF',surface:'#F3F3F3',text:'#111111'},
    'Koraal':  {primary:'#FF6F59',secondary:'#254441',accent:'#254441',bg:'#FFFBF7',surface:'#FCEFE8',text:'#22302E'}
  };

  function hex(v){v=(v||'').trim();if(/^#[0-9a-f]{3}$/i.test(v))v='#'+v[1]+v[1]+v[2]+v[2]+v[3]+v[3];return /^#[0-9a-f]{6}$/i.test(v)?v.toUpperCase():null;}
  function lum(h){var c=[1,3,5].map(function(i){var x=parseInt(h.substr(i,2),16)/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];}
  function ratio(a,b){var A=lum(a),B=lum(b);return (Math.max(A,B)+.05)/(Math.min(A,B)+.05);}
  function onColor(h){return ratio(h,'#FFFFFF')>=ratio(h,'#151515')?'#FFFFFF':'#151515';}
  function get(k){return hex(getComputedStyle(root).getPropertyValue('--e2e-'+k))||'#000000';}

  var box=document.getElementById('colorInputs');
  keys.forEach(function(k){
    var row=document.createElement('div');row.className='doc-color';
    row.innerHTML='<label for="c-'+k[0]+'">'+k[1]+'</label><div class="doc-color__inputs"><input type="text" id="t-'+k[0]+'" aria-label="'+k[1]+' hex"><input type="color" id="c-'+k[0]+'" aria-label="'+k[1]+'"></div>';
    box.appendChild(row);
    var c=row.querySelector('[type=color]'),t=row.querySelector('[type=text]');
    c.addEventListener('input',function(){set(k[0],c.value)});
    t.addEventListener('change',function(){var v=hex(t.value);if(v)set(k[0],v);else t.value=get(k[0]);});
  });

  function set(k,v){root.style.setProperty('--e2e-'+k,v);sync();}
  function apply(p){Object.keys(p).forEach(function(k){root.style.setProperty('--e2e-'+k,p[k])});
    var dark=lum(p.bg)<.2;root.style.setProperty('--e2e-shadow-strength',dark?'40%':'10%');sync();}

  function sync(){
    ['primary','secondary','accent'].forEach(function(k){root.style.setProperty('--e2e-on-'+k,onColor(get(k)))});
    keys.forEach(function(k){var v=get(k[0]);document.getElementById('c-'+k[0]).value=v.toLowerCase();document.getElementById('t-'+k[0]).value=v;});
    var r1=ratio(get('text'),get('bg')),r2=ratio(get('primary'),get('on-primary')),r3=ratio(get('primary'),get('bg'));
    function f(r,min){return '<b class="'+(r>=min?'ok':'bad')+'">'+r.toFixed(1)+':1</b>'}
    document.getElementById('contrast').innerHTML='Contrast tekst/achtergrond '+f(r1,4.5)+'<br>Knoptekst op primair '+f(r2,4.5)+'<br>Primair op achtergrond '+f(r3,3)+' <span style="opacity:.7">(rand/iconen)</span>';
    swatches();
  }

  function swatches(){
    var list=[['primary','basis'],['secondary','basis'],['accent','basis'],['bg','basis'],['surface','basis'],['text','basis'],
      ['primary-soft','auto'],['primary-hover','auto'],['primary-ink','auto'],['muted','auto'],['border','auto'],['on-primary','auto']];
    document.getElementById('swatches').innerHTML=list.map(function(s){
      return '<div class="doc-swatch"><div style="background:var(--e2e-'+s[0]+')"></div><span>--e2e-'+s[0]+'<br><small style="color:var(--e2e-muted)">'+s[1]+'</small></span></div>';
    }).join('');
  }

  var pbox=document.getElementById('presets');
  Object.keys(presets).forEach(function(n){
    var p=presets[n],b=document.createElement('button');b.className='doc-preset';b.type='button';
    b.innerHTML='<i><b style="background:'+p.primary+'"></b><b style="background:'+p.secondary+'"></b><b style="background:'+p.accent+'"></b><b style="background:'+p.surface+'"></b></i>'+n;
    b.addEventListener('click',function(){apply(p)});pbox.appendChild(b);
  });

  var rad=document.getElementById('t-radius');
  rad.addEventListener('input',function(){root.style.setProperty('--e2e-radius',rad.value+'px');document.getElementById('t-radius-v').textContent=rad.value;});
  document.getElementById('t-head').addEventListener('change',function(e){root.style.setProperty('--e2e-font-heading',e.target.value)});
  document.getElementById('t-body').addEventListener('change',function(e){root.style.setProperty('--e2e-font-body',e.target.value)});

  var panel=document.getElementById('panel');
  document.querySelectorAll('[data-open-panel]').forEach(function(b){b.addEventListener('click',function(){panel.classList.add('is-open')})});
  document.querySelector('[data-close-panel]').addEventListener('click',function(){panel.classList.remove('is-open')});

  function copy(text,msg){
    function done(){e2eToast(msg)}
    try{navigator.clipboard.writeText(text).then(done,fallback);}catch(e){fallback();}
    function fallback(){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){window.prompt('Kopieer handmatig:',text);}ta.remove();}
  }
  document.querySelectorAll('[data-export]').forEach(function(b){b.addEventListener('click',function(){
    var cs=getComputedStyle(root),out=':root{\n';
    ['primary','secondary','accent','bg','surface','text','on-primary','on-secondary','on-accent','success','warning','danger','info','radius','font-heading','font-body','shadow-strength']
      .forEach(function(k){out+='  --e2e-'+k+': '+cs.getPropertyValue('--e2e-'+k).trim()+';\n'});
    copy(out+'}','CSS-variabelen gekopieerd');
  })});

  document.querySelectorAll('.doc-demo').forEach(function(d){
    d.querySelector('.doc-copy').addEventListener('click',function(){copy(d._src,'HTML gekopieerd')});
  });

  // Demo-audio: genereer korte melodieën als WAV, zodat de spelers zonder externe bestanden werken
  function tone(seed){
    var sr=22050,notes=[[262,330,392,523,392,330],[294,370,440,587,440,370,294],[330,415,494,659,494,415]][seed%3],len=0.55,rep=3;
    var total=Math.floor(sr*len*notes.length*rep),buf=new ArrayBuffer(44+total*2),v=new DataView(buf);
    function w(o,s){for(var i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))}
    w(0,'RIFF');v.setUint32(4,36+total*2,true);w(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,sr,true);v.setUint32(28,sr*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,total*2,true);
    var per=Math.floor(sr*len);
    for(var i=0;i<total;i++){var n=notes[Math.floor(i/per)%notes.length],t=(i%per)/sr,env=Math.min(1,t*40)*Math.exp(-t*4);
      var s=(Math.sin(2*Math.PI*n*t)*.6+Math.sin(2*Math.PI*n*2*t)*.15)*env*.5;v.setInt16(44+i*2,s*32767,true);}
    return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
  }
  var tones={};
  function toneUrl(k){return tones[k]||(tones[k]=tone(+k));}
  document.querySelectorAll('[data-demo-tone]').forEach(function(el){
    var url=toneUrl(el.getAttribute('data-demo-tone'));
    if(el.tagName==='AUDIO')el.src=url;else{el.setAttribute('data-src',url);var l=el.querySelector('[data-len]');if(l)l.textContent=fmtLen(url,l);}
  });
  function fmtLen(url,el){var a=new Audio();a.preload='metadata';a.src=url;a.onloadedmetadata=function(){var s=Math.round(a.duration);el.textContent=Math.floor(s/60)+':'+('0'+s%60).slice(-2);};return '…';}

  // Kalender/kanban/slot-events zichtbaar maken in de showcase
  document.addEventListener('e2e:move',function(e){e2eToast('Verplaatst naar "'+e.detail.column+'"')});
  document.addEventListener('e2e:slot',function(e){e2eToast('Gekozen: '+e.detail.value)});

  sync();
})();