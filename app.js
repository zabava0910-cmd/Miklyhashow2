(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const config = window.APP_CONFIG || {};
  const ready = !!(config.SUPABASE_URL && config.SUPABASE_ANON_KEY && window.supabase);
  const db = ready ? window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY) : null;
  let user = null, isAdmin = false, status = "pending", category = "Все", sort = "best", authMode = "login";
  let items = [], page = 0, pageSize = 20, currentDetail = null;
  const demoKey = "miklyxashow_demo_items_v1";
  const seed = [
    {id:"demo1",title:"Подборка смешных моментов",description:"Небольшая подборка клипов для просмотра на эфире.",category:"Клипы",type:"media",url:"https://www.youtube.com/",votes:18,status:"pending",created_at:new Date(Date.now()-3600000).toISOString(),author_name:"viewer01"},
    {id:"demo2",title:"Какой режим попробовать в следующий раз?",description:"Идея для обсуждения с чатом.",category:"Вопросы",type:"question",url:"",votes:12,status:"pending",created_at:new Date(Date.now()-86400000).toISOString(),author_name:"streamfan"},
    {id:"demo3",title:"Забавный игровой момент",description:"Пример карточки уже просмотренного материала.",category:"Игры",type:"media",url:"https://www.twitch.tv/",votes:31,status:"watched",created_at:new Date(Date.now()-172800000).toISOString(),author_name:"clipper"}
  ];
  function demoItems(){try{return JSON.parse(localStorage.getItem(demoKey)) || seed}catch{return seed}}
  function saveDemo(){localStorage.setItem(demoKey,JSON.stringify(items))}
  function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600)}
  function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function dateLabel(d){const ms=Date.now()-new Date(d).getTime();if(ms<86400000)return "сегодня";if(ms<172800000)return "вчера";return Math.floor(ms/86400000)+" дн. назад"}
  function notifyConfig(){if(!ready)$("#filterStatus").textContent += " · демо"}
  async function init(){
    if(ready){const {data:{session}}=await db.auth.getSession();user=session?.user||null;db.auth.onAuthStateChange((_e,s)=>{user=s?.user||null;refreshUser();loadItems()});await refreshUser();await loadItems()}
    else{items=demoItems();refreshUser();render();notifyConfig()}
  }
  async function refreshUser(){
    $("#authBtn").textContent=user?(user.email?.split("@")[0]||"Аккаунт"):"Войти";
    isAdmin=false;
    if(ready && user){const {data}=await db.from("profiles").select("is_admin").eq("id",user.id).maybeSingle();isAdmin=!!data?.is_admin}
  }
  async function loadItems(){
    if(!ready){items=demoItems();render();return}
    let q=db.from("submissions").select("*").order(sort==="new"?"created_at":"votes_count",{ascending:false}).range(0,199);
    if(status!=="all")q=q.eq("status",status);
    if(category!=="Все")q=q.eq("category",category);
    const {data,error}=await q;
    if(error){toast("Не удалось загрузить ленту");console.error(error);return}
    items=data||[];render();
  }
  function filtered(){
    let arr=[...items],term=$("#search").value.trim().toLowerCase(),period=$("#periodFilter").value,type=$("#typeFilter").value;
    if(!ready)arr=arr.filter(x=>status==="all"||x.status===status).filter(x=>category==="Все"||x.category===category);
    if(term)arr=arr.filter(x=>(x.title+" "+(x.description||"")).toLowerCase().includes(term));
    if(type!=="all")arr=arr.filter(x=>x.type===type);
    if(period!=="all"){const days=period==="today"?1:period==="week"?7:30;arr=arr.filter(x=>Date.now()-new Date(x.created_at).getTime()<days*86400000)}
    if(sort==="new")arr.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));else arr.sort((a,b)=>(b.votes_count??b.votes??0)-(a.votes_count??a.votes??0));
    return arr;
  }
  function render(){
    const arr=filtered(),list=$("#feedList");
    $("#filterStatus").textContent=(status==="pending"?"Не смотрели":status==="watched"?"Просмотрено":"Все")+(category!=="Все"?" · "+category:"");
    if(!arr.length){list.innerHTML='<div class="empty-state">Пока здесь пусто.<br>Будь первым — предложи материал для стрима.</div>';return}
    list.innerHTML=arr.map(x=>{
      const vote=x.votes_count??x.votes??0,tag=x.category||"Видео",watched=x.status==="watched";
      const media=x.file_url?`<img src="${escapeHtml(x.file_url)}" alt="">`:x.url?'<span class="play">▶</span>▶':'✦';
      return `<article class="post" data-id="${escapeHtml(x.id)}"><div class="thumb">${media}</div><div class="post-main"><div class="post-tags"><span>${x.file_url?"Файл":x.url?"Ссылка":"Вопрос"}</span><span class="tag">${escapeHtml(tag)}</span>${watched?'<span class="post-status">Просмотрено</span>':'<span class="post-status pending">На рассмотрении</span>'}</div><h3 class="post-title" data-open="${escapeHtml(x.id)}">${escapeHtml(x.title)}</h3><p class="post-desc">${escapeHtml(x.description||"Без описания")}</p><div class="post-meta"><span class="author-dot">${escapeHtml((x.author_name||"U")[0].toUpperCase())}</span><b>${escapeHtml(x.author_name||"Участник")}</b><span>·</span><span>${dateLabel(x.created_at)}</span></div></div><div class="post-vote"><button class="vote-btn" data-vote="${escapeHtml(x.id)}" title="Голосовать">▲</button><span class="vote-count">${vote}</span><span class="post-rating">голосов</span></div></article>`;
    }).join("");
    list.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",()=>openDetail(el.dataset.open)));
    list.querySelectorAll("[data-vote]").forEach(el=>el.addEventListener("click",()=>vote(el.dataset.vote)));
  }
  function getItem(id){return items.find(x=>String(x.id)===String(id))}
  async function vote(id){
    if(!user&&ready){$("#authDialog").showModal();return}
    if(!ready){let x=getItem(id);if(!x)return;x.votes=(x.votes||0)+1;saveDemo();render();toast("Голос учтён в демо-режиме");return}
    const {error}=await db.from("votes").upsert({submission_id:id,user_id:user.id},{onConflict:"submission_id,user_id"});
    if(error){toast(error.code==="23505"?"Вы уже голосовали":"Не удалось сохранить голос");return}
    await loadItems();toast("Голос учтён");
  }
  function openDetail(id){
    const x=getItem(id);if(!x)return;currentDetail=x;
    const media=x.file_url?(x.file_type?.startsWith("video")?`<video class="detail-media" src="${escapeHtml(x.file_url)}" controls></video>`:`<img class="detail-media" src="${escapeHtml(x.file_url)}">`):"";
    $("#itemDetail").innerHTML=`<div class="dialog-head"><div><div class="eyebrow">${escapeHtml(x.category||"ПРЕДЛОЖЕНИЕ")}</div><h2>${escapeHtml(x.title)}</h2></div><button class="close-btn" data-close="itemDialog">×</button></div>${media}<p>${escapeHtml(x.description||"")}</p>${x.url?`<a href="${escapeHtml(x.url)}" target="_blank" rel="noreferrer">Открыть исходное видео ↗</a>`:""}<div class="detail-actions"><button id="detailVote">▲ Голосовать (${x.votes_count??x.votes??0})</button>${x.status==="watched"?"<span class='post-status'>Просмотрено</span>":""}</div>${isAdmin?`<div class="moderation-tools"><button class="approve" id="approveItem">Одобрить</button><button class="reject" id="rejectItem">Отклонить</button><button id="watchedItem">Отметить просмотренным</button></div>`:""}`;
    $("#itemDialog").showModal();
    $("#itemDetail").querySelector("[data-close]").onclick=()=>$("#itemDialog").close();
    $("#detailVote").onclick=()=>vote(id);
    if(isAdmin){
      $("#approveItem").onclick=()=>moderate(id,"pending");
      $("#rejectItem").onclick=()=>moderate(id,"rejected");
      $("#watchedItem").onclick=()=>moderate(id,"watched");
    }
  }
  async function moderate(id,next){
    if(!ready||!isAdmin){toast("Действие доступно модератору");return}
    const {error}=await db.from("submissions").update({status:next}).eq("id",id);
    if(error){toast("Не удалось изменить статус");return}
    $("#itemDialog").close();await loadItems();toast("Статус обновлён");
  }
  async function submitItem(e){
    e.preventDefault();
    const title=$("#itemTitle").value.trim(),description=$("#itemDescription").value.trim(),url=$("#itemUrl").value.trim(),file=$("#itemFile").files[0];
    if(!title){return}
    if(ready&&!user){$("#authDialog").showModal();$("#submitMessage").textContent="Сначала войдите в аккаунт.";return}
    if(!url&&!file&&$("#itemType").value!=="question"){toast("Добавьте ссылку или файл");return}
    const btn=$("#submitButton");btn.disabled=true;btn.textContent="Отправляем…";
    try{
      let file_url=null,file_type=null;
      if(ready&&file){
        if(file.size>100*1024*1024)throw new Error("Файл больше 100 МБ");
        const path=`${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
        const up=await db.storage.from("submission-media").upload(path,file,{upsert:false});
        if(up.error)throw up.error;
        file_url=db.storage.from("submission-media").getPublicUrl(path).data.publicUrl;file_type=file.type;
      } else if(!ready&&file){
        if(file.size>100*1024*1024)throw new Error("Файл больше 100 МБ");
        file_url=URL.createObjectURL(file);file_type=file.type;
      }
      const payload={title,description,url:url||null,file_url,file_type,category:$("#itemCategory").value,type:$("#itemType").value,status:"pending",created_at:new Date().toISOString(),...(ready?{user_id:user.id,author_name:user.email?.split("@")[0]||"Участник"}:{})};
      if(ready){
        const {error}=await db.from("submissions").insert(payload);if(error)throw error;
      }else{
        items.unshift({...payload,id:"local"+Date.now(),votes:0,author_name:"Гость"});saveDemo();
      }
      $("#submitForm").reset();$("#fileName").textContent="";$("#submitDialog").close();status="pending";category="Все";await loadItems();toast(ready?"Отправлено на модерацию":"Добавлено в демо-ленту");
    }catch(err){console.error(err);$("#submitMessage").textContent=err.message||"Ошибка отправки"}
    finally{btn.disabled=false;btn.textContent="Отправить на модерацию"}
  }
  async function authSubmit(e){
    e.preventDefault();if(!ready){toast("Подключите Supabase для аккаунтов");return}
    const email=$("#authEmail").value,password=$("#authPassword").value;
    const result=authMode==="login"?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password});
    if(result.error){$("#authMessage").textContent=result.error.message;return}
    $("#authMessage").textContent=authMode==="login"?"Вход выполнен.":"Проверьте почту для подтверждения регистрации.";
    if(authMode==="login"){$("#authDialog").close();toast("Вы вошли")}
  }
  $("#openSubmit").onclick=()=>$("#submitDialog").showModal();
  $("#authBtn").onclick=()=>user?db.auth.signOut():$("#authDialog").showModal();
  $("#submitForm").addEventListener("submit",submitItem);
  $("#authForm").addEventListener("submit",authSubmit);
  $("#toggleAuth").onclick=()=>{authMode=authMode==="login"?"signup":"login";$("#authTitle").textContent=authMode==="login"?"Войти":"Регистрация";$("#authSubmit").textContent=authMode==="login"?"Войти":"Создать аккаунт";$("#toggleAuth").textContent=authMode==="login"?"Нет аккаунта? Зарегистрироваться":"Уже есть аккаунт? Войти"};
  $$("[data-close]").forEach(b=>b.onclick=()=>$("#"+b.dataset.close).close());
  $$("[data-status]").forEach(b=>b.onclick=()=>{status=b.dataset.status;$$("[data-status]").forEach(x=>x.classList.toggle("active",x===b));loadItems()});
  $$("[data-category]").forEach(b=>b.onclick=()=>{category=b.dataset.category;$$("[data-category]").forEach(x=>x.classList.toggle("active",x===b));loadItems()});
  $$("[data-sort]").forEach(b=>b.onclick=()=>{sort=b.dataset.sort;$$("[data-sort]").forEach(x=>x.classList.toggle("active",x===b));loadItems()});
  ["search","periodFilter","typeFilter"].forEach(id=>$("#"+id).addEventListener(id==="search"?"input":"change",render));
  $("#resetFilters").onclick=()=>{$("#search").value="";$("#periodFilter").value="all";$("#typeFilter").value="all";status="pending";category="Все";$$("[data-status]").forEach(x=>x.classList.toggle("active",x.dataset.status===status));$$("[data-category]").forEach(x=>x.classList.toggle("active",x.dataset.category===category));loadItems()};
  $("#themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem("miklyxashow_theme",document.body.classList.contains("light")?"light":"dark")};
  if(localStorage.getItem("miklyxashow_theme")==="light")document.body.classList.add("light");
  $("#itemFile").onchange=e=>$("#fileName").textContent=e.target.files[0]?.name||"";
  $("#loadMore").hidden=true;
  document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#search").focus()}});
  init();
})();
