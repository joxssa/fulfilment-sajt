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
    assert.ok(fs.existsSync(path.join(__dirname, loc ? `${loc}.html` : "index.html")), loc);
  assert.doesNotMatch(sitemap, /hvala/);
  assert.equal(fs.existsSync(path.join(__dirname, ".nojekyll")), true);
});

test("every indexable page has one H1, SEO-length title and description, extensionless canonical and valid JSON-LD references", () => {
  const indexable = pages.filter((file) => !/noindex/.test(read(file)));
  assert.ok(indexable.length >= 13, `indexable pages: ${indexable.length}`);
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
    assert.deepEqual(hrefs, ["/skladistenje-robe", "/pakovanje-paketa", "/slanje-pouzecem", "/povrati-i-reklamacije", "/roba-na-veliko", "/usluzni-uvoz-iz-kine", "/fulfilment-za-dropshipping"], file);
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
    assert.equal(mail.pathname, "info@bizonline.rs");
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
    assert.equal(bars.length, 1, file);
    assert.equal([...bars[0][1].matchAll(/<a\b/g)].length, 1, file);
    assert.match(bars[0][1], /href="\/#prijava"/);
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
  const select = read("index.html").match(/<select id="paketi"[^>]*>([\s\S]*?)<\/select>/)[1];
  const options = [...select.matchAll(/<option>([^<]+)<\/option>/g)].map((m) => m[1]);
  assert.deepEqual(options, ["Do 500", "501 – 1.000", "1.001 – 3.000", "Preko 3.000"]);
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
  assert.match(css, /main :where\(p, li, td, figcaption\) a:where\(:not\(\.btn, \.text-link\)\)\s*\{[^}]*color:\s*var\(--signal-dark\)/);
  assert.match(css, /\.service-cell h3 a\s*\{[^}]*color:\s*var\(--ink\)[^}]*text-decoration:\s*none/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
