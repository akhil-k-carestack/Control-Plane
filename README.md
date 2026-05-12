# Telecom Operations Control Plane

A modern Next.js application for managing telecom operations.

## Features

- **Dark Mode Slate Theme**: Professional dark UI with slate-950 background, slate-900 cards, and blue-500 primary color
- **Ops region**: Single region code for legacy `/api/v1/[region]/…` calls (configurable via env)
- **NextAuth.js Authentication**: Secure credential-based login system
- **Three Main Operations** (legacy `/api/v1` routes return **410 Gone** until a new backend is wired in):
  - **RabbitMQ Queue Management**: Push messages to queues with sample payloads
  - **Sync Status Checking**: Check synchronization status for Practice, Location, Device, and All Bifrost
  - **Numbers Lookup**: Find numbers not in Bifrost with CSV export functionality

## Tech Stack

- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Authentication**: NextAuth.js
- **Form Validation**: react-hook-form + zod
- **Notifications**: sonner
- **Icons**: lucide-react

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file (copy from `.env.example`):

```bash
cp .env.example .env.local
```

4. Configure environment variables (see `.env.example` for database, Simwood, Firestore app logs, etc.):

```env
NEXTAUTH_SECRET=your-secret-key-change-in-production
NEXTAUTH_URL=http://localhost:3000
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Default Login

The application uses NextAuth.js with credentials provider. For demo purposes, any username/password combination will work. In production, update the `authorize` function in `lib/auth.ts` to integrate with your authentication system.

## Ops region

Set **`OPS_REGION`** (server) and **`NEXT_PUBLIC_OPS_REGION`** (client bundle, same value) if the default `AU-VOICESTACK` is not correct. Display names for known codes are in `lib/regions.ts`.

## Project Structure

```
control-plane/
├── app/
│   ├── (auth)/              # Authentication routes
│   ├── (dashboard)/         # Protected dashboard routes
│   ├── api/
│   │   ├── auth/            # NextAuth API routes
│   │   ├── v1/[region]/     # Legacy region ops (410 until replaced)
│   │   └── regions/         # Regions API
│   └── layout.tsx
├── components/
├── lib/
│   ├── ops-backend-removed.ts  # Shared 410 response for retired ops routes
│   ├── regions.ts
│   └── ...
├── types/
│   └── ops-api.ts           # Types for legacy ops UI/API shapes
└── middleware.ts
```

## API Routes

### Region operations (`/api/v1/[region]/…`)

These routes enforce auth/permissions and region validation, then return **410 Gone** with a JSON `error` message. Replace the handler bodies when you connect a new HTTP or other backend.

### Regions

- `GET /api/regions` - Returns the single configured ops region (`code` / `name`)

## Development

### Build

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Lint

```bash
npm run lint
```

## Features in Detail

### Confirmation Dialogs

Operations that support confirmations may display context (for example the ops region) before execution.

### Form Validation

Forms use `react-hook-form` with `zod` schemas where applicable.

### Loading States

Operations show loading states during API calls.

### Error Handling

Failed API calls surface user-friendly messages (toasts or inline) depending on the page.

## License

Private - Internal Use Only
