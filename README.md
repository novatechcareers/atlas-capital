This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Supabase setup (optional)

This project can use Supabase for authentication and user storage. By default the app falls back to in-browser `localStorage` if Supabase is not configured.

1. Create a Supabase project at https://app.supabase.com
2. In your project settings get the Project URL and the `anon` public API key.
3. Add environment variables to a local `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your_anon_key
```

4. (Optional) Create a `profiles` table or configure additional Postgres tables to store user metadata.

5. Install the Supabase client if you haven't already:

```bash
npm install @supabase/supabase-js
```

The app includes a small helper at `lib/supabase.ts` and `lib/auth.ts` will automatically use Supabase Auth for `registerAccount` and `loginAccount` when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present. If those env vars are absent or Supabase calls fail, the app falls back to the previous localStorage-based mock implementation.

Security note: Do not commit service role or secret keys to the repository. Use deployment environment variables for server-side keys.
