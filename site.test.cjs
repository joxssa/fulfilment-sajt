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
    assert.match(html, /<html lang="sr">/, file);
    assert.match(html, /<title>[^<]+<\/title>/, file);
    for (const script of html.matchAll(
      /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
    )) {
      if (script[1].includes("application/ld+json")) JSON.parse(script[2]);
      else new vm.Script(script[2], { filename: file });
    }
    const base = html.includes('<base href="/">')
      ? "https://fulfilment.rs/"
      : `https://fulfilment.rs/${file}`;
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(?:https?:|mailto:|data:|tel:)/.test(href)) continue;
      const url = new URL(href, base);
      const dest = decodeURIComponent(url.pathname.slice(1)) || "index.html";
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

function harness(fetchHandler) {
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
        toggle: (name) => {
          if (this.classes.has(name)) {
            this.classes.delete(name);
            return false;
          }
          this.classes.add(name);
          return true;
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
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
  };
  const calls = [];
  const navigations = [];
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
    window: { location: { assign: (url) => navigations.push(url) } },
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
    timers,
    cleared,
    burger,
    links,
    navLink,
    document,
    motionButton,
    marquee,
    Element,
  };
}

test("successful lead uses the existing endpoint and field contract, then confirms receipt", async () => {
  const h = harness(async () => ({ ok: true }));
  await h.send();
  assert.equal(h.calls.length, 1);
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
  assert.deepEqual(h.navigations, ["hvala.html"]);
  assert.deepEqual(h.cleared, [1]);
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
  let resolve;
  const h = harness(() => new Promise((r) => (resolve = r)));
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
  assert.equal(h.calls.length, 1);
  resolve({ ok: true });
  await pending;
});

test("mobile menu announces state and Escape returns keyboard focus to its trigger", () => {
  const h = harness(() => {
    throw new Error("Unexpected network call");
  });
  h.burger.listeners.click();
  assert.equal(h.burger.attrs["aria-expanded"], "true");
  h.document.listeners.keydown({ key: "Escape" });
  assert.equal(h.burger.attrs["aria-expanded"], "false");
  assert.equal(h.burger.focused, true);
  h.burger.listeners.click();
  h.navLink.listeners.click();
  assert.equal(h.links.classList.contains("open"), false);
  h.burger.listeners.click();
  h.document.listeners.click({ target: new h.Element() });
  assert.equal(h.links.classList.contains("open"), false);
});

test("brand motion can be paused without removing or changing the supplied logos", () => {
  const h = harness(() => {
    throw new Error("Unexpected network call");
  });
  h.motionButton.listeners.click();
  assert.equal(h.marquee.classList.contains("paused"), true);
  assert.equal(h.motionButton.attrs["aria-pressed"], "true");
  h.motionButton.listeners.click();
  assert.equal(h.marquee.classList.contains("paused"), false);
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
  ])
    assert.match(home, new RegExp(`images/brend-${brand}\\.png`));
  assert.match(read("premium.css"), /prefers-reduced-motion:\s*reduce/);
});
