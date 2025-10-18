BrightBox

BrightBox is a private, invite-only app for school-friendly short videos and a simple chat. Think of it as a safe hallway: students can share learning clips, ask questions, and get quick feedback — only after they’ve been approved.

Why it exists

Schools need a focused space for short educational content without the noise. BrightBox keeps things tight: approved users, simple flows, and clear rules. No public feeds. No surprise guests.

What’s inside (MVP)

Invite gate — students request access; admins approve. Only approved emails can create accounts.

Accounts — email + password (or magic link later). Sessions work on both client and server.

Global chat — one shared room to keep questions and answers moving.

Clean UI — minimal components, readable on phones and laptops.

Extendable — video uploads and class channels can come next without rewiring the whole app.

How it works (in plain English)

A student requests an invite.

An admin marks them as approved.

The student signs up with that email, sets a password, and gets in.

Inside, they see a simple feed and a chat. That’s it.

Safety and privacy

Only approved users can join.

Read and write rules are enforced in the database, not just the UI.

No public endpoints that expose student data.

Keep content guidelines simple and visible. Kids read them when they’re short.

Tech (at a glance)

Next.js (App Router), TypeScript, Tailwind

Supabase for Auth, Database, and Realtime

shadcn/ui and lucide icons for a tidy interface

Getting started (super short)

Add your Supabase URL and anon key to .env.local.

Install dependencies and run the dev server.

Use the “Request Invite” page to submit an email, approve it in the DB, then sign up and try the chat.

If you need a step-by-step setup later, we can add one. For now, this should keep the readme light.

Roadmap

Class-specific rooms (instead of one global chat)

Teacher tools (pin, mute, remove)

Simple video uploads (start with MP4 via storage; move to adaptive streaming later)

Moderation logs and content flags

Contributing

Keep changes small and easy to review. Name things clearly. Prefer boring, reliable solutions over clever ones that need a manual.
