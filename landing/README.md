# Landing (Vercel Free)

Single-page landing site for Upwork conversion.

## Local dev

```bash
npm install
npm run dev
```

## Contact form (optional)

The contact form is enabled by `NEXT_PUBLIC_FORMSPREE_ENDPOINT`.

- If set: the form POSTs to Formspree.
- If not set: the Contact section shows a “Contact via Upwork” button.

Example:

```bash
NEXT_PUBLIC_FORMSPREE_ENDPOINT="https://formspree.io/f/xxxxxx"
```

## Deploy (Vercel)

In Vercel project settings, set:

- Root Directory: `landing`

Optional env var:

- `NEXT_PUBLIC_FORMSPREE_ENDPOINT`
- `NEXT_PUBLIC_FIVERR_PROFILE_URL`
