/* PAKUM — animacije (2026-10-11)
   1) hero ulazi stepenasto, sekcije se otkrivaju pri skrolu
   2) „pakovanje zahteva": kad posetilac pošalje formu, uneti podaci ulete u kutiju,
      kutija se zatvori, zalepi, dobije nalepnicu sa imenom brenda i otputuje —
      pa tek onda ide stranica potvrde.
   Bez biblioteka. Ako je uključeno „manje pokreta", ništa se ne animira.
   Sadržaj se krije SAMO klasom koju dodaje ovaj skript, pa bez JS-a stranica ostaje cela. */
(() => {
  "use strict";

  const manjePokreta = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ──────────────────────────  1. ULAZAK I OTKRIVANJE  ────────────────────────── */

  /** @param {Element[]} grupa */
  const oznaci = (grupa) => {
    grupa.forEach((el, i) => {
      if (!(el instanceof HTMLElement) || el.classList.contains("an-ulaz")) return;
      el.classList.add("an-ulaz");
      if (i > 0) el.dataset.anKasni = String(Math.min(i, 5));
    });
  };

  const pokaziOdmah = (grupa) => grupa.forEach((el) => el.classList.add("an-vidi"));

  function postaviOtkrivanje() {
    const hero = document.querySelector(".hero");
    const heroDelovi = hero
      ? /** @type {Element[]} */ ([
          hero.querySelector(".kicker"),
          hero.querySelector("h1"),
          hero.querySelector(".lead"),
          hero.querySelector(".hero-ctas"),
          hero.querySelector(".hero-trust"),
        ].filter(Boolean))
      : [];

    /** @type {Element[][]} */
    const grupe = [];
    document.querySelectorAll("main section").forEach((sec) => {
      const naslov = sec.querySelector("h2");
      if (!naslov) return;
      const okvir = naslov.parentElement;
      const uvod = okvir ? okvir.querySelector("h2 ~ p, h2 ~ .lead") : null;
      const delovi = /** @type {Element[]} */ ([naslov, uvod].filter(Boolean));
      grupe.push(delovi);
    });

    oznaci(heroDelovi);
    grupe.forEach(oznaci);

    // hero se pokazuje odmah, ostalo pri dolasku u vidno polje
    requestAnimationFrame(() => pokaziOdmah(heroDelovi));

    if (typeof IntersectionObserver !== "function") {
      grupe.forEach(pokaziOdmah);
      return;
    }
    const posmatrac = new IntersectionObserver(
      (unosi) => {
        unosi.forEach((u) => {
          if (!u.isIntersecting) return;
          u.target.classList.add("an-vidi");
          posmatrac.unobserve(u.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    grupe.flat().forEach((el) => posmatrac.observe(el));
  }

  /* ──────────────────────────  2. PAKOVANJE ZAHTEVA  ────────────────────────── */

  /** Redosled i natpisi papirića — prikazuje se najviše 5 popunjenih polja. */
  const POLJA = [
    ["brend", "Brend"],
    ["proizvod", "Proizvod"],
    ["paketi", "Paketa mesečno"],
    ["ime", "Kontakt"],
    ["telefon", "Telefon"],
    ["email", "Email"],
    ["sajt", "Sajt"],
  ];

  const KORACI = [
    { faza: "pakuje", posle: 0, tekst: "Pakujemo vaš zahtev…", pod: "Vaši podaci ulaze u paket." },
    { faza: "lepi", posle: 1050, tekst: "Zatvaramo kutiju.", pod: "Ništa ne ispada usput." },
    { faza: "nalepnica", posle: 1420, tekst: "Lepimo nalepnicu.", pod: "Ide na ime vašeg brenda." },
  ];
  /** blago pomeranje papirića levo-desno da se ne slažu jedan preko drugog */
  const POMAK = [-16, 14, -9, 18, -5];

  let sloj = /** @type {HTMLElement|null} */ (null);
  let tajmeri = /** @type {number[]} */ ([]);
  let pocetak = 0;

  const ocisti = () => {
    tajmeri.forEach((t) => clearTimeout(t));
    tajmeri = [];
  };

  /** @param {string} s */
  const bez = (s) => String(s == null ? "" : s).trim();

  /** @param {Record<string, string>} podaci */
  function napraviSloj(podaci) {
    const el = document.createElement("div");
    el.className = "pakovanje";
    el.setAttribute("aria-hidden", "true");

    const scena = document.createElement("div");
    scena.className = "pakovanje-scena";

    const popunjena = POLJA.filter(([k]) => bez(podaci[k])).slice(0, 5);
    popunjena.forEach(([k, naziv], i) => {
      const p = document.createElement("div");
      p.className = "pakovanje-papir";
      p.style.setProperty("--kasni", `${0.1 + i * 0.13}s`);
      p.style.setProperty("--rot", `${i % 2 ? 6 : -6}deg`);
      p.style.setProperty("--pom", `${POMAK[i] || 0}px`);
      const b = document.createElement("b");
      b.textContent = naziv;
      const t = document.createElement("span");
      t.textContent = bez(podaci[k]);
      p.append(b, t);
      scena.appendChild(p);
    });

    const podloga = document.createElement("div");
    podloga.className = "pakovanje-podloga";

    const brzina = document.createElement("div");
    brzina.className = "pakovanje-brzina";
    brzina.innerHTML = "<i></i><i></i><i></i>";

    const kutija = document.createElement("div");
    kutija.className = "pakovanje-kutija";
    const telo = document.createElement("div");
    telo.className = "pakovanje-telo";
    const kriloL = document.createElement("div");
    kriloL.className = "pakovanje-krilo levo";
    const kriloD = document.createElement("div");
    kriloD.className = "pakovanje-krilo desno";
    const traka = document.createElement("div");
    traka.className = "pakovanje-traka";

    const nalepnica = document.createElement("div");
    nalepnica.className = "pakovanje-nalepnica";
    const nazivMale = document.createElement("span");
    nazivMale.textContent = "POŠILJALAC";
    const nazivBrenda = document.createElement("strong");
    nazivBrenda.textContent = bez(podaci.brend) || "Vaš brend";
    const barkod = document.createElement("div");
    barkod.className = "pakovanje-barkod";
    // širine crtica su stalne (bez slučajnih brojeva) da izgled bude isti svaki put
    [3, 1, 2, 1, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 1, 3, 2, 1].forEach((w) => {
      const i = document.createElement("i");
      i.style.width = `${w}px`;
      barkod.appendChild(i);
    });
    nalepnica.append(nazivMale, nazivBrenda, barkod);

    kutija.append(telo, traka, nalepnica, kriloL, kriloD);

    const tekst = document.createElement("div");
    tekst.className = "pakovanje-tekst";
    tekst.setAttribute("role", "status");
    tekst.setAttribute("aria-live", "polite");

    scena.append(podloga, brzina, kutija, tekst);
    el.appendChild(scena);
    document.body.appendChild(el);
    return el;
  }

  /** @param {HTMLElement} el @param {string} glavni @param {string} pod */
  function status(el, glavni, pod) {
    const t = el.querySelector(".pakovanje-tekst");
    if (!t) return;
    t.textContent = glavni;
    const s = document.createElement("small");
    s.textContent = pod;
    t.appendChild(s);
  }

  /**
   * Pokreće animaciju odmah po slanju — pokriva čekanje na odgovor servera.
   * @param {Record<string, string>} podaci
   */
  function pokreni(podaci) {
    if (manjePokreta() || sloj) return;
    pocetak = Date.now();
    sloj = napraviSloj(podaci || {});
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => sloj && sloj.setAttribute("data-otvoreno", "1"));
    KORACI.forEach((k) => {
      tajmeri.push(
        window.setTimeout(() => {
          if (!sloj) return;
          sloj.setAttribute("data-faza", k.faza);
          status(sloj, k.tekst, k.pod);
        }, k.posle),
      );
    });
  }

  /** Server je potvrdio prijem — paket odlazi, pa se otvara stranica potvrde. */
  function uspeh() {
    if (!sloj) return Promise.resolve();
    const el = sloj;
    // sačekaj da se nalepnica stigne videti, i kad server odgovori brže od animacije
    const minimum = KORACI[KORACI.length - 1].posle + 400;
    const ostalo = Math.max(0, minimum - (Date.now() - pocetak));
    return new Promise((resolve) => {
      window.setTimeout(() => {
        el.setAttribute("data-faza", "salje");
        status(el, "Poslato.", "Otvaramo potvrdu…");
        window.setTimeout(resolve, 820);
      }, ostalo);
    });
  }

  /** Slanje nije potvrđeno — sklanjamo sloj i vraćamo formu korisniku. */
  function greska() {
    ocisti();
    if (!sloj) return;
    const el = sloj;
    sloj = null;
    el.removeAttribute("data-otvoreno");
    document.documentElement.style.overflow = "";
    window.setTimeout(() => el.remove(), 320);
  }

  window.PakumPaket = { pokreni, uspeh, greska };

  /* ──────────────────────────  start  ────────────────────────── */

  const start = () => {
    if (!manjePokreta()) postaviOtkrivanje();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();

/* ──────────────────────────  PUT PORUDŽBINE  ──────────────────────────
   Paket putuje od stanice do stanice; radi samo dok je sekcija u vidnom polju. */
(() => {
  "use strict";
  const manjePokreta = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tok() {
    const lista = document.querySelector(".tok");
    if (!lista) return;
    const koraci = Array.from(lista.querySelectorAll(".tok-korak"));
    const paket = lista.querySelector(".tok-paket");
    if (!koraci.length) return;

    let i = 0;
    let tajmer = 0;

    const postavi = () => {
      koraci.forEach((k, j) => k.classList.toggle("je-tu", j === i));
      const tacka = koraci[i].querySelector(".tok-tacka");
      if (!paket || !tacka) return;
      const a = lista.getBoundingClientRect();
      const b = tacka.getBoundingClientRect();
      const vodoravno = window.innerWidth >= 860;
      paket.style.transition = "transform .7s cubic-bezier(.4,.1,.2,1)";
      // paket staje TIK PRED stanicu (ne preko ikonice) — čita se kao „stigao je"
      paket.style.transform = vodoravno
        ? "translateX(" + (b.left - a.left - 24) + "px)"
        : "translateY(" + (b.top - a.top - 22) + "px)";
    };

    const sledeci = () => {
      i = (i + 1) % koraci.length;
      postavi();
    };
    postavi();

    const pokreni = () => {
      if (tajmer || manjePokreta()) return;
      tajmer = window.setInterval(sledeci, 2500);
    };
    const stani = () => {
      window.clearInterval(tajmer);
      tajmer = 0;
    };

    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver(
        (unosi) => unosi.forEach((u) => (u.isIntersecting ? pokreni() : stani())),
        { threshold: 0.25 },
      ).observe(lista);
    } else {
      pokreni();
    }
    window.addEventListener("resize", postavi);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tok, { once: true });
  else tok();
})();
