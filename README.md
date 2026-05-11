# IT Asset Management - Backend API

The backend for the IT Asset Management Service, built with Node.js, Express, and Prisma.

## Prerequisites

- **Node.js**: v18.x or v20.x (LTS recommended)
- **PostgreSQL**: A running instance (Supabase is recommended for easy setup)
- **npm**: v9 or later

## Environment Variables

Create a `.env.local` file in the root directory based on `.env.example`:

| Variable | Description |
| :--- | :--- |
| `PORT` | The port the server will listen on (default: `5000`). |
| `FRONTEND_URL` | The URL of the frontend application for CORS (e.g., `http://localhost:3000`). |
| `JWT_SECRET` | A secure random string used to sign authentication tokens. |
| `DATABASE_URL` | PostgreSQL connection string with pooling (e.g., `...&pgbouncer=true`). |
| `DIRECT_URL` | Direct PostgreSQL connection string for database migrations. |

## Getting Started

1.  **Clone the repository**:
    ```bash
    git clone <repository-url>
    cd itam-backend
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Set up environment**:
    Copy `.env.example` to `.env.local` and fill in your database credentials and secret.

4.  **Run database migrations**:
    Apply the schema to your PostgreSQL instance:
    ```bash
    npx prisma migrate deploy
    ```

5.  **Seed the database**:
    Populate the database with initial users and assets:
    ```bash
    npx prisma db seed
    ```

6.  **Start the development server**:
    ```bash
    npm run dev
    ```
    The API will be available at `http://localhost:5000/api`.

## API Endpoints

| Method | Path | Required Role | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/login` | Public | Authenticate a user and return a JWT token. |
| GET | `/api/users` | `ADMIN` | List all user accounts. |
| POST | `/api/users` | `ADMIN` | Create a new user account. |
| PATCH | `/api/users/:id` | `ADMIN` | Update an existing user (name, email, role, status). |
| DELETE | `/api/users/:id` | `ADMIN` | Remove a user account. |
| GET | `/api/assets` | `ADMIN`, `IT_MANAGER`, `IT_STAFF` | List assets with search and filtering. |
| POST | `/api/assets` | `IT_MANAGER` | Add a new asset to the catalogue. |
| GET | `/api/assets/:id` | `ADMIN`, `IT_MANAGER`, `IT_STAFF` | Get details and history for a specific asset. |
| PATCH | `/api/assets/:id` | `IT_MANAGER` | Update asset details. |
| DELETE | `/api/assets/:id` | `IT_MANAGER` | Remove an asset. |
| GET | `/api/assignments` | `ADMIN`, `IT_MANAGER`, `IT_STAFF` | List assignment history. |
| POST | `/api/assignments` | `IT_MANAGER`, `IT_STAFF` | Assign an asset to a user. |
| POST | `/api/assignments/:id/return` | `IT_MANAGER`, `IT_STAFF` | Record the return of an asset. |
| GET | `/api/audit` | `IT_MANAGER` | View the full audit trail of system changes. |
