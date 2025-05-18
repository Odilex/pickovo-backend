# Pickovo Backend

This is the backend server for the Pickovo car repair service application. It provides RESTful API endpoints for the Pickovo mobile and web applications.

## Tech Stack

- **Next.js**: Server-side rendering and API routes
- **TypeScript**: Type safety and better developer experience
- **Supabase**: PostgreSQL database, authentication, storage, and realtime features

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account (for database and authentication)

### Setup Instructions

1. **Clone the repository**

```bash
git clone <repository-url>
cd pickovo-backend
```

2. **Install dependencies**

```bash
npm install
# or
yarn install
```

3. **Set up environment variables**

Create a `.env.local` file in the root directory with the following variables:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Set up Supabase**

- Create a new project in Supabase
- Go to SQL Editor and run the SQL script in `supabase/schema.sql` to create all necessary tables and policies
- Set up authentication providers in Supabase dashboard

5. **Run the development server**

```bash
npm run dev
# or
yarn dev
```

The server will start at [http://localhost:3000](http://localhost:3000).

## API Endpoints

### Authentication

- `GET /api/auth/user` - Get authenticated user info

### Bookings

- `GET /api/bookings` - List all bookings for the authenticated user
- `POST /api/bookings` - Create a new booking

### Mechanics

- `GET /api/mechanics` - List available mechanics

### Vehicles

- `GET /api/vehicles` - List vehicles for the authenticated user
- `POST /api/vehicles` - Add a new vehicle

### Wallet

- `GET /api/wallet` - Get wallet balance and transaction history
- `POST /api/wallet` - Add or deduct wallet balance

### Messages

- `GET /api/messages` - List messages for a booking
- `POST /api/messages` - Send a message

### Notifications

- `GET /api/notifications` - List notifications for the authenticated user
- `POST /api/notifications` - Add a notification
- `PATCH /api/notifications` - Mark notifications as read

## Authentication

All API endpoints (except public ones) require authentication using a JWT token. The token should be included in the `Authorization` header as a Bearer token:

```
Authorization: Bearer <jwt_token>
```

The JWT token is issued by Supabase Auth when a user signs in.

## Deployment

This backend is designed to be deployed on Vercel. Follow these steps to deploy:

1. Push your code to a GitHub repository
2. Connect your repository to Vercel
3. Set up the environment variables in Vercel dashboard
4. Deploy the application

## License

[MIT](LICENSE)
