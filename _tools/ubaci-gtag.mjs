// Ubacuje Google tag (Google Ads) u <head> svih stranica sajta + konverziju na stranice zahvalnice.
// Pokretanje iz korena repoa:  node _tools/ubaci-gtag.mjs
// Idempotentno: ako je tag vec tu, fajl se preskace.
import fs from 'node:fs'
import path from 'node:path'

const KOREN = process.cwd()
const AW = 'AW-18463606676'
const LABEL = 'MOE6CJuR4f4cEJSPkeRE'
const HVALA = ['hvala/index.html', 'en/thank-you/index.html']

const TAG = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${AW}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${AW}');
</script>`

const KONVERZIJA = `<!-- Google Ads konverzija: Zahtev za ponudu -->
<script>
  gtag('event', 'conversion', {'send_to': '${AW}/${LABEL}'});
</script>`

function sviHtml(dir, lista = []) {
  for (const stavka of fs.readdirSync(dir, { withFileTypes: true })) {
    if (stavka.name === 'node_modules' || stavka.name.startsWith('.') || stavka.name === '_tools') continue
    const pun = path.join(dir, stavka.name)
    if (stavka.isDirectory()) sviHtml(pun, lista)
    else if (stavka.name.endsWith('.html')) lista.push(pun)
  }
  return lista
}

let dodato = 0, preskoceno = 0, stubova = 0, konverzija = 0
for (const fajl of sviHtml(KOREN)) {
  let s = fs.readFileSync(fajl, 'utf8')
  const rel = path.relative(KOREN, fajl).replace(/\\/g, '/')

  if (/http-equiv=["']refresh["']/i.test(s) && s.length < 2000) { stubova++; continue }
  if (s.includes(AW)) { preskoceno++; continue }
  if (!/<head[^>]*>/i.test(s)) { console.log('  ! nema <head>:', rel); continue }

  // Tag ide posle <head> i posle postojeceg redirect skripta ako ga ima.
  const redirect = s.match(/<script>\(function\(\)\{var p=location\.pathname;[\s\S]*?<\/script>/)
  if (redirect) s = s.replace(redirect[0], redirect[0] + '\n' + TAG)
  else s = s.replace(/(<head[^>]*>)/i, '$1\n' + TAG)

  if (HVALA.includes(rel)) { s = s.replace(TAG, TAG + '\n' + KONVERZIJA); konverzija++ }

  fs.writeFileSync(fajl, s, 'utf8')
  dodato++
}

console.log(`Tag dodat: ${dodato} stranica | vec imalo: ${preskoceno} | redirect stubovi preskoceni: ${stubova} | konverzija na: ${konverzija} stranice`)
