# LULL — panel administracyjny, baza i maile

Ten dokument opisuje, co zostało dobudowane, jak to uruchomić i jak samemu dokładać kolejne endpointy.

## 1. Co powstało

```
server/
  db/
    index.js         wybiera sterownik: Supabase jeśli są klucze w .env, inaczej pliki lokalne
    file.js          sterownik plikowy (server/data/db/*.json + server/data/enquiries.json)
    supabase.js      sterownik Supabase (REST/PostgREST przez fetch, bez dodatkowych paczek)
  lib/
    env.js           wczytuje .env i .env.local (bez paczki dotenv)
    auth.js          logowanie admina, podpisane ciasteczko sesji, ochrona CSRF
    settings.js      ustawienia CMS: skrzynki, routing, statusy, szablony, nadawca + walidacja
    mail.js          wysyłka maili: transporty "log" (domyślny) i "resend" (gotowy, nieaktywny)
    enquiries.js     logika zapytań: routing, zmiana statusu, przekazanie, forward, notatki
    schema.js        pola formularzy CMS dla stays / destinations / journal + walidacja
    store.js         treści w pamięci, ładowane z bazy przy starcie, zapisywane przez CMS
  routes/
    admin.js         całe API panelu: /api/admin/*
    enquiries.js     publiczne POST /api/enquiries (teraz z routingiem i mailami)
  scripts/seed.js    reset treści do plików seed (npm run db:seed)
  views/admin.html   szkielet panelu
public/
  css/admin.css      style panelu, tylko tokeny z base.css
  js/admin/          panel: main.js (router, logowanie), state.js, ui.js, views/*
supabase/schema.sql  tabele, widok, RLS — wklejasz raz w SQL Editor
.env / .env.example  konfiguracja
```

Panel jest pod **`/admin`**. Ma: Overview, Enquiries (lista, filtry, szczegóły, historia), Outbox (wszystkie maile),
Stays / Destinations / Journal (edycja treści, zmiany widoczne od razu), Settings (routing, skrzynki, statusy,
szablony maili, nadawca).

## 2. Uruchomienie lokalnie

```bash
npm install
npm run dev
```

Bez kluczy Supabase aplikacja działa w **trybie plikowym**: zapytania idą do `server/data/enquiries.json`,
a edycje treści, ustawienia i outbox do `server/data/db/` (oba w `.gitignore`). Pliki seed
(`server/data/stays.json` itd.) nie są nigdy nadpisywane.

W konsoli po starcie widać, co jest aktywne:

```
LULL running → http://localhost:3000
  database  file
  mail      log (nothing leaves this server)
  admin     http://localhost:3000/admin
```

Dane logowania do panelu są w `.env` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

## 3. Jak postawiony jest endpoint listy zapytań (i jak robić kolejne)

Wcześniej był tylko zapis (`POST /api/enquiries`) i licznik. Teraz lista to
`GET /api/admin/enquiries`, chroniona logowaniem. Zbudowana jest z trzech warstw — ten sam przepis
działa dla każdego nowego endpointu.

### Warstwa 1 — sterownik bazy (`server/db/*.js`)

Każdy sterownik eksportuje **te same funkcje** z tymi samymi argumentami. Reszta aplikacji woła
`db.listEnquiries(...)` i nie wie, czy pod spodem jest plik czy Supabase.

Plik (`server/db/file.js`) — filtruje tablicę w JS:

```js
export async function listEnquiries({ status, assignee, q, limit = 50, offset = 0 } = {}) {
  let rows = allEnquiries().sort(byNewest);
  if (status) rows = rows.filter((e) => e.status === status);
  ...
  return { total: rows.length, results: rows.slice(offset, offset + limit) };
}
```

Supabase (`server/db/supabase.js`) — to samo, ale filtry idą w URL do PostgREST:

```js
const params = {
  select: '*',
  order: 'received_at.desc',
  limit, offset,
  status: status ? `eq.${status}` : undefined,
};
const { data, res } = await rest(`enquiries?${qs(params)}`, { prefer: 'count=exact' });
return { total: totalFrom(res), results: data.map(fromRow) };
```

