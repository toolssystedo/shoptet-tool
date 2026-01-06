# Shoptet Tool - Next.js 14+ Application

A modern web application built with Next.js 14+, TypeScript, Tailwind CSS, Shadcn/ui, NextAuth.js v5, and Prisma.

## Features

- **Next.js 14+** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **NextAuth.js v5** for authentication
- **Prisma** ORM for database management
- **Dark mode** support with next-themes
- **Form validation** with react-hook-form and Zod

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database (or another Prisma-supported database)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your environment variables:
```bash
cp .env.example .env
```

3. Set up the database:
```bash
npm run prisma:db:push
# or for migrations
npm run prisma:migrate:dev
```

4. Generate Prisma client:
```bash
npm run prisma:generate
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Structure

```
app/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   └── theme-provider.tsx # Theme provider
├── lib/                   # Utility functions and configurations
│   ├── auth.ts           # NextAuth.js configuration
│   ├── prisma.ts         # Prisma client
│   └── utils.ts          # Utility functions
├── prisma/               # Prisma schema and migrations
│   └── schema.prisma     # Database schema
└── types/                # TypeScript type definitions
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:db:push` - Push schema changes to database
- `npm run prisma:migrate:dev` - Create and apply migrations
- `npm run prisma:studio` - Open Prisma Studio

## Environment Variables

See `.env.example` for all required environment variables.

## Authentication

This project uses NextAuth.js v5 with support for:
- Credentials-based authentication
- OAuth providers (Google, GitHub)
- Database sessions with Prisma adapter

## Database

The project uses Prisma ORM with PostgreSQL by default. You can change the database provider in `prisma/schema.prisma`.

## Styling

- Tailwind CSS for utility-first styling
- Shadcn/ui for pre-built components
- CSS variables for theming
- Dark mode support

## License

MIT