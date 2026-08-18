const SUPABASE_URL = 'https://udydiwdajloqcraxzaey.supabase.co';
const SUPABASE_KEY = 'sb_publishable_i8L54-YlFNUMtF2__9IC-A_ApR4Y5EL';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentProfile = null;

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function getUser(){const {data:{user}}=await sb.auth.getUser();return user||null}
async function getProfile(id){if(currentProfile&&currentProfile.id===id)return currentProfile;const {data,error}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();if(error)console.error(error);currentProfile=data||null;return currentProfile}
async function nav(){
  const n=document.querySelector('#nav'); if(!n)return;
  const u=await getUser(); const p=u?await getProfile(u.id):null;
  n.innerHTML='<a href="index.html">posts</a><a href="search.html">search</a><a href="upload.html">new post</a><a href="profile.html">profile</a>'+
    (u?'<a href="admin.html" id="adminNav" style="display:none">moderation</a>':'')+
    (u?'<a href="#" id="logoutLink">Logout ('+esc(p?.username||'Account')+')</a>':'<a href="login.html">Login</a>');
  const l=document.querySelector('#logoutLink'); if(l)l.onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='index.html'};
  if(u){const {data:m}=await sb.rpc('get_my_moderation_status');if(m?.[0]?.is_moderator){const a=document.querySelector('#adminNav');if(a)a.style.display='inline'}}
}
function tags(a=[]){return '<div class="tags">'+a.map(t=>'<a class="tag" href="search.html?q='+encodeURIComponent(t.name||t)+'">#'+esc(t.name||t)+'</a>').join('')+'</div>'}
function card(p){
  const ts=p.post_tags?.map(x=>x.tags).filter(Boolean)||[];
  return '<article class="card"><a href="post.html?id='+p.id+'">'+(p.image_url?'<img class="post-image" src="'+esc(p.image_url)+'">':'<div class="preview">'+esc(p.body)+'</div>')+'</a><div class="cardbody"><h3><a href="post.html?id='+p.id+'">'+esc(p.title)+'</a></h3><p class="muted">by '+authorName(p.profiles?.username)+'</p>'+tags(ts)+'</div></article>';
}
async function fetchPosts(filterTags=[]){
  let q=sb.from('posts').select('*, profiles(username), post_tags(tags(name))').order('created_at',{ascending:false});
  const {data,error}=await q;if(error){console.error(error);return []}
  let a=data||[];
  if(filterTags.length)a=a.filter(p=>{const ts=(p.post_tags||[]).map(x=>x.tags?.name?.toLowerCase()||'');return filterTags.every(t=>ts.some(x=>x.includes(t))) });
  return a;
}
function render(a,e){document.querySelector(e).innerHTML=a.map(card).join('');const z=document.querySelector('#empty');if(z)z.textContent=a.length?'':'No posts found.'}
async function home(){
  await nav(); const a=await fetchPosts(); render(a,'#posts');
  const f=document.querySelector('#homeSearch'); if(f)f.onsubmit=e=>{e.preventDefault();location.href='search.html?q='+encodeURIComponent(document.querySelector('#homeQuery').value)}
}
async function runSearch(){
  await nav();const q=new URLSearchParams(location.search).get('q')||'';document.querySelector('#query').value=q;
  const t=q.toLowerCase().split(/\s+/).filter(Boolean),a=await fetchPosts(t);
  document.querySelector('#resultTitle').textContent=q?'Results for “'+esc(q)+'”':'All posts';render(a,'#results');
  document.querySelector('#searchForm').onsubmit=e=>{e.preventDefault();location.href='search.html?q='+encodeURIComponent(document.querySelector('#query').value)}
}
async function setupUpload(){
  await nav();const u=await getUser();if(!u){location.href='login.html';return}
  const f=document.querySelector('#postForm'),im=document.querySelector('#image');
  im.onchange=()=>{const x=im.files[0];if(!x)return;if(x.size>5000000){notice('Image too large (max 5 MB).');im.value='';return}const r=new FileReader();r.onload=()=>document.querySelector('#imagePreview').innerHTML='<img class="image-preview" src="'+r.result+'">';r.readAsDataURL(x)};
  f.onsubmit=async e=>{
    e.preventDefault(); const title=document.querySelector('#title').value.trim(),body=document.querySelector('#text').value,tagsIn=[...new Set(document.querySelector('#tags').value.toLowerCase().split(/[\s,]+/).filter(Boolean))];
    if(!title||!body||!tagsIn.length){notice('Title, text, and at least one tag are required.');return}
    const b=f.querySelector('button');b.disabled=true;b.textContent='Publishing…';
    let image_url=null;
    try{
      const imf=im.files[0];
      if(imf){const ext=(imf.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=u.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from('post-images').upload(path,imf,{contentType:imf.type,upsert:false});if(error)throw error;image_url=sb.storage.from('post-images').getPublicUrl(path).data.publicUrl}
      const {data:post,error:pe}=await sb.from('posts').insert({user_id:u.id,title,body,image_url,approved:false}).select('id').single();if(pe)throw pe;
      for(const name of tagsIn){
        let {data:tag,error:fe}=await sb.from('tags').select('id').eq('name',name).maybeSingle();if(fe)throw fe;
        if(!tag){const {data:created,error:te}=await sb.from('tags').insert({name}).select('id').single();if(te)throw te;tag=created;}
        const {error:pte}=await sb.from('post_tags').insert({post_id:post.id,tag_id:tag.id});if(pte)throw pte;
      }
      notice('Post submitted for approval.');setTimeout(()=>location.href='index.html',700);
    }catch(err){console.error(err);notice(err.message||'Could not publish post.');b.disabled=false;b.textContent='Publish post'}
  }
}
async function renderPost(){
  await nav();const id=new URLSearchParams(location.search).get('id'),el=document.querySelector('#post');
  const {data:p,error}=await sb.from('posts').select('*, profiles(username), post_tags(tags(name))').eq('id',id).maybeSingle();
  if(error||!p){el.innerHTML='<section class="panel"><h1>Post not found</h1></section>';return}
  const {data:c,error:ce}=await sb.from('comments').select('*, profiles(username)').eq('post_id',id).order('created_at',{ascending:true});if(ce)console.error(ce);
  const u=await getUser(); const ts=p.post_tags?.map(x=>x.tags).filter(Boolean)||[];
  el.innerHTML='<section class="panel"><h1>'+esc(p.title)+'</h1><p class="muted">by '+authorName(p.profiles?.username)+' · '+new Date(p.created_at).toLocaleString()+'</p>'+(p.image_url?'<img class="post-image" src="'+esc(p.image_url)+'">':'')+
  '<div class="post-text">'+esc(p.body)+'</div><div style="margin-top:18px">'+tags(ts)+'</div><p><button onclick="downloadPost('+p.id+')">Download text</button>'+
  (u&&u.id===p.user_id?' <button class="danger" onclick="deletePost('+p.id+')">Delete</button>':'')+'</p><hr><h2>Comments ('+(c?.length||0)+')</h2><div>'+
  ((c||[]).map(x=>'<div class="comment"><b>'+esc(x.profiles?.username||'Unknown')+'</b> <span class="muted">'+new Date(x.created_at).toLocaleString()+'</span><div>'+esc(x.body)+'</div></div>').join('')||'<p class="muted">No replies yet.</p>')+
  '</div>'+(u?'<form id="commentForm"><label>Comment<textarea id="commentBody" rows="4" required></textarea></label><button>Comment</button></form>':'<p class="muted">Log in to comment.</p>')+'</section>';
  if(u)document.querySelector('#commentForm').onsubmit=async e=>{e.preventDefault();const b=document.querySelector('#commentBody').value.trim();if(!b)return;const {error}=await sb.from('comments').insert({post_id:id,user_id:u.id,body:b});if(error)notice(error.message);else renderPost()}
}
async function downloadPost(id){const {data:p}=await sb.from('posts').select('title,body').eq('id',id).single();if(!p)return;const b=new Blob([p.body],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(p.title||'soybreach-post').replace(/[^a-z0-9_-]+/gi,'_')+'.txt';a.click();URL.revokeObjectURL(a.href)}
async function deletePost(id){const u=await getUser();if(!u||!confirm('Delete this post?'))return;const {error}=await sb.from('posts').delete().eq('id',id);if(error)alert(error.message);else location.href='index.html'}
async function getModeration(){const u=await getUser();if(!u)return null;const {data}=await sb.rpc('get_my_moderation_status');return data?.[0]||null}
async function setupAdmin(){
  await nav(); const u=await getUser(); if(!u){location.href='login.html';return}
  const {data:me}=await sb.rpc('get_my_moderation_status'); const m=me?.[0];
  if(!m?.is_admin){document.querySelector('#admin').innerHTML='<section class="panel"><h1>Access denied</h1><p>You are not an administrator.</p></section>';return}
  const {data:posts,error}=await sb.from('posts').select('*, profiles(username), post_tags(tags(name))').order('created_at',{ascending:false});
  if(error){notice(error.message);return}
  document.querySelector('#admin').innerHTML='<section class="panel"><h1>Moderation</h1><p class="muted">Approve or delete posts and ban/unban users.</p></section><div id="adminPosts"></div><section class="panel"><h2>Users</h2><div id="adminUsers"></div></section>';
  document.querySelector('#adminPosts').innerHTML='<section class="panel"><h2>Posts</h2>'+((posts||[]).map(p=>'<div class="admin-row"><div><b>'+esc(p.title)+'</b> <span class="muted">by '+authorName(p.profiles?.username)+' · '+(p.approved?'approved':'PENDING')+'</span></div><div>'+(p.approved?'':'<button onclick="approvePost(\''+p.id+'\')">Approve</button> ')+'<button class="danger" onclick="adminDeletePost(\''+p.id+'\')">Delete</button></div></div>').join('')||'<p class="muted">No posts.</p>')+'</section>';
  const {data:users}=await sb.rpc('list_moderation_users');
  document.querySelector('#adminUsers').innerHTML=(users||[]).map(x=>'<div class="admin-row"><div><b>'+esc(x.username)+'</b> <span class="muted">'+(x.banned?'BANNED':'active')+'</span></div><div>'+(x.banned?'<button onclick="setBan(\''+x.id+'\',false)">Unban</button>':'<button class="danger" onclick="setBan(\''+x.id+'\',true)">Ban</button>')+'</div></div>').join('')||'<p class="muted">No users.</p>';
}
async function approvePost(id){const {error}=await sb.from('posts').update({approved:true}).eq('id',id);if(error)alert(error.message);else setupAdmin()}
async function adminDeletePost(id){if(!confirm('Delete this post?'))return;const {error}=await sb.from('posts').delete().eq('id',id);if(error)alert(error.message);else setupAdmin()}
async function setBan(id,banned){if(!confirm(banned?'Ban this user?':'Unban this user?'))return;const {error}=await sb.rpc('set_user_banned',{target_user_id:id,should_ban:banned});if(error)alert(error.message);else setupAdmin()}
async function setupRegister(){
  await nav();document.querySelector('#registerForm').onsubmit=async e=>{
    e.preventDefault();const n=document.querySelector('#username').value.trim(),email=document.querySelector('#email').value.trim(),p=document.querySelector('#password').value;
    if(!/^[A-Za-z0-9_]{2,30}$/.test(n)){notice('Username must be 2-30 letters, numbers or underscores.');return}
    const b=e.target.querySelector('button');b.disabled=true;b.textContent='Creating…';
    const {data,error}=await sb.auth.signUp({email,password:p,options:{data:{username:n}}});
    if(error){notice(error.message);b.disabled=false;b.textContent='Register';return}
    if(data.user&&data.session){const {error:pe}=await sb.from('profiles').upsert({id:data.user.id,username:n},{onConflict:'id'});if(pe){notice(pe.message);return}}
    notice(data.session?'Account created! You are now logged in.':'Account created. Log in to continue.');
    if(data.session)setTimeout(()=>location.href='index.html',700);
  }
}
async function setupLogin(){
  await nav();document.querySelector('#loginForm').onsubmit=async e=>{
    e.preventDefault();const email=document.querySelector('#email').value.trim(),p=document.querySelector('#password').value,b=e.target.querySelector('button');b.disabled=true;b.textContent='Logging in…';
    const {error}=await sb.auth.signInWithPassword({email,password:p});if(error){notice(error.message);b.disabled=false;b.textContent='Log in';return}location.href='index.html'
  }
}
function notice(x){const n=document.querySelector('#notice');if(n)n.textContent=x}
async function renderProfile(){
  await nav();const u=await getUser();let id=new URLSearchParams(location.search).get('id');if(!id&&u)id=u.id;
  if(!id){document.querySelector('#profile').innerHTML='<section class="panel"><h1>Log in to view your profile</h1></section>';return}
  const {data:p}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();if(!p){document.querySelector('#profile').innerHTML='<section class="panel"><h1>Profile not found</h1></section>';return}
  const {data:a}=await sb.from('posts').select('*, profiles(username), post_tags(tags(name))').eq('user_id',id).order('created_at',{ascending:false});
  document.querySelector('#profile').innerHTML='<section class="panel profile"><div class="avatar">'+esc(p.username.slice(0,2).toUpperCase())+'</div><div><h1>'+esc(p.username)+'</h1><p class="muted">'+(a?.length||0)+' post'+((a?.length||0)===1?'':'s')+'</p></div></section><h2>Posts</h2><div id="posts" class="grid"></div><p id="empty" class="muted"></p>';render(a||[],'#posts')
}
document.addEventListener('DOMContentLoaded',()=>{const path=location.pathname;if(path.endsWith('index.html')||path.endsWith('/'))home()});
