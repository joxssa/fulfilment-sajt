const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const pages = [
  ...fs.readdirSync(__dirname).filter((file) => file.endsWith(".html")),
  "hvala/index.html",
];
const source = fs.readFileSync(path.join(__dirname, "site.js"), "utf8");
const read = (file) => fs.readFileSync(path.join(__dirname, file), "utf8");

test("all existing public pages retain valid scripts, metadata and local destinations", () => {
  const errors = [];
  for (const file of pages) {
    const html = read(file);
    assert.match(html, /<html lang="sr-Latn">/, file);
    assert.match(html, /<title>[^<]+<\/title>/, file);
    for (const script of html.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
    )) {
      if (script[1].includes("application/ld+json")) JSON.parse(script[2]);
      else new vm.Script(script[2], { filename: file });
    }
    const base = `https://fulfilment.rs/${file}`;
    const targets = [
      ...html.matchAll(/(?:href|src)="([^"]+)"/g),
      ...html.matchAll(/content="0; url=([^"]+)"/g),
      ...html.matchAll(/location\.replace\('([^']+)'\)/g),
    ];
    for (const match of targets) {
      const href = match[1];
      if (/^(?:https?:|mailto:|data:|tel:)/.test(href)) continue;
      const url = new URL(href, base);
      let dest = decodeURIComponent(url.pathname.slice(1)) || "index.html";
      if (dest.endsWith("/")) dest += "index.html";
      else if (!path.extname(dest)) dest += ".html";
      if (!fs.existsSync(path.join(__dirname, dest))) {
        errors.push(`${file}: missing ${href}`);
        continue;
      }
      if (
        url.hash &&
        dest.endsWith(".html") &&
        !read(dest).includes(`id="${url.hash.slice(1)}"`)
      )
        errors.push(`${file}: missing anchor ${href}`);
    }
  }
  assert.deepEqual(errors, []);
});

test("fulfilment posluje kao PAKUM DOO NIŠ — nigde više Bizonline podaci", () => {
  // Lazarova reč 16.09: „gde god piše bizonline, mora da piše PAKUM — bizonline više nema veze sa fulfilmentom".
  for (const file of [...pages, ...enPages, "site.js", "llms.txt"]) {
    const text = read(file);
    assert.doesNotMatch(text, /bizonline/i, `${file}: stara firma`);
    assert.doesNotMatch(text, /113156519|66619206/, `${file}: stari PIB ili matični broj`);
  }
  const footer = read("index.html");
  assert.match(footer, /<li><a href="mailto:info@pakum\.rs">info@pakum\.rs<\/a><\/li>/);
  assert.match(footer, /<li>PAKUM DOO NIŠ<\/li>/);
  assert.match(footer, /Matični broj: 22332040/);
  assert.match(footer, /PIB: 115952498/);
  assert.match(footer, /"legalName":"PAKUM DOO NIŠ"/);
  assert.match(footer, /"taxID":"115952498"/);
});

