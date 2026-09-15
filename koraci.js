// @ts-check
// Upitnik u četiri koraka (/zahtev-za-ponudu).
// Slanje radi site.js (isti kanal kao ostale forme) — ovde je samo kretanje
// kroz korake: prikaz, provera polja tekućeg koraka, traka napretka i pregled.
// Bez JavaScripta strana ostaje upotrebljiva: svi koraci su vidljivi u jednoj
// formi (ovaj fajl ih tek posle učitavanja skuplja u korake).
(() => {
  const form = document.getElementById("ponuda");
  if (!(form instanceof HTMLFormElement)) return;

  const koraci = /** @type {HTMLFieldSetElement[]} */ (
    Array.from(form.querySelectorAll("fieldset.korak")).filter(
      (element) => element instanceof HTMLFieldSetElement,
    )
  );
  if (koraci.length < 2) return;

  const tacke = Array.from(document.querySelectorAll("#koraci li"));
  const traka = document.getElementById("korak-traka");
  const punjenje = document.getElementById("korak-traka-punjenje");
  const status = document.getElementById("korak-status");
  const pregled = document.getElementById("pregled");
  const imena = ["Vaši podaci", "Proizvodi i obim", "Napomena", "Pregled"];

  /** Polja u pregledu (4. korak) i u redosledu u kom se popunjavaju. */
  const polja = [
    ["q-ime", "Ime i prezime"],
    ["q-telefon", "Broj telefona"],
    ["q-email", "Email adresa"],
    ["q-firma", "Naziv firme"],
    ["q-pib", "PIB"],
    ["q-izvor", "Čuli za nas"],
    ["q-brend", "Naziv brenda"],
    ["q-proizvod", "Šta prodajete"],
    ["q-sajt", "Sajt ili profil"],
    ["q-paketi", "Paketa mesečno"],
    ["q-interes", "Usluge"],
    ["q-roba", "Gde je roba sada"],
    ["q-pocetak", "Početak saradnje"],
    ["q-poruka", "Napomena"],
  ];

  let tekuci = 1;
  let dostignut = 1;

  /** @param {string} id */
  const vrednost = (id) => {
    const polje = form.querySelector(`#${id}`);
    return polje instanceof HTMLInputElement ||
      polje instanceof HTMLSelectElement ||
      polje instanceof HTMLTextAreaElement
      ? polje.value.trim()
      : "";
  };

  const napisiPregled = () => {
    if (!pregled) return;
    pregled.textContent = "";
    let popunjeno = false;
    for (const [id, labela] of polja) {
      const upisano = vrednost(id);
      if (!upisano) continue;
      popunjeno = true;
      const red = document.createElement("div");
      red.className = "pregled-red";
      const naziv = document.createElement("dt");
      naziv.textContent = labela;
      const sadrzaj = document.createElement("dd");
      sadrzaj.textContent = upisano;
      red.append(naziv, sadrzaj);
      pregled.append(red);
    }
    if (!popunjeno) {
      const prazno = document.createElement("p");
      prazno.className = "pregled-prazno";
      prazno.textContent = "Nijedno polje nije popunjeno. Vratite se na prvi korak.";
      pregled.append(prazno);
    }
  };

  /**
   * @param {number} broj
   * @param {boolean} pomeri  — pomeri fokus i pogled na karticu
   */
  const prikazi = (broj, pomeri) => {
    tekuci = Math.min(Math.max(broj, 1), koraci.length);
    if (tekuci > dostignut) dostignut = tekuci;

    koraci.forEach((korak, redni) => {
      const aktivan = redni === tekuci - 1;
      korak.hidden = !aktivan;
      // Isključena polja ne ulaze u proveru forme, pa prazno obavezno polje
      // iz sakrivenog koraka ne može da blokira slanje.
      korak.disabled = !aktivan;
    });

    tacke.forEach((tacka, redni) => {
      tacka.classList.toggle("aktivan", redni === tekuci - 1);
      tacka.classList.toggle("zavrsen", redni < tekuci - 1);
      const dugme = tacka.querySelector("button");
      if (!(dugme instanceof HTMLButtonElement)) return;
      if (redni === tekuci - 1) dugme.setAttribute("aria-current", "step");
      else dugme.removeAttribute("aria-current");
      dugme.disabled = redni + 1 > dostignut;
    });

    if (punjenje instanceof HTMLElement)
      punjenje.style.width = `${(tekuci / koraci.length) * 100}%`;
    if (traka) traka.setAttribute("aria-valuenow", String(tekuci));
    if (status)
      status.textContent = `Korak ${tekuci} od ${koraci.length} — ${imena[tekuci - 1] || ""}`;
    if (tekuci === koraci.length) napisiPregled();

    if (!pomeri) return;
    const korak = koraci[tekuci - 1];
    korak.setAttribute("tabindex", "-1");
    korak.focus({ preventScroll: true });
    const okvir = form.getBoundingClientRect();
    if (okvir.top < 0 || okvir.top > window.innerHeight * 0.45) {
      const mirno = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({
        top: window.scrollY + okvir.top - 90,
        behavior: mirno ? "auto" : "smooth",
      });
    }
  };

  /**
   * Prvo neispravno polje jednog koraka, ili null. Korak se za proveru
   * privremeno uključi: isključena polja browser ne proverava, pa bi bez toga
   * prazno obavezno polje iz preskočenog koraka prošlo neprimetno.
   * @param {number} redni — indeks koraka, 0 do n-1
   */
  const prvoNeispravnoPolje = (redni) => {
    const korak = koraci[redni];
    if (!korak) return null;
    const bioIskljucen = korak.disabled;
    korak.disabled = false;
    let neispravno = null;
    for (const polje of Array.from(korak.querySelectorAll("input, select, textarea"))) {
      if (
        !(
          polje instanceof HTMLInputElement ||
          polje instanceof HTMLSelectElement ||
          polje instanceof HTMLTextAreaElement
        )
      )
        continue;
      if (!polje.checkValidity()) {
        neispravno = polje;
        break;
      }
    }
    korak.disabled = bioIskljucen;
    return neispravno;
  };

  /**
   * Vodi na traženi korak, ali tek kad su svi koraci pre njega ispravni.
   * Ako nisu, otvara prvi sporni korak i pokazuje poruku na polju.
   * @param {number} cilj — 1 do n
   */
  const idiNa = (cilj) => {
    if (cilj <= tekuci) {
      prikazi(cilj, true);
      return true;
    }
    for (let redni = 0; redni < cilj - 1; redni += 1) {
      const neispravno = prvoNeispravnoPolje(redni);
      if (!neispravno) continue;
      prikazi(redni + 1, true);
      neispravno.reportValidity();
      return false;
    }
    prikazi(cilj, true);
    return true;
  };

  const dalje = () => idiNa(tekuci + 1);

  form.addEventListener("click", (event) => {
    const meta = event.target;
    if (!(meta instanceof Element)) return;
    if (meta.closest("[data-dalje]")) {
      event.preventDefault();
      dalje();
      return;
    }
    if (meta.closest("[data-nazad]")) {
      event.preventDefault();
      prikazi(tekuci - 1, true);
    }
  });

  // Enter u polju vodi na sledeći korak umesto da pošalje nedovršen upitnik.
  // Padajuće liste i dugmad zadržavaju svoje uobičajeno ponašanje.
  form.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const meta = event.target;
    if (
      meta instanceof HTMLTextAreaElement ||
      meta instanceof HTMLButtonElement ||
      meta instanceof HTMLSelectElement
    )
      return;
    if (tekuci >= koraci.length) return;
    event.preventDefault();
    dalje();
  });

  // Sigurnosna brava: slanje prolazi samo sa poslednjeg koraka i samo kad su
  // SVI koraci ispravni. Slušalac je na dokumentu u fazi hvatanja, pa radi pre
  // slušaoca forme iz site.js.
  document.addEventListener(
    "submit",
    (event) => {
      if (event.target !== form) return;
      if (tekuci < koraci.length) {
        event.preventDefault();
        event.stopPropagation();
        dalje();
        return;
      }
      for (let redni = 0; redni < koraci.length - 1; redni += 1) {
        const neispravno = prvoNeispravnoPolje(redni);
        if (!neispravno) continue;
        event.preventDefault();
        event.stopPropagation();
        prikazi(redni + 1, true);
        neispravno.reportValidity();
        return;
      }
    },
    true,
  );

  tacke.forEach((tacka, redni) => {
    const dugme = tacka.querySelector("button");
    if (!(dugme instanceof HTMLButtonElement)) return;
    dugme.addEventListener("click", () => {
      const cilj = redni + 1;
      if (cilj === tekuci || cilj > dostignut) return;
      idiNa(cilj);
    });
  });

  const pib = document.getElementById("q-pib");
  if (pib instanceof HTMLInputElement) {
    const proveriPib = () => {
      pib.setCustomValidity(
        pib.value && !/^[0-9]{9}$/.test(pib.value) ? "PIB ima tačno devet cifara." : "",
      );
    };
    pib.addEventListener("input", proveriPib);
    pib.addEventListener("blur", proveriPib);
  }

  prikazi(1, false);
})();
