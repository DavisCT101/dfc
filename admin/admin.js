DFC.ready.then(()=>{
const $=s=>document.querySelector(s),E=DFC.esc,S=DFC.safe;
const K={m:'members',g:'msgs',u:'u',a:'a',h:'hero',s:'songs'},D={m:[],g:[],u:DFC.defaults.u,a:DFC.defaults.a,h:DFC.defaults.hero,s:DFC.defaults.songs};
const L=k=>DFC.get(K[k],D[k]),W=(k,v)=>DFC.set(K[k],v);
const ses={get(){try{return sessionStorage.getItem('dfc_admin')==='1'}catch(e){return window._a===1}},set(v){try{sessionStorage.setItem('dfc_admin',v?'1':'0')}catch(e){window._a=v?1:0}}};
let view='dashboard',sel=null,ed=null,q='';
const TITLES={dashboard:'Dashboard',members:'Members',messages:'Messages',updates:'Updates',songs:'Songs',albums:'Albums',hero:'Hero images',profile:'My profile'};
const ini=n=>(n||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const when=t=>new Date(t).toLocaleString([], {dateStyle:'medium',timeStyle:'short'});
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('on');setTimeout(()=>e.classList.remove('on'),2200)};
const bg=u=>{const s=DFC.url(u);return s?`style="background-image:url('${E(s)}')"`:''};   /* DFC.url fixes pictures written as assets/... */
const albumCover=g=>g?new URL(`${API_BASE}/api/album-cover?img=1&w=200&url=${encodeURIComponent(g)}`,location.href).href:'';
const ytThumb=u=>{const m=String(u||'').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);return m?`https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`:''};
const imgF=`<div class="c2"><label>Image link<input name="img" placeholder="assets/images/pic.jpg or https://..."></label><label>…or upload a photo<input name="file" type="file" accept="image/*"></label></div>`;
const getImg=async(f,old)=>{const x=f.file&&f.file.files[0];return x?await DFC.resize(x):(f.img.value.trim()||old||'')};

const V={
dashboard(){const M=L('m'),G=L('g');
 const st=[['Members',M.filter(x=>x.s!=='pending').length,'members'],['Pending',M.filter(x=>x.s==='pending').length,'members'],['Unread messages',G.filter(x=>!x.r).length,'messages'],['Updates',L('u').length,'updates'],['Albums',L('a').length,'albums'],['Songs',L('s').length,'songs']];
 return `<section class="card hello"><div><h2>Welcome back, ${E(DFC.admin().name)}</h2><p class="mute">Manage the DFC website from here.</p></div><a class="btn" href="index.html" target="_blank">View website</a></section>
 <div class="stats">${st.map(s=>`<button class="card stat" data-v="${s[2]}"><b>${s[1]}</b><span class="mute">${s[0]}</span></button>`).join('')}</div>
 <div class="two"><section class="card"><h3>Recent messages</h3>${G.length?G.slice(0,4).map((m,i)=>`<div class="row"><span class="av">${ini(m.n)}</span><div class="g1"><b>${E(m.n)}</b><p>${E(m.m)}</p></div>${m.r?'':'<span class="dot"></span>'}</div>`).join(''):'<div class="empty">No messages yet.</div>'}</section>
 <section class="card"><h3>New sign-ups</h3>${M.length?M.slice(0,5).map(m=>`<div class="row"><span class="av">${ini(m.n)}</span><div class="g1"><b>${E(m.n)}</b><p>${E(m.r||'')}</p></div><span class="tag ${m.s==='pending'?'p':''}">${m.s==='pending'?'Pending':'Active'}</span></div>`).join(''):'<div class="empty">No members yet.</div>'}</section></div>
 <section class="card"><h3>Quick actions</h3><div class="acts"><button class="btn s" data-v="updates">Post an update</button><button class="btn s" data-v="albums">Add an album</button><button class="btn s" data-v="hero">Change hero photos</button><button class="btn s g" data-v="members">Manage members</button></div></section>`},
members(){return `<div class="three"><form class="card fm" data-f="m"><h3>Add a member</h3><label>Full name<input name="n" required></label><label>Email<input name="e" type="email"></label><label>Phone<input name="p"></label>
 <label>Role<select name="r"><option>Dancer</option><option>Choreographer</option><option>Media team</option><option>Prayer team</option><option>Leadership</option></select></label><button class="btn">Add member</button></form>
 <section class="card"><h3>All members (${L('m').length})</h3><label><input id="sq" placeholder="Search members" value="${E(q)}"></label><div id="ml">${mlist()}</div></section></div>`},
messages(){const G=L('g'),m=G[sel];
 return `<div class="three"><section class="card"><h3>Inbox (${G.length})</h3>${G.length?G.map((x,i)=>`<button class="row" style="width:100%;background:none;border:0;border-bottom:1px solid rgba(255,255,255,.09);text-align:left;color:inherit;${i===sel?'background:rgba(245,163,10,.1)':''}" data-a="open" data-i="${i}"><span class="av">${ini(x.n)}</span><div class="g1"><b>${E(x.n)}</b><p>${E(x.m)}</p></div>${x.r?'':'<span class="dot"></span>'}</button>`).join(''):'<div class="empty">No messages yet. Messages from the website contact form appear here.</div>'}</section>
 <section class="card">${m?`<h3>${E(m.n)}</h3><p class="mute">${E(m.e)} · ${when(m.t)}</p><div class="msgv">${E(m.m)}</div><div class="acts"><a class="btn s" href="mailto:${E(m.e)}?subject=${encodeURIComponent('Re: your message to DFC')}">Reply by email</a><button class="btn s g" data-a="unread" data-i="${sel}">Mark unread</button><button class="btn s d" data-a="delg" data-i="${sel}">Delete</button></div>`:'<div class="empty">Select a message to read it.</div>'}</section></div>`},
updates(){return crud('u','This week at DFC','Title','Date or note','d')},
songs(){const it=ed!==null?L('s')[ed]||{}:{},list=L('s');
 return `<form class="card fm" data-f="s"><h3>${ed!==null?'Edit':'Add'} song</h3><div class="c2"><label>Title<input name="t" value="${E(it.t||'')}" required></label><label>Artist<input name="a" value="${E(it.a||'')}"></label></div>
 <div class="c2"><label>Service<select name="s"><option ${it.s==='Sunday'?'':'selected'}>Friday</option><option ${it.s==='Sunday'?'selected':''}>Sunday</option></select></label><label>Audio link (mp3)<input name="au" value="${E(it.au||'')}" placeholder="assets/audio/song.mp3 or https://..."></label></div>
 <label>YouTube link (the song plays from YouTube; the cover is taken from the video)<input name="yt" value="${E(it.yt||'')}" placeholder="https://youtu.be/..."></label>
 <label>Lyrics / chords (optional)<textarea name="l" rows="5">${E(it.l||'')}</textarea></label>${imgF.replace('Image link','Cover image link')}
 <div class="acts"><button class="btn">${ed!==null?'Save changes':'Add song'}</button>${ed!==null?'<button type="button" class="btn g" data-a="cancel">Cancel</button>':''}</div></form>
 <section class="card"><h3>Songs (${list.length})</h3>${list.length?list.map((x,i)=>`<div class="row"><div class="thumb" ${bg(x.i||ytThumb(x.yt))}></div><div class="g1"><b>${E(x.t)}</b><p>${E(x.s)} · ${x.yt?'YouTube':x.au?E(x.au):'no audio yet'}</p></div><div class="acts"><button class="btn s g" data-a="edit" data-i="${i}">Edit</button><button class="btn s d" data-a="del" data-i="${i}">Delete</button></div></div>`).join(''):'<div class="empty">No songs yet.</div>'}</section>`},
albums(){return crud('a','Photo albums','Album title (optional: taken from Google Photos if left empty)','Google Photos share link (the cover photo is fetched automatically)','g')},
hero(){const H=L('h');return `<form class="card fm" data-f="h"><h3>Add hero photos</h3>${imgF.replace('name="file"','name="file" multiple')}<div class="acts"><button class="btn">Add</button><button type="button" class="btn g" data-a="reseth">Reset to default</button></div></form>
 <section class="card"><h3>Hero photos (${H.length})</h3><div class="imgs">${H.map((u,i)=>`<div ${bg(u)}><button data-a="delh" data-i="${i}" aria-label="Remove">✕</button></div>`).join('')}</div></section>`},
profile(){const a=DFC.admin();return `<div class="three"><section class="card" style="text-align:center"><span class="av big" style="margin:auto">${ini(a.name)}</span><h3 style="margin-top:12px">${E(a.name)}</h3><p class="mute">${E(a.role)}</p></section>
 <form class="card fm" data-f="p"><h3>Edit profile</h3><div class="c2"><label>Name<input name="name" value="${E(a.name)}" required></label><label>Role<input name="role" value="${E(a.role)}"></label></div>
 <div class="c2"><label>Email<input name="email" type="email" value="${E(a.email)}"></label><label>Phone<input name="phone" value="${E(a.phone)}"></label></div>
 <div class="c2"><label>Username<input name="user" value="${E(a.user)}" required></label><label>New password<input name="pass" type="password" placeholder="Leave blank to keep"></label></div><button class="btn">Save profile</button></form></div>
 <form class="card fm" data-f="gh"><h3>GitHub publishing</h3><p class="mute">Paste a fine-grained GitHub token for your DFC repo (Contents: Read and write). It is saved only in this browser and is never written into the website files.</p><label>GitHub token<input name="tk" type="password" autocomplete="off" value="${E(DFC.token())}" placeholder="github_pat_..."></label><div class="acts"><button class="btn">Save token</button><button type="button" class="btn g" data-a="test">Test connection</button></div></form>`}
};
function mlist(){const M=L('m').map((m,i)=>[m,i]).filter(([m])=>(m.n+m.e+m.r).toLowerCase().includes(q.toLowerCase()));
 return M.length?M.map(([m,i])=>`<div class="row"><span class="av">${ini(m.n)}</span><div class="g1"><b>${E(m.n)}</b><p>${E(m.r||'')} · ${E(m.e||m.p||'')}</p></div><span class="tag ${m.s==='pending'?'p':''}">${m.s==='pending'?'Pending':'Active'}</span><div class="acts">${m.s==='pending'?`<button class="btn s" data-a="appr" data-i="${i}">Approve</button>`:''}<button class="btn s d" data-a="delm" data-i="${i}">Remove</button></div></div>`).join(''):'<div class="empty">No members found.</div>'}
function crud(k,title,l1,l2,f2){const it=ed!==null?L(k)[ed]||{}:{},list=L(k);
 return `<form class="card fm" data-f="${k}"><h3>${ed!==null?'Edit':'Add'} ${k==='u'?'update':'album'}</h3><label>${l1}<input name="t" value="${E(it.t||'')}" ${k==='a'?'':'required'}></label><label>${l2}<input name="${f2}" value="${E(it[f2]||'')}" ${k==='a'?'type="url" required':''}></label>${imgF}
 <div class="acts"><button class="btn">${ed!==null?'Save changes':'Publish'}</button>${ed!==null?'<button type="button" class="btn g" data-a="cancel">Cancel</button>':''}</div></form>
 <section class="card"><h3>${title} (${list.length})</h3>${list.length?list.map((x,i)=>`<div class="row"><div class="thumb" ${bg(x.i||(k==='a'?albumCover(x.g):''))}></div><div class="g1"><b>${E(x.t)}</b><p>${E(x[f2]||'')}</p></div><div class="acts"><button class="btn s g" data-a="edit" data-i="${i}">Edit</button><button class="btn s d" data-a="del" data-i="${i}">Delete</button></div></div>`).join(''):'<div class="empty">Nothing here yet.</div>'}</section>`}

function render(){const G=L('g'),un=G.filter(x=>!x.r).length,a=DFC.admin();
 $('#mb').textContent=un||'';$('#bn').textContent=un||'';$('#av').textContent=ini(a.name);$('#an').textContent=a.name;
 document.querySelectorAll('#side [data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===view));
 pubUI();$('#title').textContent=TITLES[view];$('#view').innerHTML=V[view]();
 const s=$('#sq');if(s)s.oninput=()=>{q=s.value;$('#ml').innerHTML=mlist()}}
function enter(){const on=ses.get();$('#login').hidden=on;$('#app').hidden=!on;if(on)render()}
document.addEventListener('click',e=>{const t=e.target.closest('[data-v],[data-a]');if(!t)return;
 if(t.dataset.v){view=t.dataset.v;sel=null;ed=null;$('#side').classList.remove('open');return render()}
 const a=t.dataset.a,i=+t.dataset.i,ask=m=>confirm(m);
 if(a==='test'){DFC.test().then(toast);return}
 if(a==='burger')return $('#side').classList.toggle('open');
 if(a==='out'){ses.set(false);return enter()}
 if(a==='open'){sel=i;const G=L('g');G[i].r=true;W('g',G);return render()}
 if(a==='unread'){const G=L('g');G[i].r=false;W('g',G);return render()}
 if(a==='delg'&&ask('Delete this message?')){const G=L('g');G.splice(i,1);W('g',G);sel=null;return render()}
 if(a==='appr'){const M=L('m');M[i].s='active';W('m',M);toast('Member approved');return render()}
 if(a==='delm'&&ask('Remove this member?')){const M=L('m');M.splice(i,1);W('m',M);return render()}
 const k={updates:'u',albums:'a',songs:'s'}[view];
 if(a==='edit'){ed=i;return render()}if(a==='cancel'){ed=null;return render()}
 if(a==='del'&&ask('Delete this item?')){const x=L(k);x.splice(i,1);W(k,x);ed=null;toast('Deleted');return render()}
 if(a==='delh'){const H=L('h');H.splice(i,1);W('h',H);return render()}
 if(a==='reseth'&&ask('Restore the default hero photos?')){W('h',DFC.defaults.hero);return render()}});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target;
 if(f.id==='lf'){const a=DFC.admin();if((f.u.value.trim()===a.user||(a.email&&f.u.value.trim().toLowerCase()===a.email.toLowerCase()))&&f.p.value===a.pass){ses.set(true);f.reset();$('#le').textContent='';return enter()}return $('#le').textContent='Wrong username or password.'}
 const k=f.dataset.f;
 if(k==='m'){const M=L('m');M.unshift({n:f.n.value,e:f.e.value,p:f.p.value,r:f.r.value,s:'active',t:Date.now()});W('m',M);toast('Member added')}
 if(k==='u'||k==='a'){const x=L(k),old=ed!==null?x[ed]:{},o=k==='u'?{t:f.t.value,d:f.d.value}:{t:f.t.value,g:f.g.value};o.i=await getImg(f,old.i);
  if(k==='a'&&(!o.i||!o.t)){const b=f.querySelector('.btn');b.disabled=true;b.textContent='Fetching cover…';
   try{const r=await DFC.albumInfo(o.g);if(!o.i)o.i=r.image;if(!o.t)o.t=r.title||'Photo album'}catch(x){alert(x.message+'\nThe album was saved without a cover. You can add one by hand.');if(!o.t)o.t='Photo album'}}
  ed!==null?x[ed]=o:x.unshift(o);W(k,x);ed=null;toast('Saved. It is now live on the website.')}
 if(k==='s'){const x=L('s'),old=ed!==null?x[ed]:{},o={t:f.t.value,a:f.a.value,s:f.s.value,au:f.au.value.trim(),yt:f.yt.value.trim(),l:f.l.value};o.i=await getImg(f,old.i);ed!==null?x[ed]=o:x.push(o);W('s',x);ed=null;toast('Song saved. It is live on the Songs page.')}
 if(k==='h'){const H=L('h');for(const x of f.file.files)H.push(await DFC.resize(x,1000));if(f.img.value.trim())H.push(f.img.value.trim());W('h',H);toast('Hero photos updated')}
 if(k==='gh'){DFC.setToken(f.tk.value.trim());toast('Token saved on this device only')}
 if(k==='p'){const a=DFC.admin();DFC.set('admin',{...a,name:f.elements['name'].value,role:f.role.value,email:f.email.value,phone:f.phone.value,user:f.user.value,pass:f.pass.value||a.pass});toast('Profile saved')}
 render()});
function pubUI(){const p=$('#pub');if(p)p.hidden=!DFC.dirty.size}
if($('#pubbtn'))$('#pubbtn').onclick=async e=>{const b=e.target;b.disabled=true;b.textContent='Publishing…';try{await DFC.publish();toast('Published! The live site updates in about a minute.')}catch(x){alert(x.message)}b.disabled=false;b.textContent='Publish to website';render()};
enter();
});
