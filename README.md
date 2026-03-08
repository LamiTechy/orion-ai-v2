# Orion AI v3 — React + Supabase

A full migration of Orion AI from Express/MongoDB/HTML to React + Supabase Edge Functions.

## Stack

| Layer | Old | New |
|---|---|---|
| Frontend | Plain HTML/CSS/JS | React + Vite |
| Auth | JWT (manual) | Supabase Auth |
| Database | MongoDB (Mongoose) | Supabase (Postgres) |
| Backend | Express.js | Supabase Edge Functions (Deno) |
| File storage | Local disk | Supabase Storage |
| AI | Groq (Llama 4 Scout) | Groq (same) |
| Image gen | HuggingFace FLUX | HuggingFace FLUX (same) |
| Web search | Tavily | Tavily (same) |

## Project Structure

```
orion-react/
├── src/
│   ├── components/
│   │   └── MessageBubble.jsx    # Chat message with markdown & image rendering
│   ├── context/
│   │   └── AuthContext.jsx      # Supabase auth state
│   ├── hooks/
│   │   └── useConversations.js  # Supabase DB operations
│   ├── lib/
│   │   └── supabase.js          # Supabase client + helpers
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   └── Chat.jsx             # Main chat interface
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── functions/
│   │   ├── chat-stream/         # SSE streaming chat
│   │   ├── upload/              # File + image upload
│   │   ├── generate-image/      # HuggingFace image gen
│   │   ├── classify-intent/     # Detect image requests
│   │   └── save-image-messages/ # Save image gen to DB
│   └── schema.sql               # Postgres tables + RLS policies
└── .env.example
```

## Setup

### 1. Create a Supabase Project

Go to [supabase.com](https://supabase.com) → New Project.

### 2. Run the Database Schema

In your Supabase dashboard → **SQL Editor** → paste and run `supabase/schema.sql`.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Fill in `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both values are in Supabase → **Settings** → **API**.

### 4. Set Edge Function Secrets

In Supabase → **Edge Functions** → **Manage Secrets**, add:

```
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
HF_API_KEY=your_huggingface_api_key
SYSTEM_PROMPT=You are Orion... (optional, uses default if not set)
```

### 5. Deploy Edge Functions

Install Supabase CLI:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login
supabase link --project-ref your-project-ref
```

Deploy all functions:
```bash
supabase functions deploy chat-stream
supabase functions deploy upload
supabase functions deploy generate-image
supabase functions deploy classify-intent
supabase functions deploy save-image-messages
```

### 6. Install & Run Frontend

```bash
npm install
npm run dev
```

### 7. Build for Production

```bash
npm run build
```

Deploy the `dist/` folder to **Vercel**, **Netlify**, or **Cloudflare Pages**.

## Auth Configuration

In Supabase → **Authentication** → **Settings**:
- **Email confirmations**: Turn OFF for frictionless signup (or leave ON for production)
- **Site URL**: Set to your deployed domain

## Features

- ✅ Streaming chat with Groq (Llama 4 Scout)
- ✅ Supabase Auth (signup, login, logout)
- ✅ Conversation history (Postgres)
- ✅ User memory extraction (per-user facts)
- ✅ Web search via Tavily (auto-triggered for real-time queries)
- ✅ File uploads: images (vision AI), text files, code files, CSV
- ✅ AI image generation (HuggingFace FLUX → stored in Supabase Storage)
- ✅ Voice input (Web Speech API)
- ✅ Markdown + code highlighting
- ✅ Mobile responsive with slide-out sidebar
- ✅ Multilingual (auto-detects user language)
