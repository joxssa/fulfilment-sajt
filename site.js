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

  const motionButton = document.getElementById("marquee-toggle");
  const marquee = document.querySelector(".marquee-track");
  if (motionButton && marquee) {
    motionButton.addEventListener("click", () => {
      const paused = marquee.classList.toggle("paused");
      motionButton.setAttribute("aria-pressed", String(paused));
      motionButton.textContent = paused
        ? "Pokreni kretanje"
        : "Pauziraj kretanje";
    });
  }

  const form = document.getElementById("prijava");
  const submit = form?.querySelector('button[type="submit"]');
  const status = document.getElementById("form-status");
  const fallback = document.getElementById("email-fallback");
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
    const data = {
      brend: value("brend"),
      proizvod: value("proizvod"),
      paketi: value("paketi"),
      interes: value("interes"),
      firma: value("firma"),
      ime: value("ime"),
      telefon: value("telefon"),
      email: value("email"),
      poruka: value("poruka"),
      web: value("web"),
    };
    if (data.web) return;
    submit.disabled = true;
    submit.textContent = "Šaljemo zahtev…";
    status.textContent = "Slanje je u toku.";
    fallback.hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("https://sus.rs/api/pakum/prijava", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Slanje nije potvrđeno");
      window.location.assign("hvala.html");
    } catch {
      status.textContent =
        "Nismo dobili potvrdu da je zahtev primljen. Podaci su sačuvani u formi. Pokušajte ponovo ili ih pošaljite emailom.";
      const body = [
        "Zahtev za ponudu — fulfilment.rs",
        "",
        `Brend: ${data.brend}`,
        `Proizvod: ${data.proizvod}`,
        `Paketa mesečno: ${data.paketi}`,
        `Usluge: ${data.interes}`,
        `Firma/PIB: ${data.firma}`,
        `Ime: ${data.ime}`,
        `Telefon: ${data.telefon}`,
        `Email: ${data.email}`,
        `Napomena: ${data.poruka}`,
      ].join("\n");
      fallback.href = `mailto:info@bizonline.rs?subject=${encodeURIComponent(`Ponuda — ${data.brend}`)}&body=${encodeURIComponent(body)}`;
      fallback.hidden = false;
      submit.disabled = false;
      submit.textContent = "Pokušaj ponovo";
    } finally {
      clearTimeout(timeout);
    }
  });
})();
