(function(){var W=WIDGET,prev=!!window.WIDGET_PREVIEW,$=function(i){return document.getElementById(i)},wx=null,lastDay='';
function lang(){return String(window.WIDGET_LANG||'nl')}
function fmt(o){var d=new Date();try{return new Intl.DateTimeFormat(lang(),o).format(d)}catch(e){return new Intl.DateTimeFormat('nl',o).format(d)}}
function weekNo(){var d=new Date(Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate())),n=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-n);return Math.ceil(((d-Date.UTC(d.getUTCFullYear(),0,1))/864e5+1)/7)}
var WORD={nl:'week',en:'week',de:'KW',fr:'semaine',es:'semana',it:'settimana',pt:'semana'};
function renderDate(){var o={},l=lang();lastDay=new Date().toDateString();
if(W.show_weekday)o.weekday='long';if(W.show_day)o.day='numeric';if(W.show_month)o.month='long';if(W.show_year)o.year='numeric';
var any=W.show_weekday||W.show_day||W.show_month||W.show_year;
$('wd').textContent=W.show_weekday?fmt({weekday:'long'}):'';$('big').textContent=W.show_day?fmt({day:'numeric'}):'';
var my=[];if(W.show_month)my.push(fmt({month:'long'}));if(W.show_year)my.push(fmt({year:'numeric'}));$('my').textContent=my.join(' ');
$('line').textContent=any?fmt(o):'';
$('big').hidden=!W.show_day;$('my').hidden=!my.length;$('wd').hidden=!W.show_weekday;
$('wk').textContent=W.show_week?(WORD[l.slice(0,2)]||'week')+' '+weekNo():'';$('wk').hidden=!W.show_week;
$('date').hidden=!any&&!W.show_week}
var KINDS={sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
part:'<circle cx="8" cy="8" r="3"/><path d="M8 2v1M2 8h1M3.8 3.8l.7.7M12.2 3.8l-.7.7"/><path d="M8 20a4 4 0 0 1 0-8 5 5 0 0 1 9.5 1A3.5 3.5 0 0 1 17 20z" transform="translate(1 0)"/>',
cloud:'<path d="M7 19a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 11a4 4 0 0 1-.5 8z"/>',
fog:'<path d="M7 14a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 6a4 4 0 0 1-.5 8z"/><path d="M4 18h16M7 21h10"/>',
rain:'<path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-.5 8z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
snow:'<path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-.5 8z"/><path d="M8 18v.1M12 19v.1M16 18v.1M10 21v.1M14 21v.1" stroke-width="3"/>',
storm:'<path d="M7 15a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 7a4 4 0 0 1-.5 8z"/><path d="M12 14l-2.5 4h4L11 22"/>'};
var TXT={nl:{sun:'zonnig',mostly:'overwegend zonnig',part:'half bewolkt',cloud:'bewolkt',fog:'mist',drizzle:'motregen',rain:'regen',snow:'sneeuw',showers:'buien',snowshowers:'sneeuwbuien',storm:'onweer'},
en:{sun:'sunny',mostly:'mostly sunny',part:'partly cloudy',cloud:'cloudy',fog:'fog',drizzle:'drizzle',rain:'rain',snow:'snow',showers:'showers',snowshowers:'snow showers',storm:'thunderstorm'}};
function kind(c){if(c===0)return['sun','sun'];if(c===1)return['mostly','sun'];if(c===2)return['part','part'];if(c===3)return['cloud','cloud'];if(c===45||c===48)return['fog','fog'];
if(c>=51&&c<=57)return['drizzle','rain'];if(c>=61&&c<=67)return['rain','rain'];if(c>=71&&c<=77)return['snow','snow'];if(c>=80&&c<=82)return['showers','rain'];if(c>=85&&c<=86)return['snowshowers','snow'];if(c>=95&&c<=99)return['storm','storm'];return['cloud','cloud']}
function renderWx(){if(!wx){$('wx').hidden=true;return}var k=kind(wx.code),t=TXT[lang().slice(0,2)]||TXT.nl;
$('wi').innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+KINDS[k[1]]+'</svg>';
$('wtmp').textContent=Math.round(wx.temp)+(W.unit==='fahrenheit'?'°F':'°C');$('wtx').textContent=W.weather_text?t[k[0]]:'';$('wpl').textContent=String(W.place||'');$('wx').hidden=false}
function load(){var la=Number(W.lat),lo=Number(W.lon);if(isNaN(la)||isNaN(lo)||!window.fetch)return;
var url='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(la)+'&longitude='+encodeURIComponent(lo)+'&current=temperature_2m,weather_code&timezone=auto'+(W.unit==='fahrenheit'?'&temperature_unit=fahrenheit':'');
fetch(url).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){var c=j&&j.current;if(!c||typeof c.temperature_2m!=='number')throw 0;wx={temp:c.temperature_2m,code:Number(c.weather_code)};renderWx()}).catch(function(){wx=null;renderWx()})}
renderDate();
if(W.weather){if(prev){wx={temp:W.unit==='fahrenheit'?64:18,code:2};renderWx()}else{load();setInterval(load,1800000)}}
setInterval(function(){if(lastDay!==new Date().toDateString())renderDate()},60000);
addEventListener('message',function(e){if(e.data&&e.data.widgetLang){window.WIDGET_LANG=e.data.widgetLang;renderDate();renderWx()}});
})();
