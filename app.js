const posts=[
{id:1,title:"Example visual text file",tags:["example","text","archive"],user:"ExampleUser",text:"SOYBREACH\n\nThis is a visual text file preview.\n\nText is the primary content."},
{id:2,title:"Archive sample",tags:["archive","internet"],user:"Archivist",text:"A second example post.\n\nDownloadable text belongs here."},
{id:3,title:"Tagged note",tags:["note","example"],user:"ExampleUser",text:"Tags make posts discoverable.\n\nImages are optional."}
];
function card(p){return `<article class="card"><div class="preview">${escapeHtml(p.text)}</div><div class="cardbody"><h3>${escapeHtml(p.title)}</h3><p class="muted">by ${escapeHtml(p.user)}</p><div class="tags">${p.tags.map(t=>`<a class="tag" href="search.html?q=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`).join("")}</div></div></article>`}
function render(list,el){document.querySelector(el).innerHTML=list.map(card).join("")}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function runSearch(){const f=document.querySelector("#searchForm"),q=new URLSearchParams(location.search).get("q")||"";document.querySelector("#query").value=q;render(q?posts.filter(p=>q.toLowerCase().split(/\s+/).every(x=>p.tags.some(t=>t.includes(x)))):posts,"#results");f.addEventListener("submit",e=>{e.preventDefault();location.href="search.html?q="+encodeURIComponent(document.querySelector("#query").value)})}
function demoUpload(){document.querySelector("#notice").textContent="Prototype: connect this form to the production backend before enabling publishing."}
function demoLogin(){document.querySelector("#notice").textContent="Prototype: authentication requires a server-side backend."}
document.addEventListener("DOMContentLoaded",()=>{if(document.querySelector("#posts"))render(posts,"#posts")});