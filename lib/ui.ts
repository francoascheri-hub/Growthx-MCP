// MCP Apps (io.modelcontextprotocol/ui) widget for recommend_events / plan_my_week.
// Self-contained HTML: no external assets. Also served as an OpenAI Apps SDK (skybridge) template.

export const EVENTS_UI_URI = "ui://growthx/events.html";
export const EVENTS_SKYBRIDGE_URI = "ui://growthx/events-skybridge.html";
export const MCP_APP_MIME = "text/html;profile=mcp-app";
export const SKYBRIDGE_MIME = "text/html+skybridge";

const CSS = `
:root{--g:#0f7a4a;--gd:#0a5c37;--gs:#e3f2e9;--bg:#f7f6f1;--ink:#1d2420;--mut:#5f6b64;--line:#e4e2da}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{padding:14px;max-width:760px;margin:0 auto}
header{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.brand{font-weight:700;color:var(--g);letter-spacing:.02em;font-size:12px;text-transform:uppercase}
h1{font-size:16px;margin:2px 0 0;font-weight:650}
.sub{color:var(--mut);font-size:12px}
.list{display:grid;gap:10px}
.card{background:#fff;border:1px solid var(--line);border-left:4px solid var(--g);border-radius:10px;padding:12px 14px}
.when{font-size:12px;font-weight:600;color:var(--gd);text-transform:uppercase;letter-spacing:.03em}
.title{font-size:15px;font-weight:650;margin:2px 0 4px}
.meta{color:var(--mut);font-size:13px;display:flex;flex-wrap:wrap;gap:4px 12px}
.price{font-weight:600;color:var(--ink)}
.why{margin:8px 0;padding:6px 10px;background:var(--gs);border-radius:6px;font-size:13px;color:var(--gd)}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}
.tag{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--gs);color:var(--gd)}
.btns{display:flex;gap:8px;flex-wrap:wrap}
button{font:inherit;font-size:13px;font-weight:600;border-radius:8px;padding:6px 12px;cursor:pointer;border:1px solid var(--g)}
.pri{background:var(--g);color:#fff}.pri:hover{background:var(--gd)}
.sec{background:#fff;color:var(--g)}.sec:hover{background:var(--gs)}
.empty{color:var(--mut);padding:24px;text-align:center}
@media (max-width:480px){.wrap{padding:10px}.card{padding:10px 12px}}
`;

