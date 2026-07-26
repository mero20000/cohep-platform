# Phase 5 – Solution Architecture

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Cloud Architecture](#4-cloud-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Frontend Architecture](#6-frontend-architecture)
7. [API Design](#7-api-design)
8. [Security Model](#8-security-model)
9. [Deployment Strategy](#9-deployment-strategy)
10. [Scalability](#10-scalability)
11. [Backup & Disaster Recovery](#11-backup--disaster-recovery)
12. [Monitoring & Observability](#12-monitoring--observability)
13. [Assumptions](#13-assumptions)
14. [Recommendations](#14-recommendations)
15. [Risks](#15-risks)
16. [Approval Gate](#16-approval-gate)

---

## 1. Architecture Overview

### 1.1 Architecture Principles

| Principle | Description |
|-----------|-------------|
| **Cloud-Native** | Designed for cloud deployment with containerization |
| **Microservices-Ready** | Modular monolith that can evolve to microservices |
| **API-First** | All features accessible via well-defined APIs |
| **Event-Driven** | Asynchronous communication for decoupled components |
| **Security by Design** | Zero-trust architecture with defense in depth |
| **Infrastructure as Code** | All infrastructure defined in code (Terraform/Pulumi) |
| **Observable** | Comprehensive logging, monitoring, and tracing |
| **Disposable** | Services can be replaced without system impact |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NIANGELOS PLATFORM ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   CDN       │
                                    │ (CloudFront)│
                                    └──────┬──────┘
                                           │
                                    ┌──────┴──────┐
                                    │  WAF/ACL    │
                                    └──────┬──────┘
                                           │
                              ┌────────────┴────────────┐
                              │                         │
                              ▼                         ▼
                    ┌─────────────────┐       ┌─────────────────┐
                    │   API Gateway   │       │  Static Assets  │
                    │  (Kong/AWS AGW) │       │   (S3 + CDN)    │
                    └────────┬────────┘       └─────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Load Balancer │
                    │   (ALB/NLB)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  Web App │  │  Web App │  │  Web App │
        │ (Node.js)│  │ (Node.js)│  │ (Node.js)│
        │  Pod 1   │  │  Pod 2   │  │  Pod 3   │
        └────┬─────┘  └────┬─────┘  └────┬─────┘
             │              │              │
             └──────────────┼──────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ PostgreSQL│  │  Redis   │  │  S3/MinIO│
        │  Primary  │  │  Cache   │  │  Storage │
        └──────────┘  └──────────┘  └──────────┘
```

---

## 2. Technology Stack

### 2.1 Stack Overview

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend** | Next.js 15 + React 19 | SSR/SSG, App Router, React Server Components |
| **UI Framework** | Tailwind CSS + shadcn/ui | Utility-first CSS, accessible components |
| **State Management** | TanStack Query | Server state caching, optimistic updates |
| **Backend Runtime** | Node.js 22 LTS | JavaScript ecosystem, async I/O |
| **Backend Framework** | NestJS | Enterprise patterns, TypeScript, modular |
| **ORM** | Prisma | Type-safe queries, migrations, schema |
| **Database** | PostgreSQL 16 | JSONB, RLS, mature, scalable |
| **Cache** | Redis 7 | Session, cache, pub/sub, queues |
| **Object Storage** | AWS S3 / MinIO | Media files, backups, documents |
| **Search** | Meilisearch | Fast, typo-tolerant, multi-language |
| **Queue** | BullMQ (Redis) | Job processing, notifications |
| **Authentication** | NextAuth.js v5 | Multiple providers, JWT, sessions |
| **Email** | AWS SES / Resend | Transactional emails |
| **SMS** | Twilio / AWS SNS | OTP, notifications |
| **Push Notifications** | Firebase Cloud Messaging | Mobile push |
| **Analytics** | PostHog / Plausible | Product analytics |
| **Monitoring** | Grafana + Prometheus | Metrics, dashboards |
| **Logging** | Loki / ELK Stack | Centralized logging |
| **Tracing** | OpenTelemetry | Distributed tracing |
| **CI/CD** | GitHub Actions | Automated pipelines |
| **Containerization** | Docker + Docker Compose | Local development |
| **Orchestration** | Kubernetes (EKS/GKE) | Production deployment |
| **Infrastructure** | Terraform | Infrastructure as code |
| **CDN** | CloudFront / Cloudflare | Global content delivery |

### 2.2 Technology Justification

#### Frontend: Next.js 15

| Feature | Benefit |
|---------|---------|
| App Router | File-based routing, layouts, loading states |
| React Server Components | Reduced client JS, faster initial load |
| Server Actions | Form handling without API routes |
| ISR/SSG | Static generation for public pages |
| Image Optimization | Automatic WebP, lazy loading |
| Built-in Optimization | Font optimization, script loading |
| Middleware | Auth checks, redirects at edge |

#### Backend: NestJS

| Feature | Benefit |
|---------|---------|
| TypeScript | End-to-end type safety |
| Dependency Injection | Testable, maintainable code |
| Modules | Clean separation of concerns |
| Guards | Auth/permission enforcement |
| Interceptors | Cross-cutting concerns (logging, caching) |
| Pipes | Input validation and transformation |
| WebSockets | Real-time notifications |

#### Database: PostgreSQL

| Feature | Benefit |
|---------|---------|
| JSONB | Flexible metadata, localized content |
| Row-Level Security | Multi-tenant data isolation |
| Full-Text Search | Coptic/Arabic/English search |
| Materialized Views | Dashboard aggregations |
| Partitioning | Large table management |
| Extensions | UUID, pg_trgm, fuzzystrmatch |

---

## 3. System Architecture

### 3.1 Application Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  Web Browser (Desktop)  │  Web Browser (Mobile)  │  PWA        │
└─────────────────────────┴────────────────────────┴─────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┤
│                        EDGE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  CDN (CloudFront)  │  WAF  │  DDoS Protection  │  SSL/TLS     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┤
│                      GATEWAY LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  API Gateway  │  Rate Limiting  │  Request Validation          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Auth   │ │Student  │ │Curricu- │ │Attend-  │ │Assess-  │ │
│  │ Module  │ │ Module  │ │lum Mod  │ │ance Mod │ │ment Mod │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │Progress │ │Gamefi-  │ │Notifi-  │ │Messag-  │ │Reports  │ │
│  │ Module  │ │cation   │ │cation   │ │ing Mod  │ │ Module  │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Primary)  │  Redis (Cache)  │  S3 (Storage)       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┤
│                    INTEGRATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Email (SES)  │  SMS (Twilio)  │  Push (FCM)  │  Webhooks     │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Module Breakdown

| Module | Responsibilities | Dependencies |
|--------|------------------|--------------|
| **Auth** | Registration, login, sessions, roles, permissions | User, School |
| **Student** | Profile CRUD, search, documents, medical notes | User, School, Level, Group |
| **Curriculum** | Levels, groups, subjects, lessons, sessions, resources | School |
| **Attendance** | Sessions, records, analytics | Student, Lesson, User |
| **Assessment** | Exams, submissions, grading, rubrics | Student, Lesson, Level |
| **Progress** | Tracking, promotion, dashboards | Student, Lesson, Assessment |
| **Gamification** | XP, badges, certificates, streaks | Student, Achievement |
| **Notification** | Push, email, SMS, in-app | User, School |
| **Messaging** | Direct messages, conversations | User, School |
| **Reports** | Analytics, exports, dashboards | All modules |
| **Search** | Global search, filters | All modules |
| **Admin** | Church, school, user, system config | School |

---

## 4. Cloud Architecture

### 4.1 AWS Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           AWS CLOUD ARCHITECTURE                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │   Route 53      │
                              │   (DNS)         │
                              └────────┬────────┘
                                       │
                              ┌────────┴────────┐
                              │   CloudFront    │
                              │   (CDN)         │
                              └────────┬────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
              ┌──────────┐      ┌──────────┐      ┌──────────┐
              │ S3 Bucket│      │ ALB      │      │ WAF      │
              │ (Static) │      │(Load Bal)│      │          │
              └──────────┘      └────┬─────┘      └──────────┘
                                     │
                              ┌──────┴──────┐
                              │  ECS/EKS    │
                              │ (Container) │
                              └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │ RDS      │    │ ElastiCache│   │ S3       │
              │(Postgres)│    │ (Redis)   │    │ (Media)  │
              └──────────┘    └──────────┘    └──────────┘
                    │
              ┌─────┴─────┐
              │           │
              ▼           ▼
        ┌──────────┐ ┌──────────┐
        │ Read     │ │ Backup   │
        │ Replica  │ │ (S3)     │
        └──────────┘ └──────────┘
```

### 4.2 Service Specifications

| Service | Configuration | Purpose |
|---------|---------------|---------|
| **EKS Cluster** | 3 nodes, t3.medium | Container orchestration |
| **RDS PostgreSQL** | db.r6g.large, Multi-AZ | Primary database |
| **ElastiCache Redis** | cache.r6g.large, cluster mode | Caching, sessions, queues |
| **S3** | Standard + Intelligent-Tiering | Media storage |
| **CloudFront** | Global edge locations | CDN |
| **ALB** | Application Load Balancer | Traffic distribution |
| **WAF** | OWASP rules, rate limiting | Security |
| **Route 53** | Health checks, failover | DNS |
| **SES** | Verified senders | Email delivery |
| **FCM** | Server key | Push notifications |

### 4.3 Cost Estimation (Monthly)

| Service | Configuration | Est. Cost |
|---------|---------------|-----------|
| EKS | 3x t3.medium | $150 |
| RDS | db.r6g.large Multi-AZ | $400 |
| ElastiCache | cache.r6g.large | $200 |
| S3 | 100GB + requests | $25 |
| CloudFront | 1TB transfer | $85 |
| ALB | LCU hours | $50 |
| WAF | Web ACL + rules | $30 |
| Route 53 | Hosted zone | $5 |
| SES | 10K emails | $5 |
| **TOTAL** | | **~$950/mo** |

*Note: Costs scale with usage. Initial MVP can start with smaller instances (~$400/mo).*

---

## 5. Backend Architecture

### 5.1 NestJS Module Structure

```
src/
├── app.module.ts                    # Root module
├── main.ts                          # Application entry
│
├── modules/
│   ├── auth/                        # Authentication module
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   ├── local.strategy.ts
│   │   │   └── google.strategy.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── permissions.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   └── dto/
│   │       ├── login.dto.ts
│   │       └── register.dto.ts
│   │
│   ├── users/                       # User management
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   │   ├── user.entity.ts
│   │   │   └── role.entity.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   ├── students/                    # Student management
│   │   ├── students.module.ts
│   │   ├── students.controller.ts
│   │   ├── students.service.ts
│   │   ├── entities/
│   │   │   ├── student.entity.ts
│   │   │   └── student-profile.entity.ts
│   │   └── dto/
│   │
│   ├── curriculum/                  # Curriculum management
│   │   ├── curriculum.module.ts
│   │   ├── levels/
│   │   │   ├── levels.controller.ts
│   │   │   ├── levels.service.ts
│   │   │   └── entities/
│   │   ├── groups/
│   │   ├── subjects/
│   │   ├── lessons/
│   │   ├── sessions/
│   │   └── resources/
│   │
│   ├── attendance/                  # Attendance tracking
│   │   ├── attendance.module.ts
│   │   ├── attendance.controller.ts
│   │   ├── attendance.service.ts
│   │   └── entities/
│   │
│   ├── assessments/                 # Assessment system
│   │   ├── assessments.module.ts
│   │   ├── assessments.controller.ts
│   │   ├── assessments.service.ts
│   │   ├── grading/
│   │   └── entities/
│   │
│   ├── progress/                    # Progress tracking
│   │   ├── progress.module.ts
│   │   ├── progress.controller.ts
│   │   ├── progress.service.ts
│   │   └── entities/
│   │
│   ├── gamification/                # Gamification system
│   │   ├── gamification.module.ts
│   │   ├── gamification.controller.ts
│   │   ├── gamification.service.ts
│   │   ├── xp/
│   │   ├── badges/
│   │   ├── certificates/
│   │   └── entities/
│   │
│   ├── notifications/               # Notification system
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts
│   │   ├── channels/
│   │   │   ├── email.channel.ts
│   │   │   ├── push.channel.ts
│   │   │   ├── sms.channel.ts
│   │   │   └── in-app.channel.ts
│   │   └── entities/
│   │
│   ├── messaging/                   # Direct messaging
│   │   ├── messaging.module.ts
│   │   ├── messaging.controller.ts
│   │   ├── messaging.service.ts
│   │   └── entities/
│   │
│   ├── reports/                     # Report generation
│   │   ├── reports.module.ts
│   │   ├── reports.controller.ts
│   │   ├── reports.service.ts
│   │   ├── generators/
│   │   │   ├── pdf.generator.ts
│   │   │   └── excel.generator.ts
│   │   └── templates/
│   │
│   ├── search/                      # Global search
│   │   ├── search.module.ts
│   │   ├── search.controller.ts
│   │   ├── search.service.ts
│   │   └── indices/
│   │
│   └── admin/                       # Administration
│       ├── admin.module.ts
│       ├── admin.controller.ts
│       ├── admin.service.ts
│       ├── churches/
│       ├── schools/
│       └── system/
│
├── common/                          # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   └── utils/
│
├── config/                          # Configuration
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── storage.config.ts
│
└── database/                        # Database
    ├── migrations/
    ├── seeds/
    └── prisma/
        └── schema.prisma
```

### 5.2 Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     REQUEST FLOW DIAGRAM                         │
└─────────────────────────────────────────────────────────────────┘

Client Request
      │
      ▼
┌─────────────────┐
│ Global Middleware│ → Helmet, CORS, Compression, Request ID
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Rate Limiter    │ → Throttle per IP/user
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Auth Guard      │ → JWT validation, session check
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Role Guard      │ → Role-based access control
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Permission Guard│ → Fine-grained permissions
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tenant Guard    │ → Multi-tenant context
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Validation Pipe │ → DTO validation, sanitization
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Controller      │ → Route handler
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Service         │ → Business logic
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Repository      │ → Data access (Prisma)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Interceptor     │ → Response transformation, caching
└────────┬────────┘
         │
         ▼
Client Response
```

---

## 6. Frontend Architecture

### 6.1 Next.js App Structure

```
frontend/
├── app/                              # App Router
│   ├── (auth)/                       # Auth pages (public)
│   │   ├── login/
│   │   ├── register/
│   │   └── forgot-password/
│   │
│   ├── (dashboard)/                  # Dashboard pages (protected)
│   │   ├── dashboard/
│   │   │   ├── student/
│   │   │   ├── parent/
│   │   │   ├── servant/
│   │   │   └── principal/
│   │   │
│   │   ├── students/
│   │   │   ├── page.tsx              # Student list
│   │   │   └── [id]/
│   │   │       ├── page.tsx          # Student profile
│   │   │       ├── attendance/
│   │   │       ├── assessments/
│   │   │       └── progress/
│   │   │
│   │   ├── curriculum/
│   │   │   ├── page.tsx
│   │   │   ├── levels/
│   │   │   ├── lessons/
│   │   │   └── resources/
│   │   │
│   │   ├── attendance/
│   │   │   ├── mark/
│   │   │   ├── history/
│   │   │   └── analytics/
│   │   │
│   │   ├── assessments/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   ├── new/
│   │   │   └── grade/
│   │   │
│   │   ├── progress/
│   │   ├── gamification/
│   │   ├── notifications/
│   │   ├── messages/
│   │   ├── reports/
│   │   └── settings/
│   │
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Landing page
│   └── not-found.tsx
│
├── components/                       # Reusable components
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── ...
│   │
│   ├── layout/                       # Layout components
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   ├── mobile-nav.tsx
│   │   └── breadcrumbs.tsx
│   │
│   ├── dashboard/                    # Dashboard widgets
│   │   ├── stat-card.tsx
│   │   ├── progress-chart.tsx
│   │   ├── attendance-chart.tsx
│   │   └── recent-activity.tsx
│   │
│   ├── students/                     # Student components
│   │   ├── student-card.tsx
│   │   ├── student-list.tsx
│   │   └── student-profile.tsx
│   │
│   ├── curriculum/                   # Curriculum components
│   │   ├── lesson-card.tsx
│   │   ├── resource-viewer.tsx
│   │   └── audio-player.tsx
│   │
│   ├── attendance/                   # Attendance components
│   │   ├── attendance-grid.tsx
│   │   └── attendance-calendar.tsx
│   │
│   └── shared/                       # Shared components
│       ├── data-table.tsx
│       ├── search-command.tsx
│       ├── notification-bell.tsx
│       ├── language-toggle.tsx
│       └── avatar.tsx
│
├── hooks/                            # Custom hooks
│   ├── use-auth.ts
│   ├── use-students.ts
│   ├── use-curriculum.ts
│   ├── use-attendance.ts
│   └── use-search.ts
│
├── lib/                              # Utilities
│   ├── api.ts                        # API client
│   ├── auth.ts                       # Auth utilities
│   ├── i18n.ts                       # Internationalization
│   ├── utils.ts                      # General utilities
│   └── validators.ts                 # Zod schemas
│
├── stores/                           # State management
│   ├── auth-store.ts
│   └── ui-store.ts
│
├── styles/                           # Global styles
│   ├── globals.css
│   └── fonts.css
│
└── public/                           # Static assets
    ├── icons/
    ├── images/
    └── fonts/
```

### 6.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT ARCHITECTURE                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     LAYOUT COMPONENTS                            │
│  RootLayout → AuthLayout → DashboardLayout → PageLayout         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PAGE COMPONENTS                              │
│  Server Components (data fetching)                              │
│  Client Components (interactivity)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FEATURE COMPONENTS                           │
│  StudentList, AttendanceGrid, CurriculumBrowser, etc.           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     UI COMPONENTS (shadcn/ui)                    │
│  Button, Card, Dialog, Input, Select, Table, etc.               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. API Design

### 7.1 REST API Conventions

| Method | Action | Example |
|--------|--------|---------|
| GET | List resources | `GET /api/students?level=3&group=2` |
| GET | Get single resource | `GET /api/students/:id` |
| POST | Create resource | `POST /api/students` |
| PATCH | Update resource | `PATCH /api/students/:id` |
| DELETE | Delete resource | `DELETE /api/students/:id` |
| POST | Action on resource | `POST /api/attendance/mark` |

### 7.2 API Response Format

```typescript
// Success Response
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Malak",
    // ... resource data
  },
  "meta": {
    "requestId": "req_uuid",
    "timestamp": "2026-07-13T10:00:00Z"
  }
}

// Paginated Response
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}

// Error Response
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "requestId": "req_uuid",
    "timestamp": "2026-07-13T10:00:00Z"
  }
}
```

### 7.3 API Endpoints (Selected)

```
# Authentication
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/verify-email
GET    /api/auth/me

# Students
GET    /api/students
POST   /api/students
GET    /api/students/:id
PATCH  /api/students/:id
DELETE /api/students/:id
GET    /api/students/:id/attendance
GET    /api/students/:id/assessments
GET    /api/students/:id/progress
POST   /api/students/:id/documents

# Curriculum
GET    /api/levels
POST   /api/levels
GET    /api/levels/:id
PATCH  /api/levels/:id
GET    /api/levels/:id/groups
GET    /api/levels/:id/subjects
GET    /api/subjects
GET    /api/lessons
POST   /api/lessons
GET    /api/lessons/:id
PATCH  /api/lessons/:id
POST   /api/lessons/:id/publish

# Attendance
POST   /api/attendance/mark
GET    /api/attendance/sessions
GET    /api/attendance/sessions/:id
GET    /api/attendance/history
GET    /api/attendance/analytics

# Assessments
GET    /api/assessments
POST   /api/assessments
GET    /api/assessments/:id
PATCH  /api/assessments/:id
POST   /api/assessments/:id/submit
GET    /api/assessments/:id/submissions
POST   /api/assessments/:id/grade

# Progress
GET    /api/progress/student/:id
GET    /api/progress/class/:id
GET    /api/progress/level/:id
POST   /api/progress/promote

# Gamification
GET    /api/gamification/badges
GET    /api/gamification/student/:id/badges
GET    /api/gamification/leaderboard
GET    /api/gamification/certificates
POST   /api/gamification/certificates/generate

# Notifications
GET    /api/notifications
PATCH  /api/notifications/:id/read
POST   /api/notifications/read-all
GET    /api/notifications/settings
PATCH  /api/notifications/settings

# Messages
GET    /api/messages
POST   /api/messages
GET    /api/messages/:id
POST   /api/messages/:id/reply

# Reports
GET    /api/reports/attendance
GET    /api/reports/progress
GET    /api/reports/assessments
GET    /api/reports/export/:type

# Search
GET    /api/search?q=term&type=student

# Admin
GET    /api/admin/churches
POST   /api/admin/churches
GET    /api/admin/schools
POST   /api/admin/schools
GET    /api/admin/audit-logs
GET    /api/admin/monitoring
```

---

## 8. Security Model

### 8.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                           │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│  Client  │      │  API     │      │  Auth    │      │ Database │
└────┬─────┘      └────┬─────┘      └────┬─────┘      └────┬─────┘
     │                 │                 │                 │
     │  POST /login    │                 │                 │
     │────────────────>│                 │                 │
     │                 │  Validate       │                 │
     │                 │  credentials    │                 │
     │                 │────────────────>│                 │
     │                 │                 │  Query user     │
     │                 │                 │────────────────>│
     │                 │                 │  User data      │
     │                 │                 │<────────────────│
     │                 │                 │                 │
     │                 │                 │  Verify bcrypt  │
     │                 │                 │  hash           │
     │                 │                 │                 │
     │                 │                 │  Generate JWT   │
     │                 │  Access Token   │  (15min)        │
     │  Set cookies    │  Refresh Token  │                 │
     │<────────────────│  (7 days)       │                 │
     │                 │<────────────────│                 │
     │                 │                 │                 │
     │  API Request    │                 │                 │
     │  + JWT Cookie   │                 │                 │
     │────────────────>│                 │                 │
     │                 │  Verify JWT     │                 │
     │                 │────────────────>│                 │
     │                 │                 │  Valid?         │
     │                 │  Response       │                 │
     │<────────────────│<────────────────│                 │
     │                 │                 │                 │
```

### 8.2 Authorization Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHORIZATION MODEL                           │
└─────────────────────────────────────────────────────────────────┘

User
  │
  ├── Has many Roles (via UserRole)
  │     │
  │     ├── Role: "Servant"
  │     │     │
  │     │     └── Has many Permissions
  │     │           ├── students.read
  │     │           ├── attendance.create
  │     │           ├── assessments.read
  │     │           └── ...
  │     │
  │     └── Role: "Parent"
  │           │
  │           └── Has many Permissions
  │                 ├── students.read (own children)
  │                 ├── progress.read (own children)
  │                 └── ...
  │
  └── Tenant Context (school_id)
        │
        └── Row-Level Security
              └── All queries filtered by school_id
```

### 8.3 Security Measures

| Layer | Measure |
|-------|---------|
| **Transport** | TLS 1.3, HSTS, Certificate pinning |
| **Edge** | WAF, DDoS protection, Rate limiting |
| **Authentication** | JWT + Refresh tokens, bcrypt password hashing |
| **Authorization** | RBAC + Row-Level Security |
| **Input** | Validation (class-validator), Sanitization (DOMPurify) |
| **Output** | Response filtering, No sensitive data exposure |
| **Storage** | AES-256 encryption at rest, S3 bucket policies |
| **Database** | RLS policies, Encrypted connections, Audit logging |
| **Logging** | No sensitive data in logs, Structured logging |
| **Dependencies** | Automated vulnerability scanning (Snyk/Dependabot) |
| **CI/CD** | Secret scanning, SAST/DAST in pipeline |

---

## 9. Deployment Strategy

### 9.1 CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      CI/CD PIPELINE                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Push to │    │  Build   │    │  Test    │    │  Deploy  │
│  Branch  │───▶│  Stage   │───▶│  Stage   │───▶│  Stage   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │              │              │
                     ▼              ▼              ▼
                ┌─────────┐   ┌─────────┐   ┌─────────┐
                │ Lint    │   │ Unit    │   │ Staging │
                │ Type    │   │ Tests   │   │ Deploy  │
                │ Check   │   │         │   │         │
                │ Build   │   │ Integr. │   │ E2E     │
                │ Docker  │   │ Tests   │   │ Tests   │
                │ Image   │   │         │   │         │
                │         │   │ Security│   │ Prod    │
                │         │   │ Scan    │   │ Deploy  │
                └─────────┘   └─────────┘   └─────────┘
```

### 9.2 Deployment Environments

| Environment | Purpose | Trigger | Infrastructure |
|-------------|---------|---------|----------------|
| **Development** | Local development | Manual | Docker Compose |
| **Preview** | PR preview | PR created | Vercel/Preview |
| **Staging** | Pre-production testing | Merge to main | AWS (scaled down) |
| **Production** | Live environment | Release tag | AWS (full scale) |

### 9.3 Blue-Green Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                   BLUE-GREEN DEPLOYMENT                         │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────┐
                    │     ALB     │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
        ┌──────────┐             ┌──────────┐
        │  BLUE    │             │  GREEN   │
        │ (Current)│             │  (New)   │
        │  v1.0    │             │  v1.1    │
        └──────────┘             └──────────┘
              │                         │
              │    ┌─────────────┐      │
              │    │   Health    │      │
              └───▶│   Check     │◀─────┘
                   └──────┬──────┘
                          │
                   ┌──────┴──────┐
                   │   Traffic   │
                   │   Shift     │
                   │   (100%)    │
                   └─────────────┘
```

---

## 10. Scalability

### 10.1 Scaling Strategy

| Component | Scaling Method | Trigger |
|-----------|---------------|---------|
| **Application** | Horizontal (more pods) | CPU > 70% |
| **Database** | Vertical + Read replicas | CPU > 60%, connections > 80% |
| **Cache** | Cluster mode (sharding) | Memory > 80% |
| **Storage** | Automatic (S3) | Unlimited |
| **Search** | Cluster mode | Query latency > 500ms |

### 10.2 Auto-Scaling Configuration

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: niangelos-api
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: niangelos-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### 10.3 Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time | < 200ms (p95) | APM monitoring |
| Page Load Time | < 2s | Lighthouse |
| Time to First Byte | < 100ms | CDN metrics |
| Database Query Time | < 50ms (p95) | pg_stat_statements |
| Search Response Time | < 300ms | Application metrics |
| WebSocket Latency | < 100ms | Connection monitoring |

---

## 11. Backup & Disaster Recovery

### 11.1 Backup Strategy

| Component | Method | Frequency | Retention |
|-----------|--------|-----------|-----------|
| **Database** | Automated snapshots | Daily | 30 days |
| **Database WAL** | Continuous archiving | Real-time | 7 days |
| **Database** | Manual backup | Weekly | 12 months |
| **S3 Media** | Versioning + Cross-region | Real-time | 90 days |
| **Application Config** | Git repository | On change | Indefinite |
| **Secrets** | AWS Secrets Manager | On change | Indefinite |

### 11.2 Disaster Recovery

| Scenario | RTO | RPO | Recovery Steps |
|----------|-----|-----|----------------|
| **Database Failure** | 15 min | 5 min | Promote read replica, update connection |
| **Application Failure** | 5 min | 0 | Auto-healing, rolling restart |
| **Region Outage** | 1 hour | 5 min | Failover to secondary region |
| **Data Corruption** | 2 hours | 5 min | Point-in-time recovery |
| **Security Breach** | 30 min | varies | Isolate, investigate, restore |

---

## 12. Monitoring & Observability

### 12.1 Monitoring Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING STACK                              │
└─────────────────────────────────────────────────────────────────┘

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│Application│    │Infrastructure│   │ Security │    │ Business │
│ Metrics  │    │  Metrics  │    │  Logs    │    │ Metrics  │
└────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Grafana Dashboards                           │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│  │API      │ │Database │ │Cache    │ │Business │ │Security │ │
│  │Health   │ │Health   │ │Health   │ │KPIs     │ │Events   │ │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │    Alerting     │
                    │  (PagerDuty/    │
                    │   Slack)        │
                    └─────────────────┘
```

### 12.2 Key Metrics

| Category | Metrics |
|----------|---------|
| **Application** | Request rate, Error rate, Response time, Saturation |
| **Database** | Connections, Query time, Replication lag, Disk usage |
| **Cache** | Hit rate, Memory usage, Evictions, Connections |
| **Business** | DAU, Registrations, Lesson completions, Assessments |
| **Security** | Failed logins, Rate limit hits, Suspicious activity |

---

## 13. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| SA-01 | AWS is the primary cloud provider | Need to adapt for GCP/Azure |
| SA-02 | Kubernetes is chosen for orchestration | May use ECS for simplicity |
| SA-03 | PostgreSQL is the primary database | Adapt for MySQL/SQL Server |
| SA-04 | Single-region deployment initially | Need multi-region from start |
| SA-05 | Team has DevOps expertise | Need training or hiring |
| SA-06 | Budget supports ~$1000/mo cloud costs | Need to optimize or reduce scope |
| SA-07 | Container registry needed | May use Docker Hub initially |
| SA-08 | Full CI/CD pipeline from day one | May start with manual deployment |
| SA-09 | Blue-green deployment required | May start with rolling updates |
| SA-10 | Comprehensive monitoring from start | May add incrementally |

---

## 14. Recommendations

### 14.1 Architecture Recommendations

1. **Start with Monolith** – Deploy as modular monolith first, extract microservices only when needed.

2. **Use Managed Services** – RDS, ElastiCache, S3 reduce operational burden.

3. **Implement Feature Flags** – LaunchDarkly or Unleash for gradual rollouts.

4. **API Versioning** – Use URL versioning (`/api/v1/`) from day one.

5. **GraphQL Consideration** – Evaluate GraphQL for complex data fetching needs.

### 14.2 Security Recommendations

1. **Security Audits** – Annual third-party security audits.

2. **Penetration Testing** – Quarterly penetration testing.

3. **Bug Bounty Program** – Consider for public launch.

4. **SOC 2 Compliance** – Plan for SOC 2 Type II certification.

5. **Data Encryption** – Encrypt all PII at rest and in transit.

---

## 15. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| AR-01 | Over-engineering for MVP | High | Medium | Start simple, iterate |
| AR-02 | Vendor lock-in (AWS) | Medium | Medium | Use abstractions, multi-cloud ready |
| AR-03 | Cost overrun | Medium | Medium | Cost monitoring, budget alerts |
| AR-04 | Security breach | Low | Critical | Defense in depth, regular audits |
| AR-05 | Performance issues at scale | Medium | High | Load testing, optimization |
| AR-06 | Deployment failures | Medium | Medium | Blue-green, rollback capability |
| AR-07 | Monitoring blind spots | Medium | Medium | Comprehensive observability |
| AR-08 | Database corruption | Low | Critical | Backups, point-in-time recovery |
| AR-09 | Team skill gaps | Medium | Medium | Training, documentation |
| AR-10 | Scope creep in architecture | High | Medium | Architecture review board |

---

## 16. Approval Gate

### Deliverables Summary

| Deliverable | Status |
|-------------|--------|
| Architecture Principles | ✅ Complete |
| Technology Stack (20+ technologies) | ✅ Complete |
| System Architecture | ✅ Complete |
| Cloud Architecture (AWS) | ✅ Complete |
| Backend Architecture (NestJS) | ✅ Complete |
| Frontend Architecture (Next.js) | ✅ Complete |
| API Design (REST) | ✅ Complete |
| Security Model | ✅ Complete |
| Deployment Strategy | ✅ Complete |
| Scalability Strategy | ✅ Complete |
| Backup & DR | ✅ Complete |
| Monitoring & Observability | ✅ Complete |
| Cost Estimation | ✅ Complete |
| Assumptions (10) | ✅ Complete |
| Recommendations | ✅ Complete |
| Risks (10) | ✅ Complete |

### Questions for Approval

1. Is the technology stack appropriate?
2. Is the AWS architecture within budget?
3. Is the security model sufficient?
4. Is the deployment strategy appropriate?
5. Are there any missing architectural concerns?

### Next Phase Preview

**Phase 6 – UI/UX Design System**
- Design tokens
- Color palette
- Typography
- Components
- Patterns

---

**Awaiting approval to proceed to Phase 6.**
