# NiAngelos Platform

**School for Hymns and Praises - Digital Platform**

A modern, scalable Education Management System (EMS) and Learning Management System (LMS) for Coptic Orthodox hymn education.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ 
- PostgreSQL 15/16
- Redis 7+
- Docker & Docker Compose (optional)

### Development Setup

#### 1. Clone and Install

```bash
# Install dependencies
npm install

# Setup backend
cd backend
cp .env.example .env
npm install

# Setup frontend
cd ../frontend
npm install
```

#### 2. Start Database Services

```bash
# Using Docker
docker-compose up -d postgres redis meilisearch

# Or use local PostgreSQL and Redis
```

#### 3. Setup Database

```bash
cd backend

# Run migrations
npx prisma migrate dev

# Seed database
npx prisma db seed

# Generate Prisma Client
npx prisma generate
```

#### 4. Start Development Servers

```bash
# From root directory
npm run dev

# Or start separately
npm run dev:backend  # API on port 3001
npm run dev:frontend # App on port 3000
```

### Docker Setup

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📁 Project Structure

```
niangelos-platform/
├── backend/                    # NestJS API
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication
│   │   │   ├── users/         # User management
│   │   │   ├── students/      # Student management
│   │   │   ├── curriculum/    # Curriculum management
│   │   │   ├── attendance/    # Attendance tracking
│   │   │   ├── assessments/   # Assessment system
│   │   │   ├── progress/      # Progress tracking
│   │   │   ├── gamification/  # Gamification
│   │   │   ├── notifications/ # Notifications
│   │   │   ├── reports/       # Reports
│   │   │   ├── search/        # Search
│   │   │   └── admin/         # Administration
│   │   ├── common/            # Shared utilities
│   │   └── database/          # Prisma setup
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── Dockerfile
│
├── frontend/                   # Next.js App
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   ├── components/        # React components
│   │   │   ├── ui/            # UI primitives
│   │   │   └── layout/        # Layout components
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utilities
│   │   └── styles/            # Global styles
│   └── Dockerfile
│
├── docs/                       # Documentation
│   └── phases/                # Design phases
├── docker-compose.yml          # Docker setup
└── package.json                # Root package.json
```

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 20
- **Framework:** NestJS 10
- **Database:** PostgreSQL 15/16
- **ORM:** Prisma 5
- **Cache:** Redis 7
- **Search:** Meilisearch
- **Auth:** JWT + Passport

### Frontend
- **Framework:** Next.js 15 (App Router)
- **UI:** shadcn/ui + Tailwind CSS
- **State:** React Server Components
- **Icons:** Lucide React

### Infrastructure
- **Container:** Docker
- **Orchestration:** Docker Compose
- **CI/CD:** GitHub Actions

## 📚 API Documentation

Once running, visit: `http://localhost:3001/api/docs`

## 🔐 Authentication

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "Test",
    "lastName": "User",
    "schoolId": "your-school-id"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "schoolId": "your-school-id"
  }'
```

## 🧪 Testing

```bash
# Backend tests
cd backend
npm run test        # Unit tests
npm run test:e2e    # E2E tests
npm run test:cov    # Coverage

# Frontend tests
cd frontend
npm run test
```

## 📦 Deployment

See [Deployment Guide](./DEPLOY.md)

## 🤝 Contributing

See [Brand & Design Guide](./BRAND.md)

## 📄 License

Proprietary - NiAngelos School for Hymns and Praises
