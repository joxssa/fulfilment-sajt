// @ts-check
(() => {
  const burger = document.getElementById("burger");
  const links = document.querySelector(".nav-links");
  if (burger && links) {
    const closeMenu = () => {
      links.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Otvori meni");
    };
    burger.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Zatvori meni" : "Otvori meni");
    });
    links
      .querySelectorAll("a")
      .forEach((link) => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && links.classList.contains("open")) {
        closeMenu();
        burger.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (event.target instanceof Element && !event.target.closest("nav"))
        closeMenu();
    });
  }

  document.querySelectorAll(".nav-drop").forEach((drop) => {
    const button = drop.querySelector(".nav-drop-btn");
    if (!(button instanceof HTMLButtonElement)) return;
    /** @param {boolean} open */
    const setOpen = (open) => {
      drop.classList.toggle("open", open);
      button.setAttribute("aria-expanded", String(open));
    };
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(!drop.classList.contains("open"));
    });
    document.addEventListener("click", (event) => {
      if (event.target instanceof Element && !event.target.closest(".nav-drop"))
        setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && drop.classList.contains("open")) {
        setOpen(false);
        button.focus();
      }
    });
  });

  // Obe forme (zahtev za ponudu i partnerska prijava) idu istim kanalom:
  // sus.rs → Slack #asistent, plus kopija u BizOMS (Fulfilment › Prijave sa sajta).
  const PRIMARY_URL = "https://sus.rs/api/pakum/prijava";
  const BIZOMS_LEAD_URL = "https://bizdb.46.224.193.209.sslip.io/functions/v1/pakum-lead";

  // ---- Izvor prijave (Lazar 23.09.2026) ----
  // Pamti odakle je posetilac došao: klik sa Google oglasa (gclid/gbraid/wbraid), Facebook
  // (fbclid), utm_* iz sufiksa oglasa, ulazna strana i spoljni sajt sa kog je stigao.
  // Čuva se u localStorage 90 dana. Dolazak sa oznakom oglasa uvek preuzima zapis (važi
  // poslednji označen klik); dolazak sa spoljnog sajta menja samo zapis bez oznake; inače
  // ostaje sačuvani. Ide SAMO u kopiju za BizOMS (fulfilment_leads.raw.izvor) — sus.rs
  // dobija isto telo kao ranije.
  const IZVOR_KLJUC = "pakum_izvor";
  const IZVOR_ROK_MS = 90 * 24 * 60 * 60 * 1000;
  const IZVOR_BUDUCNOST_MS = 24 * 60 * 60 * 1000;
  const IZVOR_MAKS = 300;
  const IZVOR_PARAMETRI = [
    "gclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];
  const IZVOR_POLJA = [...IZVOR_PARAMETRI, "landing", "referrer", "vreme"];
  // Funkcija pakum-lead odbija telo duže od 20.000 znakova; izvor nikad ne sme da obori prijavu.
  const BIZOMS_TELO_MAKS = 19000;
  const KONTROLNI_ZNACI = /[\u0000-\u001F\u007F]/g;

  /**
   * Tekst bez kontrolnih znakova, bez razmaka na krajevima, najviše IZVOR_MAKS znakova.
   * Skraćivanje ne ostavlja pola emodžija (usamljen surogat baza ne prima u jsonb).
   * @param {unknown} vrednost
   * @returns {string}
   */
  const ocistiIzvor = (vrednost) =>
    typeof vrednost === "string"
      ? vrednost
          .replace(KONTROLNI_ZNACI, "")
          .trim()
          .slice(0, IZVOR_MAKS)
          .replace(/[\uD800-\uDBFF]$/, "")
      : "";

  /**
   * Parametri oglasa iz adrese strane (samo poznati ključevi, očišćeni i skraćeni).
   * @param {string} search
   * @returns {Record<string, string>}
   */
  const parametriOglasa = (search) => {
    /** @type {Record<string, string>} */
    const nadjeno = {};
    const parametri = new URLSearchParams(search || "");
    for (const kljuc of IZVOR_PARAMETRI) {
      const vrednost = ocistiIzvor(parametri.get(kljuc));
      if (vrednost) nadjeno[kljuc] = vrednost;
    }
    return nadjeno;
  };

  /**
   * Spoljni referrer kao „host/putanja“ (bez upita i heša). Prazno za isti sajt
   * (i sa www. i bez njega) ili neispravnu adresu.
   * @param {string} referrer
   * @param {string} host hostname ove strane
   * @returns {string}
   */
  const spoljniReferrer = (referrer, host) => {
    if (!referrer) return "";
    let adresa;
    try {
      adresa = new URL(referrer);
    } catch {
      return "";
    }
    if (!adresa.hostname) return "";
    /** @param {string} ime */
    const bezWww = (ime) => ime.toLowerCase().replace(/^www\./, "");
    if (host && bezWww(adresa.hostname) === bezWww(host)) return "";
    return ocistiIzvor(adresa.hostname + adresa.pathname);
  };

  /**
   * Sačuvan zapis izvora: samo poznata polja, očišćena. null ako je neispravan, bez
   * vremena, stariji od 90 dana ili iz budućnosti (više od dan, zbog pomerenog sata).
   * @param {string | null} tekst
   * @param {number} sada
   * @returns {Record<string, string> | null}
   */
  const procitajIzvor = (tekst, sada) => {
    if (!tekst) return null;
    let sirovo;
    try {
      sirovo = JSON.parse(tekst);
    } catch {
      return null;
    }
    if (!sirovo || typeof sirovo !== "object" || Array.isArray(sirovo)) return null;
    /** @type {Record<string, string>} */
    const zapis = {};
    for (const kljuc of IZVOR_POLJA) {
      const vrednost = ocistiIzvor(sirovo[kljuc]);
      if (vrednost) zapis[kljuc] = vrednost;
    }
    const vreme = Date.parse(zapis.vreme || "");
    if (!Number.isFinite(vreme)) return null;
    if (sada - vreme >= IZVOR_ROK_MS || vreme - sada > IZVOR_BUDUCNOST_MS) return null;
    return zapis;
  };

  /**
   * Koji izvor važi posle ove posete i da li ga treba upisati.
   * @param {{ search: string, putanja: string, referrer: string, host: string, sacuvano: string | null, sada: number }} ulaz
   * @returns {{ zapis: Record<string, string>, upisi: boolean }}
   */
  const izracunajIzvor = ({ search, putanja, referrer, host, sacuvano, sada }) => {
    const oglas = parametriOglasa(search);
    /** @type {Record<string, string>} */
    const poseta = { ...oglas };
    const landing = ocistiIzvor(`${putanja || ""}${search || ""}`);
    if (landing) poseta.landing = landing;
    const spolja = spoljniReferrer(referrer, host);
    if (spolja) poseta.referrer = spolja;
    poseta.vreme = new Date(sada).toISOString();
    if (Object.keys(oglas).length) return { zapis: poseta, upisi: true };
    const prethodni = procitajIzvor(sacuvano, sada);
    const prethodniOznacen = !!prethodni && IZVOR_PARAMETRI.some((kljuc) => kljuc in prethodni);
    if (prethodni && (!spolja || prethodniOznacen)) return { zapis: prethodni, upisi: false };
    return { zapis: poseta, upisi: true };
  };

  /**
   * Telo kopije za BizOMS: isti podaci kao za sus.rs plus „izvor“. Bez izvora (samo vreme)
   * ili kad bi telo prešlo granicu funkcije pakum-lead ide isto telo kao za sus.rs.
   * @param {Record<string, string>} data
   * @param {Record<string, string>} izvor
   * @param {string} osnovno telo za sus.rs
   * @returns {string}
   */
  const teloZaBizoms = (data, izvor, osnovno) => {
    if (!Object.keys(izvor).some((kljuc) => kljuc !== "vreme")) return osnovno;
    const telo = JSON.stringify({ ...data, izvor });
    return telo.length > BIZOMS_TELO_MAKS ? osnovno : telo;
  };

  /**
   * Beleži izvor pri svakom učitavanju strane. Blokiran ili pun localStorage (privatni
   * režim) ne sme da smeta formi: tada važi samo ova poseta.
   * @returns {Record<string, string>}
   */
  const zabeleziIzvor = () => {
    /** @type {Storage | null} */
    let skladiste = null;
    /** @type {string | null} */
    let sacuvano = null;
    try {
      skladiste = window.localStorage;
      sacuvano = skladiste.getItem(IZVOR_KLJUC);
    } catch {
      skladiste = null;
      sacuvano = null;
    }
    const lokacija = window.location;
    const { zapis, upisi } = izracunajIzvor({
      search: (lokacija && lokacija.search) || "",
      putanja: (lokacija && lokacija.pathname) || "",
      referrer: document.referrer || "",
      host: (lokacija && lokacija.hostname) || "",
      sacuvano,
      sada: Date.now(),
    });
    if (upisi && skladiste) {
      try {
        skladiste.setItem(IZVOR_KLJUC, JSON.stringify(zapis));
      } catch {
        /* skladište je puno ili blokirano; izvor ove posete i dalje ide uz prijavu */
      }
    }
    return zapis;
  };

  /** @type {Record<string, string>} */
  let izvorPosete = {};
  try {
    izvorPosete = zabeleziIzvor();
  } catch {
    izvorPosete = {};
  }

  /**
   * @typedef {Object} LeadSpec
   * @property {string} formId
   * @property {string} statusId
   * @property {string} fallbackId
   * @property {(value: (id: string) => string) => { data: Record<string, string>, subject: string, lines: string[] }} build
   */

  /** @param {LeadSpec} spec */
  const bindLeadForm = (spec) => {
    const form = document.getElementById(spec.formId);
    const submit = form?.querySelector('button[type="submit"]');
    const status = document.getElementById(spec.statusId);
    const fallback = document.getElementById(spec.fallbackId);
    if (
      !(form instanceof HTMLFormElement) ||
      !(submit instanceof HTMLButtonElement) ||
      !status ||
      !(fallback instanceof HTMLAnchorElement)
    )
      return;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled || !form.reportValidity()) return;
      /** @param {string} id */
      const value = (id) => {
        const field = form.querySelector(`#${id}`);
        return field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement ||
          field instanceof HTMLTextAreaElement
          ? field.value.trim()
          : "";
      };
      const { data, subject, lines } = spec.build(value);
      if (data.web) return;
      // Forma sa engleskog sajta (data-lang="en"): u Slacku se vidi „EN:" na početku.
      if (form.dataset && form.dataset.lang === "en" && data.brend) data.brend = `EN: ${data.brend}`;
      submit.disabled = true;
      submit.textContent = "Šaljemo zahtev…";
      status.textContent = "Slanje je u toku.";
      fallback.hidden = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const request = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
          signal: controller.signal,
        };
        const primary = fetch(PRIMARY_URL, request);
        // Kopija u BizOMS (sa izvorom prijave). Dopunska: ne menja ishod slanja.
        try {
          const bizomsBody = teloZaBizoms(data, izvorPosete, request.body);
          fetch(BIZOMS_LEAD_URL, { ...request, body: bizomsBody, keepalive: true }).catch(() => {});
        } catch {
          /* kopija u BizOMS nije uspela; glavni kanal odlučuje */
        }
        const response = await primary;
        if (!response.ok) throw new Error("Slanje nije potvrđeno");
        // Engleska verzija forme nosi data-thanks="/en/thank-you/".
        window.location.assign((form.dataset && form.dataset.thanks) || "/hvala/");
      } catch {
        status.textContent =
          "Nismo dobili potvrdu da je zahtev primljen. Podaci su sačuvani u formi. Pokušajte ponovo ili ih pošaljite emailom.";
        fallback.href = `mailto:info@pakum.rs?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
        fallback.hidden = false;
        submit.disabled = false;
        submit.textContent = "Pokušaj ponovo";
      } finally {
        clearTimeout(timeout);
      }
    });
  };

  // Zahtev za ponudu (naslovna).
  bindLeadForm({
    formId: "prijava",
    statusId: "form-status",
    fallbackId: "email-fallback",
    build: (value) => {
      const data = {
        brend: value("brend"),
        sajt: value("sajt"),
        proizvod: value("proizvod"),
        paketi: value("paketi"),
        interes: value("interes"),
        firma: value("firma"),
        pib: value("pib"),
        ime: value("ime"),
        telefon: value("telefon"),
        email: value("email"),
        poruka: value("poruka"),
        web: value("web"),
      };
      return {
        data,
        subject: `Ponuda — ${data.brend}`,
        lines: [
          "Zahtev za ponudu — fulfilment.rs",
          "",
          `Brend: ${data.brend}`,
          `Sajt: ${data.sajt}`,
          `Proizvod: ${data.proizvod}`,
          `Paketa mesečno: ${data.paketi}`,
          `Usluge: ${data.interes}`,
          `Firma: ${data.firma}`,
          `PIB: ${data.pib}`,
          `Ime: ${data.ime}`,
          `Telefon: ${data.telefon}`,
          `Email: ${data.email}`,
          `Napomena: ${data.poruka}`,
        ],
      };
    },
  });

  // Upitnik u četiri koraka (/zahtev-za-ponudu): ista polja ka serveru kao i
  // forma sa naslovne; dodatna pitanja (izvor, gde je roba, kada počinje) idu
  // u napomenu, da ugovor sa API-jem ostane nepromenjen.
  bindLeadForm({
    formId: "ponuda",
    statusId: "ponuda-status",
    fallbackId: "ponuda-fallback",
    build: (value) => {
      const izvor = value("q-izvor");
      const roba = value("q-roba");
      const pocetak = value("q-pocetak");
      const napomena = value("q-poruka");
      const dodatno = [
        roba ? `Roba je sada: ${roba}.` : "",
        pocetak ? `Početak saradnje: ${pocetak}.` : "",
        izvor ? `Za nas su čuli preko: ${izvor}.` : "",
        "Popunjeno kroz upitnik u četiri koraka.",
      ].filter(Boolean);
      const data = {
        brend: value("q-brend"),
        sajt: value("q-sajt"),
        proizvod: value("q-proizvod"),
        paketi: value("q-paketi"),
        interes: value("q-interes"),
        firma: value("q-firma"),
        pib: value("q-pib"),
        ime: value("q-ime"),
        telefon: value("q-telefon"),
        email: value("q-email"),
        poruka: [napomena, ...dodatno].filter(Boolean).join(" "),
        web: value("q-web"),
      };
      return {
        data,
        subject: `Ponuda — ${data.brend}`,
        lines: [
          "Zahtev za ponudu (upitnik u četiri koraka) — fulfilment.rs",
          "",
          `Ime: ${data.ime}`,
          `Telefon: ${data.telefon}`,
          `Email: ${data.email}`,
          `Firma: ${data.firma}`,
          `PIB: ${data.pib}`,
          `Brend: ${data.brend}`,
          `Proizvod: ${data.proizvod}`,
          `Sajt: ${data.sajt}`,
          `Paketa mesečno: ${data.paketi}`,
          `Usluge: ${data.interes}`,
          `Napomena: ${data.poruka}`,
        ],
      };
    },
  });

  // Partnerski program (/partnerski-program): ista polja ka serveru, mapirana da Slack poruka bude jasna.
  bindLeadForm({
    formId: "partner",
    statusId: "partner-status",
    fallbackId: "partner-fallback",
    build: (value) => {
      const naziv = value("p-naziv");
      const kanal = value("p-kanal");
      const doseg = value("p-doseg");
      const nacin = value("p-nacin");
      const poruka = value("p-poruka");
      const data = {
        brend: `PARTNER: ${naziv}`,
        sajt: value("p-link"),
        proizvod: value("p-proizvodi"),
        paketi: "",
        interes: `Partnerski program — ${nacin}`,
        firma: value("p-firma"),
        pib: "",
        ime: value("p-ime"),
        telefon: value("p-telefon"),
        email: value("p-email"),
        poruka: [`Kanal: ${kanal}.`, `Doseg: ${doseg}.`, poruka].filter(Boolean).join(" "),
        web: value("p-web"),
      };
      return {
        data,
        subject: `Partnerski program — ${naziv}`,
        lines: [
          "Prijava za partnerski program — fulfilment.rs",
          "",
          `Sajt/profil: ${naziv}`,
          `Link: ${data.sajt}`,
          `Kanal: ${kanal}`,
          `Doseg: ${doseg}`,
          `Način saradnje: ${nacin}`,
          `Proizvodi: ${data.proizvod}`,
          `Firma: ${data.firma}`,
          `Ime: ${data.ime}`,
          `Telefon: ${data.telefon}`,
          `Email: ${data.email}`,
          `Napomena: ${poruka}`,
        ],
      };
    },
  });

  // Vrednost skripte browser odbacuje; testovi (vm.runInNewContext) je koriste da
  // provere čistu logiku izvora bez DOM-a.
  return {
    izvor: {
      KLJUC: IZVOR_KLJUC,
      ROK_MS: IZVOR_ROK_MS,
      parametriOglasa,
      spoljniReferrer,
      procitajIzvor,
      izracunajIzvor,
      teloZaBizoms,
    },
  };
})();
