// SOYBREACH build 2026-08-18-major
const SUPABASE_URL = 'https://udydiwdajloqcraxzaey.supabase.co';
const SUPABASE_KEY = 'sb_publishable_i8L54-YlFNUMtF2__9IC-A_ApR4Y5EL';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentProfile = null;
let publicStaff = new Map();

function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function staffLabel(name, role){
  const r=String(role||'').toLowerCase();
  if(r==='janny')return '<span class="janny-name">'+esc(name)+'</span>';
  if(r==='admin'){
    const a=window.SOYBREACH_ADMINS?.[name];
    return a?'<span style="color:'+esc(a.color)+'">'+esc(name)+'</span>':esc(name);
  }
  return esc(name);
}
function adminName(name, role){return staffLabel(name,role)}
function authorLink(id,name,role){const label=staffLabel(name||'Unknown',role);return id?'<a href="profile.html?id='+encodeURIComponent(id)+'">'+label+'</a>':label}

async function getUser(){const {data:{user}}=await sb.auth.getUser();return user||null}
async function getProfile(id){
  if(currentProfile&&currentProfile.id===id)return currentProfile;
  const {data,error}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();
  if(error)console.error(error);
  currentProfile=data||null;
  return currentProfile;
}
async function getRoleStatus(){
  const {data,error}=await sb.rpc('get_my_role_status');
  if(error){console.warn('Role status unavailable:',error.message);return {role:'user',is_admin:false,is_janny:false,is_auto_confirmed:false,is_moderator:false,banned:false}}
  return data?.[0]||{role:'user',is_admin:false,is_janny:false,is_auto_confirmed:false,is_moderator:false,banned:false};
}
async function loadPublicStaff(){
  const {data,error}=await sb.rpc('get_public_staff');
  if(error){console.warn('Could not load staff badges:',error.message);return publicStaff}
  publicStaff=new Map((data||[]).map(x=>[x.id,x.role]));
  return publicStaff;
}
async function nav(){
  const n=document.querySelector('#nav'); if(!n)return;
  const u=await getUser(); const p=u?await getProfile(u.id):null;
  n.innerHTML=(u?'<a href="profile.html">profile</a>':'')+
    (u?'<a href="admin.html" id="adminNav" style="display:none">moderation</a>':'')+
    (u?'<a href="#" id="logoutLink">Logout ('+esc(p?.username||'Account')+')</a>':'<a href="login.html">Login</a>');
  const l=document.querySelector('#logoutLink'); if(l)l.onclick=async e=>{e.preventDefault();await sb.auth.signOut();location.href='index.html'};
  if(u){const m=await getRoleStatus();if((m.is_admin||m.is_janny)&&!m.banned){const a=document.querySelector('#adminNav');if(a)a.style.display='inline'}}
}
function tags(a=[]){return '<div class="tags">'+a.map(t=>'<a class="tag" href="search.html?q='+encodeURIComponent(t.name||t)+'">#'+esc(t.name||t)+'</a>').join('')+'</div>'}
function card(p){
  const ts=p.tags||[]; const role=p.profiles?.role||publicStaff.get(p.user_id);
  return '<article class="card"><a href="post.html?id='+p.id+'">'+(p.image_url?'<img class="post-image" src="'+esc(p.image_url)+'">':'<div class="preview">'+esc(p.body)+'</div>')+'</a><div class="cardbody"><h3><a href="post.html?id='+p.id+'">'+esc(p.title)+'</a></h3><p class="muted">by '+authorLink(p.user_id,p.profiles?.username||'Unknown',role)+'</p>'+tags(ts)+'</div></article>';
}
async function fetchPosts(filterTags=[]){
  const {data,error}=await sb.from('posts').select('*').eq('approved',true).order('created_at',{ascending:false});
  if(error){console.error('Loading posts failed:',error);return []}
  let a=data||[];
  await hydratePosts(a);
  if(filterTags.length)a=a.filter(p=>{const ts=(p.tags||[]).map(x=>String(x.name||'').toLowerCase());return filterTags.every(t=>ts.some(x=>x.includes(t)))});
  return a;
}
async function hydratePosts(posts){
  if(!posts.length)return posts;
  const userIds=[...new Set(posts.map(p=>p.user_id).filter(Boolean))];
  const postIds=[...new Set(posts.map(p=>p.id).filter(Boolean))];
  const tagMap=new Map(); const profileMap=new Map();
  if(userIds.length){
    const {data:profiles,error}=await sb.from('profiles').select('id,username,avatar_url,bio').in('id',userIds);
    if(error)console.warn('Could not load post authors:',error.message);
    (profiles||[]).forEach(x=>profileMap.set(x.id,x));
    await loadPublicStaff();
  }
  if(postIds.length){
    const {data:links,error}=await sb.from('post_tags').select('post_id,tag_id').in('post_id',postIds);
    if(error)console.warn('Could not load post tags:',error.message);
    else{
      const tagIds=[...new Set((links||[]).map(x=>x.tag_id).filter(Boolean))];
      if(tagIds.length){const {data:tagRows,error:te}=await sb.from('tags').select('id,name').in('id',tagIds);if(te)console.warn('Could not load tag names:',te.message);(tagRows||[]).forEach(x=>tagMap.set(x.id,x));}
      const byPost=new Map();
      (links||[]).forEach(link=>{if(!byPost.has(link.post_id))byPost.set(link.post_id,[]);const tag=tagMap.get(link.tag_id);if(tag)byPost.get(link.post_id).push(tag)});
      posts.forEach(p=>p.tags=byPost.get(p.id)||[]);
    }
  }
  posts.forEach(p=>{p.profiles=profileMap.get(p.user_id)||null;if(p.profiles)p.profiles.role=publicStaff.get(p.user_id)||null;if(!p.tags)p.tags=[]});
  return posts;
}
function render(a,e){const el=document.querySelector(e);if(el)el.innerHTML=a.map(card).join('');const z=document.querySelector('#empty');if(z)z.textContent=a.length?'':'No posts found.'}
async function home(){await nav();const a=await fetchPosts();render(a,'#posts');const f=document.querySelector('#homeSearch');if(f)f.onsubmit=e=>{e.preventDefault();location.href='search.html?q='+encodeURIComponent(document.querySelector('#homeQuery').value)}}
async function runSearch(){await nav();const q=new URLSearchParams(location.search).get('q')||'';document.querySelector('#query').value=q;const t=q.toLowerCase().split(/\s+/).filter(Boolean),a=await fetchPosts(t);document.querySelector('#resultTitle').textContent=q?'Results for “'+esc(q)+'”':'All posts';render(a,'#results');document.querySelector('#searchForm').onsubmit=e=>{e.preventDefault();location.href='search.html?q='+encodeURIComponent(document.querySelector('#query').value)}}