test("internal navigation, canonicals, sitemap and redirects use extensionless URLs", () => {
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(html, /href="(?!https?:)[^"]*\.html/, file);
    assert.doesNotMatch(html, /https:\/\/fulfilment\.rs\/[^"'\s<]*\.html/, file);
    assert.doesNotMatch(html, /url=[^"']*\.html/, file);
    assert.doesNotMatch(html, /<base\b/, file);
    for (const match of html.matchAll(/(?:href|src)="(?!https?:|mailto:|data:|tel:|#)([^"]+)"/g))
      assert.match(match[1], /^\//, `${file}: ${match[1]} must be root-relative`);
  }
  const sitemap = read("sitemap.xml");
  assert.doesNotMatch(sitemap, /\.html/);
  const locs = [...sitemap.matchAll(/<loc>https:\/\/fulfilment\.rs\/([^<]*)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.includes("") && locs.includes("softver") && locs.includes("cena-fulfilmenta"));
  for (const loc of locs)
    assert.ok(fs.existsSync(path.join(__dirname, loc === "" || loc.endsWith("/") ? `${loc}index.html` : `${loc}.html`)), loc);
  assert.doesNotMatch(sitemap, /hvala/);
  assert.equal(fs.existsSync(path.join(__dirname, ".nojekyll")), true);
});

test("every indexable page has one H1, SEO-length title and description, extensionless canonical and valid JSON-LD references", () => {
  const indexable = pages.filter((file) => !/noindex/.test(read(file)));
  // 16.09: roba-na-veliko, usluzni-uvoz-iz-kine i skaliranje su namerno noindex (sajt za sad nudi samo fulfilment) → 11 indeksiranih
  assert.ok(indexable.length >= 11, `indexable pages: ${indexable.length}`);
  for (const file of indexable) {
    const html = read(file);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${file}: exactly one H1`);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(title.length >= 30 && title.length <= 62 && / \| PAKUM$/.test(title), `${file}: title "${title}" (${title.length})`);
    const meta = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)[1];
    assert.ok(meta.length >= 110 && meta.length <= 158, `${file}: meta ${meta.length}`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    assert.match(canonical, /^https:\/\/fulfilment\.rs\/([a-z0-9-]+|hvala\/)?$/, `${file}: canonical ${canonical}`);
    assert.doesNotMatch(html, /[ČčCc]akum-pakum|\d[\d.]*\+?\s*paketa\s+(mesečno|dnevno)|\b48\s?h\b|48 sati|isti dan|\bSUS\b|na jugu Srbije|call centar|\bUskoro\b/, `${file}: forbidden phrase`);
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
    const refsOrg = JSON.stringify(ld).includes('"@id":"https://fulfilment.rs/#organization"');
    assert.ok(refsOrg, `${file}: Organization @id reference`);
  }
});

test("FAQ schema matches visible questions and answers, and unsupported public promises are absent", () => {
  const clean = (text) =>
    text
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(
      html,
      /400\.000|2\.000 m²|30\.000|48h|48 sati|fizički ne može|uvek jednako/,
    );
    const questions = [
      ...html.matchAll(
        /<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g,
      ),
    ].map((match) => [clean(match[1]), clean(match[2])]);
    for (const script of html.matchAll(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
    )) {
      const json = JSON.parse(script[1]);
      if (json["@type"] === "FAQPage")
        assert.deepEqual(
          json.mainEntity.map((item) => [item.name, item.acceptedAnswer.text]),
          questions,
          file,
        );
    }
  }
});

function harness(fetchHandler, location = {}) {
  class Element {
    constructor() {
      this.listeners = {};
      this.attrs = {};
      this.classes = new Set();
      this.textContent = "";
      this.hidden = false;
      this.disabled = false;
      this.value = "";
      this.focused = false;
    }
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    }
    setAttribute(name, value) {
      this.attrs[name] = value;
    }
    focus() {
      this.focused = true;
    }
    get classList() {
      return {
        contains: (name) => this.classes.has(name),
        remove: (name) => this.classes.delete(name),
        toggle: (name, force) => {
          const open = force === undefined ? !this.classes.has(name) : force;
          if (open) this.classes.add(name);
          else this.classes.delete(name);
          return open;
        },
      };
    }
    closest() {
      return null;
    }
  }
  class Input extends Element {}
  class Select extends Element {}
  class Textarea extends Element {}
  class Button extends Element {}
  class Anchor extends Element {}
  class Form extends Element {
    reportValidity() {
      return this.valid !== false;
    }
    querySelector(selector) {
      return selector.includes("button")
        ? submit
        : fields[selector.slice(1)] || null;
    }
  }
  const submit = new Button();
  const form = new Form();
  const partnerSubmit = new Button();
  const partnerForm = new Form();
  partnerForm.querySelector = (selector) =>
    selector.includes("button") ? partnerSubmit : fields[selector.slice(1)] || null;
  const partnerStatus = new Element();
  const partnerFallback = new Anchor();
  const ponudaSubmit = new Button();
  const ponudaForm = new Form();
  ponudaForm.querySelector = (selector) =>
    selector.includes("button") ? ponudaSubmit : fields[selector.slice(1)] || null;
  const ponudaStatus = new Element();
  const ponudaFallback = new Anchor();
  const status = new Element();
  const fallback = new Anchor();
  const burger = new Button();
  const links = new Element();
  const navLink = new Anchor();
  links.querySelectorAll = () => [navLink];
  const marquee = new Element();
  const motionButton = new Button();
  const dropButton = new Button();
  const drop = new Element();
  drop.querySelector = () => dropButton;
  const fields = {};
  const data = {
    brend: "  Čarobni brend  ",
    sajt: " https://carobni.rs ",
    proizvod: "Kozmetika",
    paketi: "501 – 1.000",
    interes: "Fulfilment (slanje paketa)",
    firma: "Primer d.o.o.",
    pib: "123456789",
    ime: "Željko Test",
    telefon: "0600000000",
    email: "qa@example.test",
    poruka: "Posebna ambalaža\nDrugi red",
    web: "",
    "p-naziv": " Moj blog ",
    "p-link": "https://mojblog.rs",
    "p-kanal": "Instagram / TikTok",
    "p-doseg": "20.000 – 100.000",
    "p-nacin": "Provizija po prodaji",
    "p-proizvodi": "Kozmetika, kuhinja",
    "p-firma": "",
    "p-ime": "Pera Partner",
    "p-telefon": "0611111111",
    "p-email": "pera@example.test",
    "p-poruka": "Imam FB grupu",
    "p-web": "",
    "q-ime": " Mila Testić ",
    "q-telefon": "0655555555",
    "q-email": "mila@example.test",
    "q-firma": "Mila d.o.o.",
    "q-pib": "112233445",
    "q-izvor": "Google pretraga",
    "q-brend": "Mila Cosmetics",
    "q-proizvod": "Kozmetika",
    "q-sajt": "https://mila.rs",
    "q-paketi": "501 – 1.000",
    "q-interes": "Fulfilment (slanje paketa)",
    "q-roba": "Kod mene ili u mom prostoru",
    "q-pocetak": "Odmah",
    "q-poruka": "Imam gratis uzorke uz paket",
    "q-web": "",
  };
  for (const [name, value] of Object.entries(data)) {
    fields[name] = new Input();
    fields[name].value = value;
  }
  const els = {
    prijava: form,
    "form-status": status,
    "email-fallback": fallback,
    burger,
    "marquee-toggle": motionButton,
    partner: partnerForm,
    "partner-status": partnerStatus,
    "partner-fallback": partnerFallback,
    ponuda: ponudaForm,
    "ponuda-status": ponudaStatus,
    "ponuda-fallback": ponudaFallback,
  };
  const document = {
    listeners: {},
    getElementById: (id) => els[id] || null,
    querySelector: (selector) => (selector === ".nav-links" ? links : marquee),
    querySelectorAll: (selector) => (selector === ".nav-drop" ? [drop] : []),
    addEventListener(name, callback) {
      (this.listeners[name] ||= []).push(callback);
    },
  };
  const dispatch = (name, event) =>
    (document.listeners[name] || []).forEach((callback) => callback(event));
  const calls = [];
  const navigations = [];
  const replaced = [];
  const timers = [];
  const cleared = [];
  const context = {
    document,
    Element,
    HTMLInputElement: Input,
    HTMLSelectElement: Select,
    HTMLTextAreaElement: Textarea,
    HTMLButtonElement: Button,
    HTMLAnchorElement: Anchor,
    HTMLFormElement: Form,
    AbortController,
    setTimeout: (callback, ms) => {
      timers.push({ callback, ms });
      return timers.length;
    },
    clearTimeout: (timer) => cleared.push(timer),
    window: {
      location: {
        assign: (url) => navigations.push(url),
        replace: (url) => replaced.push(url),
        ...location,
      },
    },
    fetch: (url, options) => {
      calls.push({ url, options });
      return fetchHandler(url, options);
    },
  };
  vm.runInNewContext(source, context);
  const send = () => form.listeners.submit({ preventDefault() {} });
  return {
    send,
    form,
    submit,
    status,
    fallback,
    fields,
    calls,
    navigations,
    replaced,
    timers,
    cleared,
    burger,
    links,
    navLink,
    document,
    dispatch,
    drop,
    dropButton,
    motionButton,
    marquee,
    Element,
    partnerForm,
    partnerSubmit,
    partnerStatus,
    partnerFallback,
    sendPartner: () => partnerForm.listeners.submit({ preventDefault() {} }),
    ponudaForm,
    ponudaSubmit,
    ponudaStatus,
    ponudaFallback,
    sendPonuda: () => ponudaForm.listeners.submit({ preventDefault() {} }),
  };
}

const HEAD_REDIRECT = /<meta name="viewport"[^>]*>\s*<script>([\s\S]*?)<\/script>/;
function runHeadRedirect(file, location) {
  const match = read(file).match(HEAD_REDIRECT);
  assert.ok(match, `${file}: inline redirect script missing after viewport meta`);
  const replaced = [];
  vm.runInNewContext(match[1], {
    location: { ...location, replace: (url) => replaced.push(url) },
  });
  return replaced;
}

const BIZOMS_LEAD_URL = "https://bizdb.46.224.193.209.sslip.io/functions/v1/pakum-lead";

test("successful lead uses the existing endpoint and field contract, then confirms receipt", async () => {
  const h = harness(async () => ({ ok: true }));
  await h.send();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].url, "https://sus.rs/api/pakum/prijava");
  assert.equal(h.calls[0].options.method, "POST");
  assert.equal(h.calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(h.calls[0].options.body), {
    brend: "Čarobni brend",
    sajt: "https://carobni.rs",
    proizvod: "Kozmetika",
    paketi: "501 – 1.000",
    interes: "Fulfilment (slanje paketa)",
    firma: "Primer d.o.o.",
    pib: "123456789",
    ime: "Željko Test",
    telefon: "0600000000",
    email: "qa@example.test",
    poruka: "Posebna ambalaža\nDrugi red",
    web: "",
  });
  assert.equal(h.calls[1].url, BIZOMS_LEAD_URL);
  assert.equal(h.calls[1].options.method, "POST");
  assert.equal(h.calls[1].options.headers["Content-Type"], "application/json");
  assert.equal(h.calls[1].options.keepalive, true);
  assert.equal(h.calls[1].options.body, h.calls[0].options.body);
  assert.deepEqual(h.navigations, ["/hvala/"]);
  assert.deepEqual(h.cleared, [1]);
});

test("the BizOMS copy never changes the outcome: its failure keeps the confirmation, its success never hides a primary failure", async () => {
  let h = harness((url) => (url === BIZOMS_LEAD_URL ? Promise.reject(new Error("bizoms down")) : Promise.resolve({ ok: true })));
  await h.send();
  assert.deepEqual(h.navigations, ["/hvala/"]);
  h = harness((url) => {
    if (url === BIZOMS_LEAD_URL) throw new Error("sync failure");
    return Promise.resolve({ ok: true });
  });
  await h.send();
  assert.deepEqual(h.navigations, ["/hvala/"]);
  h = harness((url) => Promise.resolve({ ok: url === BIZOMS_LEAD_URL }));
  await h.send();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.fallback.hidden, false);
  assert.match(h.status.textContent, /Nismo dobili potvrdu/);
});

test("legacy .html addresses are replaced by extensionless URLs before the page script runs", () => {
  const noNetwork = () => {
    throw new Error("Unexpected network call");
  };
  const navPages = pages.filter((file) => read(file).includes('<nav aria-label="Glavna navigacija">'));
  assert.ok(navPages.length >= 13);
  for (const file of navPages) {
    for (const [from, to] of [
      ["/softver.html", "/softver"],
      ["/cena-fulfilmenta.html", "/cena-fulfilmenta"],
      ["/index.html", "/"],
      ["/hvala.html", "/hvala/"],
      ["/hvala/index.html", "/hvala/"],
    ]) {
      assert.deepEqual(runHeadRedirect(file, { pathname: from, search: "?a=1", hash: "#kontakt" }), [`${to}?a=1#kontakt`], `${file} ${from}`);
    }
    for (const pathname of ["/softver", "/", "/hvala/", "/fulfilment-za-dropshipping"])
      assert.deepEqual(runHeadRedirect(file, { pathname, search: "", hash: "" }), [], `${file} ${pathname}`);
  }
  const h = harness(noNetwork, { pathname: "/softver.html", search: "", hash: "" });
  assert.deepEqual(h.replaced, [], "site.js must not redirect; the head script does");
  assert.equal(typeof h.form.listeners.submit, "function");
});

test("Usluge dropdown toggles, closes on Escape with focus restored, and closes on outside click", () => {
  const h = harness(() => {
    throw new Error("Unexpected network call");
  });
  assert.equal(typeof h.dropButton.listeners.click, "function");
  h.dropButton.listeners.click({ stopPropagation() {} });
  assert.equal(h.drop.classList.contains("open"), true);
  assert.equal(h.dropButton.attrs["aria-expanded"], "true");
  h.dispatch("keydown", { key: "Escape" });
  assert.equal(h.drop.classList.contains("open"), false);
  assert.equal(h.dropButton.attrs["aria-expanded"], "false");
  assert.equal(h.dropButton.focused, true);
  h.dropButton.listeners.click({ stopPropagation() {} });
  h.dispatch("click", { target: new h.Element() });
  assert.equal(h.drop.classList.contains("open"), false);
  for (const file of pages.filter((f) => read(f).includes("nav-drop-menu"))) {
    const menu = read(file).match(/<div class="nav-drop-menu"[^>]*>([\s\S]*?)<\/div>/)[1];
    const hrefs = [...menu.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    // Lazarova reč 16.09: za sad samo fulfilment usluge — roba na veliko i uslužni uvoz su sklonjeni iz menija
    assert.deepEqual(hrefs, ["/skladistenje-robe", "/pakovanje-paketa", "/slanje-pouzecem", "/povrati-i-reklamacije", "/fulfilment-za-dropshipping"], file);
    assert.match(read(file), /<button type="button" class="nav-drop-btn[^"]*" id="nav-usluge-btn" aria-expanded="false" aria-controls="nav-usluge"/, file);
  }
});

for (const failure of ["http", "network", "timeout"])
  test(`${failure} failure retains the form and offers an explicit email fallback without false success`, async () => {
    const h = harness((url, options) =>
      failure === "http"
        ? Promise.resolve({ ok: false })
        : failure === "network"
          ? Promise.reject(new Error("offline"))
          : new Promise((resolve, reject) =>
              options.signal.addEventListener("abort", () =>
                reject(new Error("timeout")),
              ),
            ),
    );
    const pending = h.send();
    if (failure === "timeout") {
      assert.equal(h.timers[0].ms, 15000);
      h.timers[0].callback();
    }
    await pending;
    assert.deepEqual(h.navigations, []);
    assert.equal(h.submit.disabled, false);
    assert.equal(h.fallback.hidden, false);
    assert.match(h.status.textContent, /Nismo dobili potvrdu/);
    const mail = new URL(h.fallback.href);
    assert.equal(mail.protocol, "mailto:");
    assert.equal(mail.pathname, "info@pakum.rs");
    assert.equal(mail.searchParams.get("subject"), "Ponuda — Čarobni brend");
    assert.match(
      mail.searchParams.get("body"),
      /Napomena: Posebna ambalaža\nDrugi red/,
    );
    assert.equal(h.fields.brend.value, "  Čarobni brend  ");
    assert.deepEqual(h.cleared, [1]);
  });

test("double submission, invalid input and honeypot do not create duplicate or unwanted leads", async () => {
  const resolvers = [];
  const h = harness(() => new Promise((r) => resolvers.push(r)));
  h.form.valid = false;
  await h.send();
  assert.equal(h.calls.length, 0);
  h.form.valid = true;
  h.fields.web.value = "spam";
  await h.send();
  assert.equal(h.calls.length, 0);
  h.fields.web.value = "";
  const pending = h.send();
  await h.send();
  assert.equal(h.calls.length, 2);
  resolvers.forEach((resolve) => resolve({ ok: true }));
  await pending;
});

test("mobile menu announces state and Escape returns keyboard focus to its trigger", () => {
  const h = harness(() => {
    throw new Error("Unexpected network call");
  });
  h.burger.listeners.click();
  assert.equal(h.burger.attrs["aria-expanded"], "true");
  h.dispatch("keydown", { key: "Escape" });
  assert.equal(h.burger.attrs["aria-expanded"], "false");
  assert.equal(h.burger.focused, true);
  h.burger.listeners.click();
  h.navLink.listeners.click();
  assert.equal(h.links.classList.contains("open"), false);
  h.burger.listeners.click();
  h.dispatch("click", { target: new h.Element() });
  assert.equal(h.links.classList.contains("open"), false);
});

test("the static brand grid preserves every supplied logo and the mobile action opens the enquiry form", () => {
  const home = read("index.html");
  for (const brand of [
    "maleni",
    "shopex",
    "naklik",
    "hir",
    "plantigo",
    "rabito",
    "regenpro",
    "solea",
    "kupina",
  ]) {
    assert.equal(
      [...home.matchAll(new RegExp(`images/brend-${brand}\\.png`, "g"))].length,
      1,
      brand,
    );
  }
  assert.match(home, /<span>TVTop<\/span>/);
  assert.doesNotMatch(home, /class="marquee|pakum-parcel\.svg/);
  for (const file of pages) {
    const html = read(file);
    assert.doesNotMatch(html, /[Čč]akum/);
    if (!html.includes("<nav")) continue;
    const bars = [
      ...html.matchAll(
        /<aside class="mobile-contact-bar"[^>]*>([\s\S]*?)<\/aside>/g,
      ),
    ];
    // Strana sa upitnikom nema plutajuću traku: sama forma je sadržaj te strane.
    if (file === "zahtev-za-ponudu.html") {
      assert.equal(bars.length, 0, file);
      continue;
    }
    assert.equal(bars.length, 1, file);
    assert.equal([...bars[0][1].matchAll(/<a\b/g)].length, 1, file);
    assert.match(bars[0][1], /href="\/zahtev-za-ponudu"/);
    assert.doesNotMatch(bars[0][1], /mailto:|tel:/);
  }
  assert.match(read("premium.css"), /prefers-reduced-motion:\s*reduce/);
});

// ---- 13.09.2026: tema.css (završni sloj dizajna), forma 3.000+, vidljive mrvice, Shopify/WooCommerce stranica ----

test("tema.css se učitava posle premium.css na svakoj stranici sa navigacijom", () => {
  assert.equal(fs.existsSync(path.join(__dirname, "tema.css")), true);
  for (const file of pages) {
    const html = read(file);
    if (!html.includes("<nav")) continue;
    const premium = html.indexOf('href="/premium.css');
    const tema = html.indexOf('href="/tema.css');
    assert.ok(premium > -1 && tema > premium, `${file}: tema.css posle premium.css`);
  }
});

test("forma nudi obim preko 3.000 paketa i zadržava postojeće vrednosti koje BizOMS i sus.rs već primaju", () => {
  // Srpska forma je od 16.09. upitnik u četiri koraka; engleska ostaje na /en/.
  const upitnik = read("zahtev-za-ponudu.html").match(/<select id="q-paketi"[^>]*>([\s\S]*?)<\/select>/)[1];
  const opcije = [...upitnik.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]);
  assert.deepEqual(opcije, ["Do 500", "501 – 1.000", "1.001 – 3.000", "Preko 3.000"]);
  assert.match(upitnik, /<option value="">Izaberite \(opciono\)<\/option>/);
  const en = read("en/index.html").match(/<select id="paketi"[^>]*>([\s\S]*?)<\/select>/)[1];
  assert.deepEqual(
    [...en.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]),
    ["Up to 500", "501 – 1,000", "1,001 – 3,000", "Over 3,000"],
  );
});

test("vidljive mrvice odgovaraju BreadcrumbList šemi i stoje pre H1 na svakoj podstranici", () => {
  for (const file of pages) {
    const html = read(file);
    const ld = html.match(/<script type="application\/ld\+json">(\{[^<]*"BreadcrumbList"[^<]*)<\/script>/);
    if (!ld) {
      assert.doesNotMatch(html, /class="breadcrumbs"/, file);
      continue;
    }
    const names = JSON.parse(ld[1]).itemListElement.map((item) => item.name);
    const nav = html.match(/<nav aria-label="Putanja"><ol class="breadcrumbs">([\s\S]*?)<\/ol><\/nav>/);
    assert.ok(nav, `${file}: vidljive mrvice`);
    const visible = [...nav[1].matchAll(/<li>(?:<a href="[^"]+">|<span aria-current="page">)([^<]+)/g)].map((m) => m[1]);
    assert.deepEqual(visible, names, file);
    assert.match(nav[1], /^<li><a href="\/">Početna<\/a><\/li>/);
    assert.ok(html.indexOf('class="breadcrumbs"') < html.indexOf("<h1"), `${file}: mrvice pre H1`);
  }
});

test("stranica za Shopify i WooCommerce je povezana iz naslovne, footera, sitemapa i llms.txt", () => {
  assert.equal(fs.existsSync(path.join(__dirname, "fulfilment-shopify-woocommerce.html")), true);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/fulfilment\.rs\/fulfilment-shopify-woocommerce<\/loc>/);
  assert.match(read("llms.txt"), /\(https:\/\/fulfilment\.rs\/fulfilment-shopify-woocommerce\)/);
  assert.match(read("index.html"), /<h3><a href="\/fulfilment-shopify-woocommerce">/);
  for (const file of pages) {
    const html = read(file);
    if (!html.includes("<footer")) continue;
    assert.match(html, /<li><a href="\/fulfilment-shopify-woocommerce">Fulfilment za Shopify i WooCommerce<\/a><\/li>/, file);
  }
});

test("naslovna nosi traku poverenja i plutajuću traku usluga sa ikonicama umesto stare tekstualne trake", () => {
  const home = read("index.html");
  assert.doesNotMatch(home, /legacy-service-band/);
  const band = home.match(/<ul class="band-card" role="list">([\s\S]*?)<\/ul>/);
  assert.ok(band, "band-card");
  const items = [...band[1].matchAll(/<strong>([^<]+)<\/strong>/g)].map((m) => m[1]);
  assert.deepEqual(items, ["Prijem robe", "Skladištenje", "Pakovanje i slanje", "Povrati"]);
  assert.equal([...band[1].matchAll(/<svg /g)].length, 4);
  const trust = home.match(/<ul class="hero-trust"[^>]*>([\s\S]*?)<\/ul>/);
  assert.ok(trust, "hero-trust");
  assert.equal([...trust[1].matchAll(/<li>/g)].length, 3);
});

test("linkovi u tekstu nose boju brenda umesto podrazumevane plave, a naslovi kartica nisu podvučeni", () => {
  const css = read("tema.css");
  assert.match(css, /main :where\(p, li, td, figcaption\) a:where\(:not\(\.btn, \.text-link\)\)\s*\{[^}]*color:\s*var\(--signal-deep\)/);
  assert.match(css, /\.service-cell h3 a\s*\{[^}]*color:\s*var\(--ink\)[^}]*text-decoration:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

// ---- 13.09.2026: stari WordPress URL-ovi (iz GSC) dobijaju preusmerenje umesto 404 ----

test("stari WordPress URL /author/aleksandar/ preusmerava na postojeću stranicu i ne indeksira se", () => {
  const html = read("author/aleksandar/index.html");
  const target = html.match(/<meta http-equiv="refresh" content="0; url=([^"]+)">/);
  assert.ok(target, "meta refresh");
  assert.match(target[1], /^\/[a-z0-9-]+$/);
  assert.equal(fs.existsSync(path.join(__dirname, `${target[1].slice(1)}.html`)), true, `cilj ${target[1]} postoji`);
  assert.match(html, new RegExp(`<link rel="canonical" href="https://fulfilment.rs${target[1]}">`));
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, new RegExp(`location.replace\\("${target[1]}"\\)`));
  assert.doesNotMatch(read("sitemap.xml"), /author/);
});

test("404 stranica skida završnu kosu crtu sa starih WordPress adresa, a /hvala/ i koren ostavlja na miru", () => {
  for (const [from, to] of [
    ["/o-nama/", "/o-nama"],
    ["/skladistenje-robe/", "/skladistenje-robe"],
    ["/softver.html", "/softver"],
  ]) {
    assert.deepEqual(runHeadRedirect("404.html", { pathname: from, search: "?a=1", hash: "#x" }), [`${to}?a=1#x`], from);
  }
  for (const pathname of ["/", "/hvala/", "/o-nama", "/nepostojeca-strana"])
    assert.deepEqual(runHeadRedirect("404.html", { pathname, search: "", hash: "" }), [], pathname);
  // ostale stranice ne diraju završnu kosu crtu (samo 404 to radi)
  assert.deepEqual(runHeadRedirect("index.html", { pathname: "/o-nama/", search: "", hash: "" }), []);
});

// ---- 13.09.2026: partnerski program (stranica + forma na isti Slack kanal) ----

test("partnerski program je u meniju, footeru, sitemapu i llms.txt, a stranica ima formu sa obaveznim poljima", () => {
  for (const file of pages) {
    const html = read(file);
    if (html.includes('<nav aria-label="Glavna navigacija">'))
      assert.match(html, /<a href="\/partnerski-program"[^>]*>Partneri<\/a>/, `${file}: meni`);
    if (html.includes("<footer"))
      assert.match(html, /<li><a href="\/partnerski-program">Partnerski program<\/a><\/li>/, `${file}: footer`);
  }
  assert.match(read("sitemap.xml"), /<loc>https:\/\/fulfilment\.rs\/partnerski-program<\/loc>/);
  assert.match(read("llms.txt"), /\(https:\/\/fulfilment\.rs\/partnerski-program\)/);
  const page = read("partnerski-program.html");
  assert.match(page, /<form class="formwrap" id="partner"/);
  for (const id of ["p-naziv", "p-link", "p-ime", "p-telefon", "p-email"])
    assert.match(page, new RegExp(`<input id="${id}"[^>]*\\brequired\\b`), `${id} obavezno`);
  for (const id of ["p-kanal", "p-doseg", "p-nacin"]) assert.match(page, new RegExp(`<select id="${id}"`), id);
  assert.match(page, /<input type="text" id="p-web" name="web"/);
  assert.match(page, /id="partner-status"/);
  assert.match(page, /id="partner-fallback"/);
  assert.match(page, /site\.js\?v=20260915/);
});

test("partnerska prijava ide istim kanalom (sus.rs + BizOMS kopija) sa jasno mapiranim poljima i potvrdom", async () => {
  const h = harness(async () => ({ ok: true }));
  await h.sendPartner();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].url, "https://sus.rs/api/pakum/prijava");
  assert.deepEqual(JSON.parse(h.calls[0].options.body), {
    brend: "PARTNER: Moj blog",
    sajt: "https://mojblog.rs",
    proizvod: "Kozmetika, kuhinja",
    paketi: "",
    interes: "Partnerski program — Provizija po prodaji",
    firma: "",
    pib: "",
    ime: "Pera Partner",
    telefon: "0611111111",
    email: "pera@example.test",
    poruka: "Kanal: Instagram / TikTok. Doseg: 20.000 – 100.000. Imam FB grupu",
    web: "",
  });
  assert.equal(h.calls[1].url, "https://bizdb.46.224.193.209.sslip.io/functions/v1/pakum-lead");
  assert.equal(h.calls[1].options.body, h.calls[0].options.body);
  assert.deepEqual(h.navigations, ["/hvala/"]);
  assert.equal(h.partnerSubmit.disabled, true);
});

test("partnerska prijava bez potvrde nudi email sa svojim naslovom, a honeypot je blokira", async () => {
  let h = harness(() => Promise.resolve({ ok: false }));
  await h.sendPartner();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.partnerFallback.hidden, false);
  assert.match(h.partnerStatus.textContent, /Nismo dobili potvrdu/);
  const mail = new URL(h.partnerFallback.href);
  assert.equal(mail.searchParams.get("subject"), "Partnerski program — Moj blog");
  assert.match(mail.searchParams.get("body"), /Način saradnje: Provizija po prodaji/);
  assert.equal(h.partnerSubmit.disabled, false);
  h = harness(() => { throw new Error("Unexpected network call"); });
  h.fields["p-web"].value = "spam";
  await h.sendPartner();
  assert.equal(h.calls.length, 0);
});

// ---- 13.09.2026: engleska verzija (/en/) — hreflang, meni, forma, SEO okvir ----

const enPages = [
  ...fs.readdirSync(path.join(__dirname, "en")).filter((file) => file.endsWith(".html")).map((file) => `en/${file}`),
  "en/thank-you/index.html",
];

test("engleske strane imaju lang=en, jedan H1, SEO naslov i opis, canonical i hreflang par sa srpskom stranom", () => {
  assert.ok(enPages.length >= 12, `en strana: ${enPages.length}`);
  for (const file of enPages) {
    const html = read(file);
    assert.match(html, /<html lang="en">/, file);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${file}: exactly one H1`);
    const title = html.match(/<title>([^<]*)<\/title>/)[1];
    assert.ok(title.length >= 30 && title.length <= 62 && / \| PAKUM$/.test(title), `${file}: title "${title}" (${title.length})`);
    const meta = html.match(/<meta name="description" content="([^"]*)"/)[1];
    assert.ok(meta.length >= 110 && meta.length <= 158, `${file}: meta ${meta.length}`);
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const expected = file === "en/index.html" ? "https://fulfilment.rs/en/" : file === "en/thank-you/index.html" ? "https://fulfilment.rs/en/thank-you/" : `https://fulfilment.rs/${file.replace(/\.html$/, "")}`;
    assert.equal(canonical, expected, `${file}: canonical`);
    assert.match(html, new RegExp(`<link rel="alternate" hreflang="en" href="${expected}">`), `${file}: hreflang en`);
    const sr = html.match(/<link rel="alternate" hreflang="sr" href="https:\/\/fulfilment\.rs\/([^"]*)">/);
    if (sr) {
      const srFile = sr[1] === "" ? "index.html" : sr[1].endsWith("/") ? `${sr[1]}index.html` : `${sr[1]}.html`;
      assert.equal(fs.existsSync(path.join(__dirname, srFile)), true, `${file}: srpski par ${srFile}`);
      assert.match(read(srFile), new RegExp(`<link rel="alternate" hreflang="en" href="${expected}">`), `${srFile}: hreflang nazad ka ${expected}`);
      assert.match(read(srFile), new RegExp(`<a href="${expected.replace("https://fulfilment.rs", "")}" lang="en" hreflang="en" title="English">EN</a>`), `${srFile}: EN prekidač`);
    }
    assert.match(html, /<link rel="alternate" hreflang="x-default"/, `${file}: x-default`);
    assert.ok(html.includes('"@id":"https://fulfilment.rs/#organization"'), `${file}: Organization`);
    assert.match(html, /<meta name="viewport"[^>]*>\s*<script>\(function\(\)\{var p=location\.pathname;/, `${file}: head redirect`);
    assert.doesNotMatch(html, /href="(?!https?:)[^"]*\.html/, `${file}: .html link`);
    for (const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(script[1]);
    for (const match of html.matchAll(/(?:href|src)="(?!https?:|mailto:|data:|tel:|#)([^"]+)"/g)) {
      const href = match[1];
      assert.match(href, /^\//, `${file}: ${href} must be root-relative`);
      const url = new URL(href, "https://fulfilment.rs/");
      let dest = decodeURIComponent(url.pathname.slice(1)) || "index.html";
      if (dest.endsWith("/")) dest += "index.html";
      else if (!path.extname(dest)) dest += ".html";
      assert.equal(fs.existsSync(path.join(__dirname, dest)), true, `${file}: missing ${href}`);
    }
    const bars = [...html.matchAll(/<aside class="mobile-contact-bar"[^>]*>([\s\S]*?)<\/aside>/g)];
    assert.equal(bars.length, 1, `${file}: mobile bar`);
    assert.match(bars[0][1], /href="\/en\/#quote"/, file);
    assert.match(html, /<a href="\/[^"]*" lang="sr-Latn" hreflang="sr" title="Srpski">SR<\/a>/, `${file}: SR prekidač`);
    assert.doesNotMatch(html, /\d[\d,.]*\+?\s*parcels\s+(per|a)\s+day|\b48\s?h\b|same[- ]day|\bSUS\b/, `${file}: forbidden phrase`);
  }
  assert.match(read("sitemap.xml"), /<loc>https:\/\/fulfilment\.rs\/en\/<\/loc>/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/fulfilment\.rs\/en\/fulfilment-serbia-for-foreign-brands<\/loc>/);
  assert.doesNotMatch(read("sitemap.xml"), /thank-you/);
  assert.match(read("llms.txt"), /https:\/\/fulfilment\.rs\/en\//);
});

test("engleski FAQ odgovara šemi, forma na /en/ koristi isti kontrakt i vodi na englesku hvala stranu", async () => {
  const clean = (text) => text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  for (const file of enPages) {
    const html = read(file);
    const questions = [...html.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map((m) => [clean(m[1]), clean(m[2])]);
    for (const script of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const json = JSON.parse(script[1]);
      if (json["@type"] === "FAQPage") assert.deepEqual(json.mainEntity.map((item) => [item.name, item.acceptedAnswer.text]), questions, file);
    }
  }
  const home = read("en/index.html");
  assert.match(home, /<form class="formwrap" id="prijava" data-thanks="\/en\/thank-you\/"/);
  for (const id of ["brend", "sajt", "proizvod", "paketi", "interes", "firma", "pib", "ime", "telefon", "email", "poruka", "web"])
    assert.match(home, new RegExp(`id="${id}"`), `en forma: ${id}`);
  const h = harness(async () => ({ ok: true }));
  h.form.dataset = { thanks: "/en/thank-you/" };
  await h.send();
  assert.deepEqual(h.navigations, ["/en/thank-you/"]);
  assert.equal(h.calls[0].url, "https://sus.rs/api/pakum/prijava");
  assert.match(read("en/thank-you/index.html"), /<meta name="robots" content="noindex">/);
});

// ---- 13.09.2026: EN oznaka u Slack poruci, engleski logo, vodič za evropske brendove ----

test("prijava sa engleskog sajta nosi EN: ispred brenda, srpska ne", async () => {
  let h = harness(async () => ({ ok: true }));
  h.form.dataset = { thanks: "/en/thank-you/", lang: "en" };
  await h.send();
  assert.equal(JSON.parse(h.calls[0].options.body).brend, "EN: Čarobni brend");
  assert.deepEqual(h.navigations, ["/en/thank-you/"]);
  h = harness(async () => ({ ok: true }));
  await h.send();
  assert.equal(JSON.parse(h.calls[0].options.body).brend, "Čarobni brend");
  assert.match(read("en/index.html"), /<form class="formwrap" id="prijava" data-thanks="\/en\/thank-you\/" data-lang="en"/);
});

test("engleske strane koriste engleski logo (tagline na engleskom) u meniju i footeru", () => {
  for (const file of ["images/pakum-logo-wordmark-en.png", "images/pakum-logo-footer-en.png"])
    assert.equal(fs.existsSync(path.join(__dirname, file)), true, file);
  for (const file of enPages) {
    const html = read(file);
    assert.match(html, /<a class="logo" href="\/en\/"[^>]*><img src="\/images\/pakum-logo-wordmark-en\.png\?v=\d+"/, `${file}: nav logo`);
    assert.match(html, /<img src="\/images\/pakum-logo-footer-en\.png\?v=\d+"/, `${file}: footer logo`);
    assert.doesNotMatch(html, /pakum-logo-wordmark\.png|pakum-logo-footer\.png/, `${file}: srpski logo`);
  }
  const guide = read("en/fulfilment-serbia-guide.html");
  assert.match(guide, /<link rel="alternate" hreflang="x-default" href="https:\/\/fulfilment\.rs\/en\/fulfilment-serbia-guide">/);
  assert.doesNotMatch(guide, /<link rel="alternate" hreflang="sr"/);
  assert.match(read("en/index.html"), /href="\/en\/fulfilment-serbia-guide"/);
});

// ---- 15.09.2026: upitnik u četiri koraka (/zahtev-za-ponudu) ----

test("strana sa upitnikom ima četiri koraka, PIB od devet cifara i veze ka sebi", () => {
  const page = read("zahtev-za-ponudu.html");
  assert.deepEqual(
    [...page.matchAll(/<fieldset class="korak" id="korak-(\d)" data-korak="\1">/g)].map((m) => m[1]),
    ["1", "2", "3", "4"],
  );
  assert.equal((page.match(/data-dalje/g) || []).length, 3, "tri dugmeta napred");
  assert.equal((page.match(/data-nazad/g) || []).length, 3, "tri dugmeta nazad");
  assert.equal((page.match(/class="korak-tacka" data-idi="\d"/g) || []).length, 4, "četiri tačke u traci");
  assert.equal((page.match(/type="submit"/g) || []).length, 1, "samo poslednji korak šalje");
  for (const id of ["q-ime", "q-telefon", "q-email", "q-brend", "q-proizvod"])
    assert.match(page, new RegExp(`<input id="${id}"[^>]*\\brequired\\b`), `${id} obavezno`);
  const pib = page.match(/<input id="q-pib"[^>]*>/)[0];
  assert.match(pib, /pattern="\[0-9\]\{9\}"/, "PIB: devet cifara");
  assert.match(pib, /maxlength="9"/);
  assert.doesNotMatch(pib, /\brequired\b/, "PIB je opcion");
  for (const id of ["q-izvor", "q-paketi", "q-interes", "q-roba", "q-pocetak"])
    assert.match(page, new RegExp(`<select id="${id}"`), id);
  assert.match(page, /<input type="text" id="q-web" name="web"/, "honeypot");
  assert.match(page, /id="ponuda-status"/);
  assert.match(page, /id="ponuda-fallback"/);
  assert.match(page, /koraci\.css\?v=20260915/);
  assert.match(page, /koraci\.js\?v=20260915/);
  assert.match(page, /site\.js\?v=20260915/);
  assert.match(read("sitemap.xml"), /<loc>https:\/\/fulfilment\.rs\/zahtev-za-ponudu<\/loc>/);
  assert.match(read("llms.txt"), /\(https:\/\/fulfilment\.rs\/zahtev-za-ponudu\)/);
  const naslovna = read("index.html");
  // Stara forma sa naslovne je uklonjena (Lazarova reč 16.09) — ostaje samo poziv na upitnik.
  assert.doesNotMatch(naslovna, /<form[^>]*id="prijava"/, "naslovna nema staru formu");
  assert.doesNotMatch(naslovna, /<select id="paketi"|id="poruka"|id="brend"/, "naslovna nema polja stare forme");
  assert.match(naslovna, /<section class="contact-section" id="kontakt">[\s\S]*?href="\/zahtev-za-ponudu"[\s\S]*?<\/section>/);
  for (const file of pages) {
    const html = read(file);
    // Svaki "Zatraži ponudu" na srpskim stranama vodi na upitnik, ne vise na formu sa naslovne.
    assert.doesNotMatch(html, /href="\/?#(kontakt|prijava)"/, `${file}: stari link na formu sa naslovne`);
    if (html.includes("<footer"))
      assert.match(
        html,
        /<li><a href="\/zahtev-za-ponudu">Zatraži ponudu<\/a><\/li>/,
        `${file}: footer`,
      );
  }
});

test("upitnik šalje isti ugovor polja kao forma sa naslovne, sa dodatnim odgovorima u napomeni", async () => {
  const h = harness(async () => ({ ok: true }));
  await h.sendPonuda();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].url, "https://sus.rs/api/pakum/prijava");
  assert.deepEqual(JSON.parse(h.calls[0].options.body), {
    brend: "Mila Cosmetics",
    sajt: "https://mila.rs",
    proizvod: "Kozmetika",
    paketi: "501 – 1.000",
    interes: "Fulfilment (slanje paketa)",
    firma: "Mila d.o.o.",
    pib: "112233445",
    ime: "Mila Testić",
    telefon: "0655555555",
    email: "mila@example.test",
    poruka:
      "Imam gratis uzorke uz paket Roba je sada: Kod mene ili u mom prostoru. Početak saradnje: Odmah. Za nas su čuli preko: Google pretraga. Popunjeno kroz upitnik u četiri koraka.",
    web: "",
  });
  assert.equal(h.calls[1].url, BIZOMS_LEAD_URL);
  assert.equal(h.calls[1].options.body, h.calls[0].options.body);
  assert.deepEqual(h.navigations, ["/hvala/"]);
  assert.equal(h.ponudaSubmit.disabled, true);
});

test("upitnik bez potvrde nudi email sa svim podacima, a honeypot ga blokira", async () => {
  let h = harness(() => Promise.resolve({ ok: false }));
  await h.sendPonuda();
  assert.deepEqual(h.navigations, []);
  assert.equal(h.ponudaFallback.hidden, false);
  assert.match(h.ponudaStatus.textContent, /Nismo dobili potvrdu/);
  const mail = new URL(h.ponudaFallback.href);
  assert.equal(mail.searchParams.get("subject"), "Ponuda — Mila Cosmetics");
  assert.match(mail.searchParams.get("body"), /PIB: 112233445/);
  assert.match(mail.searchParams.get("body"), /upitnik u četiri koraka/);
  assert.equal(h.ponudaSubmit.disabled, false);
  h = harness(async () => ({ ok: true }));
  h.fields["q-web"].value = "bot";
  await h.sendPonuda();
  assert.equal(h.calls.length, 0);
  assert.deepEqual(h.navigations, []);
});

// Lagani DOM za koraci.js: samo ono što skripta stvarno dodiruje.
function koraciHarness() {
  class Element {
    constructor(tag) {
      this.tagName = String(tag || "div").toUpperCase();
      this.attrs = {};
      this.classes = new Set();
      this.children = [];
      this.parentNode = null;
      this.listeners = {};
      this.hidden = false;
      this.disabled = false;
      this.value = "";
      this.textContent = "";
      this.style = {};
      this.valid = true;
      this.reported = 0;
      this.focused = 0;
    }
    addEventListener(name, callback) {
      (this.listeners[name] ||= []).push(callback);
    }
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    }
    removeAttribute(name) {
      delete this.attrs[name];
    }
    getAttribute(name) {
      return name in this.attrs ? this.attrs[name] : null;
    }
    append(...nodes) {
      for (const node of nodes) {
        node.parentNode = this;
        this.children.push(node);
      }
    }
    get className() {
      return [...this.classes].join(" ");
    }
    set className(value) {
      this.classes = new Set(String(value).split(" ").filter(Boolean));
    }
    focus() {
      this.focused += 1;
    }
    checkValidity() {
      const skup = this.closest("fieldset");
      // Kao u browseru: polje u isključenom fieldsetu se ne proverava.
      if (skup && skup.disabled) return true;
      return this.valid;
    }
    reportValidity() {
      this.reported += 1;
      return this.valid;
    }
    setCustomValidity(message) {
      this.customValidity = message;
      this.valid = !message;
    }
    getBoundingClientRect() {
      return { top: 0 };
    }
    get classList() {
      return {
        contains: (name) => this.classes.has(name),
        add: (name) => this.classes.add(name),
        remove: (name) => this.classes.delete(name),
        toggle: (name, force) => {
          const on = force === undefined ? !this.classes.has(name) : force;
          if (on) this.classes.add(name);
          else this.classes.delete(name);
          return on;
        },
      };
    }
    matches(selector) {
      const one = selector.trim();
      if (one.startsWith("[") && one.endsWith("]")) return one.slice(1, -1) in this.attrs;
      if (one.startsWith("#")) return this.attrs.id === one.slice(1);
      const [tag, ...klase] = one.split(".");
      if (tag && this.tagName !== tag.toUpperCase()) return false;
      return klase.every((klasa) => this.classes.has(klasa));
    }
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches(selector)) return node;
        node = node.parentNode;
      }
      return null;
    }
    potomci() {
      return this.children.flatMap((child) => [child, ...child.potomci()]);
    }
    querySelectorAll(selector) {
      const delovi = selector.split(",").map((deo) => deo.trim());
      return this.potomci().filter((node) => delovi.some((deo) => node.matches(deo)));
    }
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  }
  class HTMLElement extends Element {}
  class HTMLFormElement extends HTMLElement {}
  class HTMLFieldSetElement extends HTMLElement {}
  class HTMLInputElement extends HTMLElement {}
  class HTMLSelectElement extends HTMLElement {}
  class HTMLTextAreaElement extends HTMLElement {}
  class HTMLButtonElement extends HTMLElement {}

  const byId = {};
  const napravi = (Klasa, tag, id, klase = []) => {
    const node = new Klasa(tag);
    if (id) {
      node.attrs.id = id;
      byId[id] = node;
    }
    for (const klasa of klase) node.classes.add(klasa);
    return node;
  };

  const form = napravi(HTMLFormElement, "form", "ponuda");
  const raspored = [
    [
      ["q-ime", HTMLInputElement, true],
      ["q-telefon", HTMLInputElement, true],
      ["q-email", HTMLInputElement, true],
      ["q-firma", HTMLInputElement, false],
      ["q-pib", HTMLInputElement, false],
      ["q-izvor", HTMLSelectElement, false],
    ],
    [
      ["q-brend", HTMLInputElement, true],
      ["q-proizvod", HTMLInputElement, true],
      ["q-sajt", HTMLInputElement, false],
      ["q-paketi", HTMLSelectElement, false],
      ["q-interes", HTMLSelectElement, false],
      ["q-roba", HTMLSelectElement, false],
      ["q-pocetak", HTMLSelectElement, false],
    ],
    [["q-poruka", HTMLTextAreaElement, false]],
    [],
  ];
  const koraci = [];
  const dugmadDalje = [];
  const dugmadNazad = [];
  raspored.forEach((polja, redni) => {
    const korak = napravi(HTMLFieldSetElement, "fieldset", `korak-${redni + 1}`, ["korak"]);
    korak.attrs["data-korak"] = String(redni + 1);
    for (const [id, Klasa] of polja) {
      const tag = Klasa === HTMLSelectElement ? "select" : Klasa === HTMLTextAreaElement ? "textarea" : "input";
      korak.append(napravi(Klasa, tag, id));
    }
    if (redni > 0) {
      const nazad = napravi(HTMLButtonElement, "button", `nazad-${redni + 1}`);
      nazad.attrs["data-nazad"] = "";
      korak.append(nazad);
      dugmadNazad.push(nazad);
    }
    if (redni < raspored.length - 1) {
      const dalje = napravi(HTMLButtonElement, "button", `dalje-${redni + 1}`);
      dalje.attrs["data-dalje"] = "";
      korak.append(dalje);
      dugmadDalje.push(dalje);
    }
    form.append(korak);
    koraci.push(korak);
  });

  const lis = [1, 2, 3, 4].map((broj) => {
    const li = napravi(Element, "li", `tacka-${broj}`);
    li.append(napravi(HTMLButtonElement, "button", `tacka-dugme-${broj}`));
    return li;
  });
  const traka = napravi(Element, "div", "korak-traka");
  const punjenje = napravi(HTMLElement, "span", "korak-traka-punjenje");
  const status = napravi(Element, "p", "korak-status");
  const pregled = napravi(Element, "dl", "pregled");

  const scrolls = [];
  const document = {
    listeners: {},
    getElementById: (id) => byId[id] || null,
    querySelectorAll: (selector) => (selector === "#koraci li" ? lis : []),
    createElement: (tag) => new HTMLElement(tag),
    addEventListener(name, callback) {
      (this.listeners[name] ||= []).push(callback);
    },
  };
  const context = {
    document,
    Element,
    HTMLElement,
    HTMLFormElement,
    HTMLFieldSetElement,
    HTMLInputElement,
    HTMLSelectElement,
    HTMLTextAreaElement,
    HTMLButtonElement,
    window: {
      innerHeight: 800,
      scrollY: 0,
      scrollTo: (opcije) => scrolls.push(opcije),
      matchMedia: () => ({ matches: false }),
    },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "koraci.js"), "utf8"), context);

  const klikni = (dugme) => {
    let sprecen = 0;
    for (const callback of form.listeners.click || [])
      callback({ target: dugme, preventDefault: () => (sprecen += 1) });
    return sprecen;
  };
  return {
    form,
    koraci,
    lis,
    traka,
    punjenje,
    status,
    pregled,
    polja: byId,
    scrolls,
    klikni,
    dalje: (redni) => klikni(dugmadDalje[redni - 1]),
    nazad: (redni) => klikni(dugmadNazad[redni - 2]),
    tacka: (broj) => {
      for (const callback of lis[broj - 1].children[0].listeners.click || []) callback({});
    },
    enter: (polje) => {
      let sprecen = 0;
      for (const callback of form.listeners.keydown || [])
        callback({ key: "Enter", target: polje, preventDefault: () => (sprecen += 1) });
      return sprecen;
    },
    posalji: () => {
      const trag = { sprecen: 0, zaustavljen: 0 };
      for (const callback of document.listeners.submit || [])
        callback({
          target: form,
          preventDefault: () => (trag.sprecen += 1),
          stopPropagation: () => (trag.zaustavljen += 1),
        });
      return trag;
    },
  };
}