- `eq.`, `ilike.`, `is.null` to operatory PostgREST (`?status=eq.new` = `WHERE status = 'new'`).
- `Prefer: count=exact` każe Supabase zwrócić łączną liczbę w nagłówku `Content-Range` — stąd paginacja.
- `fromRow` tłumaczy kolumny z bazy (`received_at`) na nazwy używane w JS (`receivedAt`).

### Warstwa 2 — trasa (`server/routes/admin.js`)

```js
router.use(requireAdmin);

router.get(
  '/enquiries',
  wrap(async (req, res) => {
    const limit = int(req.query.limit, 1, 200, 50);
    const offset = int(req.query.offset, 0, 1_000_000, 0);
    const { total, results } = await db.listEnquiries({ ...listQuery(req.query), limit, offset });
    res.json({ total, count: results.length, limit, offset, results });
  })
);
```

- `router.use(requireAdmin)` — wszystko **pod** tą linią wymaga zalogowania (401 bez ciasteczka).
- `wrap(...)` łapie błędy z funkcji `async` i oddaje je do handlera błędów na końcu pliku (JSON zamiast HTML).
- `int(...)` i `str(...)` przycinają to, co przyszło w query — nigdy nie ufamy parametrom z zewnątrz.
- Router jest podpięty w `server/index.js`: `app.use('/api/admin', adminRoutes)`.

### Warstwa 3 — panel (`public/js/admin/*`)

```js
const data = await adm(`/enquiries?status=new&limit=50`);
```

`adm()` (w `state.js`) to cienka nakładka na `api()` z `public/js/api.js`: dokleja `/admin`, wysyła
ciasteczko i przy 401 pokazuje ekran logowania.

### Przepis: nowy endpoint w 4 krokach

Przykład: liczba zapytań na region, `GET /api/admin/enquiries-by-region`.

1. **Sterownik plikowy** — dopisz funkcję w `server/db/file.js`:
   ```js
   export async function regionCounts() {
     return allEnquiries().reduce((acc, e) => {
       const k = e.destination || 'none';
       return { ...acc, [k]: (acc[k] || 0) + 1 };
     }, {});
   }
   ```
2. **Sterownik Supabase** — ta sama nazwa w `server/db/supabase.js`. Najprościej przez widok SQL
   (jak `enquiry_status_counts` w `supabase/schema.sql`):
   ```sql
   create or replace view public.enquiry_region_counts with (security_invoker = true) as
     select coalesce(nullif(destination, ''), 'none') as region, count(*)::int as count
     from public.enquiries group by 1;
   ```
   ```js
   export async function regionCounts() {
     const { data } = await rest('enquiry_region_counts?select=region,count');
     return Object.fromEntries(data.map((r) => [r.region, r.count]));
   }
   ```
3. **Trasa** — w `server/routes/admin.js`, gdzieś pod `router.use(requireAdmin)`:
   ```js
   router.get('/enquiries-by-region', wrap(async (_req, res) => {
     res.json({ counts: await db.regionCounts() });
   }));
   ```
4. **Test z terminala** (logowanie zapisuje ciasteczko do pliku, kolejne wywołania go używają):
   ```bash
   curl -c cookies.txt -H 'Content-Type: application/json' \
     -d '{"email":"TWÓJ_ADMIN_EMAIL","password":"TWOJE_HASŁO"}' \
     http://localhost:3000/api/admin/login
   curl -b cookies.txt http://localhost:3000/api/admin/enquiries-by-region
   ```

Jeśli endpoint ma być **publiczny** (bez logowania), dodaj go w osobnym pliku w `server/routes/`
i podepnij w `server/index.js` przed linią `app.use('/api', ... 404 ...)`. Publicznie nigdy nie
zwracaj danych osobowych z zapytań.

### Wszystkie endpointy panelu

