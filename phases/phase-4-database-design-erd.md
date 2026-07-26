# Phase 4 – Database Design and ERD

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Database Design Principles](#1-database-design-principles)
2. [Entity Overview](#2-entity-overview)
3. [Entity Relationship Diagram](#3-entity-relationship-diagram)
4. [Entity Definitions](#4-entity-definitions)
5. [Schema Design](#5-schema-design)
6. [Relationships](#6-relationships)
7. [Indexes](#7-indexes)
8. [Data Types](#8-data-types)
9. [Multi-Tenancy Strategy](#9-multi-tenancy-strategy)
10. [Soft Deletes & Audit](#10-soft-deletes-audit)
11. [Assumptions](#11-assumptions)
12. [Recommendations](#12-recommendations)
13. [Risks](#13-risks)
14. [Approval Gate](#14-approval-gate)

---

## 1. Database Design Principles

### 1.1 Core Principles

| Principle | Description | Application |
|-----------|-------------|-------------|
| **Normalization** | Minimize data redundancy, maximize integrity | 3NF primary, strategic denormalization for performance |
| **Multi-Tenancy** | Data isolation per church/school | Tenant ID on all tables, row-level security |
| **Soft Deletes** | Preserve data for audit and recovery | `deleted_at` timestamp, never hard delete |
| **Audit Trail** | Track all changes for accountability | `created_at`, `updated_at`, `created_by`, `updated_by` |
| **UUID Primary Keys** | Prevent ID guessing, enable distributed systems | UUID v4 for all primary keys |
| **Localization** | Support multi-language content | JSONB fields for localized content |
| **Extensibility** | Allow future attributes without schema changes | JSONB `metadata` columns for flexible data |
| **Performance** | Optimize for read-heavy workloads | Strategic indexes, materialized views |

### 1.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `students`, `curriculum_lessons` |
| Columns | snake_case | `first_name`, `created_at` |
| Primary Keys | `id` (UUID) | `id: uuid` |
| Foreign Keys | `{table}_id` | `student_id`, `level_id` |
| Indexes | `idx_{table}_{column}` | `idx_students_level_id` |
| Unique Constraints | `uniq_{table}_{column}` | `uniq_users_email` |
| Timestamps | `created_at`, `updated_at` | ISO 8601 format |

---

## 2. Entity Overview

### 2.1 Core Domain Entities

| Domain | Entities | Description |
|--------|----------|-------------|
| **Multi-Tenancy** | Church, School, AcademicYear | Tenant and organizational structure |
| **Users** | User, Role, UserRole, Permission, RolePermission | Authentication and authorization |
| **Students** | Student, StudentProfile, StudentDocument, MedicalNote | Student management |
| **Curriculum** | Level, Group, Subject, Lesson, Session, Resource | Curriculum structure |
| **Attendance** | AttendanceRecord, AttendanceSession | Attendance tracking |
| **Assessments** | Assessment, AssessmentQuestion, AssessmentSubmission, Grade | Assessment system |
| **Progress** | LessonProgress, StudentProgress, PromotionRecord | Progress tracking |
| **Gamification** | Badge, StudentBadge, Achievement, Certificate, XPTransaction | Gamification |
| **Communication** | Announcement, Message, Notification, Event | Communication |
| **System** | AuditLog, SystemConfig, FileUpload | System infrastructure |

### 2.2 Entity Count Summary

| Category | Entity Count | Relationship Count |
|----------|--------------|-------------------|
| Multi-Tenancy | 3 | 4 |
| Users | 5 | 8 |
| Students | 4 | 6 |
| Curriculum | 6 | 12 |
| Attendance | 2 | 4 |
| Assessments | 4 | 8 |
| Progress | 3 | 6 |
| Gamification | 5 | 10 |
| Communication | 4 | 6 |
| System | 3 | 2 |
| **TOTAL** | **39 entities** | **66 relationships** |

---

## 3. Entity Relationship Diagram

### 3.1 High-Level ERD

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              NIANGELOS PLATFORM - ERD                               │
└─────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   CHURCH    │
                                    └──────┬──────┘
                                           │
                                    ┌──────┴──────┐
                                    │             │
                                    ▼             ▼
                              ┌──────────┐  ┌──────────┐
                              │  SCHOOL  │  │  SCHOOL  │
                              └────┬─────┘  └──────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ACADEMIC  │  │  LEVEL   │  │  USER    │
              │  YEAR    │  └────┬─────┘  └────┬─────┘
              └──────────┘       │              │
                           ┌─────┴─────┐        │
                           │           │        │
                           ▼           ▼        │
                     ┌──────────┐ ┌──────────┐  │
                     │  GROUP   │ │ SUBJECT  │  │
                     └────┬─────┘ └────┬─────┘  │
                          │            │        │
                          └─────┬──────┘        │
                                │               │
                                ▼               │
                          ┌──────────┐          │
                          │  LESSON  │◄─────────┘
                          └────┬─────┘
                               │
                          ┌────┴────┐
                          │         │
                          ▼         ▼
                    ┌──────────┐ ┌──────────┐
                    │ SESSION  │ │ RESOURCE │
                    └────┬─────┘ └──────────┘
                         │
                         ▼
                   ┌──────────┐
                   │ STUDENT  │
                   └────┬─────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
              ▼         ▼         ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ATTENDANCE│ │ASSESSMENT│ │ PROGRESS │
        └──────────┘ └──────────┘ └──────────┘
```

### 3.2 Detailed ERD - Core Entities

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           DETAILED ERD - CORE ENTITIES                              │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   CHURCH    │────1:N──│   SCHOOL    │────1:N──│ACADEMIC_YEAR│
└─────────────┘         └──────┬──────┘         └─────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐    ┌──────────┐    ┌──────────┐
        │  LEVEL   │    │   USER   │    │STUDENT   │
        └────┬─────┘    └────┬─────┘    └────┬─────┘
             │               │               │
        ┌────┴────┐     ┌────┴────┐     ┌────┴────┐
        │         │     │         │     │         │
        ▼         ▼     ▼         ▼     ▼         ▼
  ┌──────────┐┌─────┐┌─────┐┌─────────┐┌──────┐┌──────┐
  │  GROUP   ││ROLE ││USER_││STUDENT_ ││MEDICAL││STUDENT│
  │          ││     ││ROLE ││PROFILE  ││ NOTE  ││DOC   │
  └────┬─────┘└─────┘└─────┘└─────────┘└──────┘└──────┘
       │
  ┌────┴─────────────────────────────────────────────┐
  │                                                  │
  ▼                                                  ▼
┌──────────┐                                    ┌──────────┐
│ SUBJECT  │                                    │ATTENDANCE│
└────┬─────┘                                    │ SESSION  │
     │                                          └────┬─────┘
     ▼                                               │
┌──────────┐                                    ┌────┴─────┐
│  LESSON  │                                    │ATTENDANCE│
└────┬─────┘                                    │ RECORD   │
     │                                          └──────────┘
┌────┴──────────────────────────────────┐
│                                       │
▼                                       ▼
┌──────────┐                      ┌──────────┐
│ SESSION  │                      │ RESOURCE │
└────┬─────┘                      └──────────┘
     │
     ▼
┌──────────┐
│ASSESSMENT│
└──────────┘
```

---

## 4. Entity Definitions

### 4.1 Multi-Tenancy Entities

#### CHURCH

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `name` | VARCHAR(255) | NO | Church name |
| `name_ar` | VARCHAR(255) | YES | Arabic name |
| `slug` | VARCHAR(100) | NO | URL-friendly identifier |
| `logo_url` | TEXT | YES | Church logo |
| `timezone` | VARCHAR(50) | NO | Default timezone |
| `locale` | VARCHAR(10) | NO | Default language |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_churches_slug` (unique)

---

#### SCHOOL

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `church_id` | UUID | NO | FK → churches.id |
| `name` | VARCHAR(255) | NO | School name |
| `name_ar` | VARCHAR(255) | YES | Arabic name |
| `slug` | VARCHAR(100) | NO | URL-friendly identifier |
| `logo_url` | TEXT | YES | School logo |
| `address` | TEXT | YES | Physical address |
| `phone` | VARCHAR(20) | YES | Contact phone |
| `email` | VARCHAR(255) | YES | Contact email |
| `timezone` | VARCHAR(50) | NO | School timezone |
| `locale` | VARCHAR(10) | NO | Default language |
| `subscription_plan` | VARCHAR(50) | NO | Subscription tier |
| `is_active` | BOOLEAN | NO | Active status |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_schools_church_id`, `idx_schools_slug` (unique)

---

#### ACADEMIC_YEAR

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `name` | VARCHAR(100) | NO | e.g., "2025-2026" |
| `start_date` | DATE | NO | Academic year start |
| `end_date` | DATE | NO | Academic year end |
| `is_current` | BOOLEAN | NO | Current year flag |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_academic_years_school_id`, `idx_academic_years_is_current`

---

### 4.2 User Management Entities

#### USER

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `email` | VARCHAR(255) | NO | Email address (login) |
| `phone` | VARCHAR(20) | YES | Phone number |
| `password_hash` | VARCHAR(255) | NO | Bcrypt hash |
| `first_name` | VARCHAR(100) | NO | First name |
| `last_name` | VARCHAR(100) | NO | Last name |
| `first_name_ar` | VARCHAR(100) | YES | Arabic first name |
| `last_name_ar` | VARCHAR(100) | YES | Arabic last name |
| `avatar_url` | TEXT | YES | Profile photo |
| `locale` | VARCHAR(10) | NO | Language preference |
| `timezone` | VARCHAR(50) | NO | Timezone |
| `is_active` | BOOLEAN | NO | Active status |
| `email_verified_at` | TIMESTAMP | YES | Email verification |
| `phone_verified_at` | TIMESTAMP | YES | Phone verification |
| `last_login_at` | TIMESTAMP | YES | Last login |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_users_school_id`, `idx_users_email` (unique), `idx_users_phone`

---

#### ROLE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `name` | VARCHAR(50) | NO | Role name |
| `display_name` | VARCHAR(100) | NO | Human-readable name |
| `description` | TEXT | YES | Role description |
| `level` | INTEGER | NO | Hierarchy level (1=highest) |
| `is_system` | BOOLEAN | NO | System role (non-deletable) |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_roles_name` (unique)

**Default Roles:**

| ID | Name | Level | Description |
|----|------|-------|-------------|
| 1 | super_admin | 1 | Platform administrator |
| 2 | principal | 2 | School principal |
| 3 | curriculum_manager | 3 | Curriculum administrator |
| 4 | servant | 4 | Teaching servant |
| 5 | assistant_servant | 5 | Assistant servant |
| 6 | parent | 6 | Parent/guardian |
| 7 | student | 7 | Student |
| 8 | guest | 8 | Read-only visitor |

---

#### USER_ROLE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `user_id` | UUID | NO | FK → users.id |
| `role_id` | UUID | NO | FK → roles.id |
| `assigned_by` | UUID | YES | FK → users.id |
| `assigned_at` | TIMESTAMP | NO | Assignment timestamp |
| `expires_at` | TIMESTAMP | YES | Optional expiry |

**Indexes:** `idx_user_roles_user_id`, `idx_user_roles_role_id`, `uniq_user_roles_user_role` (unique pair)

---

#### PERMISSION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `name` | VARCHAR(100) | NO | Permission identifier |
| `display_name` | VARCHAR(150) | NO | Human-readable name |
| `description` | TEXT | YES | Permission description |
| `resource` | VARCHAR(100) | NO | Resource type |
| `action` | VARCHAR(50) | NO | Action type |
| `created_at` | TIMESTAMP | NO | Creation timestamp |

**Indexes:** `idx_permissions_name` (unique), `idx_permissions_resource_action`

---

#### ROLE_PERMISSION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `role_id` | UUID | NO | FK → roles.id |
| `permission_id` | UUID | NO | FK → permissions.id |

**Indexes:** `idx_role_permissions_role_id`, `uniq_role_permissions_role_permission` (unique pair)

---

### 4.3 Student Entities

#### STUDENT

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `academic_year_id` | UUID | NO | FK → academic_years.id |
| `student_code` | VARCHAR(20) | NO | Unique student code |
| `first_name` | VARCHAR(100) | NO | First name |
| `last_name` | VARCHAR(100) | NO | Last name |
| `first_name_ar` | VARCHAR(100) | YES | Arabic first name |
| `last_name_ar` | VARCHAR(100) | YES | Arabic last name |
| `date_of_birth` | DATE | NO | Date of birth |
| `gender` | VARCHAR(10) | NO | male/female |
| `photo_url` | TEXT | YES | Profile photo |
| `church_name` | VARCHAR(255) | YES | Affiliated church |
| `school_grade` | VARCHAR(50) | YES | Secular school grade |
| `level_id` | UUID | NO | FK → levels.id |
| `group_id` | UUID | NO | FK → groups.id |
| `status` | VARCHAR(20) | NO | active/inactive/graduated/transferred |
| `enrollment_date` | DATE | NO | Date of enrollment |
| `graduation_date` | DATE | YES | Date of graduation |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_students_school_id`, `idx_students_academic_year_id`, `idx_students_level_id`, `idx_students_group_id`, `idx_students_student_code` (unique), `idx_students_status`

---

#### STUDENT_PROFILE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `emergency_contact_name` | VARCHAR(200) | YES | Emergency contact |
| `emergency_contact_phone` | VARCHAR(20) | YES | Emergency phone |
| `emergency_contact_relation` | VARCHAR(50) | YES | Relationship |
| `allergies` | TEXT | YES | Allergy information |
| `medical_conditions` | TEXT | YES | Medical conditions |
| `medications` | TEXT | YES | Current medications |
| `special_needs` | TEXT | YES | Special requirements |
| `notes` | TEXT | YES | General notes |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_student_profiles_student_id` (unique)

---

#### STUDENT_PARENT (Junction Table)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `parent_id` | UUID | NO | FK → users.id |
| `relationship` | VARCHAR(50) | NO | mother/father/guardian |
| `is_primary` | BOOLEAN | NO | Primary contact flag |
| `created_at` | TIMESTAMP | NO | Creation timestamp |

**Indexes:** `idx_student_parents_student_id`, `idx_student_parents_parent_id`, `uniq_student_parents_student_parent` (unique pair)

---

#### MEDICAL_NOTE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `category` | VARCHAR(50) | NO | allergy/condition/medication/other |
| `title` | VARCHAR(200) | NO | Note title |
| `content` | TEXT | NO | Note content |
| `severity` | VARCHAR(20) | YES | low/medium/high/critical |
| `is_active` | BOOLEAN | NO | Active status |
| `created_by` | UUID | NO | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_medical_notes_student_id`, `idx_medical_notes_category`

---

### 4.4 Curriculum Entities

#### LEVEL

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `number` | INTEGER | NO | Level number (1-10) |
| `name` | VARCHAR(100) | NO | Level name |
| `name_ar` | VARCHAR(100) | YES | Arabic name |
| `description` | TEXT | YES | Level description |
| `description_ar` | TEXT | YES | Arabic description |
| `sessions_per_lesson` | INTEGER | NO | Default sessions per lesson |
| `min_attendance_percent` | DECIMAL(5,2) | NO | Min attendance for promotion |
| `min_assessment_score` | DECIMAL(5,2) | NO | Min score for promotion |
| `status` | VARCHAR(20) | NO | active/draft/archived |
| `order_index` | INTEGER | NO | Display order |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_levels_school_id`, `idx_levels_number`, `uniq_levels_school_number` (unique pair)

---

#### GROUP

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `level_id` | UUID | NO | FK → levels.id |
| `name` | VARCHAR(100) | NO | Group name |
| `name_ar` | VARCHAR(100) | YES | Arabic name |
| `description` | TEXT | YES | Group description |
| `capacity` | INTEGER | NO | Max students |
| `order_index` | INTEGER | NO | Display order |
| `status` | VARCHAR(20) | NO | active/draft/archived |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_groups_level_id`, `idx_groups_order_index`

---

#### SUBJECT

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `name` | VARCHAR(100) | NO | Subject name |
| `name_ar` | VARCHAR(100) | YES | Arabic name |
| `name_coptic` | VARCHAR(100) | YES | Coptic name |
| `description` | TEXT | YES | Subject description |
| `icon` | VARCHAR(50) | YES | Icon identifier |
| `color` | VARCHAR(7) | YES | Hex color code |
| `status` | VARCHAR(20) | NO | active/draft/archived |
| `order_index` | INTEGER | NO | Display order |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_subjects_school_id`, `idx_subjects_name`

**Default Subjects:**
- Coptic Hymns (ⲡⲓⲙⲱⲟⲩⲉⲓ)
- Coptic Rites (ⲡⲓⲤⲙⲟⲩ)
- Coptic Language (ⲡⲓⲢⲉⲙⲛⲭⲏⲙⲓ)

---

#### LESSON

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `level_id` | UUID | NO | FK → levels.id |
| `subject_id` | UUID | NO | FK → subjects.id |
| `title` | VARCHAR(255) | NO | Lesson title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `title_coptic` | VARCHAR(255) | YES | Coptic title |
| `description` | TEXT | YES | Lesson description |
| `description_ar` | TEXT | YES | Arabic description |
| `description_coptic` | TEXT | YES | Coptic description |
| `objectives` | JSONB | YES | Learning objectives array |
| `objectives_ar` | JSONB | YES | Arabic objectives |
| `estimated_duration_minutes` | INTEGER | YES | Estimated duration |
| `required_memorization` | TEXT | YES | Memorization requirements |
| `required_memorization_ar` | TEXT | YES | Arabic memorization |
| `prerequisites` | JSONB | YES | Prerequisite lesson IDs |
| `sessions_count` | INTEGER | NO | Number of sessions |
| `order_index` | INTEGER | NO | Display order |
| `status` | VARCHAR(20) | NO | draft/published/archived |
| `published_at` | TIMESTAMP | YES | Publication timestamp |
| `version` | INTEGER | NO | Version number |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_by` | UUID | NO | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_lessons_school_id`, `idx_lessons_level_id`, `idx_lessons_subject_id`, `idx_lessons_status`, `idx_lessons_order_index`

---

#### SESSION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `lesson_id` | UUID | NO | FK → lessons.id |
| `title` | VARCHAR(255) | NO | Session title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `description` | TEXT | YES | Session description |
| `description_ar` | TEXT | YES | Arabic description |
| `objectives` | JSONB | YES | Session objectives |
| `estimated_duration_minutes` | INTEGER | YES | Estimated duration |
| `order_index` | INTEGER | NO | Display order |
| `content_en` | TEXT | YES | English content |
| `content_ar` | TEXT | YES | Arabic content |
| `content_coptic` | TEXT | YES | Coptic content |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_sessions_lesson_id`, `idx_sessions_order_index`

---

#### RESOURCE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `lesson_id` | UUID | YES | FK → lessons.id (nullable) |
| `title` | VARCHAR(255) | NO | Resource title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `type` | VARCHAR(50) | NO | pdf/audio/video/image/pptx/youtube/sheet_music |
| `category` | VARCHAR(50) | NO | primary/supplementary/homework |
| `file_url` | TEXT | NO | File storage URL |
| `file_size` | BIGINT | NO | File size in bytes |
| `mime_type` | VARCHAR(100) | NO | MIME type |
| `duration_seconds` | INTEGER | YES | Audio/video duration |
| `language` | VARCHAR(10) | NO | Content language |
| `transcription` | TEXT | YES | Text transcription |
| `order_index` | INTEGER | NO | Display order |
| `is_downloadable` | BOOLEAN | NO | Download allowed |
| `metadata` | JSONB | YES | Extensible attributes |
| `uploaded_by` | UUID | NO | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_resources_school_id`, `idx_resources_lesson_id`, `idx_resources_type`, `idx_resources_language`

---

#### LEVEL_SUBJECT (Junction Table)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `level_id` | UUID | NO | FK → levels.id |
| `subject_id` | UUID | NO | FK → subjects.id |
| `is_required` | BOOLEAN | NO | Required subject |
| `order_index` | INTEGER | NO | Display order |

**Indexes:** `idx_level_subjects_level_id`, `uniq_level_subjects_level_subject` (unique pair)

---

### 4.5 Attendance Entities

#### ATTENDANCE_SESSION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `lesson_id` | UUID | NO | FK → lessons.id |
| `session_id` | UUID | YES | FK → sessions.id |
| `servant_id` | UUID | NO | FK → users.id |
| `level_id` | UUID | NO | FK → levels.id |
| `group_id` | UUID | NO | FK → groups.id |
| `scheduled_date` | DATE | NO | Scheduled date |
| `scheduled_time` | TIME | YES | Scheduled time |
| `actual_start_time` | TIMESTAMP | YES | Actual start |
| `actual_end_time` | TIMESTAMP | YES | Actual end |
| `status` | VARCHAR(20) | NO | scheduled/in_progress/completed/cancelled |
| `notes` | TEXT | YES | Session notes |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_attendance_sessions_school_id`, `idx_attendance_sessions_servant_id`, `idx_attendance_sessions_level_id`, `idx_attendance_sessions_group_id`, `idx_attendance_sessions_scheduled_date`

---

#### ATTENDANCE_RECORD

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `attendance_session_id` | UUID | NO | FK → attendance_sessions.id |
| `student_id` | UUID | NO | FK → students.id |
| `status` | VARCHAR(20) | NO | present/late/absent/excused |
| `homework_status` | VARCHAR(20) | NO | completed/missing/partial/not_assigned |
| `note` | TEXT | YES | Servant note |
| `note_category` | VARCHAR(50) | YES | behavioral/medical/academic/general |
| `is_private_note` | BOOLEAN | NO | Private to principal only |
| `recorded_by` | UUID | NO | FK → users.id |
| `recorded_at` | TIMESTAMP | NO | Record timestamp |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_attendance_records_session_id`, `idx_attendance_records_student_id`, `idx_attendance_records_status`, `uniq_attendance_records_session_student` (unique pair)

---

### 4.6 Assessment Entities

#### ASSESSMENT

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `lesson_id` | UUID | YES | FK → lessons.id |
| `level_id` | UUID | NO | FK → levels.id |
| `subject_id` | UUID | NO | FK → subjects.id |
| `title` | VARCHAR(255) | NO | Assessment title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `description` | TEXT | YES | Description |
| `description_ar` | TEXT | YES | Arabic description |
| `type` | VARCHAR(50) | NO | written/oral/practical/audio_video/quiz |
| `grading_type` | VARCHAR(20) | NO | manual/automatic/rubric |
| `total_points` | DECIMAL(10,2) | NO | Maximum points |
| `passing_score` | DECIMAL(5,2) | NO | Minimum passing percentage |
| `time_limit_minutes` | INTEGER | YES | Time limit |
| `due_date` | TIMESTAMP | YES | Submission deadline |
| `allow_late_submission` | BOOLEAN | NO | Late submission allowed |
| `instructions` | TEXT | YES | Student instructions |
| `instructions_ar` | TEXT | YES | Arabic instructions |
| `status` | VARCHAR(20) | NO | draft/published/archived |
| `published_at` | TIMESTAMP | YES | Publication timestamp |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_by` | UUID | NO | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_assessments_school_id`, `idx_assessments_level_id`, `idx_assessments_subject_id`, `idx_assessments_type`, `idx_assessments_status`

---

#### ASSESSMENT_QUESTION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `assessment_id` | UUID | NO | FK → assessments.id |
| `question_text` | TEXT | NO | Question text |
| `question_text_ar` | TEXT | YES | Arabic question |
| `question_text_coptic` | TEXT | YES | Coptic question |
| `type` | VARCHAR(50) | NO | mcq/true_false/fill_blank/short_answer/essay |
| `options` | JSONB | YES | MCQ options array |
| `correct_answer` | TEXT | YES | Correct answer |
| `correct_answer_ar` | TEXT | YES | Arabic correct answer |
| `explanation` | TEXT | YES | Answer explanation |
| `explanation_ar` | TEXT | YES | Arabic explanation |
| `points` | DECIMAL(10,2) | NO | Points value |
| `order_index` | INTEGER | NO | Display order |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_assessment_questions_assessment_id`, `idx_assessment_questions_order_index`

---

#### ASSESSMENT_SUBMISSION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `assessment_id` | UUID | NO | FK → assessments.id |
| `student_id` | UUID | NO | FK → students.id |
| `submission_type` | VARCHAR(20) | NO | text/audio/video/file |
| `submission_content` | TEXT | YES | Text answer |
| `file_url` | TEXT | YES | Uploaded file URL |
| `file_type` | VARCHAR(50) | YES | File MIME type |
| `duration_seconds` | INTEGER | YES | Audio/video duration |
| `started_at` | TIMESTAMP | YES | When student started |
| `submitted_at` | TIMESTAMP | NO | Submission timestamp |
| `status` | VARCHAR(20) | NO | in_progress/submitted/graded/returned |
| `is_late` | BOOLEAN | NO | Late submission flag |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_assessment_submissions_assessment_id`, `idx_assessment_submissions_student_id`, `idx_assessment_submissions_status`

---

#### GRADE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `submission_id` | UUID | NO | FK → assessment_submissions.id |
| `question_id` | UUID | YES | FK → assessment_questions.id |
| `score` | DECIMAL(10,2) | NO | Points earned |
| `max_score` | DECIMAL(10,2) | NO | Maximum points |
| `feedback` | TEXT | YES | Grader feedback |
| `feedback_ar` | TEXT | YES | Arabic feedback |
| `rubric_scores` | JSONB | YES | Rubric criteria scores |
| `graded_by` | UUID | NO | FK → users.id |
| `graded_at` | TIMESTAMP | NO | Grading timestamp |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_grades_submission_id`, `idx_grades_question_id`, `idx_grades_graded_by`

---

### 4.7 Progress Entities

#### LESSON_PROGRESS

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `lesson_id` | UUID | NO | FK → lessons.id |
| `status` | VARCHAR(30) | NO | not_started/in_progress/memorized/reviewed/passed_assessment/needs_improvement/completed |
| `progress_percent` | DECIMAL(5,2) | NO | Completion percentage |
| `sessions_completed` | INTEGER | NO | Sessions done |
| `total_sessions` | INTEGER | NO | Total sessions |
| `last_accessed_at` | TIMESTAMP | YES | Last activity |
| `completed_at` | TIMESTAMP | YES | Completion timestamp |
| `notes` | TEXT | YES | Progress notes |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_lesson_progress_student_id`, `idx_lesson_progress_lesson_id`, `idx_lesson_progress_status`, `uniq_lesson_progress_student_lesson` (unique pair)

---

#### STUDENT_PROGRESS (Aggregated)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `academic_year_id` | UUID | NO | FK → academic_years.id |
| `level_id` | UUID | NO | FK → levels.id |
| `total_lessons` | INTEGER | NO | Total lessons in level |
| `completed_lessons` | INTEGER | NO | Completed lessons |
| `progress_percent` | DECIMAL(5,2) | NO | Overall progress |
| `total_xp` | INTEGER | NO | Total XP earned |
| `current_level` | INTEGER | NO | Gamification level |
| `current_streak` | INTEGER | NO | Current day streak |
| `longest_streak` | INTEGER | NO | Longest streak |
| `attendance_percent` | DECIMAL(5,2) | NO | Attendance percentage |
| `average_score` | DECIMAL(5,2) | NO | Average assessment score |
| `last_activity_at` | TIMESTAMP | YES | Last activity |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_student_progress_student_id`, `idx_student_progress_academic_year_id`, `idx_student_progress_level_id`

---

#### PROMOTION_RECORD

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `from_level_id` | UUID | NO | FK → levels.id |
| `to_level_id` | UUID | NO | FK → levels.id |
| `from_group_id` | UUID | NO | FK → groups.id |
| `to_group_id` | UUID | YES | FK → groups.id |
| `academic_year_id` | UUID | NO | FK → academic_years.id |
| `promotion_date` | DATE | NO | Date of promotion |
| `status` | VARCHAR(20) | NO | pending/approved/denied/deferred |
| `attendance_percent` | DECIMAL(5,2) | YES | Attendance at promotion |
| `average_score` | DECIMAL(5,2) | YES | Score at promotion |
| `reason` | TEXT | YES | Promotion/denial reason |
| `approved_by` | UUID | YES | FK → users.id |
| `approved_at` | TIMESTAMP | YES | Approval timestamp |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_promotion_records_student_id`, `idx_promotion_records_from_level_id`, `idx_promotion_records_to_level_id`, `idx_promotion_records_status`

---

### 4.8 Gamification Entities

#### BADGE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | YES | FK → schools.id (NULL = system badge) |
| `name` | VARCHAR(100) | NO | Badge name |
| `name_ar` | VARCHAR(100) | YES | Arabic name |
| `description` | TEXT | YES | Badge description |
| `description_ar` | TEXT | YES | Arabic description |
| `icon_url` | TEXT | NO | Badge icon |
| `category` | VARCHAR(50) | NO | learning/consistency/assessment/community/special |
| `xp_reward` | INTEGER | NO | XP awarded |
| `criteria` | JSONB | NO | Award criteria |
| `is_active` | BOOLEAN | NO | Active status |
| `is_secret` | BOOLEAN | NO | Hidden until earned |
| `max_awards` | INTEGER | YES | Max times earnable |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_badges_school_id`, `idx_badges_category`, `idx_badges_is_active`

---

#### STUDENT_BADGE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `badge_id` | UUID | NO | FK → badges.id |
| `awarded_at` | TIMESTAMP | NO | Award timestamp |
| `awarded_by` | UUID | YES | FK → users.id |
| `reason` | TEXT | YES | Award reason |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |

**Indexes:** `idx_student_badges_student_id`, `idx_student_badges_badge_id`, `idx_student_badges_awarded_at`

---

#### ACHIEVEMENT

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `type` | VARCHAR(50) | NO | lesson_complete/assessment_passed/streak/milestone |
| `title` | VARCHAR(200) | NO | Achievement title |
| `description` | TEXT | YES | Achievement description |
| `xp_earned` | INTEGER | NO | XP earned |
| `metadata` | JSONB | YES | Achievement details |
| `created_at` | TIMESTAMP | NO | Creation timestamp |

**Indexes:** `idx_achievements_student_id`, `idx_achievements_type`, `idx_achievements_created_at`

---

#### CERTIFICATE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `level_id` | UUID | NO | FK → levels.id |
| `academic_year_id` | UUID | NO | FK → academic_years.id |
| `certificate_number` | VARCHAR(50) | NO | Unique certificate ID |
| `issued_date` | DATE | NO | Issue date |
| `issued_by` | UUID | NO | FK → users.id |
| `template_id` | VARCHAR(50) | NO | Template used |
| `pdf_url` | TEXT | YES | Generated PDF URL |
| `status` | VARCHAR(20) | NO | active/revoked |
| `revoked_at` | TIMESTAMP | YES | Revocation timestamp |
| `revoked_by` | UUID | YES | FK → users.id |
| `revocation_reason` | TEXT | YES | Revocation reason |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_certificates_student_id`, `idx_certificates_level_id`, `idx_certificates_certificate_number` (unique), `idx_certificates_status`

---

#### XP_TRANSACTION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `student_id` | UUID | NO | FK → students.id |
| `amount` | INTEGER | NO | XP amount (positive/negative) |
| `balance_after` | INTEGER | NO | Balance after transaction |
| `type` | VARCHAR(50) | NO | lesson_complete/assessment/badge/streak/manual/penalty |
| `reference_type` | VARCHAR(50) | YES | Related entity type |
| `reference_id` | UUID | YES | Related entity ID |
| `description` | TEXT | YES | Transaction description |
| `created_by` | UUID | YES | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |

**Indexes:** `idx_xp_transactions_student_id`, `idx_xp_transactions_type`, `idx_xp_transactions_created_at`

---

### 4.9 Communication Entities

#### ANNOUNCEMENT

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `title` | VARCHAR(255) | NO | Announcement title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `content` | TEXT | NO | Announcement content |
| `content_ar` | TEXT | YES | Arabic content |
| `target_audience` | VARCHAR(50) | NO | all/parents/servants/students/level_ |
| `target_level_ids` | JSONB | YES | Target levels (if level_) |
| `target_group_ids` | JSONB | YES | Target groups |
| `priority` | VARCHAR(20) | NO | low/normal/high/urgent |
| `is_pinned` | BOOLEAN | NO | Pinned to top |
| `publish_at` | TIMESTAMP | NO | Publish timestamp |
| `expires_at` | TIMESTAMP | YES | Expiration timestamp |
| `status` | VARCHAR(20) | NO | draft/published/archived |
| `attachments` | JSONB | YES | File attachments |
| `created_by` | UUID | NO | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_announcements_school_id`, `idx_announcements_target_audience`, `idx_announcements_publish_at`, `idx_announcements_status`

---

#### MESSAGE

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `conversation_id` | UUID | NO | FK → messages.id (self-ref for thread) |
| `sender_id` | UUID | NO | FK → users.id |
| `recipient_id` | UUID | NO | FK → users.id |
| `content` | TEXT | NO | Message content |
| `attachments` | JSONB | YES | File attachments |
| `is_read` | BOOLEAN | NO | Read status |
| `read_at` | TIMESTAMP | YES | Read timestamp |
| `parent_message_id` | UUID | YES | FK → messages.id (for replies) |
| `status` | VARCHAR(20) | NO | sent/delivered/read |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_messages_school_id`, `idx_messages_sender_id`, `idx_messages_recipient_id`, `idx_messages_conversation_id`, `idx_messages_is_read`

---

#### NOTIFICATION

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `user_id` | UUID | NO | FK → users.id |
| `type` | VARCHAR(50) | NO | attendance/homework/assessment/promotion/announcement/event/system |
| `title` | VARCHAR(255) | NO | Notification title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `body` | TEXT | NO | Notification body |
| `body_ar` | TEXT | YES | Arabic body |
| `data` | JSONB | YES | Additional data |
| `channels` | JSONB | NO | Delivery channels array |
| `status` | VARCHAR(20) | NO | pending/sent/delivered/failed |
| `is_read` | BOOLEAN | NO | Read status |
| `read_at` | TIMESTAMP | YES | Read timestamp |
| `sent_at` | TIMESTAMP | YES | Sent timestamp |
| `delivered_at` | TIMESTAMP | YES | Delivered timestamp |
| `metadata` | JSONB | YES | Extensible attributes |
| `created_at` | TIMESTAMP | NO | Creation timestamp |

**Indexes:** `idx_notifications_user_id`, `idx_notifications_type`, `idx_notifications_is_read`, `idx_notifications_created_at`, `idx_notifications_status`

---

#### EVENT

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `title` | VARCHAR(255) | NO | Event title |
| `title_ar` | VARCHAR(255) | YES | Arabic title |
| `description` | TEXT | YES | Event description |
| `description_ar` | TEXT | YES | Arabic description |
| `location` | VARCHAR(255) | YES | Event location |
| `start_datetime` | TIMESTAMP | NO | Start date/time |
| `end_datetime` | TIMESTAMP | NO | End date/time |
| `is_all_day` | BOOLEAN | NO | All-day event |
| `recurrence` | JSONB | YES | Recurrence rules |
| `target_audience` | VARCHAR(50) | NO | all/parents/servants/students |
| `target_level_ids` | JSONB | YES | Target levels |
| `rsvp_required` | BOOLEAN | NO | RSVP needed |
| `max_attendees` | INTEGER | YES | Capacity limit |
| `attachments` | JSONB | YES | File attachments |
| `status` | VARCHAR(20) | NO | draft/published/cancelled/completed |
| `created_by` | UUID | NO | FK → users.id |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |
| `deleted_at` | TIMESTAMP | YES | Soft delete timestamp |

**Indexes:** `idx_events_school_id`, `idx_events_start_datetime`, `idx_events_status`

---

### 4.10 System Entities

#### AUDIT_LOG

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | YES | FK → schools.id |
| `user_id` | UUID | YES | FK → users.id |
| `action` | VARCHAR(50) | NO | create/update/delete/login/logout |
| `entity_type` | VARCHAR(50) | NO | Entity type |
| `entity_id` | UUID | YES | Entity ID |
| `old_values` | JSONB | YES | Previous values |
| `new_values` | JSONB | YES | New values |
| `ip_address` | VARCHAR(45) | YES | Client IP |
| `user_agent` | TEXT | YES | Client user agent |
| `metadata` | JSONB | YES | Additional context |
| `created_at` | TIMESTAMP | NO | Action timestamp |

**Indexes:** `idx_audit_logs_school_id`, `idx_audit_logs_user_id`, `idx_audit_logs_entity_type_entity_id`, `idx_audit_logs_action`, `idx_audit_logs_created_at`

---

#### SYSTEM_CONFIG

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | YES | FK → schools.id (NULL = global) |
| `key` | VARCHAR(100) | NO | Config key |
| `value` | JSONB | NO | Config value |
| `description` | TEXT | YES | Config description |
| `is_public` | BOOLEAN | NO | Visible to non-admins |
| `created_at` | TIMESTAMP | NO | Creation timestamp |
| `updated_at` | TIMESTAMP | NO | Last update timestamp |

**Indexes:** `idx_system_configs_school_id`, `idx_system_configs_key`, `uniq_system_configs_school_key` (unique pair)

---

#### FILE_UPLOAD

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `school_id` | UUID | NO | FK → schools.id |
| `uploaded_by` | UUID | NO | FK → users.id |
| `original_name` | VARCHAR(255) | NO | Original filename |
| `storage_path` | TEXT | NO | Storage path |
| `file_size` | BIGINT | NO | File size in bytes |
| `mime_type` | VARCHAR(100) | NO | MIME type |
| `category` | VARCHAR(50) | NO | avatar/resource/document/attachment |
| `entity_type` | VARCHAR(50) | YES | Associated entity type |
| `entity_id` | UUID | YES | Associated entity ID |
| `metadata` | JSONB | YES | File metadata |
| `created_at` | TIMESTAMP | NO | Upload timestamp |

**Indexes:** `idx_file_uploads_school_id`, `idx_file_uploads_uploaded_by`, `idx_file_uploads_entity_type_entity_id`

---

## 5. Schema Design

### 5.1 Schema Overview

```sql
-- Core Schemas
CREATE SCHEMA IF NOT EXISTS tenant;      -- Multi-tenant data
CREATE SCHEMA IF NOT EXISTS auth;        -- Authentication data
CREATE SCHEMA IF NOT EXISTS content;     -- Curriculum content
CREATE SCHEMA IF NOT EXISTS analytics;   -- Aggregated analytics
CREATE SCHEMA IF NOT EXISTS system;      -- System infrastructure
```

### 5.2 Table Creation Order (Dependencies)

```sql
-- Phase 1: Multi-Tenancy
churches → schools → academic_years

-- Phase 2: Users
roles → users → user_roles → permissions → role_permissions

-- Phase 3: Students
students → student_profiles → student_parents → medical_notes

-- Phase 4: Curriculum
levels → groups → subjects → level_subjects → lessons → sessions → resources

-- Phase 5: Attendance
attendance_sessions → attendance_records

-- Phase 6: Assessments
assessments → assessment_questions → assessment_submissions → grades

-- Phase 7: Progress
lesson_progress → student_progress → promotion_records

-- Phase 8: Gamification
badges → student_badges → achievements → certificates → xp_transactions

-- Phase 9: Communication
announcements → messages → notifications → events

-- Phase 10: System
audit_logs → system_configs → file_uploads
```

---

## 6. Relationships

### 6.1 Relationship Matrix

| Parent | Child | Cardinality | FK Column | On Delete |
|--------|-------|-------------|-----------|-----------|
| Church | School | 1:N | church_id | RESTRICT |
| School | AcademicYear | 1:N | school_id | RESTRICT |
| School | User | 1:N | school_id | RESTRICT |
| School | Student | 1:N | school_id | RESTRICT |
| School | Level | 1:N | school_id | RESTRICT |
| School | Subject | 1:N | school_id | RESTRICT |
| School | Lesson | 1:N | school_id | RESTRICT |
| School | Resource | 1:N | school_id | RESTRICT |
| School | Assessment | 1:N | school_id | RESTRICT |
| School | Announcement | 1:N | school_id | RESTRICT |
| School | Notification | 1:N | school_id | RESTRICT |
| User | UserRole | 1:N | user_id | CASCADE |
| User | StudentParent | 1:N | parent_id | CASCADE |
| User | AttendanceSession | 1:N | servant_id | RESTRICT |
| User | AttendanceRecord | 1:N | recorded_by | RESTRICT |
| User | Assessment | 1:N | created_by | RESTRICT |
| User | AssessmentSubmission | 1:N | student_id | CASCADE |
| User | Grade | 1:N | graded_by | RESTRICT |
| User | Message | 1:N | sender_id | CASCADE |
| User | Message | 1:N | recipient_id | CASCADE |
| User | AuditLog | 1:N | user_id | SET NULL |
| Role | UserRole | 1:N | role_id | CASCADE |
| Role | RolePermission | 1:N | role_id | CASCADE |
| Permission | RolePermission | 1:N | permission_id | CASCADE |
| AcademicYear | Student | 1:N | academic_year_id | RESTRICT |
| Level | Group | 1:N | level_id | RESTRICT |
| Level | Student | 1:N | level_id | RESTRICT |
| Level | Lesson | 1:N | level_id | RESTRICT |
| Level | Assessment | 1:N | level_id | RESTRICT |
| Level | LevelSubject | 1:N | level_id | CASCADE |
| Level | PromotionRecord | 1:N | from_level_id | RESTRICT |
| Level | PromotionRecord | 1:N | to_level_id | RESTRICT |
| Group | Student | 1:N | group_id | RESTRICT |
| Group | AttendanceSession | 1:N | group_id | RESTRICT |
| Subject | Lesson | 1:N | subject_id | RESTRICT |
| Subject | Assessment | 1:N | subject_id | RESTRICT |
| Subject | LevelSubject | 1:N | subject_id | CASCADE |
| Lesson | Session | 1:N | lesson_id | CASCADE |
| Lesson | Resource | 1:N | lesson_id | SET NULL |
| Lesson | Assessment | 1:N | lesson_id | SET NULL |
| Lesson | LessonProgress | 1:N | lesson_id | CASCADE |
| Session | AttendanceSession | 1:N | session_id | SET NULL |
| Student | StudentProfile | 1:1 | student_id | CASCADE |
| Student | StudentParent | 1:N | student_id | CASCADE |
| Student | MedicalNote | 1:N | student_id | CASCADE |
| Student | AttendanceRecord | 1:N | student_id | CASCADE |
| Student | AssessmentSubmission | 1:N | student_id | CASCADE |
| Student | LessonProgress | 1:N | student_id | CASCADE |
| Student | StudentProgress | 1:N | student_id | CASCADE |
| Student | PromotionRecord | 1:N | student_id | CASCADE |
| Student | StudentBadge | 1:N | student_id | CASCADE |
| Student | Achievement | 1:N | student_id | CASCADE |
| Student | Certificate | 1:N | student_id | CASCADE |
| Student | XPTransaction | 1:N | student_id | CASCADE |
| AttendanceSession | AttendanceRecord | 1:N | attendance_session_id | CASCADE |
| Assessment | AssessmentQuestion | 1:N | assessment_id | CASCADE |
| Assessment | AssessmentSubmission | 1:N | assessment_id | CASCADE |
| AssessmentQuestion | Grade | 1:N | question_id | SET NULL |
| AssessmentSubmission | Grade | 1:N | submission_id | CASCADE |
| Badge | StudentBadge | 1:N | badge_id | CASCADE |
| Level | Certificate | 1:N | level_id | RESTRICT |

---

## 7. Indexes

### 7.1 Primary Indexes (Primary Keys)

All tables use UUID primary keys with default indexes.

### 7.2 Foreign Key Indexes

```sql
-- All foreign key columns should have indexes for JOIN performance
-- Already defined in entity definitions above
```

### 7.3 Performance Indexes

```sql
-- Composite indexes for common queries
CREATE INDEX idx_attendance_records_session_status 
ON attendance_records(attendance_session_id, status);

CREATE INDEX idx_lesson_progress_student_status 
ON lesson_progress(student_id, status);

CREATE INDEX idx_assessment_submissions_assessment_status 
ON assessment_submissions(assessment_id, status);

CREATE INDEX idx_notifications_user_read 
ON notifications(user_id, is_read, created_at DESC);

CREATE INDEX idx_messages_sender_recipient 
ON messages(sender_id, recipient_id, created_at DESC);

CREATE INDEX idx_xp_transactions_student_date 
ON xp_transactions(student_id, created_at DESC);

-- Full-text search indexes
CREATE INDEX idx_lessons_search 
ON lessons USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE INDEX idx_students_search 
ON students USING gin(to_tsvector('english', first_name || ' ' || last_name));

-- Partial indexes for active records
CREATE INDEX idx_users_active ON users(school_id) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_students_active ON students(school_id, level_id, group_id) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_lessons_published ON lessons(school_id, level_id, subject_id) WHERE status = 'published' AND deleted_at IS NULL;

-- Covering indexes for dashboard queries
CREATE INDEX idx_student_progress_covering 
ON student_progress(student_id, academic_year_id, level_id) 
INCLUDE (progress_percent, total_xp, attendance_percent, average_score);

CREATE INDEX idx_attendance_sessions_covering 
ON attendance_sessions(school_id, servant_id, scheduled_date) 
INCLUDE (status, level_id, group_id);
```

### 7.4 Unique Constraints

```sql
ALTER TABLE churches ADD CONSTRAINT uniq_churches_slug UNIQUE (slug);
ALTER TABLE schools ADD CONSTRAINT uniq_schools_slug UNIQUE (slug);
ALTER TABLE users ADD CONSTRAINT uniq_users_email UNIQUE (email);
ALTER TABLE user_roles ADD CONSTRAINT uniq_user_roles_user_role UNIQUE (user_id, role_id);
ALTER TABLE roles ADD CONSTRAINT uniq_roles_name UNIQUE (name);
ALTER TABLE permissions ADD CONSTRAINT uniq_permissions_name UNIQUE (name);
ALTER TABLE level_subjects ADD CONSTRAINT uniq_level_subjects_level_subject UNIQUE (level_id, subject_id);
ALTER TABLE attendance_records ADD CONSTRAINT uniq_attendance_records_session_student UNIQUE (attendance_session_id, student_id);
ALTER TABLE lesson_progress ADD CONSTRAINT uniq_lesson_progress_student_lesson UNIQUE (student_id, lesson_id);
ALTER TABLE system_configs ADD CONSTRAINT uniq_system_configs_school_key UNIQUE (school_id, key);
ALTER TABLE certificates ADD CONSTRAINT uniq_certificates_number UNIQUE (certificate_number);
```

---

## 8. Data Types

### 8.1 UUID Generation

```sql
-- Use uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Or use gen_random_uuid() (PostgreSQL 13+)
DEFAULT gen_random_uuid()
```

### 8.2 JSONB Usage

```sql
-- Localized content
{
  "en": "English text",
  "ar": "Arabic text",
  "coptic": "Coptic text"
}

-- Learning objectives
[
  "Student can recite hymn from memory",
  "Student understands the theological meaning",
  "Student can chant with proper pronunciation"
]

-- Metadata (extensible)
{
  "difficulty": "intermediate",
  "tags": ["tenouchi", "offering", "sunday"],
  "custom_fields": {}
}

-- Gamification criteria
{
  "type": "lesson_complete",
  "required_lessons": 5,
  "required_subject": "coptic_hymns",
  "timeframe_days": 30
}
```

### 8.3 Timestamp Handling

```sql
-- All timestamps in UTC
-- Application layer handles timezone conversion

-- Default timestamp columns
created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
deleted_at TIMESTAMP WITH TIME ZONE NULL
```

### 8.4 Decimal Precision

| Column Type | Precision | Scale | Example |
|-------------|-----------|-------|---------|
| Percentages | 5 | 2 | 85.50% |
| Scores | 10 | 2 | 95.75 |
| XP Points | INTEGER | - | 1500 |
| File Sizes | BIGINT | - | 52428800 |

---

## 9. Multi-Tenancy Strategy

### 9.1 Approach: Shared Database, Row-Level Security

```sql
-- Tenant context function
CREATE OR REPLACE FUNCTION set_tenant_context(p_school_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_school_id', p_school_id::TEXT, TRUE);
END;
$$ LANGUAGE plpgsql;

-- Row-Level Security Policy
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY students_tenant_isolation ON students
  USING (school_id = current_setting('app.current_school_id')::UUID);

-- Apply to all tenant tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
-- ... etc
```

### 9.2 Tenant Data Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-TENANCY MODEL                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Shared Tables (Cross-Tenant)                                   │
│  ├── roles                                                      │
│  ├── permissions                                                │
│  └── system_configs (global)                                    │
│                                                                 │
│  Tenant-Isolated Tables (Row-Level Security)                    │
│  ├── churches                                                   │
│  ├── schools                                                    │
│  ├── users                                                      │
│  ├── students                                                   │
│  ├── curriculum_*                                               │
│  ├── attendance_*                                               │
│  ├── assessments_*                                              │
│  ├── progress_*                                                 │
│  ├── gamification_*                                             │
│  ├── communication_*                                            │
│  └── audit_logs                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. Soft Deletes & Audit

### 10.1 Soft Delete Pattern

```sql
-- Soft delete function
CREATE OR REPLACE FUNCTION soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE SET deleted_at = NOW() WHERE id = OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables
CREATE TRIGGER trg_students_soft_delete
  BEFORE DELETE ON students
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- Query pattern
SELECT * FROM students WHERE deleted_at IS NULL;
```

### 10.2 Audit Trail Pattern

```sql
-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    school_id, user_id, action, entity_type, entity_id,
    old_values, new_values, created_at
  ) VALUES (
    current_setting('app.current_school_id')::UUID,
    current_setting('app.current_user_id')::UUID,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER trg_students_audit
  AFTER INSERT OR UPDATE OR DELETE ON students
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
```

---

## 11. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| DB-01 | PostgreSQL is the chosen RDBMS | Need to adapt for MySQL/SQL Server |
| DB-02 | UUID v4 is acceptable for primary keys | Performance impact on large tables |
| DB-03 | JSONB is sufficient for localized content | May need separate translation tables |
| DB-04 | Row-level security provides adequate isolation | May need schema-per-tenant |
| DB-05 | Soft deletes are acceptable for all entities | May need hard deletes for GDPR |
| DB-06 | Audit triggers have acceptable performance | May need async audit logging |
| DB-07 | 3NF normalization is appropriate | May need more denormalization |
| DB-08 | No legacy data migration required | Need ETL pipeline |
| DB-09 | Single-region deployment is sufficient | Need multi-region replication |
| DB-10 | Read replicas are not needed initially | May need them at scale |

---

## 12. Recommendations

### 12.1 Database Recommendations

1. **Partitioning** – Consider table partitioning for attendance_records and audit_logs by date.

2. **Archival Strategy** – Archive old academic year data to separate tables.

3. **Connection Pooling** – Use PgBouncer for connection management.

4. **Read Replicas** – Plan for read replicas for dashboard analytics.

5. **Backup Schedule** – Daily full backups, hourly incremental, WAL archiving.

### 12.2 Performance Recommendations

1. **Materialized Views** – Create materialized views for aggregated dashboard data.

2. **Query Analysis** – Use pg_stat_statements to identify slow queries.

3. **Index Monitoring** – Monitor index usage and remove unused indexes.

4. **Vacuum Strategy** – Configure autovacuum for high-update tables.

5. **Cache Layer** – Use Redis for frequently accessed, rarely changing data.

---

## 13. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| DR-01 | Data growth exceeds expectations | Medium | Medium | Partitioning, archival, monitoring |
| DR-02 | Row-level security performance overhead | Low | Medium | Benchmark, optimize policies |
| DR-03 | JSONB query performance issues | Medium | Medium | GIN indexes, query optimization |
| DR-04 | UUID primary key fragmentation | Low | Low | Use UUIDv7 or ULID for time-ordered IDs |
| DR-05 | Audit trigger performance impact | Medium | Medium | Async audit logging for high-volume tables |
| DR-06 | Migration complexity for schema changes | Medium | Medium | Use migration tools (Flyway, Alembic) |
| DR-07 | Concurrent user update conflicts | Low | Medium | Optimistic locking with version columns |
| DR-08 | Backup restore time exceeds RPO | Low | High | Regular restore testing, WAL archiving |
| DR-09 | Multi-tenant data leakage | Low | Critical | RLS testing, security audits |
| DR-10 | Database becoming bottleneck | Medium | High | Read replicas, caching, query optimization |

---

## 14. Approval Gate

### Deliverables Summary

| Deliverable | Status |
|-------------|--------|
| Database Design Principles | ✅ Complete |
| Entity Overview (39 entities) | ✅ Complete |
| High-Level ERD | ✅ Complete |
| Detailed ERD | ✅ Complete |
| Entity Definitions (39 entities) | ✅ Complete |
| Schema Design | ✅ Complete |
| Relationships (66 relationships) | ✅ Complete |
| Indexes (Performance, Composite, Partial) | ✅ Complete |
| Data Types | ✅ Complete |
| Multi-Tenancy Strategy | ✅ Complete |
| Soft Deletes & Audit | ✅ Complete |
| Assumptions (10) | ✅ Complete |
| Recommendations | ✅ Complete |
| Risks (10) | ✅ Complete |

### Questions for Approval

1. Is the entity structure complete and logical?
2. Are the relationships correctly defined?
3. Is the multi-tenancy approach (RLS) appropriate?
4. Are the indexes sufficient for expected query patterns?
5. Should any entities be added or removed?
6. Is the audit trail approach acceptable?

### Next Phase Preview

**Phase 5 – Solution Architecture**
- System architecture design
- Cloud architecture
- Backend architecture
- Frontend architecture
- Security model
- Deployment strategy

---

**Awaiting approval to proceed to Phase 5.**