test("koraci: na učitavanju je vidljiv samo prvi korak, ostali su isključeni", () => {
  const k = koraciHarness();
  assert.deepEqual(
    k.koraci.map((korak) => korak.hidden),
    [false, true, true, true],
  );
  assert.deepEqual(
    k.koraci.map((korak) => korak.disabled),
    [false, true, true, true],
    "sakriveni koraci su isključeni, pa prazno obavezno polje ne blokira slanje",
  );
  assert.equal(k.status.textContent, "Korak 1 od 4 — Vaši podaci");
  assert.equal(k.punjenje.style.width, "25%");
  assert.equal(k.traka.getAttribute("aria-valuenow"), "1");
  assert.equal(k.lis[0].classes.has("aktivan"), true);
  assert.equal(k.lis[1].children[0].disabled, true, "nedostignut korak se ne otvara klikom");
});

test("koraci: neispravno polje zaustavlja prelaz, ispravno vodi dalje i puni traku", () => {
  const k = koraciHarness();
  k.polja["q-ime"].valid = false;
  assert.equal(k.dalje(1), 1, "klik je preuzet");
  assert.equal(k.koraci[0].hidden, false, "ostajemo na prvom koraku");
  assert.equal(k.polja["q-ime"].reported, 1, "korisnik dobija poruku o polju");
  k.polja["q-ime"].valid = true;
  k.dalje(1);
  assert.equal(k.koraci[0].hidden, true);
  assert.equal(k.koraci[1].hidden, false);
  assert.equal(k.koraci[1].disabled, false);
  assert.equal(k.punjenje.style.width, "50%");
  assert.equal(k.status.textContent, "Korak 2 od 4 — Proizvodi i obim");
  assert.equal(k.lis[0].classes.has("zavrsen"), true);
  assert.equal(k.lis[1].classes.has("aktivan"), true);
  assert.equal(k.koraci[1].getAttribute("tabindex"), "-1");
  assert.equal(k.koraci[1].focused, 1, "fokus prelazi na novi korak");
  k.nazad(2);
  assert.equal(k.koraci[0].hidden, false);
  assert.equal(k.status.textContent, "Korak 1 od 4 — Vaši podaci");
  k.tacka(2);
  assert.equal(k.koraci[1].hidden, false, "tačka vodi na već dostignut korak");
});