| Metoda | Ścieżka | Co robi |
|---|---|---|
| POST | `/api/admin/login` | `{email, password}` → ustawia ciasteczko sesji (12 h) |
| POST | `/api/admin/logout` | kasuje sesję |
| GET | `/api/admin/me` | kto jest zalogowany, jaka baza, jaki transport maili |
| GET | `/api/admin/overview` | liczniki, ostatnie zapytania i maile |
| GET | `/api/admin/enquiries` | lista: `?status=&assignee=&q=&limit=&offset=` (`assignee=none` = nieprzypisane) |
| GET | `/api/admin/enquiries.csv` | eksport CSV z tymi samymi filtrami |
| GET | `/api/admin/enquiries/:id` | jedno zapytanie + jego maile + sugestia routingu |
| PATCH | `/api/admin/enquiries/:id` | `{status}` lub `{assignee, note}` |
| POST | `/api/admin/enquiries/:id/notes` | `{text}` — notatka wewnętrzna |
| POST | `/api/admin/enquiries/:id/forward` | `{to, note}` — kopia na dowolny adres |
| DELETE | `/api/admin/enquiries/:id` | usuwa zapytanie |
| GET | `/api/admin/schema` | definicje pól CMS + lista zdjęć z `public/img/card` |
| GET/POST | `/api/admin/content/:collection` | lista / nowy wpis (`stays`, `destinations`, `journal`) |
| GET/PUT/DELETE | `/api/admin/content/:collection/:slug` | odczyt / zapis / usunięcie wpisu |
| GET | `/api/admin/settings` | wszystkie ustawienia |
| PUT | `/api/admin/settings/:key` | `mail`, `mailboxes`, `routing`, `statuses`, `templates` |
| POST | `/api/admin/settings/test-mail` | `{to}` — mail testowy |
| GET | `/api/admin/outbox` | ostatnie maile (`?limit=`) |

## 4. Baza danych w chmurze — Supabase

Wybrałem Supabase (Postgres): darmowy plan wystarcza z zapasem, wideo na stronie już stoi na Supabase,
a z Node rozmawiamy przez zwykłe `fetch` do REST API — bez nowych zależności. SQLite odpadł, bo na
większości hostingów (Vercel, Render free, Railway bez wolumenu) plik bazy znika przy każdym deployu.

### Co musisz zrobić (ok. 5 minut)

1. Wejdź na https://supabase.com/dashboard → **New project**. Region najbliżej użytkowników
   (np. `eu-central-1` Frankfurt). Hasło do bazy zapisz, ale aplikacja go nie potrzebuje.
2. Po utworzeniu: **SQL Editor → New query** → wklej całą zawartość `supabase/schema.sql` → **Run**.
   Powstaną tabele `entries`, `enquiries`, `settings`, `email_log` i widok `enquiry_status_counts`,
   wszystkie z włączonym RLS (klucz publiczny nie ma do nich dostępu).
3. **Project Settings → API Keys**:
   - skopiuj **Project URL** (np. `https://abcd1234.supabase.co`) → `SUPABASE_URL`
   - w zakładce z nowymi kluczami skopiuj **secret key** (`sb_secret_...`) → `SUPABASE_SECRET_KEY`.
     Działa też stary `service_role` (zaczyna się od `eyJ...`) — wtedy wklej go w to samo pole.
4. Zrestartuj serwer. W konsoli powinno być `database  supabase`.
5. Przy pierwszym starcie aplikacja sama wgra stays / destinations / journal z plików seed do tabeli
   `entries`. Ustawienia CMS zapiszą się przy pierwszym „Save” w panelu (do tego czasu działają domyślne).

**Secret key daje pełny dostęp do bazy.** Trzymaj go tylko w `.env` na serwerze i w zmiennych
środowiskowych hostingu. Nigdy we frontendzie, nigdy w repo.

### Przydatne

```bash
npm run db:seed                     # pokazuje, co zrobi, i nic nie robi
npm run db:seed -- --yes            # reset treści do plików seed (zapytań nie dotyka)
npm run db:seed -- --yes --settings # to samo + reset ustawień CMS do domyślnych
```

Stare zapytania z `server/data/enquiries.json` nie są przenoszone automatycznie (to dane testowe).

## 5. Plik `.env`

| Zmienna | Po co |
|---|---|
| `PORT` | port serwera, domyślnie 3000 |
| `SITE_URL` | pełny adres strony; używany w linkach w mailach (`{{adminUrl}}`) i w meta |
| `TRUST_PROXY` | ustaw `1` za reverse proxy (Render, Railway, Nginx), żeby działał rate limit i `Secure` na ciasteczku |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | logowanie do `/admin`; puste = panel wyłączony |
| `SESSION_SECRET` | klucz do podpisywania sesji; bez niego sesje giną przy każdym restarcie |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | baza w chmurze; puste = tryb plikowy |
| `MAIL_TRANSPORT` | `log` (domyślnie, nic nie wychodzi) albo `resend` |
| `RESEND_API_KEY` | tylko gdy `MAIL_TRANSPORT=resend` |

