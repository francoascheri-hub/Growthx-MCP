// MCP Apps (io.modelcontextprotocol/ui) widget for GrowthX event tools.
// Same black agenda design as lib/agendaHtml.ts (PDF + inline artifact). Skybridge uses the same HTML.

import { AGENDA_CSS, WIDGET_EXTRA_CSS } from "./agendaHtml";

export const EVENTS_UI_URI = "ui://growthx/events-v6.html";
export const EVENTS_SKYBRIDGE_URI = "ui://growthx/events-skybridge-v6.html";
export const MCP_APP_MIME = "text/html;profile=mcp-app";
export const SKYBRIDGE_MIME = "text/html+skybridge";

/** Luma og:image hosts (verified via lu.ma pages in data/events.json) plus our PDF origin. */
export const WIDGET_CSP_RESOURCE_DOMAINS = [
  "https://images.lumacdn.com",
  "https://og.luma.com",
  "https://cdn.lu.ma",
  "https://social-images.lu.ma",
  "https://growthx-mcp.vercel.app",
] as const;

export const WIDGET_CSP_CONNECT_DOMAINS = [
  "https://growthx-mcp.vercel.app",
  "https://lu.ma",
  "https://luma.com",
  "https://calendar.google.com",
] as const;

export const WIDGET_UI_CSP = {
  resourceDomains: [...WIDGET_CSP_RESOURCE_DOMAINS],
  connectDomains: [...WIDGET_CSP_CONNECT_DOMAINS],
};

export const WIDGET_OPENAI_CSP = {
  resource_domains: [...WIDGET_CSP_RESOURCE_DOMAINS],
  connect_domains: [...WIDGET_CSP_CONNECT_DOMAINS],
  redirect_domains: ["https://lu.ma", "https://luma.com", "https://calendar.google.com", "https://growthx-mcp.vercel.app"],
};