test("koraci: slanje sa nepotpunog upitnika je zaustavljeno, Enter vodi na sledeći korak", () => {
  const k = koraciHarness();
  const trag = k.posalji();
  assert.equal(trag.sprecen, 1, "slanje sa prvog koraka je sprečeno");
  assert.equal(trag.zaustavljen, 1, "slušalac forme iz site.js ga ne vidi");
  assert.equal(k.koraci[1].hidden, false, "umesto slanja idemo na sledeći korak");
  assert.equal(k.enter(k.polja["q-brend"]), 1, "Enter u polju ne šalje formu");
  assert.equal(k.koraci[2].hidden, false);
  k.dalje(3);
  assert.equal(k.koraci[3].hidden, false, "poslednji korak");
  assert.equal(k.punjenje.style.width, "100%");
  assert.equal(k.posalji().sprecen, 0, "sa poslednjeg koraka slanje prolazi");
});

test("koraci: pregled prikazuje samo popunjena polja, ispravno označena", () => {
  const k = koraciHarness();
  k.polja["q-ime"].value = "Mila Testić";
  k.polja["q-telefon"].value = "0655555555";
  k.polja["q-pib"].value = "112233445";
  k.polja["q-brend"].value = "Mila Cosmetics";
  k.dalje(1);
  k.dalje(2);
  k.dalje(3);
  const redovi = k.pregled.children.map((red) => [
    red.children[0].textContent,
    red.children[1].textContent,
  ]);
  assert.deepEqual(redovi, [
    ["Ime i prezime", "Mila Testić"],
    ["Broj telefona", "0655555555"],
    ["PIB", "112233445"],
    ["Naziv brenda", "Mila Cosmetics"],
  ]);
  assert.equal(k.pregled.children.every((red) => red.classes.has("pregled-red")), true);
});

