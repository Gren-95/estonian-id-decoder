# Estonian ID Code Decoder

A tiny, dependency-free single-page app that decodes an Estonian personal
identification code (*isikukood*): gender, date of birth, age, and checksum
validity. Everything runs client-side — no network requests, no backend, no
data ever leaves the browser.

## How the code is structured

An isikukood is 11 digits: `G YYMMDD SSS C`

| Part | Meaning |
|------|---------|
| `G` | Century + gender: 1/2 = male/female born 1800–1899, 3/4 = 1900–1999, 5/6 = 2000–2099, 7/8 = 2100–2199 |
| `YYMMDD` | Date of birth |
| `SSS` | Sequence number distinguishing people born the same day |
| `C` | Checksum digit, a weighted mod-11 check over the first 10 digits |

## Running locally

No build step. Just serve the directory statically, e.g.:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Or simply open `index.html` directly in a browser.

## Deploying to GitHub Pages

1. Create a new GitHub repository and push this folder to it:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)`.
4. Save — GitHub will publish the site at
   `https://<your-username>.github.io/<repo-name>/` within a minute or two.

No GitHub Actions workflow is needed since this is plain static HTML/CSS/JS.

## Privacy note

This tool only parses the public, self-describing structure of the code
(it's not a lookup or a database). Nothing typed into the input is
transmitted anywhere — open your browser's Network tab to confirm.