async function setupUpload(){
  await nav();const u=await getUser();if(!u){location.href='login.html';return}
  const f=document.querySelector('#postForm'),im=document.querySelector('#image');
  im.onchange=()=>{const x=im.files[0];if(!x)return;if(x.size>5000000){notice('Image too large (max 5 MB).');im.value='';return}const r=new FileReader();r.onload=()=>document.querySelector('#imagePreview').innerHTML='<img class="image-preview" src="'+r.result+'">';r.readAsDataURL(x)};
  f.onsubmit=async e=>{
    e.preventDefault();const title=document.querySelector('#title').value.trim(),body=document.querySelector('#text').value,tagsIn=[...new Set(document.querySelector('#tags').value.toLowerCase().split(/[\s,]+/).filter(Boolean))];
    if(!title||!body||!tagsIn.length){notice('Title, text, and at least one tag are required.');return}
    const b=f.querySelector('button');b.disabled=true;b.textContent='Publishing…';let image_url=null;
    try{
      const mod=await getRoleStatus();if(mod.banned)throw new Error('Your account is banned.');
      const shouldAutoApprove=mod.is_admin||mod.is_janny||mod.is_auto_confirmed;
      const imf=im.files[0];
      if(imf){const ext=(imf.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=u.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from('post-images').upload(path,imf,{contentType:imf.type,upsert:false});if(error)throw new Error('Image upload failed: '+error.message);image_url=sb.storage.from('post-images').getPublicUrl(path).data.publicUrl}
      const {data:post,error:pe}=await sb.from('posts').insert({user_id:u.id,title,body,image_url,approved:shouldAutoApprove}).select('id,approved').single();
      if(pe)throw new Error('Creating the post failed: '+(pe.message||pe.code||'Unknown Supabase error'));
      const tagErrors=[];
      for(const name of tagsIn){try{let {data:tag,error:fe}=await sb.from('tags').select('id').eq('name',name).maybeSingle();if(fe)throw fe;if(!tag){const {data:created,error:te}=await sb.from('tags').insert({name}).select('id').single();if(te)throw te;tag=created}const {error:pte}=await sb.from('post_tags').insert({post_id:post.id,tag_id:tag.id});if(pte)throw pte}catch(tagErr){console.error('Tag error for',name,tagErr);tagErrors.push(name+': '+(tagErr.message||'Failed to fetch'))}}
      notice(tagErrors.length?(post.approved?'Post published':'Post submitted for approval')+', but some tags could not be saved: '+tagErrors.join(' | '):(post.approved?'Post published!':'Post submitted for approval.'));
      setTimeout(()=>location.href=post.approved?'index.html':'profile.html',1200);
    }catch(err){console.error(err);notice(err.message||'Could not publish post.');b.disabled=false;b.textContent='Publish post'}
  }
}

async function renderPost(){
  await nav();const id=new URLSearchParams(location.search).get('id'),el=document.querySelector('#post');
  const {data:p,error}=await sb.from('posts').select('*').eq('id',id).maybeSingle();
  if(error||!p){el.innerHTML='<section class="panel"><h1>Post not found</h1></section>';return}
  const {data:author}=await sb.from('profiles').select('id,username,avatar_url,bio').eq('id',p.user_id).maybeSingle();p.profiles=author||null;await hydratePosts([p]);
  const {data:c,error:ce}=await sb.from('comments').select('*').eq('post_id',id).order('created_at',{ascending:true});
  const cids=[...new Set((c||[]).map(x=>x.user_id).filter(Boolean))];
  if(cids.length){const {data:cp}=await sb.from('profiles').select('id,username,avatar_url').in('id',cids);const cm=new Map((cp||[]).map(x=>[x.id,x]));(c||[]).forEach(x=>{x.profiles=cm.get(x.user_id)||null;x.profiles.role=publicStaff.get(x.user_id)||null})}
  if(ce)console.error(ce);
  const u=await getUser(),mod=u?await getRoleStatus():null,ts=p.tags||[];
  const commentHtml=(c||[]).map(x=>'<div class="comment"><b>'+authorLink(x.user_id,x.profiles?.username||'Unknown',x.profiles?.role)+'</b> <span class="muted">'+new Date(x.created_at).toLocaleString()+'</span><div>'+esc(x.body)+'</div>'+(x.image_url?'<img class="comment-image" src="'+esc(x.image_url)+'">':'')+'</div>').join('')||'<p class="muted">No comments yet.</p>';
  const commentForm=u?'<form id="commentForm"><label>Comment<textarea id="commentBody" rows="4" required></textarea></label>'+(mod?.is_admin||mod?.is_janny||mod?.is_auto_confirmed?'<label>Optional image<input id="commentImage" type="file" accept="image/*"></label><div id="commentImagePreview"></div>':'')+'<button>Comment</button><p id="commentNotice"></p></form>':'<p class="muted">Log in to comment.</p>';
  el.innerHTML='<section class="panel"><h1>'+esc(p.title)+'</h1><p class="muted">by '+authorLink(p.user_id,p.profiles?.username||'Unknown',p.profiles?.role)+' · '+new Date(p.created_at).toLocaleString()+'</p>'+(p.image_url?'<img class="post-image" src="'+esc(p.image_url)+'">':'')+'<div class="post-text">'+esc(p.body)+'</div><div style="margin-top:18px">'+tags(ts)+'</div><p><button onclick="downloadPost(\''+p.id+'\')">Download text</button>'+(u&&u.id===p.user_id?' <button class="danger" onclick="deletePost(\''+p.id+'\')">Delete</button>':'')+'</p><hr><h2>Comments ('+(c?.length||0)+')</h2><div>'+commentHtml+'</div>'+commentForm+'</section>';
  if(u){
    const ci=document.querySelector('#commentImage');
    if(ci)ci.onchange=()=>{const x=ci.files[0];if(!x)return;if(x.size>5000000){noticeComment('Image too large (max 5 MB).');ci.value='';return}const r=new FileReader();r.onload=()=>document.querySelector('#commentImagePreview').innerHTML='<img class="image-preview" src="'+r.result+'">';r.readAsDataURL(x)};
    document.querySelector('#commentForm').onsubmit=async e=>{e.preventDefault();const body=document.querySelector('#commentBody').value.trim();if(!body)return;const btn=e.target.querySelector('button');btn.disabled=true;let image_url=null;try{const ci=document.querySelector('#commentImage'),file=ci?.files?.[0];if(file){const eligible=mod?.is_admin||mod?.is_janny||mod?.is_auto_confirmed;if(!eligible)throw new Error('Only auto-confirmed users can attach images to comments.');const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');const path=u.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from('comment-images').upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error('Comment image upload failed: '+error.message);image_url=sb.storage.from('comment-images').getPublicUrl(path).data.publicUrl}const {error}=await sb.from('comments').insert({post_id:id,user_id:u.id,body,image_url});if(error)throw error;renderPost()}catch(err){console.error(err);noticeComment(err.message||'Could not post comment.');btn.disabled=false}};
  }
}
function noticeComment(x){const n=document.querySelector('#commentNotice');if(n)n.textContent=x}
async function downloadPost(id){const {data:p}=await sb.from('posts').select('title,body').eq('id',id).single();if(!p)return;const b=new Blob([p.body],{type:'text/plain'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(p.title||'soybreach-post').replace(/[^a-z0-9_-]+/gi,'_')+'.txt';a.click();URL.revokeObjectURL(a.href)}
async function deletePost(id){const u=await getUser();if(!u||!confirm('Delete this post?'))return;const {error}=await sb.from('posts').delete().eq('id',id);if(error)alert(error.message);else location.href='index.html'}

async function setupAdmin(){
  const adminEl=document.querySelector('#admin');const fail=msg=>{if(adminEl)adminEl.innerHTML='<section class="panel"><h1>Moderation error</h1><p>'+esc(msg)+'</p><p class="muted">The page is working, but Supabase returned an error.</p></section>'};
  try{
    await nav();const u=await getUser();if(!u){location.href='login.html';return}
    const m=await getRoleStatus();if(m.banned){adminEl.innerHTML='<section class="panel"><h1>Access denied</h1><p>Your account is banned and cannot access moderation.</p></section>';return}if(!m.is_admin&&!m.is_janny){adminEl.innerHTML='<section class="panel"><h1>Access denied</h1><p>You are not a janny or administrator.</p></section>';return}
    const {data:posts,error:postsError}=await sb.from('posts').select('*').order('created_at',{ascending:false});if(postsError){fail('Loading posts: '+postsError.message);return}await hydratePosts(posts||[]);
    const {data:users,error:usersError}=await sb.rpc('janny_list_moderation_users');if(usersError){fail('Loading users: '+usersError.message);return}
    const pending=(posts||[]).filter(p=>!p.approved),approved=(posts||[]).filter(p=>p.approved);
    adminEl.innerHTML='<section class="panel"><h1>Moderation</h1><p class="muted">Pending posts need approval. Approved posts are public.</p></section><section class="panel"><h2>Pending approval ('+pending.length+')</h2><div id="pendingPosts"></div></section><section class="panel"><h2>Approved posts ('+approved.length+')</h2><div id="approvedPosts"></div></section><section class="panel"><h2>Users</h2><div id="adminUsers"></div></section>';
    const row=p=>'<div class="admin-row moderation-post"><div class="pending-preview">'+(p.image_url?'<img src="'+esc(p.image_url)+'" class="moderation-thumb">':'')+'<div><b><a href="post.html?id='+p.id+'">'+esc(p.title)+'</a></b><span class="muted">by '+authorLink(p.user_id,p.profiles?.username||'Unknown',p.profiles?.role)+' · '+new Date(p.created_at).toLocaleString()+'</span><div class="moderation-body">'+esc(p.body.slice(0,600))+(p.body.length>600?'…':'')+'</div></div></div><div>'+(p.approved?'':'<button onclick="approvePost(\''+p.id+'\')">Approve</button> ')+'<button class="danger" onclick="adminDeletePost(\''+p.id+'\')">Delete</button></div></div>';
    document.querySelector('#pendingPosts').innerHTML=pending.length?pending.map(row).join(''):'<p class="muted">Nothing waiting for approval.</p>';
    document.querySelector('#approvedPosts').innerHTML=approved.length?approved.map(row).join(''):'<p class="muted">No approved posts.</p>';
    const canManageJanny=m.is_admin;
    document.querySelector('#adminUsers').innerHTML=(users||[]).map(x=>{const role=x.role||'user';const isSelf=x.id===u.id;const protectedAdmin=role==='admin'&&!m.is_admin;return '<div class="admin-row user-row"><div><b>'+staffLabel(x.username,role)+'</b> <span class="muted">'+(x.banned?'BANNED':role==='admin'?'admin':role==='janny'?'janny':x.auto_confirmed?'auto-confirmed':'active')+'</span></div><div class="user-actions"><button class="menu-dots" title="User actions" onclick="toggleUserMenu(\''+x.id+'\')">⋮</button><div id="userMenu_'+x.id+'" class="user-menu" style="display:none">'+(!isSelf&&!protectedAdmin?(x.banned?'<button onclick="setBan(\''+x.id+'\',false)">Unban</button>':'<button class="danger" onclick="setBan(\''+x.id+'\',true)">Ban</button>')+(x.auto_confirmed?'<button onclick="setAutoConfirmed(\''+x.id+'\',false)">Remove auto-confirmed</button>':'<button onclick="setAutoConfirmed(\''+x.id+'\',true)">Give auto-confirmed</button>')+(canManageJanny?(role==='janny'?'<button onclick="setJanny(\''+x.id+'\',false)">Remove janny</button>':'<button onclick="setJanny(\''+x.id+'\',true)">Make janny</button>'):''):'<span class="muted">No actions</span>')+'</div></div></div>'}).join('')||'<p class="muted">No users.</p>';
  }catch(err){console.error(err);fail(err.message||String(err))}
}
async function approvePost(id){const {error}=await sb.rpc('janny_approve_post',{target_post_id:id});if(error)alert(error.message);else setupAdmin()}
async function adminDeletePost(id){if(!confirm('Delete this post?'))return;const {error}=await sb.rpc('janny_delete_post',{target_post_id:id});if(error)alert(error.message);else setupAdmin()}
async function setBan(id,banned){if(!confirm(banned?'Ban this user?':'Unban this user?'))return;const {error}=await sb.rpc('janny_set_banned',{target_user_id:id,should_ban:banned});if(error)alert(error.message);else setupAdmin()}
async function setAutoConfirmed(id,confirmed){if(!confirm(confirmed?'Give this user auto-confirmed status? Their future posts will skip moderation.':'Remove auto-confirmed status? Future posts will require approval.'))return;const {error}=await sb.rpc('janny_set_auto_confirmed',{target_user_id:id,should_confirm:confirmed});if(error)alert(error.message);else setupAdmin()}
async function setJanny(id,shouldJanny){if(!confirm(shouldJanny?'Make this user a janny? They will be able to approve posts, ban users, give auto-confirmed and delete posts.':'Remove janny status from this user?'))return;const {error}=await sb.rpc('set_janny_role',{target_user_id:id,should_janny:shouldJanny});if(error)alert(error.message);else setupAdmin()}
function toggleUserMenu(id){const el=document.querySelector('#userMenu_'+id);if(!el)return;document.querySelectorAll('.user-menu').forEach(x=>{if(x!==el)x.style.display='none'});el.style.display=el.style.display==='none'?'block':'none'}

async function setupRegister(){await nav();document.querySelector('#registerForm').onsubmit=async e=>{e.preventDefault();const n=document.querySelector('#username').value.trim(),email=document.querySelector('#email').value.trim(),p=document.querySelector('#password').value;if(!/^[A-Za-z0-9_]{2,30}$/.test(n)){notice('Username must be 2-30 letters, numbers or underscores.');return}const b=e.target.querySelector('button');b.disabled=true;b.textContent='Creating…';const {data,error}=await sb.auth.signUp({email,password:p,options:{data:{username:n}}});if(error){notice(error.message);b.disabled=false;b.textContent='Register';return}if(data.user&&data.session){const {error:pe}=await sb.from('profiles').upsert({id:data.user.id,username:n},{onConflict:'id'});if(pe){notice(pe.message);return}}notice(data.session?'Account created! You are now logged in.':'Account created. Log in to continue.');if(data.session)setTimeout(()=>location.href='index.html',700)}}
async function setupLogin(){await nav();document.querySelector('#loginForm').onsubmit=async e=>{e.preventDefault();const email=document.querySelector('#email').value.trim(),p=document.querySelector('#password').value,b=e.target.querySelector('button');b.disabled=true;b.textContent='Logging in…';const {error}=await sb.auth.signInWithPassword({email,password:p});if(error){notice(error.message);b.disabled=false;b.textContent='Log in';return}location.href='index.html'}}
function notice(x){const n=document.querySelector('#notice');if(n)n.textContent=x}

async function saveProfile(){
  const u=await getUser();if(!u)return;
  const bio=document.querySelector('#profileBio').value.slice(0,1000);const file=document.querySelector('#profileAvatar')?.files?.[0];let avatar_url=currentProfile?.avatar_url||null;
  const btn=document.querySelector('#saveProfileBtn');if(btn){btn.disabled=true;btn.textContent='Saving…'}
  try{
    if(file){if(file.size>3000000)throw new Error('Profile picture is too large (max 3 MB).');const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');const path=u.id+'/'+crypto.randomUUID()+'.'+ext;const {error}=await sb.storage.from('profile-pictures').upload(path,file,{contentType:file.type,upsert:false});if(error)throw new Error('Profile picture upload failed: '+error.message);avatar_url=sb.storage.from('profile-pictures').getPublicUrl(path).data.publicUrl}
    const {data,error}=await sb.from('profiles').update({bio,avatar_url}).eq('id',u.id).select('*').single();if(error)throw error;currentProfile=data;notice('Profile saved.');renderProfile();
  }catch(err){notice(err.message||'Could not save profile.')}finally{if(btn){btn.disabled=false;btn.textContent='Save profile'}}
}
async function removeProfilePicture(){const u=await getUser();if(!u||!confirm('Remove your profile picture?'))return;const {error}=await sb.from('profiles').update({avatar_url:null}).eq('id',u.id);if(error)notice(error.message);else{currentProfile=null;renderProfile()}}

async function renderProfile(){
  await nav();const viewer=await getUser();let id=new URLSearchParams(location.search).get('id');if(!id&&viewer)id=viewer.id;if(!id){document.querySelector('#profile').innerHTML='<section class="panel"><h1>Log in to view your profile</h1></section>';return}
  const {data:p,error:pe}=await sb.from('profiles').select('*').eq('id',id).maybeSingle();if(pe){document.querySelector('#profile').innerHTML='<section class="panel"><h1>Profile error</h1><p>'+esc(pe.message)+'</p></section>';return}if(!p){document.querySelector('#profile').innerHTML='<section class="panel"><h1>Profile not found</h1></section>';return}
  const targetRole=(await loadPublicStaff()).get(id)||null;p.role=targetRole;
  let postQuery=sb.from('posts').select('*').eq('user_id',id).order('created_at',{ascending:false});if(!viewer||viewer.id!==id)postQuery=postQuery.eq('approved',true);const {data:a,error:ae}=await postQuery;if(ae){document.querySelector('#profile').innerHTML='<section class="panel"><h1>Profile error</h1><p>'+esc(ae.message)+'</p></section>';return}await hydratePosts(a||[]);(a||[]).forEach(x=>x.profiles=p);
  let moderationBox='';
  if(viewer&&viewer.id!==id){try{const me=await getRoleStatus();if(me.is_admin||me.is_janny){const {data:users}=await sb.rpc('janny_list_moderation_users');const target=(users||[]).find(x=>x.id===id);if(target){moderationBox='<section class="panel profile-actions"><h2>Moderator actions</h2><p class="muted">Manage '+esc(p.username)+'.</p>'+(target.banned?'<button onclick="setBanFromProfile(\''+id+'\',false)">Unban user</button>':'<button class="danger" onclick="setBanFromProfile(\''+id+'\',true)">Ban user</button>')+' '+(target.auto_confirmed?'<button onclick="setAutoConfirmedFromProfile(\''+id+'\',false)">Remove auto-confirmed</button>':'<button onclick="setAutoConfirmedFromProfile(\''+id+'\',true)">Give auto-confirmed</button>')+(me.is_admin&&target.role!=='admin'?(target.role==='janny'?'<br><button onclick="setJannyFromProfile(\''+id+'\',false)">Remove janny</button>':'<br><button onclick="setJannyFromProfile(\''+id+'\',true)">Make janny</button>'):'')+'</section>'}}}catch(e){console.warn('Profile moderation controls unavailable:',e)}}
  const own=viewer&&viewer.id===id;const pendingNote=own?'<p class="muted small">Pending posts are visible here to you until they are approved.</p>':'';
  const avatar=p.avatar_url?'<img class="profile-avatar" src="'+esc(p.avatar_url)+'" alt="">':'<div class="avatar">'+esc(p.username.slice(0,2).toUpperCase())+'</div>';
  const editor=own?'<section class="panel profile-actions"><h2>Edit profile</h2><label>Bio<textarea id="profileBio" rows="5" maxlength="1000">'+esc(p.bio||'')+'</textarea></label><label>Profile picture<input id="profileAvatar" type="file" accept="image/*"></label><button id="saveProfileBtn" onclick="saveProfile()">Save profile</button>'+(p.avatar_url?' <button type="button" onclick="removeProfilePicture()">Remove picture</button>':'')+'<p id="notice"></p></section>':'';
  document.querySelector('#profile').innerHTML=editor+moderationBox+'<section class="panel profile">'+avatar+'<div><h1>'+adminName(p.username,p.role)+'</h1><p class="muted">'+(a?.length||0)+' post'+((a?.length||0)===1?'':'s')+'</p>'+(p.bio?'<div class="profile-bio">'+esc(p.bio).replace(/\n/g,'<br>')+'</div>':'')+pendingNote+'</div></section><h2>Posts</h2><div id="posts" class="grid"></div><p id="empty" class="muted"></p>';
  render(a||[],'#posts');
}
async function setBanFromProfile(id,banned){if(!confirm(banned?'Ban this user?':'Unban this user?'))return;const {error}=await sb.rpc('janny_set_banned',{target_user_id:id,should_ban:banned});if(error)alert(error.message);else renderProfile()}
async function setAutoConfirmedFromProfile(id,confirmed){if(!confirm(confirmed?'Give this user auto-confirmed status? Their future posts will skip moderation.':'Remove auto-confirmed status? Future posts will require approval.'))return;const {error}=await sb.rpc('janny_set_auto_confirmed',{target_user_id:id,should_confirm:confirmed});if(error)alert(error.message);else renderProfile()}
async function setJannyFromProfile(id,shouldJanny){if(!confirm(shouldJanny?'Make this user a janny?':'Remove janny status from this user?'))return;const {error}=await sb.rpc('set_janny_role',{target_user_id:id,should_janny:shouldJanny});if(error)alert(error.message);else renderProfile()}

document.addEventListener('DOMContentLoaded',()=>{const path=location.pathname;if(path.endsWith('index.html')||path.endsWith('/'))home()});