test("koraci: PIB koji nije devet cifara dobija jasnu poruku, ispravan prolazi", () => {
  const k = koraciHarness();
  const pib = k.polja["q-pib"];
  const proveri = (vrednost) => {
    pib.value = vrednost;
    for (const callback of pib.listeners.input || []) callback({});
  };
  proveri("12345");
  assert.equal(pib.customValidity, "PIB ima tačno devet cifara.");
  proveri("112233445");
  assert.equal(pib.customValidity, "");
  proveri("");
  assert.equal(pib.customValidity, "", "prazno polje je dozvoljeno");
});

test("koraci: praznina u preskočenom koraku ne prolazi ni skokom na tačku ni slanjem", () => {
  const k = koraciHarness();
  k.dalje(1);
  k.dalje(2);
  k.dalje(3);
  assert.equal(k.koraci[3].hidden, false, "stigli smo do pregleda");
  k.polja["q-brend"].valid = false;
  const trag = k.posalji();
  assert.equal(trag.sprecen, 1, "slanje je zaustavljeno");
  assert.equal(trag.zaustavljen, 1, "site.js ga ne vidi");
  assert.equal(k.koraci[1].hidden, false, "otvara se sporni korak");
  assert.ok(k.polja["q-brend"].reported >= 1, "polje dobija poruku");
  k.tacka(1);
  assert.equal(k.koraci[0].hidden, false);
  k.tacka(4);
  assert.equal(k.koraci[1].hidden, false, "skok na tačku staje na spornom koraku");
  k.polja["q-brend"].valid = true;
  k.tacka(4);
  assert.equal(k.koraci[3].hidden, false, "posle ispravke skok prolazi");
  assert.equal(k.posalji().sprecen, 0, "slanje prolazi");
});

