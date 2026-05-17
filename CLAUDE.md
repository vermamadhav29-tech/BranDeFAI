# BranDeFAI — AI Marketing Platform

## What This Is
BranDeFAI is an AI-powered marketing SaaS platform where users set up their brand, generate content (captions, reels, ad copy, images, videos), and auto-schedule everything into a 30-day content calendar. It also auto-posts content to Instagram via the Instagram Graph API.

## Tech Stack
FRONTEND: Next.js 14 (App Router), TypeScript, Tailwind CSS
State: Zustand, Server data: React Query (TanStack Query)
Forms: React Hook Form + Zod, Drag-drop: dnd-kit

BACKEND: Node.js, Express.js, TypeScript
ORM: Prisma, Queue: BullMQ (on Redis)

DATABASE: PostgreSQL (primary), Redis (cache + queue)
STORAGE: Cloudinary (images), AWS S3 (videos)
AI: OpenAI GPT-4o (text + vision), DALL-E 3 (images), Runway ML Gen-3 (video clips)
PAYMENTS: Razorpay
SOCIAL: Instagram Graph API (auto-posting)
HOSTING: Vercel (frontend), Railway (backend + DB + Redis)

## Folder Structure
/frontend — Next.js app (deployed to Vercel)
/backend — Express API (deployed to Railway)
/shared — Shared TypeScript type

## Critical Rules
1. All API responses: { success: boolean, data: any, error: string|null }
2. All DB queries go through Prisma — NEVER raw SQL
3. All AI calls are in /backend/src/services/ai/
4. All env vars via process.env.VAR_NAME — never hardcode
5. All routes have Zod validation middleware before the controller
6. Credits are deducted ONLY on successful AI response
7. Instagram posting uses Instagram Graph API v18+

## Design
White base (#FFFFFF), Green accent (#1A7A4A), Navy headings (#1A2E44)
Font: Inter or Plus Jakarta Sans
Style: Clean SaaS — cards, left sidebar, minimal decoration
