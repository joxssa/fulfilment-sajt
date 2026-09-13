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
        // Kopija u BizOMS. Dopunska: ne menja ishod slanja.
        try {
          fetch(BIZOMS_LEAD_URL, { ...request, keepalive: true }).catch(() => {});
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
        fallback.href = `mailto:info@bizonline.rs?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
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
})();