test("koraci: Enter u padajućoj listi ne preskače pitanje", () => {
  const k = koraciHarness();
  assert.equal(k.enter(k.polja["q-izvor"]), 0, "Enter u listi ostaje browseru");
  assert.equal(k.koraci[0].hidden, false, "ostajemo na istom koraku");
  assert.equal(k.enter(k.polja["q-ime"]), 1, "Enter u tekstualnom polju vodi dalje");
  assert.equal(k.koraci[1].hidden, false);
});

// ---- 16.09.2026: sajt za sad nudi SAMO fulfilment; snimci softvera na naslovnoj; bez imena vlasnika/autora ----

test("roba na veliko, uslužni uvoz i skaliranje su sklonjeni sa sajta: nisu u meniju, footeru, naslovnoj, sitemapu ni llms.txt, a stranice su noindex", () => {
  const hidden = ["roba-na-veliko", "usluzni-uvoz-iz-kine", "skaliranje"];
  for (const slug of hidden) {
    assert.match(read(`${slug}.html`), /<meta name="robots" content="noindex">/, `${slug}: noindex`);
    assert.equal(read("sitemap.xml").includes(`/${slug}<`), false, `${slug}: sitemap`);
    assert.equal(read("llms.txt").includes(`/${slug})`), false, `${slug}: llms`);
  }
  for (const file of pages.filter((f) => !hidden.some((slug) => f === `${slug}.html`) && !/noindex/.test(read(f)))) {
    const html = read(file);
    for (const slug of hidden) assert.doesNotMatch(html, new RegExp(`href="/${slug}"`), `${file}: link ka /${slug}`);
  }
  const home = read("index.html");
  assert.doesNotMatch(home, /uslužni uvoz iz Kine|roba na veliko|E-commerce konsultacije/i);
  assert.equal([...home.matchAll(/<article class="service-cell">/g)].length, 6);
  // ni engleska verzija ne nudi uvoz i robu na veliko (Astra 16.09)
  for (const file of enPages) assert.doesNotMatch(read(file), /assisted import|organise the import|import them for you|wholesale from our (own )?stock/i, `${file}: EN uvoz/veleprodaja`);
});