`.env` jest w `.gitignore`. Do repo idzie tylko `.env.example` bez wartości. Nowy sekret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 6. Maile: jak to działa

Żadna skrzynka nie jest podpięta. Transport `log` buduje każdy mail w całości, zapisuje go w Outboxie
(tabela `email_log` / `server/data/db/email_log.json`) i wypisuje nagłówek w konsoli serwera.
W panelu widać dokładnie, co i do kogo by poszło.

### Przepływ nowego zapytania

1. Formularz `/plan` → `POST /api/enquiries` → walidacja.
2. **Routing** (`server/lib/enquiries.js → route()`): region z formularza albo region wybranego stay →
   reguła z *Settings → Routing* → skrzynka. Brak reguły = skrzynka „fallback”.
3. Zapytanie zapisuje się ze statusem = pierwszy status z listy i z przypisaną skrzynką (handler).
4. Mail do handlera (+ skrzynki „Always copy”), szablon *New enquiry*. Reply-To = klient, więc
   odpowiedź z poczty trafia prosto do niego.
5. Jeśli włączone: potwierdzenie do klienta, szablon *Receipt*. Reply-To = handler.

Maile idą **po** odpowiedzi do przeglądarki — awaria poczty nigdy nie blokuje formularza.

### W panelu

- **Zmiana statusu** — każdy status ma przełączniki: *Email the customer* (własny temat i treść),
  *Note to the handler*, *Closes the enquiry* (nie liczy się jako otwarte).
- **Pass it on** — zmienia handlera i wysyła mu całe zapytanie z notatką.
- **Forward a copy** — kopia na dowolny adres (przewodnik, gospodarz), handler bez zmian.
- **Internal note** — tylko w historii, nic nie wychodzi.
- Szablony: zwykły tekst z `{{placeholderami}}`, podgląd na przykładowych danych w *Settings → Email templates*.

### Gdy zechcesz wysyłać naprawdę

**Resend** (adapter już jest w `server/lib/mail.js`):
1. Konto na resend.com → dodaj i zweryfikuj domenę (rekordy DNS).
2. `.env`: `MAIL_TRANSPORT=resend`, `RESEND_API_KEY=re_...`.
3. W *Settings → Sender* ustaw adres z tej domeny. Wyślij test.

**Inny dostawca / SMTP** — dopisz transport w obiekcie `transports` w `server/lib/mail.js`.
Funkcja dostaje `{ from, to[], replyTo, subject, text }` i ma zwrócić `{ status: 'sent' }` albo
rzucić błąd. Dla SMTP: `npm install nodemailer` i `nodemailer.createTransport(...).sendMail(...)`
w środku takiej funkcji. Nic więcej w aplikacji nie trzeba zmieniać.

## 7. Bezpieczeństwo — co jest zrobione

- Hasło porównywane w stałym czasie; logowanie ograniczone do 10 prób na 15 minut z jednego IP.
- Sesja w ciasteczku `HttpOnly; SameSite=Strict` (+ `Secure` po HTTPS), podpisana HMAC, ważna 12 h.
- Zapytania zmieniające dane z obcego `Origin` są odrzucane (403).
- `/admin` i `/api/admin` mają `noindex` i `Cache-Control: no-store`; `/admin` jest w `robots.txt`.
- Wszystko, co przychodzi z formularzy, jest walidowane na serwerze; wszystko, co trafia do HTML, przez `esc()`.
- W Supabase RLS jest włączony bez polityk — dostęp ma tylko klucz serwerowy.
- Eksport CSV neutralizuje formuły (`=`, `+`, `-`, `@` na początku komórki).

## 8. Co można dobudować później

- Wielu użytkowników z rolami (tabela `admins` z hashami scrypt zamiast jednego konta w `.env`).
- Wersje robocze treści (pole `published` i filtr w publicznych trasach).
- Upload zdjęć do Supabase Storage (dziś wybierasz spośród plików w `public/img/card`).
- Odbieranie odpowiedzi klientów do historii (webhook od dostawcy poczty).