const CSS = AGENDA_CSS + WIDGET_EXTRA_CSS;

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

  function renderAgenda(v){
    root.textContent="";
    var w=el("div","wrap");
    w.appendChild(el("div","kicker","GrowthX \\u00b7 San Francisco"));
    w.appendChild(el("h1","",v.title||"Your week in SF tech"));
    w.appendChild(el("div","sub",v.subtitle||""));
    if(v.summary) w.appendChild(el("div","sum",v.summary));
  if(v.days&&v.days.length){
    var strip=el("div","strip");
    v.days.forEach(function(day){
      var d=el("div","day");
      d.appendChild(el("div","dn",day.weekday));
      d.appendChild(el("div","dd",day.date));
      (day.lines||[]).forEach(function(ln){
        var line=el("div","dl");
        line.appendChild(document.createTextNode(ln.time+" \\u00b7 "+ln.title+" \\u00b7 "));
        var r=el("span","r","#"+ln.rank);
        line.appendChild(r);
        d.appendChild(line);
      });
      strip.appendChild(d);
    });
    w.appendChild(strip);
  }
  var grid=el("div","grid");
  if(!v.items||!v.items.length) grid.appendChild(el("div","empty","No matching events in this window."));
  else v.items.forEach(function(it){
    var c=el("article","card");
    var cov=el("div","cover");
    cov.appendChild(el("span","ini",it.initial||(it.title||"G").charAt(0).toUpperCase()));
    if(it.cover){
      var img=el("img","cimg"); img.alt=""; img.onerror=function(){ if(img.parentNode) img.parentNode.removeChild(img); };
      img.src=it.cover; cov.appendChild(img);
    }
    c.appendChild(cov);
    var body=el("div","body");
    var row=el("div","row");
    row.appendChild(el("span","pill",it.pill));
    row.appendChild(el("span","badge","#"+it.rank));
    body.appendChild(row);
    body.appendChild(el("div","t",it.title));
    if(it.meta) body.appendChild(el("div","m",it.meta));
    if(it.overlapsWith) body.appendChild(el("span","ov","Overlaps with #"+it.overlapsWith));
    if(it.why) body.appendChild(el("div","w",it.why));
    if(it.people) body.appendChild(el("div","pp",it.people));
    var foot=el("div","f");
    var tags=el("div","tags");
    (it.tags||[]).forEach(function(t){ tags.appendChild(el("span","tag","#"+t)); });
    if((it.tags||[]).length){ foot.appendChild(tags); body.appendChild(foot); }
    var btns=el("div","btns");
    if(it.url){
      var b1=el("button","btn pri","Register");
      b1.type="button"; b1.onclick=function(){ openLink(it.url); };
      btns.appendChild(b1);
    }
    var cal=gcal(it);
    if(cal){
      var b2=el("button","btn","Add to calendar");
      b2.type="button"; b2.onclick=function(){ openLink(cal); };
      btns.appendChild(b2);
    }
    body.appendChild(btns);
    c.appendChild(body);
    grid.appendChild(c);
  });
  w.appendChild(grid);
  if(v.pdfUrl){
    var pdfWrap=el("div","btns");
    var pdf=el("button","btn","Download PDF");
    pdf.type="button"; pdf.onclick=function(){ openLink(v.pdfUrl); };
    if(v.icsUrl&&v.items&&v.items.length){
      var wk=el("button","btn pri","Add whole week to calendar");
      wk.type="button"; wk.onclick=function(){ openLink(v.icsUrl); };
      pdfWrap.appendChild(wk);
    }
    pdfWrap.appendChild(pdf);
    w.appendChild(pdfWrap);
  }
  var foot=el("div","foot");
  foot.appendChild(el("span","", "growthx-mcp.vercel.app"));
  foot.appendChild(el("span","", (v.from||"")+" \\u2013 "+(v.to||"")+" \\u00b7 times in PT"));
  w.appendChild(foot);
  root.appendChild(w);
  reportSize();
  }

  function render(data){
    if(!data||typeof data!=="object") return;
    if(data.agendaView) { renderAgenda(data.agendaView); return; }
    var items=data.agenda||data.recommendations||data.results||data.similar||data.matches||data.events;
    if(!Array.isArray(items)){
      if(data.event&&data.event.title) items=[Object.assign({},data.event,{why:data.tldr})];
      else if(data.title&&data.start) items=[data];
      else return;
    }
    var n=items.length, goal=data.goal||data.audience||"SF tech events";
    renderAgenda({
      title: goal,
      subtitle: n+" pick"+(n===1?"":"s"),
      from: (data.week&&data.week.start)||"",
      to: (data.week&&data.week.end)||"",
      pdfUrl: data.pdfUrl||"",
      icsUrl: data.pdfUrl?String(data.pdfUrl).replace("/api/agenda.pdf","/api/agenda.ics"):"",
      days: [],
      items: items.map(function(ev,i){
        return {
          rank: ev.rank||i+1,
          pill: ev.when||ev.day||"",
          title: ev.title||"Untitled",
          meta: [ev.venue,ev.host,ev.price].filter(Boolean).join(" \\u00b7 "),
          why: ev.why||ev.fit||"",
          tags: (ev.tags||[]).slice(0,3),
          url: ev.url||"",
          cover: ev.cover,
          start: ev.start||"",
          end: ev.end||"",
          venue: ev.venue||""
        };
      })
    });
  }

  function fromResult(r){
    if(!r) return null;
    if(r.structuredContent) return r.structuredContent;
    var c=r.content;
    if(Array.isArray(c)) for(var i=0;i<c.length;i++){ if(c[i]&&c[i].type==="text"){ try{ return JSON.parse(c[i].text); }catch(e){} } }
    return null;
  }

  // Height of the content itself (documentElement.scrollHeight never shrinks below the iframe viewport).
  var lastH=0;
  function reportSize(){
    var h=Math.ceil(root.getBoundingClientRect().height);
    if(!h||h===lastH) return;
    lastH=h;
    notify("ui/notifications/size-changed",{height:h});
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

  function fromOpenAI(){ try{ if(window.openai&&window.openai.toolOutput) render(window.openai.toolOutput); }catch(e){} }
  window.addEventListener("openai:set_globals",function(e){
    var g=e&&e.detail&&e.detail.globals;
    if(g&&g.toolOutput) render(g.toolOutput); else fromOpenAI();
  });
  fromOpenAI();

  if(inHost&&!window.openai){
    rpc("ui/initialize",{protocolVersion:"2026-01-26",appInfo:{name:"growthx-events",version:"0.2.0"},appCapabilities:{}})
      .then(function(){ notify("ui/notifications/initialized",{}); },function(){ notify("ui/notifications/initialized",{}); });
  }
  if(window.ResizeObserver) new ResizeObserver(reportSize).observe(root);
  reportSize();
})();
`;

export function eventsWidgetHtml(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GrowthX events</title><style>${CSS}</style></head><body><div id="app"><div class="wrap"><div class="empty">Loading events…</div></div></div><script>${JS}</script></body></html>`;
}