test("ime vlasnika, autor i datum ažuriranja se ne pojavljuju nigde na sajtu", () => {
  for (const file of [...pages, ...enPages, "llms.txt"]) {
    const text = read(file);
    assert.doesNotMatch(text, /Joksimovi|\bLazar\b|Ažurirano \d|"@type":"Person"|hero-note/i, `${file}: ime/autor/ažurirano`);
  }
});

test("snimci softvera stoje na naslovnoj i na /softver (sr i en), integracije imaju logoe, a segmenti softvera imaju skice", () => {
  for (const file of ["index.html", "softver.html", "en/index.html", "en/software.html"]) {
    const html = read(file);
    for (const image of ["topoms-lista-porudzbina-fulfilment", "topoms-mobilna-aplikacija-fulfilment", "topoms-povrati-reklamacije-fulfilment"])
      assert.match(html, new RegExp(`/images/${image}-1400\.webp`), `${file}: ${image}`);
    assert.match(html, /<div class="screens">/, `${file}: .screens`);
  }
  for (const file of ["softver.html", "fulfilment-shopify-woocommerce.html", "en/software.html", "en/shopify-woocommerce.html"]) {
    const html = read(file);
    assert.match(html, /<ul class="integrations"/, `${file}: traka integracija`);
    assert.match(html, /\/images\/logo-shopify\.svg/, `${file}: Shopify logo`);
    assert.match(html, /\/images\/logo-woo\.svg/, `${file}: WooCommerce logo`);
  }
  for (const image of ["logo-shopify.svg", "logo-woo.svg", "skica-izvestaji.svg", "skica-reklame.svg"])
    assert.equal(fs.existsSync(path.join(__dirname, "images", image)), true, image);
  const softver = read("softver.html");
  assert.match(softver, /\/images\/skica-izvestaji\.svg/);
  assert.match(softver, /\/images\/skica-reklame\.svg/);
  assert.match(read("tema.css"), /\.screens img \{[^}]*object-fit: cover/);
});

