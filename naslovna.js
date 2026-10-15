/* Naslovna (tamna) — radi samo na strani sa body.naslovna-nova. */
(function(){
if(!document.body.classList.contains("naslovna-nova"))return;
/* PAKUM — SVG ikonice (bez emodžija). Crtaju se u svaki element sa data-ikona="ime". */
(() => {
  "use strict";
  const P = {
    prijem: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    polica: '<path d="M3 7h18M3 12h18M3 17h18"/><path d="M6 7v10M18 7v10"/>',
    paket: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="m3.5 8.5 8.5 4.8 8.5-4.8M12 13.3V21"/>',
    kamion: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.9"/><circle cx="17.5" cy="18" r="1.9"/>',
    povrat: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    racun: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
    zgrada: '<path d="M4 21V5l8-3 8 3v16"/><path d="M9 21v-6h6v6"/><path d="M8 9h.01M12 9h.01M16 9h.01"/>',
    ljudi: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11a3 3 0 1 0-1.5-5.6"/><path d="M17 20a6 6 0 0 0-2-4.5"/>',
    ugovor: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="m10 14 2 2 3.5-3.5"/>',
    pin: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
    skener: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M4 12h16"/>',
    cek: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12.2 2.4 2.4 4.6-4.8"/>',
    prodavnica: '<path d="M3 9h18l-1.5-5h-15L3 9Z"/><path d="M5 9v10h14V9"/><path d="M9 19v-5h6v5"/>',
    stit: '<path d="M12 3 4 6v6c0 4.4 3.4 8.2 8 9 4.6-.8 8-4.6 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    kuca: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    sat: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    grafik: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    popis: '<path d="M5 4h14v16H5z"/><path d="m8.5 9 1.5 1.5L13 7.5M8.5 15l1.5 1.5L13 13.5"/><path d="M15 9h2M15 15h2"/>',
    podrska: '<path d="M4 13a8 8 0 0 1 16 0"/><rect x="2.5" y="13" width="4" height="6" rx="1.6"/><rect x="17.5" y="13" width="4" height="6" rx="1.6"/><path d="M20 19v1a3 3 0 0 1-3 3h-2"/>',
    ambalaza: '<path d="M3 8h18v12H3z"/><path d="M3 8l2-4h14l2 4"/><path d="M12 4v16"/>',
  };
  const crtaj = () => {
    document.querySelectorAll("[data-ikona]").forEach((el) => {
      const d = P[el.dataset.ikona];
      if (!d || el.querySelector("svg")) return;
      el.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        d +
        "</svg>";
    });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", crtaj, { once: true });
  else crtaj();
})();
/* PAKUM — brojači paketa za novi vrh sajta.
   Pravila koja je Lazar dao:
   - DANAS: broji od jutra i puni se do 16:30 ("do pola 5"), posle toga miruje na dnevnom planu.
   - OD POČETKA GODINE: kreće od ~300.000 i raste; uživo raste zajedno sa današnjim.
   - Dnevni plan nije isti svaki dan: prosek oko 3.000, nekad 2.500, nekad 5.000 — ali je
     ISTI ceo dan (izvodi se iz datuma), da se broj ne baca pri osvežavanju strane. */
(() => {
  "use strict";

  const POCETAK_SATI = 8;      // magacin kreće u 8
  const KRAJ_SATI = 16.5;      // "do pola 5"
  const GODISNJA_OSNOVA = 302000;  // ~300.000 na početku godine
  const GODISNJI_DNEVNI = 63;      // koliko se osnova pomera svakim danom

  /** prost, stabilan heš iz broja — isti ulaz uvek daje isti izlaz */
  const hes = (n) => {
    let x = (n * 2654435761) % 4294967296;
    x ^= x >>> 13;
    x = (x * 1274126177) % 4294967296;
    return (x ^ (x >>> 16)) >>> 0;
  };

  const danUGodini = (d) => {
    const prvi = Date.UTC(d.getFullYear(), 0, 1);
    const sad = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((sad - prvi) / 86400000) + 1;
  };

  /** Dnevni plan: većina dana 2.500–3.600, svaki sedmi dan skok do ~5.000. Vikendom manje. */
  function dnevniPlan(d) {
    const h = hes(d.getFullYear() * 1000 + danUGodini(d));
    const dan = d.getDay(); // 0 nedelja, 6 subota
    let plan = 2500 + (h % 1100);
    if (h % 7 === 0) plan = 4200 + (h % 800);
    if (dan === 6) plan = Math.round(plan * 0.55);
    if (dan === 0) plan = Math.round(plan * 0.2);
    return plan;
  }

  /** Koliko je paketa spakovano do ovog trenutka danas. */
  function danasDoSada(sada, plan) {
    const sati = sada.getHours() + sada.getMinutes() / 60 + sada.getSeconds() / 3600;
    if (sati <= POCETAK_SATI) return 0;
    if (sati >= KRAJ_SATI) return plan;
    const deo = (sati - POCETAK_SATI) / (KRAJ_SATI - POCETAK_SATI);
    // malo brže pre podne, sporije pred kraj — da ne izgleda kao prava linija
    const krivina = deo < 0.5 ? deo * 1.12 : 0.56 + (deo - 0.5) * 0.88;
    return Math.max(0, Math.round(plan * Math.min(1, krivina)));
  }

  function godisnjeDoSada(sada, danas) {
    return GODISNJA_OSNOVA + (danUGodini(sada) - 1) * GODISNJI_DNEVNI + danas;
  }

  const formatiraj = (n) => n.toLocaleString("sr-RS");

  /** Mekano prebrojavanje do nove vrednosti (ne skače). */
  function animirajDo(el, od, doVred, trajanje) {
    const t0 = performance.now();
    const korak = (t) => {
      const p = Math.min(1, (t - t0) / trajanje);
      const lak = 1 - Math.pow(1 - p, 3);
      el.textContent = formatiraj(Math.round(od + (doVred - od) * lak));
      if (p < 1) requestAnimationFrame(korak);
    };
    requestAnimationFrame(korak);
  }

  function pokreni() {
    const elDanas = document.querySelector("[data-brojac='danas']");
    const elGodina = document.querySelector("[data-brojac='godina']");
    const elPlan = document.querySelector("[data-brojac='plan']");
    if (!elDanas && !elGodina) return;

    const sada = new Date();
    const plan = dnevniPlan(sada);
    let danas = danasDoSada(sada, plan);
    let godina = godisnjeDoSada(sada, danas);
    if (elPlan) elPlan.textContent = formatiraj(plan);

    // Pre pocetka smene nema smisla pokazivati veliku nulu: stoji jucerasnji ucinak.
    const oznakaDanas = elDanas && elDanas.nextElementSibling;
    const oznakaPlan = elDanas && elDanas.parentElement.querySelector("em");
    let preSmene = sada.getHours() + sada.getMinutes() / 60 < POCETAK_SATI;
    function postaviOznake(pre) {
      if (oznakaDanas) oznakaDanas.textContent = pre ? "paketa juče" : "paketa danas";
      if (oznakaPlan) {
        if (pre) oznakaPlan.textContent = "nova smena kreće u 7 h";
        else {
          oznakaPlan.textContent = "uzivo — plan ";
          if (elPlan) { oznakaPlan.appendChild(elPlan); elPlan.textContent = formatiraj(plan); }
        }
      }
    }
    if (preSmene) {
      danas = dnevniPlan(new Date(sada.getTime() - 864e5));
      postaviOznake(true);
    }

    const manjePokreta = typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (manjePokreta) {
      if (elDanas) elDanas.textContent = formatiraj(danas);
      if (elGodina) elGodina.textContent = formatiraj(godina);
      return;
    }

    // prvo uvodno prebrojavanje sa ~82% na tačnu vrednost
    if (elDanas) animirajDo(elDanas, Math.round(danas * 0.82), danas, 1600);
    if (elGodina) animirajDo(elGodina, godina - Math.round(plan * 0.6), godina, 2000);

    // pa tiho rastu dok je radno vreme
    window.setInterval(() => {
      const s = new Date();
      const sati = s.getHours() + s.getMinutes() / 60;
      if (preSmene) {
        if (sati < POCETAK_SATI) return;      // brojka stoji na jucerasnjoj
        preSmene = false;
        postaviOznake(false);
        danas = 0;
        godina = godisnjeDoSada(s, 0);
      }
      const noviDanas = danasDoSada(s, dnevniPlan(s));
      if (noviDanas === danas) return;
      const razlika = noviDanas - danas;
      danas = noviDanas;
      godina += razlika;
      if (elDanas) animirajDo(elDanas, danas - razlika, danas, 700);
      if (elGodina) animirajDo(elGodina, godina - razlika, godina, 700);
    }, 5000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", pokreni, { once: true });
  else pokreni();
})();
/* paketi na traci */
const PRIMAOCI=[["Milan P.","Beograd 11000"],["Jovana I.","Novi Sad 21000"],["Nenad S.","Niš 18000"],["Tijana K.","Kragujevac 34000"],["Vuk M.","Subotica 24000"],["Dragana L.","Čačak 32000"],["Bojan N.","Zrenjanin 23000"]];
const IZVORI=["Shopify","WooCommerce","Sales funnel","Pouzeće","Povrat","Shopify","WooCommerce"];
const okvirPaketa=document.getElementById("paketi");
for(let i=0;i<7;i++){const [ime,mesto]=PRIMAOCI[i%PRIMAOCI.length];const d=document.createElement("div");d.className="paket";
 d.innerHTML='<span class="selo"></span><span class="kurir">BEX</span><span class="nalepnica">'+
  '<span class="vrh"><span>'+IZVORI[i%IZVORI.length]+'</span><span>#'+(412900+i*7)+'</span></span>'+
  '<span class="ime">'+ime+'</span><span class="mesto">'+mesto+'</span><i class="kod"></i></span>'+
  '<span class="tezina">'+(0.4+((i*7)%23)/10).toFixed(1).replace(".",",")+' kg</span>'+
  (i%3===0?'<span class="krhko">LOMLJIVO</span>':'');
 okvirPaketa.appendChild(d);}

/* brendovi: spisak je statican u HTML-u (ne dira se iz JS-a) */

/* SCENE: kratki snimci se puštaju samo dok su na ekranu */
(function(){
 const sve=document.querySelectorAll("video[data-scena]");if(!sve.length)return;
 if(!("IntersectionObserver" in window)){sve.forEach(v=>{v.autoplay=true;v.play().catch(()=>{});});return;}
 const p=new IntersectionObserver(u=>u.forEach(x=>{
  const v=x.target;
  if(x.isIntersecting){if(v.preload==="none"){v.preload="auto";v.load();}v.play().catch(()=>{});}
  else v.pause();
 }),{threshold:.3});
 sve.forEach(v=>p.observe(v));
})();

/* EKRAN SKENERA: šest skena, jedan po jedan */
(function(){
 const okvir=document.getElementById("skener");if(!okvir)return;
 const KORACI=[
  {ime:"Prijem",kratko:"Prijem",stanica:"01",vreme:"08:12:04",redovi:[["Artikal","Masažer za vrat · crni"],["Dokument","Prijem robe #311"],["Količina","24 kom primljeno"],["Status","Uneto u sistem"]]},
  {ime:"Odlaganje",kratko:"Odlaganje",stanica:"01",vreme:"08:41:19",redovi:[["Artikal","Masažer za vrat · crni"],["Pozicija","A-R01 · polica 3"],["Količina","24 kom na polici"],["Status","Pozicija potvrđena"]]},
  {ime:"Pikovanje",kratko:"Pikovanje",stanica:"02",vreme:"13:02:55",redovi:[["Artikal","Masažer za vrat · crni"],["Porudžbina","#41287"],["Količina","1 od 2 artikla"],["Status","Skinuto sa police"]]},
  {ime:"Pakovanje",kratko:"Pakovanje",stanica:"02",vreme:"13:09:37",redovi:[["Porudžbina","#41287"],["Sadržaj","2 od 2 artikla"],["Pakovanje","Koverta M · 0,62 kg"],["Status","Spremno za otpremu"]]},
  {ime:"Otprema",kratko:"Otprema",stanica:"03",vreme:"16:44:10",redovi:[["Porudžbina","#41287"],["Adresnica","BEX · odštampana"],["Pouzeće","4.190 RSD"],["Status","Slegnuto sa porudžbinom"]]},
  {ime:"Predaja kuriru",kratko:"Kurir",stanica:"03",vreme:"17:12:48",redovi:[["Porudžbina","#41287"],["Kurir","BEX · preuzeo"],["Paketa u turi","186"],["Status","Napustilo magacin"]]}
 ];
 const red=document.getElementById("sk-redovi"),spisak=document.getElementById("sk-koraci"),
  sat=document.getElementById("sk-sat"),stanica=document.getElementById("sk-stanica"),
  potvrda=document.getElementById("sk-potvrda"),linija=document.getElementById("sk-linija");
 let i=0,ura=null;
 KORACI.forEach((k,n)=>{const li=document.createElement("li");li.innerHTML="<b>"+(n+1)+"</b>"+k.kratko;
  li.addEventListener("click",()=>{i=n;crtaj();});spisak.appendChild(li);});
 const stavke=Array.from(spisak.children);
 function crtaj(){
  const k=KORACI[i];
  red.innerHTML=k.redovi.map(([a,b])=>"<div><dt>"+a+"</dt><dd>"+b+"</dd></div>").join("");
  sat.textContent=k.vreme; stanica.textContent=k.stanica;
  stavke.forEach((li,n)=>{li.classList.toggle("sad",n===i);li.classList.toggle("proslo",n<i);});
  potvrda.classList.remove("blic");void potvrda.offsetWidth;potvrda.classList.add("blic");
  linija.classList.remove("ide");void linija.offsetWidth;linija.classList.add("ide");
 }
 crtaj();
 const kreni=()=>{if(ura)return;ura=setInterval(()=>{i=(i+1)%KORACI.length;crtaj();},3200);};
 const stani=()=>{clearInterval(ura);ura=null;};
 if("IntersectionObserver" in window)
  new IntersectionObserver(u=>u.forEach(x=>x.isIntersecting?kreni():stani()),{threshold:.25}).observe(okvir);
 else kreni();
})();

/* TELEFON: logotipi brendova klize u traci (na racunaru ostaje mirna mreza) */
(function(){
 const lista=document.querySelector("#brendovi .brand-grid");
 if(!lista||!window.matchMedia)return;
 const telefon=window.matchMedia("(max-width:899px)");
 let udvojeno=false;
 function primeni(){
  if(telefon.matches&&!udvojeno){
   lista.querySelectorAll("li").forEach(li=>{const k=li.cloneNode(true);k.setAttribute("aria-hidden","true");lista.appendChild(k);});
   lista.classList.add("tece");udvojeno=true;
  }else if(!telefon.matches&&udvojeno){
   lista.querySelectorAll('li[aria-hidden="true"]').forEach(li=>li.remove());
   lista.classList.remove("tece");udvojeno=false;
  }
 }
 primeni();
 (telefon.addEventListener?telefon.addEventListener("change",primeni):telefon.addListener(primeni));
})();

/* TELEFON: plutajuce dugme se pojavljuje tek posle hero-a, a sklanja se nad formom */
(function(){
 const traka=document.querySelector(".mobile-contact-bar"),hero=document.querySelector(".hero"),
  forma=document.getElementById("kontakt");
 if(!traka||!hero||!window.IntersectionObserver)return;
 let prosaoHero=false,kodForme=false;
 const osvezi=()=>traka.classList.toggle("vidi-se",prosaoHero&&!kodForme);
 new IntersectionObserver(u=>u.forEach(x=>{prosaoHero=!x.isIntersecting;osvezi();}),{threshold:.12}).observe(hero);
 new IntersectionObserver(u=>u.forEach(x=>{kodForme=x.isIntersecting;osvezi();}),{threshold:.08}).observe(forma);
})();

/* naslovi se dele na reči da ulaze jedna po jedna */
(function(){
 const deli=el=>{Array.from(el.childNodes).forEach(c=>{
  if(c.nodeType===3){
   const f=document.createDocumentFragment();
   c.textContent.split(/(\s+)/).forEach(t=>{
    if(!t.trim()){f.appendChild(document.createTextNode(t));return;}
    const w=document.createElement("span");w.className="w";w.textContent=t;f.appendChild(w);});
   c.replaceWith(f);
  }else if(c.nodeType===1) deli(c);});};
 document.querySelectorAll(".hero h1, .zaglavlje h2").forEach(n=>{
  n.classList.add("naslov-reci");deli(n);
  n.querySelectorAll(".w").forEach((w,i)=>w.style.transitionDelay=(0.1+i*0.052).toFixed(3)+"s");});
})();

/* brojač paketa trepne na svaki skok */
(function(){
 const b=document.querySelector("[data-brojac='danas']");if(!b||!window.MutationObserver)return;
 new MutationObserver(()=>{b.classList.add("skok");setTimeout(()=>b.classList.remove("skok"),260);})
  .observe(b,{childList:true,characterData:true,subtree:true});
})();

/* otkrivanje */
const zaOtkrivanje=document.querySelectorAll(".u");
if(typeof IntersectionObserver==="function"){
 const p=new IntersectionObserver(u=>u.forEach(x=>{if(x.isIntersecting){x.target.classList.add("vidi");p.unobserve(x.target);}}),{threshold:.1,rootMargin:"0px 0px -6% 0px"});
 zaOtkrivanje.forEach(e=>p.observe(e));
 setTimeout(()=>zaOtkrivanje.forEach(e=>{const r=e.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)e.classList.add("vidi");}),1200);
}else zaOtkrivanje.forEach(e=>e.classList.add("vidi"));

/* ŠINA */
(function(){
 const sina=document.getElementById("sina"),ispuna=document.getElementById("ispuna"),vozac=document.getElementById("vozac");
 const stanice=Array.from(document.querySelectorAll("[data-stanica]"));
 const kraj=document.getElementById("kontakt");
 const tacke=stanice.map(s=>{const t=document.createElement("i");t.className="stanica";t.title=s.dataset.stanica;sina.appendChild(t);return {el:s,tacka:t};});
 const vodoravno=()=>innerWidth<900;
 let ceka=false;
 function razmesti(){
  const r=sina.getBoundingClientRect(),h=document.documentElement.scrollHeight;
  tacke.forEach(t=>{const vrh=t.el.getBoundingClientRect().top+scrollY;const d=Math.max(0,Math.min(1,vrh/h));
   if(vodoravno()){t.tacka.style.left=d*r.width+"px";t.tacka.style.top="-3px";}
   else{t.tacka.style.top=d*r.height+"px";t.tacka.style.left="-4px";}});
  vozac.style.top="";vozac.style.left="";
 }
 function osvezi(){
  ceka=false;
  const r=sina.getBoundingClientRect(),d=document.documentElement;
  const ukupno=d.scrollHeight-d.clientHeight,deo=ukupno>0?Math.min(1,Math.max(0,d.scrollTop/ukupno)):0;
  if(vodoravno()){
   ispuna.style.width=deo*r.width+"px";ispuna.style.height="3px";ispuna.style.top="0px";
   vozac.style.left=deo*r.width+"px";vozac.style.top="";vozac.style.transform="none";
   tacke.forEach(t=>t.tacka.classList.toggle("proslo",deo*r.width>=parseFloat(t.tacka.style.left||"0")-3));
  }else{
   ispuna.style.height=deo*r.height+"px";ispuna.style.width="2px";
   vozac.style.top=(r.top+deo*r.height-11)+"px";vozac.style.left="";vozac.style.transform="none";
   tacke.forEach(t=>t.tacka.classList.toggle("proslo",deo*r.height>=parseFloat(t.tacka.style.top||"0")-4));
  }
  vozac.classList.toggle("stigao",kraj.getBoundingClientRect().top<innerHeight*.55);
 }
 addEventListener("scroll",()=>{if(!ceka){ceka=true;requestAnimationFrame(osvezi);}},{passive:true});
 addEventListener("resize",()=>{razmesti();osvezi();});
 razmesti();osvezi();setTimeout(()=>{razmesti();osvezi();},900);
})();

/* USLUGE: lista se sama smenjuje, panel prati */
(function(){
 const stavke=Array.from(document.querySelectorAll("#lista-usluga .stavka"));
 const slojevi=Array.from(document.querySelectorAll("#usluge-panel .sloj"));
 let i=0,tajmer=0;
 const idi=(n)=>{i=n;stavke.forEach((s,j)=>s.classList.toggle("akt",j===i));slojevi.forEach((s,j)=>s.classList.toggle("akt",j===i));};
 stavke.forEach(s=>s.addEventListener("mouseenter",()=>{idi(Number(s.dataset.i));clearInterval(tajmer);tajmer=0;}));
 const kreni=()=>{if(!tajmer)tajmer=setInterval(()=>idi((i+1)%stavke.length),3200);};
 new IntersectionObserver(u=>u.forEach(x=>{x.isIntersecting?kreni():(clearInterval(tajmer),tajmer=0);}),{threshold:.3})
  .observe(document.getElementById("lista-usluga"));
})();

/* ROK: linija dana se puni do granice */
(function(){const okvir=document.getElementById("dan-linija"),isp=document.getElementById("dan-ispuna");
 new IntersectionObserver(u=>u.forEach(x=>{if(x.isIntersecting)isp.style.width="75%";}),{threshold:.4}).observe(okvir);})();

/* KONTROLA: snimak se menja na 3-4 dana */
(function(){const v=document.getElementById("snimak-magacin");if(!v)return;
 const d=new Date(),prvi=Date.UTC(d.getFullYear(),0,1),sad=Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 const dan=Math.floor((sad-prvi)/86400000)+1,broj=(Math.floor(dan/3.5)%4)+1;
 v.poster="/video/pakovanje-"+broj+".jpg";v.src="/video/pakovanje-"+broj+".mp4";
 new IntersectionObserver(u=>u.forEach(x=>{x.isIntersecting?v.play().catch(()=>{}):v.pause();}),{threshold:.25}).observe(v);})();


/* KAMERA: od 7 do 17:30 pakovanje, posle prazan sto; sat ide uživo */
(function(){
 const v=document.getElementById("kamera-video"),okvir=document.getElementById("kamera-okvir"),
  stanje=document.getElementById("kamera-stanje"),sat=document.getElementById("sat-kamere");
 if(!v) return;
 let radi=null;
 function postavi(){
  const d=new Date(),h=d.getHours()+d.getMinutes()/60,dan=d.getDay();
  const uSmeni=h>=7&&h<17.5&&dan!==0;
  if(uSmeni!==radi){
   radi=uSmeni;
   v.poster=uSmeni?"/video/kamera-pakovanje.jpg":"/video/kamera-prazno.jpg";
   v.src=uSmeni?"/video/kamera-pakovanje.mp4":"/video/kamera-prazno.mp4";
   okvir.classList.toggle("mirno",!uSmeni);
   stanje.lastElementChild.textContent=uSmeni?"pakujemo":"smena je gotova — sutra od 7 h";
   v.play().catch(()=>{});
  }
  sat.textContent=d.toLocaleTimeString("sr-RS",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
 }
 postavi(); setInterval(postavi,1000);
 new IntersectionObserver(u=>u.forEach(x=>{x.isIntersecting?v.play().catch(()=>{}):v.pause();}),{threshold:.2}).observe(v);
})();

/* ZAŠTO: brojke se prebrojavaju kad udju u vidno polje */
(function(){
 document.querySelectorAll("[data-broji]").forEach(b=>{
  const o=new IntersectionObserver(u=>u.forEach(x=>{
   if(!x.isIntersecting)return;
   o.unobserve(b);
   const cilj=Number(b.dataset.broji),suf=b.dataset.sufiks||"",t0=performance.now();
   const korak=(t)=>{const pr=Math.min(1,(t-t0)/1100),lak=1-Math.pow(1-pr,3);
    b.textContent=Math.round(cilj*lak).toLocaleString("sr-RS")+suf;if(pr<1)requestAnimationFrame(korak);};
   requestAnimationFrame(korak);
  }),{threshold:.5});
  o.observe(b);
 });
})();

/* tok */
(function(){const lista=document.querySelector(".tok"),koraci=Array.from(lista.querySelectorAll(".korak")),paket=lista.querySelector(".tok-paket");
 let i=0,tajmer=0;
 const postavi=()=>{koraci.forEach((k,j)=>k.classList.toggle("je-tu",j===i));const t=koraci[i].querySelector(".tacka");
  const a=lista.getBoundingClientRect(),b=t.getBoundingClientRect();
  paket.style.transition="transform .7s cubic-bezier(.4,.1,.2,1)";
  paket.style.transform=innerWidth>=900?"translateX("+(b.left-a.left-24)+"px)":"translateY("+(b.top-a.top-22)+"px)";};
 postavi();
 new IntersectionObserver(u=>u.forEach(x=>{if(x.isIntersecting&&!tajmer)tajmer=setInterval(()=>{i=(i+1)%koraci.length;postavi();},2500);
  else if(!x.isIntersecting&&tajmer){clearInterval(tajmer);tajmer=0;}}),{threshold:.25}).observe(lista);
 addEventListener("resize",postavi);})();

})();