const JS = `
(function(){
  var root=document.getElementById("app");
  var nextId=1, pending={}, inHost=window.parent&&window.parent!==window;

  function rpc(method,params){
    if(!inHost) return Promise.reject(new Error("no host"));
    var id=nextId++;
    return new Promise(function(res,rej){
      pending[id]={res:res,rej:rej};
      window.parent.postMessage({jsonrpc:"2.0",id:id,method:method,params:params||{}},"*");
      setTimeout(function(){ if(pending[id]){ delete pending[id]; rej(new Error("timeout")); } },4000);
    });
  }
  function notify(method,params){ if(inHost) window.parent.postMessage({jsonrpc:"2.0",method:method,params:params||{}},"*"); }

  function el(tag,cls,text){ var e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=String(text); return e; }

  function icsDate(iso){ return new Date(iso).toISOString().replace(/[-:]/g,"").replace(/\\.\\d{3}/,""); }
  function gcal(ev){
    if(ev.calendar) return ev.calendar;
    if(!ev.start) return null;
    var end=ev.end||new Date(new Date(ev.start).getTime()+3600000).toISOString();
    var p=new URLSearchParams({action:"TEMPLATE",text:ev.title||"Event",dates:icsDate(ev.start)+"/"+icsDate(end),
      details:ev.url?("Register: "+ev.url):"",location:ev.venue||"",ctz:"America/Los_Angeles"});
    return "https://calendar.google.com/calendar/render?"+p.toString();
  }

  function openLink(url){
    if(!url) return;
    rpc("ui/open-link",{url:url}).then(function(r){ if(r&&r.isError) fallback(); }, fallback);
    function fallback(){
      try{ if(window.openai&&typeof window.openai.openExternal==="function"){ window.openai.openExternal({href:url}); return; } }catch(e){}
      window.open(url,"_blank","noopener");
    }
  }

  function card(ev){
    var c=el("article","card");
    c.appendChild(el("div","when",ev.when||ev.day||""));
    c.appendChild(el("div","title",ev.title||"Untitled event"));
    var m=el("div","meta");
    var where=[ev.venue,ev.neighborhood].filter(Boolean).join(" \\u00b7 ");
    if(where) m.appendChild(el("span","",where));
    if(ev.host) m.appendChild(el("span","","Host: "+ev.host));
    if(ev.price) m.appendChild(el("span","price",ev.price));
    c.appendChild(m);
    var why=ev.why||ev.fit||(ev.shared_tags&&ev.shared_tags.length?"Shared topics: "+ev.shared_tags.join(", "):"");
    if(why) c.appendChild(el("div","why",why));
    if(ev.tags&&ev.tags.length){ var t=el("div","tags"); ev.tags.slice(0,6).forEach(function(x){ t.appendChild(el("span","tag",x)); }); c.appendChild(t); }
    var b=el("div","btns");
    if(ev.url){ var r=el("button","pri","Register"); r.type="button"; r.onclick=function(){ openLink(ev.url); }; b.appendChild(r); }
    var cal=gcal(ev);
    if(cal){ var a=el("button","sec","Add to calendar"); a.type="button"; a.onclick=function(){ openLink(cal); }; b.appendChild(a); }
    c.appendChild(b);
    return c;
  }

  function render(data){
    if(!data||typeof data!=="object") return;
    var items=data.agenda||data.recommendations||data.results||data.similar||data.matches||data.events, heading;
    if(!Array.isArray(items)){
      if(data.event&&data.event.title){ items=[Object.assign({},data.event,{why:data.tldr})]; heading="Event brief"; }
      else if(data.title&&data.start){ items=[data]; heading="Event"; }
      else return;
    }
    if(!heading) heading=data.goal?("For: "+data.goal):data.agenda?"Your week":data.audience?("Sponsor fit: "+data.audience)
      :data.similar?("Similar to: "+((data.event&&data.event.title)||"this event")):data.results?"Search results":"Recommended events";
    root.textContent="";
    var w=el("div","wrap"), h=el("header"), left=el("div");
    left.appendChild(el("div","brand","GrowthX \\u00b7 SF events"));
    left.appendChild(el("h1","",heading));
    h.appendChild(left);
    if(data.week&&data.week.start) h.appendChild(el("div","sub","Week "+data.week.start+" \\u2192 "+data.week.end));
    else h.appendChild(el("div","sub",items.length+" pick"+(items.length===1?"":"s")));
    w.appendChild(h);
    var l=el("div","list");
    if(!items.length) l.appendChild(el("div","empty","No matching events found."));
    items.forEach(function(ev){ l.appendChild(card(ev)); });
    w.appendChild(l);
    root.appendChild(w);
    reportSize();
  }

  function fromResult(r){
    if(!r) return null;
    if(r.structuredContent) return r.structuredContent;
    var c=r.content;
    if(Array.isArray(c)) for(var i=0;i<c.length;i++){ if(c[i]&&c[i].type==="text"){ try{ return JSON.parse(c[i].text); }catch(e){} } }
    return null;
  }

  function reportSize(){
    var h=Math.ceil(document.documentElement.scrollHeight);
    notify("ui/notifications/size-changed",{width:Math.ceil(document.documentElement.scrollWidth),height:h});
    try{ if(window.openai&&window.openai.notifyIntrinsicHeight) window.openai.notifyIntrinsicHeight(h); }catch(e){}
  }

  window.addEventListener("message",function(ev){
    var m=ev.data;
    if(!m||m.jsonrpc!=="2.0") return;
    if(m.id!=null&&pending[m.id]&&!m.method){
      var p=pending[m.id]; delete pending[m.id];
      if(m.error) p.rej(m.error); else p.res(m.result);
      return;
    }
    if(m.method==="ui/notifications/tool-result") render(fromResult(m.params));
    else if(m.method==="ui/resource-teardown"&&m.id!=null) window.parent.postMessage({jsonrpc:"2.0",id:m.id,result:{}},"*");
    else if(m.method==="ping"&&m.id!=null) window.parent.postMessage({jsonrpc:"2.0",id:m.id,result:{}},"*");
  });

  // OpenAI Apps SDK fallback
  function fromOpenAI(){ try{ if(window.openai&&window.openai.toolOutput) render(window.openai.toolOutput); }catch(e){} }
  window.addEventListener("openai:set_globals",function(e){
    var g=e&&e.detail&&e.detail.globals;
    if(g&&g.toolOutput) render(g.toolOutput); else fromOpenAI();
  });
  fromOpenAI();

  if(inHost&&!window.openai){
    rpc("ui/initialize",{protocolVersion:"2026-01-26",appInfo:{name:"growthx-events",version:"0.1.0"},appCapabilities:{}})
      .then(function(){ notify("ui/notifications/initialized",{}); },function(){ notify("ui/notifications/initialized",{}); });
  }
  if(window.ResizeObserver) new ResizeObserver(reportSize).observe(document.body);
})();
`;

export function eventsWidgetHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrowthX events</title><style>${CSS}</style></head><body><div id="app"><div class="wrap"><div class="empty">Loading events…</div></div></div><script>${JS}</script></body></html>`;
}

// Static fallback for clients that don't render MCP Apps (e.g. Claude.ai web): same look, no JS.
export type FallbackCard = { title?: string; when?: string; venue?: string; why?: string; url?: string };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const FALLBACK_CSS = `${CSS}
.hero{background:var(--g);color:#fff;border-radius:12px;padding:16px 18px;margin-bottom:12px}
.hero .brand{color:#cfe9da}.hero h1{color:#fff;font-size:18px}.hero .sub{color:#e3f2e9}
a.pri{display:inline-block;text-decoration:none;font-size:13px;font-weight:600;border-radius:8px;padding:6px 12px;border:1px solid var(--g)}
`;

export function eventsFallbackHtml(heading: string, cards: FallbackCard[]): string {
  const body = cards.length
    ? cards
        .map((c) => {
          const when = c.when ? `<div class="when">${esc(/\bPT$/.test(c.when) ? c.when : `${c.when} PT`)}</div>` : "";
          const venue = c.venue ? `<div class="meta"><span>${esc(c.venue)}</span></div>` : "";
          const why = c.why ? `<div class="why">${esc(c.why)}</div>` : "";
          const btn = c.url && /^https?:\/\//.test(c.url) ? `<div class="btns"><a class="pri" href="${esc(c.url)}" target="_blank" rel="noopener">Register on Luma</a></div>` : "";
          return `<article class="card">${when}<div class="title">${esc(c.title || "Untitled event")}</div>${venue}${why}${btn}</article>`;
        })
        .join("")
    : `<div class="empty">No matching events found.</div>`;
  const n = `${cards.length} event${cards.length === 1 ? "" : "s"}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrowthX events</title><style>${FALLBACK_CSS}</style></head><body><div class="wrap"><header class="hero"><div><div class="brand">GrowthX \u00b7 SF events</div><h1>${esc(heading)}</h1><div class="sub">${n}</div></div></header><div class="list">${body}</div></div></body></html>`;
}