test("naslovna: potvrđeno do 17 h = red za slanje tog dana (bez golog obećanja „poslato istog dana“, Lazar 18.09), dve smene, softver koji klijent dobija, sr i en", () => {
  const home = read("index.html");
  assert.match(home, /<section id="rok-slanja">/);
  assert.match(home, /Potvrđeno do 17 h ulazi u red za slanje tog dana\./);
  assert.match(home, /Dve smene do 17:30/);
  // Lazar 18.09: ne sme da stoji golo obećanje „stiglo → poslato istog dana“; red za slanje, ne garancija
  assert.doesNotMatch(home, /Stiglo do 17:30|šaljemo istog dana|predaje kuriru istog dana/);
  assert.match(home, /Porudžbina potvrđena do 17 h radnim danom ulazi u red za slanje tog dana\./);
  assert.match(home, /<section id="softver-koji-dobijate">/);
  assert.equal([...home.matchAll(/<div class="grid-3 feature-grid">[\s\S]*?<\/div>\s*<p/g)][0][0].split('<article class="card">').length - 1, 8);
  assert.match(home, /Do kada porudžbina treba da bude potvrđena da bi krenula istog dana\?/);
  const en = read("en/index.html");
  assert.match(en, /<section id="dispatch-cutoff">/);
  assert.match(en, /Confirmed by 17:00, it joins that day's dispatch queue\./);
  assert.doesNotMatch(en, /Received by 17:30|shipped that day|handed to the courier that day/);
  assert.match(en, /<section id="software-you-get">/);
  assert.equal([...en.matchAll(/<div class="grid-3 feature-grid">[\s\S]*?<\/div>\s*<p/g)][0][0].split('<article class="card">').length - 1, 8);
  // natpisi bez pilule: kicker je oznaka sa crtom; snimci na telefonu jedan ispod drugog; lepljivo dugme sklonjeno
  const css = read("tema.css");
  assert.match(css, /\.kicker::before \{ width: 22px; height: 2px;/);
  assert.match(css, /@media \(max-width: 880px\) \{\s*\.screens \{ grid-template-columns: 1fr;/);
  assert.match(css, /\.mobile-contact-bar \{ display: none !important; \}/);
  assert.match(css, /\.hero-trust li \{ background: #fff;/);
});
