# GitHub Contribution Graph

Custom SVG line chart contribution graph generator for GitHub profile READMEs.

## Features

- Dynamic line/area SVG graph for any public GitHub username
- Themes: `dark`, `light`, `ocean`, `sunset`
- Vercel-ready Next.js API route
- Preview UI with README embed code
- One-hour cache for GitHub API responses

## Local Setup

Create `.env.local`:

```env
GITHUB_TOKEN=your_github_personal_access_token
```

Run the app:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000
```

Direct SVG API:

```txt
http://localhost:3000/api/contributions?username=muhammad-muneeb3&theme=dark&v=2
```

## README Usage

After deploying to Vercel, use your production domain:

```md
<img src="https://your-vercel-domain.vercel.app/api/contributions?username=muhammad-muneeb3&theme=dark&v=2" alt="GitHub contribution graph" />
```

Anyone can use it by changing the username:

```md
<img src="https://your-vercel-domain.vercel.app/api/contributions?username=octocat&theme=ocean&v=2" alt="GitHub contribution graph" />
```

## Deploy

Add this environment variable in Vercel project settings:

```env
GITHUB_TOKEN=your_github_personal_access_token
```

Then deploy the project from GitHub to Vercel.
