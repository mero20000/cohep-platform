# Phase 2 – Functional Requirements and User Stories

**NiAngelos School for Hymns and Praises – Digital Platform**

**Document Version:** 1.0
**Date:** July 2026
**Status:** Draft – Pending Approval

---

## Table of Contents

1. [Epic Overview](#1-epic-overview)
2. [Epic 1: Authentication & User Management](#2-epic-1)
3. [Epic 2: Student Management](#3-epic-2)
4. [Epic 3: Curriculum Management](#4-epic-3)
5. [Epic 4: Attendance & Session Management](#5-epic-4)
6. [Epic 5: Assessment & Grading](#6-epic-5)
7. [Epic 6: Progress Tracking & Reporting](#7-epic-6)
8. [Epic 7: Notifications & Communication](#8-epic-7)
9. [Epic 8: Gamification](#9-epic-8)
10. [Epic 9: Search](#10-epic-9)
11. [Epic 10: Dashboards](#11-epic-10)
12. [Epic 11: Reports & Export](#12-epic-11)
13. [Epic 12: Multi-Tenancy & Administration](#13-epic-12)
14. [User Story Mapping](#14-user-story-mapping)
15. [MVP Definition](#15-mvp-definition)
16. [Product Backlog](#16-product-backlog)
17. [Assumptions](#17-assumptions)
18. [Recommendations](#18-recommendations)
19. [Risks](#19-risks)
20. [Approval Gate](#20-approval-gate)

---

## 1. Epic Overview

| Epic | Title | Stories | Priority |
|------|-------|---------|----------|
| E-01 | Authentication & User Management | 18 | P0 – Must Have |
| E-02 | Student Management | 22 | P0 – Must Have |
| E-03 | Curriculum Management | 25 | P0 – Must Have |
| E-04 | Attendance & Session Management | 16 | P0 – Must Have |
| E-05 | Assessment & Grading | 20 | P1 – Should Have |
| E-06 | Progress Tracking & Reporting | 18 | P1 – Should Have |
| E-07 | Notifications & Communication | 15 | P1 – Should Have |
| E-08 | Gamification | 14 | P2 – Nice to Have |
| E-09 | Search | 10 | P1 – Should Have |
| E-10 | Dashboards | 12 | P0 – Must Have |
| E-11 | Reports & Export | 14 | P1 – Should Have |
| E-12 | Multi-Tenancy & Administration | 16 | P0 – Must Have |
| | **TOTAL** | **200** | |

---

## 2. Epic 1: Authentication & User Management

### E-01.1: Registration

**US-001: Parent Self-Registration**
> As a **parent**, I want to register an account using my email or phone number, so that I can access the parent portal and monitor my child's progress.

**Acceptance Criteria:**
- [ ] Registration form accepts email or phone number
- [ ] Password requires minimum 8 characters, 1 uppercase, 1 number
- [ ] Email verification sent within 60 seconds
- [ ] Phone verification via SMS OTP (6 digits, 5-minute expiry)
- [ ] Account created in "Pending" state until verification
- [ ] Duplicate email/phone rejected with clear error message
- [ ] Terms of service and privacy policy acceptance required
- [ ] COPPA consent flow for children under 13

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-002: Servant Invitation-Based Registration**
> As a **school administrator**, I want to invite servants to join the platform via email invitation, so that I can control who has access to the school.

**Acceptance Criteria:**
- [ ] Admin can send invitation with role selection
- [ ] Invitation link valid for 7 days
- [ ] Servant completes profile during onboarding
- [ ] Invitation can be resent or revoked
- [ ] Bulk invitation via CSV upload supported
- [ ] Invitation status tracking (Pending, Accepted, Expired)

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-003: Student Registration**
> As a **parent**, I want to register my child for the school and provide their details, so that they can be enrolled in the appropriate level and group.

**Acceptance Criteria:**
- [ ] Student profile form captures all required fields
- [ ] Photo upload with crop/resize functionality
- [ ] Parent linked to student during registration
- [ ] Level/group assignment by administrator after registration
- [ ] Medical notes field with privacy indicator
- [ ] Registration confirmation email sent to parent

**Priority:** P0 – Must Have
**Story Points:** 5

---

### E-01.2: Authentication

**US-004: Email/Password Login**
> As a **registered user**, I want to log in using my email and password, so that I can securely access my dashboard.

**Acceptance Criteria:**
- [ ] Login form with email and password fields
- [ ] "Remember me" option (30-day session)
- [ ] "Forgot password" link initiates reset flow
- [ ] Account locked after 5 failed attempts (15-minute lockout)
- [ ] Login attempt logging for security audit
- [ ] Redirect to role-appropriate dashboard after login
- [ ] Session timeout after 30 minutes of inactivity

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-005: Password Reset**
> As a **user**, I want to reset my password via email, so that I can regain access if I forget my credentials.

**Acceptance Criteria:**
- [ ] Password reset request sends email within 60 seconds
- [ ] Reset link valid for 1 hour
- [ ] Link can only be used once
- [ ] Password history check (last 5 passwords)
- [ ] All other sessions invalidated on reset
- [ ] Confirmation email sent after successful reset

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-006: Mobile OTP Login**
> As a **user**, I want to log in using a one-time password sent to my phone, so that I can access the platform without remembering a password.

**Acceptance Criteria:**
- [ ] OTP sent via SMS within 30 seconds
- [ ] 6-digit OTP valid for 5 minutes
- [ ] Maximum 3 OTP requests per hour
- [ ] Auto-detection of OTP on mobile devices
- [ ] Fallback to email OTP if SMS fails

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-007: Social Login (Google)**
> As a **user**, I want to sign in using my Google account, so that I can quickly access the platform without creating new credentials.

**Acceptance Criteria:**
- [ ] Google OAuth 2.0 integration
- [ ] First-time social login creates account with minimal fields
- [ ] Existing account linking if email matches
- [ ] Profile photo imported from Google
- [ ] Consent screen shows required permissions

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

### E-01.3: Authorization

**US-008: Role-Based Access Control**
> As a **platform administrator**, I want users to only access features permitted by their role, so that data security and privacy are maintained.

**Acceptance Criteria:**
- [ ] 8 defined roles with permission matrices
- [ ] Permissions enforced at API and UI level
- [ ] Role assignment and modification logged
- [ ] Users cannot elevate their own permissions
- [ ] Permission changes take effect immediately
- [ ] Role hierarchy: Super Admin > Principal > Curriculum Manager > Servant > Assistant Servant > Parent > Student > Guest

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-009: Profile Management**
> As a **user**, I want to view and edit my profile, so that my information is always current.

**Acceptance Criteria:**
- [ ] Profile page displays all user information
- [ ] Editable fields: name, phone, photo, language preference
- [ ] Non-editable fields: email (requires verification to change)
- [ ] Photo upload with crop tool
- [ ] Language preference toggle (English/Arabic)
- [ ] Timezone selection
- [ ] Notification preference management
- [ ] Change password option
- [ ] Two-factor authentication setup

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-010: Session Management**
> As a **user**, I want to see my active sessions and be able to log out from all devices, so that I can maintain account security.

**Acceptance Criteria:**
- [ ] List of active sessions with device/location info
- [ ] Ability to terminate individual sessions
- [ ] "Log out of all devices" button
- [ ] Session expiry notification
- [ ] Concurrent session limit (configurable)

**Priority:** P1 – Should Have
**Story Points:** 3

---

### E-01.4: User Administration

**US-011: User List Management**
> As a **school principal**, I want to view and manage all users in my school, so that I can maintain accurate user records.

**Acceptance Criteria:**
- [ ] Paginated user list with search and filters
- [ ] Filter by role, status, registration date
- [ ] Sort by name, email, role, last login
- [ ] Bulk actions: activate, deactivate, delete
- [ ] User detail view with full profile
- [ ] Export user list to CSV/Excel

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-012: User Deactivation**
> As a **school administrator**, I want to deactivate a user account, so that former servants or parents no longer have access.

**Acceptance Criteria:**
- [ ] Deactivation removes access immediately
- [ ] Data preserved for audit purposes
- [ ] Deactivated user notified via email
- [ ] Reactivation possible within 90 days
- [ ] Deactivation logged in audit trail
- [ ] Confirmation dialog before deactivation

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-013: Role Assignment**
> As a **school principal**, I want to assign or change user roles, so that responsibilities are properly reflected in the system.

**Acceptance Criteria:**
- [ ] Role change requires confirmation
- [ ] Role change logged in audit trail
- [ ] Previous role permissions revoked immediately
- [ ] New role permissions granted immediately
- [ ] Bulk role assignment supported
- [ ] Role change notification sent to user

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-014: Parent-Student Linking**
> As a **parent**, I want to link my account to my children's profiles, so that I can view their progress and receive notifications.

**Acceptance Criteria:**
- [ ] Parent can add child via unique student code
- [ ] Verification required (admin approval or email confirmation)
- [ ] Parent can link multiple children
- [ ] Each child can have up to 2 linked parents
- [ ] Linking audit trail maintained
- [ ] Unlinking requires admin confirmation

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-015: Servant-Class Assignment**
> As a **school administrator**, I want to assign servants to specific classes (level/group), so that teaching responsibilities are clear.

**Acceptance Criteria:**
- [ ] Assignment matrix: Servant ↔ Level/Group
- [ ] Primary and assistant servant roles
- [ ] Assignment effective date tracking
- [ ] Historical assignment records
- [ ] Conflict detection (double-booking)
- [ ] Assignment notification to servant

**Priority:** P0 – Must Have
**Story Points:** 5

---

## 3. Epic 2: Student Management

### E-02.1: Student Profile

**US-016: View Student Profile**
> As a **servant**, I want to view a student's complete profile, so that I can understand their background and needs.

**Acceptance Criteria:**
- [ ] Profile displays: photo, name, DOB, gender, church, school grade
- [ ] Academic year and current level/group displayed
- [ ] Parent information with contact details
- [ ] Medical notes (visible only to authorized roles)
- [ ] Attendance summary card
- [ ] Assessment history card
- [ ] Level/promotion history
- [ ] Notes from servants (add/view)
- [ ] Certificates and badges earned
- [ ] Activity timeline

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-017: Create Student Record**
> As a **school administrator**, I want to create a new student record with all required information, so that the student is properly enrolled.

**Acceptance Criteria:**
- [ ] Required fields: first name, last name, DOB, gender, parent contact
- [ ] Optional fields: church, school grade, medical notes, photo
- [ ] Validation for required fields before save
- [ ] Auto-generated student ID/unique code
- [ ] Academic year auto-assigned
- [ ] Level/group pending assignment
- [ ] Confirmation message on creation
- [ ] Undo option within 5 minutes

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-018: Edit Student Profile**
> As a **school administrator**, I want to update student information, so that records remain accurate.

**Acceptance Criteria:**
- [ ] All profile fields editable by authorized roles
- [ ] Change history maintained
- [ ] Sensitive field changes logged (medical, parent info)
- [ ] Photo replace with crop tool
- [ ] Validation on save
- [ ] Bulk edit for common changes (level promotion)

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-019: Student Photo Management**
> As a **parent**, I want to upload and update my child's photo, so that their profile is current.

**Acceptance Criteria:**
- [ ] Photo upload: JPEG, PNG, WebP
- [ ] Maximum file size: 5MB
- [ ] Auto-resize to standard dimensions
- [ ] Crop tool for face centering
- [ ] Default avatar if no photo
- [ ] Photo history (previous photos archived)

**Priority:** P1 – Should Have
**Story Points:** 3

---

**US-020: Student Search and Filtering**
> As a **servant**, I want to search for students by name, level, group, or other criteria, so that I can quickly find the information I need.

**Acceptance Criteria:**
- [ ] Search by name (partial match, fuzzy)
- [ ] Filter by level, group, status, gender
- [ ] Filter by attendance status
- [ ] Filter by assessment results
- [ ] Sort by name, level, last activity
- [ ] Search results with quick actions
- [ ] Recent searches saved

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-021: Student Level History**
> As a **curriculum manager**, I want to view a student's level history, so that I can track their academic journey.

**Acceptance Criteria:**
- [ ] Timeline view of levels completed
- [ ] Dates of level entry and completion
- [ ] Group assignments within each level
- [ ] Promotions and retentions documented
- [ ] Notes for each level transition
- [ ] Visual progress indicator

**Priority:** P1 – Should Have
**Story Points:** 3

---

**US-022: Student Promotion**
> As a **school principal**, I want to promote students to the next level based on their performance, so that academic progression is managed.

**Acceptance Criteria:**
- [ ] Promotion criteria configurable per level
- [ ] Batch promotion supported
- [ ] Individual promotion override
- [ ] Promotion requires assessment of:
  - [ ] Minimum attendance percentage
  - [ ] Minimum assessment score
  - [ ] Completed lessons count
- [ ] Promotion history maintained
- [ ] Parent notification on promotion
- [ ] Certificate generation on promotion

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-023: Student Demographics**
> As a **school principal**, I want to view student demographic information, so that I can understand the composition of my school.

**Acceptance Criteria:**
- [ ] Gender distribution chart
- [ ] Age distribution chart
- [ ] Church affiliation breakdown
- [ ] Geographic distribution (if applicable)
- [ ] Enrollment trends over time
- [ ] Filter by academic year

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

### E-02.2: Student Medical

**US-024: Medical Notes**
> As a **parent**, I want to add medical information about my child, so that servants are aware of any health considerations.

**Acceptance Criteria:**
- [ ] Medical conditions field (free text)
- [ ] Allergies field (structured + free text)
- [ ] Emergency contact information
- [ ] Privacy indicator (visible only to principal and assigned servants)
- [ ] Medication notes
- [ ] Update history
- [ ] Annual review reminder

**Priority:** P1 – Should Have
**Story Points:** 3

---

### E-02.3: Student Documents

**US-025: Student Document Upload**
> As a **school administrator**, I want to upload documents to a student's profile, so that important records are digitally preserved.

**Acceptance Criteria:**
- [ ] Document types: birth certificate, medical report, certificates, photos
- [ ] Supported formats: PDF, JPEG, PNG, DOCX
- [ ] Maximum file size: 20MB
- [ ] Document categorization
- [ ] Version control
- [ ] Access control by role
- [ ] Download and print options

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

## 4. Epic 3: Curriculum Management

### E-03.1: Curriculum Structure

**US-026: Manage Levels**
> As a **curriculum manager**, I want to create and configure educational levels (1-10), so that the curriculum is properly structured.

**Acceptance Criteria:**
- [ ] Levels 1-10 configurable
- [ ] Level name and description
- [ ] Level-specific settings (sessions per lesson, assessment requirements)
- [ ] Level prerequisites
- [ ] Level status (Active, Draft, Archived)
- [ ] Reordering capability
- [ ] Duplicate level structure option

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-027: Manage Groups**
> As a **curriculum manager**, I want to create groups (1-4) within each level, so that students can be organized by proficiency.

**Acceptance Criteria:**
- [ ] 1-4 groups per level configurable
- [ ] Group naming convention (Group 1, Group 2, etc.)
- [ ] Group capacity limits
- [ ] Group-specific curriculum assignments
- [ ] Group status management

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-028: Manage Subjects**
> As a **curriculum manager**, I want to define subjects within each level, so that the three educational pillars are clearly organized.

**Acceptance Criteria:**
- [ ] Three core subjects: Coptic Hymns, Coptic Rites, Coptic Language
- [ ] Custom subject creation supported
- [ ] Subject description and objectives
- [ ] Subject-specific resources
- [ ] Subject status management
- [ ] Subject order within level

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-029: Manage Lessons**
> As a **curriculum manager**, I want to create lessons with learning objectives and resources, so that servants have clear teaching guides.

**Acceptance Criteria:**
- [ ] Lesson title and description
- [ ] Learning objectives (multiple per lesson)
- [ ] Estimated teaching duration
- [ ] Prerequisites (link to other lessons)
- [ ] Required memorization content
- [ ] Lesson ordering within subject
- [ ] Lesson status (Draft, Published, Archived)
- [ ] Batch lesson creation

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-030: Manage Sessions**
> As a **curriculum manager**, I want to divide lessons into sessions, so that teaching can be structured across multiple class periods.

**Acceptance Criteria:**
- [ ] Configurable number of sessions per lesson
- [ ] Session title and description
- [ ] Session-specific objectives
- [ ] Session duration estimate
- [ ] Session resources linked
- [ ] Session ordering
- [ ] Session dependencies within lesson

**Priority:** P0 – Must Have
**Story Points:** 5

---

### E-03.2: Content Management

**US-031: Upload Lesson Resources**
> As a **curriculum manager**, I want to upload various resource types to lessons, so that servants have diverse teaching materials.

**Acceptance Criteria:**
- [ ] Supported formats:
  - [ ] PDF documents
  - [ ] Audio files (MP3, WAV, OGG)
  - [ ] Video files (MP4, WebM)
  - [ ] Images (JPEG, PNG, WebP)
  - [ ] PowerPoint (PPTX)
  - [ ] YouTube embeds
  - [ ] Sheet music (images, PDF)
- [ ] Maximum file size: 100MB (video), 50MB (audio), 20MB (others)
- [ ] Resource categorization (Primary, Supplementary, Homework)
- [ ] Resource ordering
- [ ] Preview capability for all formats

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-032: Multi-Language Content**
> As a **curriculum manager**, I want to add content in English, Arabic, and Coptic, so that lessons are accessible to all students.

**Acceptance Criteria:**
- [ ] Content tabs for each language (EN, AR, CO)
- [ ] Independent content per language
- [ ] Coptic text input with proper Unicode support
- [ ] Coptic font rendering verification
- [ ] Language-specific resource attachments
- [ ] Translation status indicator
- [ ] Side-by-side view for comparison

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-033: Coptic Text Editor**
> As a **curriculum manager**, I want a specialized text editor for Coptic content, so that Coptic text is properly formatted and displayed.

**Acceptance Criteria:**
- [ ] Coptic Unicode support (U+2C80–U+2CFF)
- [ ] Coptic keyboard layout option
- [ ] Diacritical marks support
- [ ] Text formatting (bold, italic, underline)
- [ ] Font size adjustment
- [ ] Preview with standard Coptic fonts
- [ ] Copy/paste from Coptic text sources

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-034: Interactive Quizzes**
> As a **curriculum manager**, I want to create interactive quizzes for lessons, so that student understanding can be assessed.

**Acceptance Criteria:**
- [ ] Question types: Multiple choice, True/False, Fill-in-the-blank, Ordering
- [ ] Multiple correct answers supported
- [ ] Points per question configurable
- [ ] Time limit per quiz (optional)
- [ ] Random question ordering option
- [ ] Immediate feedback option
- [ ] Quiz templates
- [ ] Bulk question import

**Priority:** P1 – Should Have
**Story Points:** 8

---

**US-035: Audio Playback Integration**
> As a **servant**, I want to play hymn audio directly from the lesson, so that students can listen and learn.

**Acceptance Criteria:**
- [ ] Audio player with play/pause/seek
- [ ] Volume control
- [ ] Playback speed adjustment (0.5x, 0.75x, 1x, 1.25x, 1.5x)
- [ ] Loop section functionality
- [ ] A/B repeat for practice
- [ ] Playlist support for multiple hymns
- [ ] Background playback

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-036: Video Playback Integration**
> As a **student**, I want to watch tutorial videos for hymns, so that I can learn visually.

**Acceptance Criteria:**
- [ ] Video player with standard controls
- [ ] Full-screen mode
- [ ] Quality selection
- [ ] Subtitle/caption support
- [ ] Playback speed adjustment
- [ ] Picture-in-picture mode
- [ ] Resume from last position

**Priority:** P1 – Should Have
**Story Points:** 5

---

### E-03.3: Curriculum Publishing

**US-037: Publish Curriculum**
> As a **curriculum manager**, I want to publish curriculum to specific levels/groups, so that servants can access it.

**Acceptance Criteria:**
- [ ] Publish entire level or individual subjects
- [ ] Schedule publish date
- [ ] Publish confirmation dialog
- [ ] Rollback capability
- [ ] Publish notification to assigned servants
- [ ] Version tracking on publish

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-038: Curriculum Versioning**
> As a **curriculum manager**, I want to maintain version history of curriculum changes, so that I can revert if needed.

**Acceptance Criteria:**
- [ ] Auto-version on significant changes
- [ ] Manual version creation
- [ ] Version comparison (diff view)
- [ ] Revert to previous version
- [ ] Version notes/description
- [ ] Version status (Draft, Current, Archived)

**Priority:** P1 – Should Have
**Story Points:** 5

---

## 5. Epic 4: Attendance & Session Management

### E-04.1: Attendance Recording

**US-039: Mark Attendance**
> As a **servant**, I want to quickly mark student attendance at the start of each class, so that attendance records are accurate.

**Acceptance Criteria:**
- [ ] Class roster displayed with student photos
- [ ] One-tap status selection: Present, Late, Excused, Absent
- [ ] Default status option (e.g., all Present)
- [ ] Bulk actions: Mark All Present, Mark All Absent
- [ ] Time stamp recorded automatically
- [ ] Save confirmation
- [ ] Edit attendance within 24 hours (with reason)

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-040: Homework Status Recording**
> As a **servant**, I want to record homework completion during attendance, so that I can track student engagement.

**Acceptance Criteria:**
- [ ] Homework status per student: Completed, Missing, Partial
- [ ] Quick toggle during attendance flow
- [ ] Notes field for homework issues
- [ ] Homework status linked to lesson
- [ ] Parent notification for missing homework

**Priority:** P0 – Must Have
**Story Points:** 3

---

**US-041: Servant Notes**
> As a **servant**, I want to add notes to attendance records, so that I can document student behavior or issues.

**Acceptance Criteria:**
- [ ] Notes field per student per session
- [ ] Note categories: Behavioral, Medical, Academic, General
- [ ] Private vs. shared notes toggle
- [ ] Note history maintained
- [ ] Search within notes

**Priority:** P1 – Should Have
**Story Points:** 3

---

### E-04.2: Session Scheduling

**US-042: Create Class Session**
> As a **servant**, I want to create upcoming class sessions, so that the schedule is planned.

**Acceptance Criteria:**
- [ ] Session date and time picker
- [ ] Recurring session support (weekly, bi-weekly)
- [ ] Session linked to lesson/session
- [ ] Duration estimate auto-populated
- [ ] Calendar view for scheduling
- [ ] Conflict detection
- [ ] Session reminder (24 hours before)

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-043: Calendar View**
> As a **servant**, I want to see my teaching schedule in a calendar view, so that I can plan my time.

**Acceptance Criteria:**
- [ ] Monthly, weekly, daily views
- [ ] Color-coded by level/group
- [ ] Click to view session details
- [ ] Drag to reschedule (with confirmation)
- [ ] Today indicator
- [ ] Export to Google/Apple Calendar

**Priority:** P1 – Should Have
**Story Points:** 5

---

### E-04.3: Attendance Analytics

**US-044: Attendance Dashboard**
> As a **principal**, I want to view school-wide attendance analytics, so that I can identify trends and issues.

**Acceptance Criteria:**
- [ ] Overall attendance percentage
- [ ] Attendance by level/group
- [ ] Attendance trends over time (chart)
- [ ] Most common absence days
- [ ] Chronic absenteeism identification (configurable threshold)
- [ ] Comparison across academic years

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-045: Student Attendance History**
> As a **parent**, I want to view my child's attendance history, so that I can monitor their participation.

**Acceptance Criteria:**
- [ ] Calendar view of attendance
- [ ] Color-coded days (Present=green, Absent=red, Late=yellow, Excused=blue)
- [ ] Attendance percentage summary
- [ ] Filter by date range
- [ ] Export attendance report

**Priority:** P0 – Must Have
**Story Points:** 3

---

## 6. Epic 5: Assessment & Grading

### E-05.1: Assessment Types

**US-046: Create Written Exam**
> As a **servant**, I want to create written exams for my students, so that I can assess their knowledge.

**Acceptance Criteria:**
- [ ] Exam title and description
- [ ] Question bank integration
- [ ] Question types: MCQ, Short answer, Essay
- [ ] Points per question
- [ ] Time limit (optional)
- [ ] Passing score configuration
- [ ] Exam scheduling

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-047: Create Oral Exam**
> As a **servant**, I want to create oral examination sessions, so that I can assess students' recitation abilities.

**Acceptance Criteria:**
- [ ] Oral exam criteria definition
- [ ] Rubric-based scoring
- [ ] Audio recording option
- [ ] Notes per student
- [ ] Batch scoring interface
- [ ] Comparison with previous assessments

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-048: Practical Hymn Assessment**
> As a **servant**, I want to assess students' hymn recitation performance, so that I can evaluate their practical skills.

**Acceptance Criteria:**
- [ ] Assessment criteria: Pitch, Rhythm, Pronunciation, Confidence
- [ ] Rubric scoring (1-5 or 1-10)
- [ ] Audio/video recording of performance
- [ ] Comparison with reference audio
- [ ] Historical performance tracking
- [ ] Improvement recommendations

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-049: Audio/Video Submission**
> As a **student**, I want to submit audio or video recordings of my practice, so that my servant can assess my progress.

**Acceptance Criteria:**
- [ ] In-app recording (audio and video)
- [ ] File upload from device
- [ ] Maximum duration: 10 minutes (audio), 5 minutes (video)
- [ ] File size limit: 50MB
- [ ] Progress indicator during upload
- [ ] Resumable upload for large files
- [ ] Submission timestamp recorded

**Priority:** P1 – Should Have
**Story Points:** 8

---

### E-05.2: Grading

**US-050: Manual Grading**
> As a **servant**, I want to grade student submissions manually, so that I can provide personalized assessment.

**Acceptance Criteria:**
- [ ] Student submission queue
- [ ] Grading interface with rubric
- [ ] Score entry with comments
- [ ] Partial credit support
- [ ] Batch grading for similar submissions
- [ ] Grade override with reason
- [ ] Grade publication control

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-051: Rubric-Based Assessment**
> As a **curriculum manager**, I want to create rubrics for assessments, so that grading is consistent and transparent.

**Acceptance Criteria:**
- [ ] Rubric creation with criteria and levels
- [ ] Point-based and descriptive rubrics
- [ ] Rubric templates
- [ ] Rubric assignment to assessments
- [ ] Rubric-based score calculation
- [ ] Student-facing rubric view

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-052: Automatic Grading**
> As a **servant**, I want quizzes to be automatically graded, so that I can focus on higher-value assessment.

**Acceptance Criteria:**
- [ ] MCQ auto-grading
- [ ] True/False auto-grading
- [ ] Fill-in-the-blank auto-grading (with variations)
- [ ] Instant score publication (optional)
- [ ] Grade calculation with weights
- [ ] Statistical analysis of results

**Priority:** P1 – Should Have
**Story Points:** 5

---

### E-05.3: Assessment Management

**US-053: Assessment History**
> As a **parent**, I want to view my child's assessment history, so that I can track their academic progress.

**Acceptance Criteria:**
- [ ] List of all assessments with scores
- [ ] Filter by subject, type, date
- [ ] Trend chart showing improvement
- [ ] Detailed view per assessment
- [ ] Servant feedback visible
- [ ] Export individual assessment report

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-054: Promotion Readiness**
> As a **principal**, I want to see promotion readiness for each student, so that I can make informed promotion decisions.

**Acceptance Criteria:**
- [ ] Promotion criteria check:
  - [ ] Minimum attendance: configurable (e.g., 80%)
  - [ ] Minimum average score: configurable (e.g., 70%)
  - [ ] Completed lessons: configurable percentage
- [ ] Traffic light indicator: Ready (green), At Risk (yellow), Not Ready (red)
- [ ] Detailed breakdown per criterion
- [ ] Override capability with reason
- [ ] Batch promotion analysis

**Priority:** P0 – Must Have
**Story Points:** 8

---

## 7. Epic 6: Progress Tracking & Reporting

### E-06.1: Lesson Progress

**US-055: Track Lesson Completion**
> As a **servant**, I want to mark lessons as completed for my class, so that progress is accurately tracked.

**Acceptance Criteria:**
- [ ] Lesson status updates:
  - [ ] Not Started
  - [ ] In Progress
  - [ ] Memorized
  - [ ] Reviewed
  - [ ] Passed Assessment
  - [ ] Needs Improvement
  - [ ] Completed
- [ ] Status change with timestamp
- [ ] Notes on status change
- [ ] Bulk status update for class
- [ ] Student self-assessment option

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-056: Student Progress Dashboard**
> As a **student**, I want to see my progress across all subjects, so that I know where I stand.

**Acceptance Criteria:**
- [ ] Progress circles for each subject
- [ ] Overall completion percentage
- [ ] Lessons completed vs. total
- [ ] Current streak display
- [ ] Recent activity feed
- [ ] Upcoming milestones
- [ ] Comparison with previous period

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-057: Visual Progress Indicators**
> As a **parent**, I want to see visual charts of my child's progress, so that I can quickly understand their performance.

**Acceptance Criteria:**
- [ ] Progress bar per subject
- [ ] Radar chart for skill areas
- [ ] Timeline view of milestones
- [ ] Trend line for scores over time
- [ ] Color-coded performance indicators
- [ ] Interactive (click for details)

**Priority:** P1 – Should Have
**Story Points:** 5

---

### E-06.2: Progress Analytics

**US-058: Class Progress Overview**
> As a **servant**, I want to see my class's overall progress, so that I can adjust my teaching.

**Acceptance Criteria:**
- [ ] Class average completion
- [ ] Distribution of student progress
- [ ] Most/least completed lessons
- [ ] Students needing attention
- [ ] Comparison with other classes
- [ ] Export class progress report

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-059: Level Progress Analytics**
> As a **principal**, I want to see progress analytics across all levels, so that I can identify systemic issues.

**Acceptance Criteria:**
- [ ] Level-by-level comparison
- [ ] Subject performance comparison
- [ ] Year-over-year trends
- [ ] Identifies best/worst performing areas
- [ ] Actionable insights

**Priority:** P1 – Should Have
**Story Points:** 8

---

## 8. Epic 7: Notifications & Communication

### E-07.1: Notifications

**US-060: Attendance Notifications**
> As a **parent**, I want to receive notifications when my child is marked absent, so that I am immediately informed.

**Acceptance Criteria:**
- [ ] Push notification on absence
- [ ] Email notification with details
- [ ] SMS notification (optional)
- [ ] Notification includes: date, class, servant name
- [ ] Parent can acknowledge notification
- [ ] Notification history available

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-061: Homework Notifications**
> As a **parent**, I want to receive notifications about homework assignments and completions, so that I can support my child.

**Acceptance Criteria:**
- [ ] New homework notification
- [ ] Homework completion notification
- [ ] Missing homework alert
- [ ] Notification includes: lesson, due date, status
- [ ] Parent can view homework details from notification

**Priority:** P1 – Should Have
**Story Points:** 3

---

**US-062: Assessment Notifications**
> As a **parent**, I want to receive notifications when assessment results are published, so that I can review them with my child.

**Acceptance Criteria:**
- [ ] Results published notification
- [ ] Includes: subject, score, servant comments
- [ ] Link to detailed assessment view
- [ ] Celebration animation for high scores

**Priority:** P1 – Should Have
**Story Points:** 3

---

**US-063: Announcement System**
> As a **principal**, I want to send announcements to all parents, servants, or specific groups, so that important information is communicated.

**Acceptance Criteria:**
- [ ] Announcement creation with rich text
- [ ] Target audience selection
- [ ] Schedule for future delivery
- [ ] Multi-channel delivery (push, email, SMS)
- [ ] Read receipt tracking
- [ ] Announcement history
- [ ] Pin important announcements

**Priority:** P0 – Must Have
**Story Points:** 5

---

### E-07.2: Communication

**US-064: In-App Messaging**
> As a **parent**, I want to message my child's servant directly, so that I can discuss concerns privately.

**Acceptance Criteria:**
- [ ] Direct messaging between parent and servant
- [ ] Message threading
- [ ] Text and image support
- [ ] Read receipts
- [ ] Notification on new message
- [ ] Message history
- [ ] Block/report functionality

**Priority:** P1 – Should Have
**Story Points:** 8

---

**US-065: Event Management**
> As a **principal**, I want to create and manage school events, so that parents and servants are informed.

**Acceptance Criteria:**
- [ ] Event creation with date, time, location, description
- [ ] RSVP functionality
- [ ] Calendar integration
- [ ] Reminder notifications
- [ ] Event photos/updates
- [ ] Recurring events

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

## 9. Epic 8: Gamification

### E-08.1: Points & Levels

**US-066: XP Points System**
> As a **student**, I want to earn XP points for completing activities, so that I am motivated to learn.

**Acceptance Criteria:**
- [ ] XP awarded for:
  - [ ] Lesson completion: 100 XP
  - [ ] Assessment passed: 150 XP
  - [ ] Perfect score: 200 XP
  - [ ] Attendance streak: 50 XP/day
  - [ ] Homework completion: 50 XP
  - [ ] Practice recording: 75 XP
- [ ] XP visible on profile
- [ ] XP history
- [ ] Anti-cheating measures

**Priority:** P1 – Should Have
**Story Points:** 8

---

**US-067: Student Levels**
> As a **student**, I want to level up as I earn XP, so that I can see my growth.

**Acceptance Criteria:**
- [ ] Level thresholds:
  - [ ] Level 1: 0 XP
  - [ ] Level 2: 500 XP
  - [ ] Level 3: 1500 XP
  - [ ] Level 4: 3000 XP
  - [ ] Level 5: 5000 XP
  - [ ] (continuing progression)
- [ ] Level-up animation
- [ ] Level badge displayed on profile
- [ ] Level benefits (unlock new features)

**Priority:** P1 – Should Have
**Story Points:** 5

---

### E-08.2: Badges & Achievements

**US-068: Badge System**
> As a **student**, I want to earn badges for achievements, so that I have tangible goals to work toward.

**Acceptance Criteria:**
- [ ] Badge categories:
  - [ ] Learning (First Lesson, Level Complete, Subject Master)
  - [ ] Consistency (7-Day Streak, 30-Day Streak)
  - [ ] Assessment (Perfect Score, Improvement Award)
  - [ ] Community (Helping Others, Best Servant Vote)
- [ ] Badge display on profile
- [ ] Badge collection view
- [ ] Badge notification on earn
- [ ] Rare/special badges

**Priority:** P1 – Should Have
**Story Points:** 8

---

**US-069: Digital Certificates**
> As a **student**, I want to receive digital certificates for completing levels, so that I have proof of achievement.

**Acceptance Criteria:**
- [ ] Certificate template with:
  - [ ] Student name
  - [ ] Level completed
  - [ ] Date
  - [ ] School name
  - [ ] Principal signature
  - [ ] Unique certificate ID
- [ ] PDF download
- [ ] Shareable link
- [ ] Verification page
- [ ] Certificate wallet

**Priority:** P0 – Must Have
**Story Points:** 8

---

### E-08.3: Leaderboards & Recognition

**US-070: Class Leaderboard**
> As a **student**, I want to see how I rank among my classmates, so that I am motivated to do better.

**Acceptance Criteria:**
- [ ] Class-level leaderboard only (not school-wide)
- [ ] Based on XP points
- [ ] Opt-out option (privacy)
- [ ] Monthly reset option
- [ ] Positive framing (show top 10, not bottom)
- [ ] Celebration for improvements

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

**US-071: Monthly Recognition**
> As a **principal**, I want to recognize outstanding students each month, so that achievement is celebrated.

**Acceptance Criteria:**
- [ ] Monthly top performers by level
- [ ] Most improved student
- [ ] Best attendance
- [ ] Certificate generation
- [ ] Announcement to school
- [ ] Photo gallery

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

**US-072: Progress Streaks**
> As a **student**, I want to maintain learning streaks, so that I am motivated to practice daily.

**Acceptance Criteria:**
- [ ] Daily practice streak tracking
- [ ] Streak freeze (2 per month)
- [ ] Streak milestones (7, 30, 100 days)
- [ ] Streak display on dashboard
- [ ] Streak notification reminders

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

## 10. Epic 9: Search

### E-09.1: Global Search

**US-073: Student Search**
> As a **servant**, I want to search for students by name, level, or other criteria, so that I can quickly find information.

**Acceptance Criteria:**
- [ ] Instant search with debouncing
- [ ] Results grouped by category
- [ ] Recent searches
- [ ] Search suggestions
- [ ] Keyboard navigation
- [ ] Mobile search overlay

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-074: Curriculum Search**
> As a **servant**, I want to search for lessons and hymns by title, content, or keyword, so that I can find resources quickly.

**Acceptance Criteria:**
- [ ] Search across lesson titles and descriptions
- [ ] Search within Coptic, Arabic, and English content
- [ ] Filter by subject, level, type
- [ ] Highlight matching terms
- [ ] Preview search results
- [ ] Quick action buttons

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-075: Multi-Language Search**
> As a **user**, I want to search in English, Arabic, or Coptic, so that I can find content regardless of language.

**Acceptance Criteria:**
- [ ] Language detection
- [ ] Cross-language search
- [ ] Coptic text search with Unicode
- [ ] Arabic text search with diacritics
- [ ] Search results in original language
- [ ] Transliteration support

**Priority:** P1 – Should Have
**Story Points:** 8

---

## 11. Epic 10: Dashboards

### E-10.1: Student Dashboard

**US-076: Student Home Dashboard**
> As a **student**, I want a personalized dashboard showing my progress and upcoming activities, so that I know what to focus on.

**Acceptance Criteria:**
- [ ] Welcome message with name
- [ ] Today's classes
- [ ] Upcoming homework
- [ ] Recent assessment results
- [ ] Progress summary (XP, level, streak)
- [ ] Quick actions (Start Practice, View Lessons)
- [ ] Announcements

**Priority:** P0 – Must Have
**Story Points:** 8

---

### E-10.2: Parent Dashboard

**US-077: Parent Home Dashboard**
> As a **parent**, I want a dashboard showing all my children's information at a glance, so that I can monitor the whole family.

**Acceptance Criteria:**
- [ ] Child selector (if multiple children)
- [ ] Attendance summary
- [ ] Recent assessment scores
- [ ] Upcoming events
- [ ] Unread notifications count
- [ ] Quick links to detailed views
- [ ] Children's XP and level display

**Priority:** P0 – Must Have
**Story Points:** 8

---

### E-10.3: Servant Dashboard

**US-078: Servant Home Dashboard**
> As a **servant**, I want a dashboard showing my teaching schedule and class overview, so that I can plan my day.

**Acceptance Criteria:**
- [ ] Today's schedule
- [ ] Class attendance summary
- [ ] Pending assessments to grade
- [ ] Student messages
- [ ] Recent activity feed
- [ ] Quick attendance marking
- [ ] Class performance overview

**Priority:** P0 – Must Have
**Story Points:** 8

---

### E-10.4: Principal Dashboard

**US-079: Principal Home Dashboard**
> As a **principal**, I want a school-wide dashboard with key metrics, so that I have a bird's eye view.

**Acceptance Criteria:**
- [ ] Total students, servants, classes
- [ ] Overall attendance rate
- [ ] Average assessment scores
- [ ] Upcoming events
- [ ] Recent announcements
- [ ] Alert cards (low attendance, at-risk students)
- [ ] Servant activity summary

**Priority:** P0 – Must Have
**Story Points:** 8

---

### E-10.5: Curriculum Manager Dashboard

**US-080: Curriculum Manager Dashboard**
> As a **curriculum manager**, I want a dashboard showing curriculum status and coverage, so that I can plan updates.

**Acceptance Criteria:**
- [ ] Curriculum completion by level
- [ ] Content gaps identified
- [ ] Recent curriculum changes
- [ ] Upcoming reviews
- [ ] Content statistics (lessons, resources)

**Priority:** P1 – Should Have
**Story Points:** 5

---

## 12. Epic 11: Reports & Export

### E-11.1: Report Generation

**US-081: Attendance Report**
> As a **principal**, I want to generate attendance reports, so that I can analyze participation patterns.

**Acceptance Criteria:**
- [ ] Date range selection
- [ ] Filter by level, group, student
- [ ] Summary statistics
- [ ] Detailed breakdown
- [ ] Chart visualization
- [ ] PDF export
- [ ] Excel export

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-082: Student Progress Report**
> As a **parent**, I want to generate a progress report for my child, so that I have a document showing their achievement.

**Acceptance Criteria:**
- [ ] Comprehensive progress summary
- [ ] Subject-by-subject breakdown
- [ ] Attendance record
- [ ] Assessment scores
- [ ] Teacher comments
- [ ] Recommendations
- [ ] PDF generation with school branding
- [ ] Download and print options

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-083: Assessment Results Report**
> As a **servant**, I want to generate assessment result reports, so that I can analyze class performance.

**Acceptance Criteria:**
- [ ] Class performance summary
- [ ] Individual student scores
- [ ] Score distribution chart
- [ ] Question analysis (for MCQ)
- [ ] Comparison with previous assessments
- [ ] Export options

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-084: Curriculum Completion Report**
> As a **curriculum manager**, I want to see curriculum completion rates, so that I can identify gaps.

**Acceptance Criteria:**
- [ ] Completion by level/group/subject
- [ ] Lessons taught vs. planned
- [ ] Upcoming lessons
- [ ] Overdue lessons
- [ ] Servant teaching pace analysis

**Priority:** P1 – Should Have
**Story Points:** 5

---

**US-085: Servant Performance Report**
> As a **principal**, I want to view servant performance metrics, so that I can support my team.

**Acceptance Criteria:**
- [ ] Attendance recording consistency
- [ ] Assessment grading timeliness
- [ ] Student satisfaction scores
- [ ] Class performance correlation
- [ ] Activity metrics

**Priority:** P2 – Nice to Have
**Story Points:** 8

---

**US-086: Certificate Report**
> As a **principal**, I want to see all certificates issued, so that I can track achievements.

**Acceptance Criteria:**
- [ ] List of certificates issued
- [ ] Filter by level, date, student
- [ ] Certificate verification
- [ ] Batch certificate generation
- [ ] Certificate revocation

**Priority:** P2 – Nice to Have
**Story Points:** 5

---

## 13. Epic 12: Multi-Tenancy & Administration

### E-12.1: Church Management

**US-087: Church Profile**
> As a **super administrator**, I want to manage church profiles, so that each church is properly configured.

**Acceptance Criteria:**
- [ ] Church name, logo, branding
- [ ] Timezone configuration
- [ ] Language preferences
- [ ] Contact information
- [ ] Subscription plan
- [ ] Usage statistics

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-088: School Management**
> As a **church administrator**, I want to manage multiple schools within the church, so that each school is independently managed.

**Acceptance Criteria:**
- [ ] School profile creation
- [ ] School-specific settings
- [ ] Staff assignment
- [ ] Curriculum assignment
- [ ] Cross-school analytics

**Priority:** P0 – Must Have
**Story Points:** 5

---

### E-12.2: Configuration

**US-089: Academic Year Configuration**
> As a **school administrator**, I want to configure academic years, so that the system follows the school calendar.

**Acceptance Criteria:**
- [ ] Academic year definition (start/end dates)
- [ ] Term/semester definition
- [ ] Holiday calendar
- [ ] Registration periods
- [ ] Historical year archiving

**Priority:** P0 – Must Have
**Story Points:** 5

---

**US-090: System Configuration**
> As a **super administrator**, I want to configure system-wide settings, so that the platform meets specific needs.

**Acceptance Criteria:**
- [ ] Notification templates
- [ ] Email templates
- [ ] Gamification settings (XP values, level thresholds)
- [ ] File storage settings
- [ ] Integration settings
- [ ] Feature flags

**Priority:** P0 – Must Have
**Story Points:** 8

---

### E-12.3: Audit & Security

**US-091: Audit Log**
> As a **super administrator**, I want to view audit logs, so that I can track system activity for security.

**Acceptance Criteria:**
- [ ] Log all critical actions:
  - [ ] Login/logout
  - [ ] Data changes
  - [ ] Permission changes
  - [ ] Deletion actions
- [ ] Filter by user, action, date
- [ ] Log retention policy
- [ ] Export audit logs
- [ ] Real-time alerting for suspicious activity

**Priority:** P0 – Must Have
**Story Points:** 8

---

**US-092: Data Backup**
> As a **super administrator**, I want automated data backups, so that data is protected.

**Acceptance Criteria:**
- [ ] Daily automated backups
- [ ] Backup verification
- [ ] Restore capability
- [ ] Backup retention (30 days)
- [ ] Encrypted backups
- [ ] Off-site backup storage

**Priority:** P0 – Must Have
**Story Points:** 5

---

## 14. User Story Mapping

### 14.1 Story Map by Priority

```
                            RELEASE 1 (MVP)              RELEASE 2              RELEASE 3
                         ───────────────────         ──────────────         ──────────────
                         P0: Must Have               P1: Should Have        P2: Nice to Have
                         ═════════════════           ══════════════         ══════════════

BACKBONE (Critical Path)
├── Authentication           US-004,005,008         US-006,007,010        -
├── Student Management       US-016,017,018         US-019,021,024,025   US-023
├── Curriculum Structure     US-026,027,028,029,030 US-034,036,038        -
├── Content Management       US-031,032,033,035     -                    -
├── Attendance               US-039,040,045         US-041,042,043,044   -
├── Assessment               US-046,048,050         US-047,049,051,052   -
├── Progress Tracking        US-055,056             US-057,058,059        -
├── Dashboards               US-076,077,078,079     US-080                -
├── Reports                  US-081,082             US-083,084            US-085,086
├── Notifications            US-060,063             US-061,062            US-065
├── Search                   US-073                 US-074,075            -
└── Multi-Tenancy            US-087,088,089,090,091,092 -                -

STORY CARDS (Detailed)
├── Registration             US-001,002,003         US-007                -
├── Authorization            US-009,011,012,013,014,015 -                -
├── Content                  -                      US-034,036,038        -
├── Gamification             -                      US-066,067,068,069   US-070,071,072
├── Communication            -                      US-064               US-065
└── Documents                -                      US-025               -
```

### 14.2 Release Summary

| Release | Stories | Focus | Timeline |
|---------|---------|-------|----------|
| **Release 1 (MVP)** | 45 stories | Core functionality: auth, students, curriculum, attendance, basic assessment, dashboards, reports | Months 1-4 |
| **Release 2** | 35 stories | Enhanced features: advanced assessment, gamification v1, search, messaging, curriculum versioning | Months 5-7 |
| **Release 3** | 20 stories | Nice-to-have: leaderboards, events, advanced reports, certificates, social features | Months 8-10 |

---

## 15. MVP Definition

### 15.1 MVP Scope

The Minimum Viable Product includes only P0 (Must Have) stories that deliver core value:

**Authentication & User Management (11 stories)**
- Registration flows (parent, servant, student)
- Login/logout
- Password reset
- Role-based access control
- Profile management
- User administration
- Parent-student linking
- Servant-class assignment

**Student Management (7 stories)**
- Student profile view/create/edit
- Student search and filtering
- Student promotion
- Medical notes

**Curriculum Management (10 stories)**
- Level, group, subject, lesson, session management
- Resource upload (all formats)
- Multi-language content
- Coptic text editor
- Audio playback
- Curriculum publishing

**Attendance & Session Management (5 stories)**
- Mark attendance
- Homework status
- Session scheduling
- Attendance history (parent view)

**Assessment & Grading (3 stories)**
- Written exam creation
- Practical hymn assessment
- Manual grading
- Promotion readiness

**Progress Tracking (2 stories)**
- Lesson completion tracking
- Student progress dashboard

**Dashboards (4 stories)**
- Student, parent, servant, principal dashboards

**Notifications (2 stories)**
- Attendance notifications
- Announcement system

**Search (1 story)**
- Student search

**Reports (2 stories)**
- Attendance report
- Student progress report

**Multi-Tenancy (6 stories)**
- Church profile
- School management
- Academic year configuration
- System configuration
- Audit log
- Data backup

### 15.2 MVP Success Criteria

| Metric | Target |
|--------|--------|
| User registration completion rate | > 80% |
| Daily active users (servants) | > 70% of enrolled |
| Daily active users (parents) | > 40% of linked |
| Attendance recording time | < 30 seconds per class |
| Student search response time | < 500ms |
| Page load time | < 2 seconds |
| User satisfaction (NPS) | > 40 |
| Critical bugs | 0 |

### 15.3 MVP Exclusions (Post-MVP)

- Social login (Google)
- SMS/WhatsApp notifications
- Interactive quizzes
- Video playback
- Curriculum versioning
- Advanced gamification (leaderboards, streaks)
- In-app messaging
- Event management
- Advanced reports
- Student demographics

---

## 16. Product Backlog

### 16.1 Backlog Prioritization (MoSCoW)

| Priority | Count | Description |
|----------|-------|-------------|
| **Must Have** | 85 | MVP and critical features |
| **Should Have** | 70 | Important for full experience |
| **Could Have** | 35 | Nice additions |
| **Won't Have (this time)** | 10 | Deferred to future releases |

### 16.2 Story Points Summary

| Epic | P0 | P1 | P2 | Total Points |
|------|----|----|-----|--------------|
| E-01: Auth & User Mgmt | 49 | 13 | 5 | 67 |
| E-02: Student Mgmt | 24 | 14 | 10 | 48 |
| E-03: Curriculum Mgmt | 54 | 26 | 0 | 80 |
| E-04: Attendance | 13 | 16 | 0 | 29 |
| E-05: Assessment | 24 | 31 | 0 | 55 |
| E-06: Progress Tracking | 10 | 18 | 0 | 28 |
| E-07: Notifications | 8 | 6 | 5 | 19 |
| E-08: Gamification | 8 | 31 | 15 | 54 |
| E-09: Search | 5 | 18 | 0 | 23 |
| E-10: Dashboards | 32 | 5 | 0 | 37 |
| E-11: Reports | 13 | 10 | 13 | 36 |
| E-12: Multi-Tenancy | 38 | 0 | 0 | 38 |
| **TOTAL** | **278** | **188** | **48** | **514** |

### 16.3 Velocity Assumption

Assuming a development team velocity of **40-60 story points per sprint** (2-week sprints):

| Release | Stories | Points | Estimated Sprints | Timeline |
|---------|---------|--------|-------------------|----------|
| Release 1 (MVP) | 85 | 278 | 5-7 sprints | 3-4 months |
| Release 2 | 70 | 188 | 3-4 sprints | 2-3 months |
| Release 3 | 45 | 48 | 1 sprint | 2-4 weeks |

---

## 17. Assumptions

| ID | Assumption | Impact if Wrong |
|----|------------|-----------------|
| SA-01 | Development team has React/Node.js expertise | Longer ramp-up time |
| SA-02 | Coptic Unicode support available in chosen framework | Custom implementation needed |
| SA-03 | Cloud hosting budget approved (AWS/GCP) | Need to evaluate alternatives |
| SA-04 | Curriculum content available before development | Content creation becomes bottleneck |
| SA-05 | Testing devices available (iOS, Android, Desktop) | Quality issues on specific platforms |
| SA-06 | User acceptance testing can be done with real users | Feature-market fit risk |
| SA-07 | No third-party integrations required for MVP | Integration scope underestimated |
| SA-08 | Single language (English) sufficient for MVP launch | Delayed Arabic market entry |
| SA-09 | No regulatory compliance (GDPR/COPPA) for MVP | Legal risk |
| SA-10 | Basic analytics sufficient for MVP | Advanced insights delayed |

---

## 18. Recommendations

### 18.1 Development Recommendations

1. **Component Library First** – Build a shared component library before features to ensure consistency.

2. **API-First Design** – Design all APIs before frontend development to enable parallel work.

3. **Mobile-First Development** – Develop mobile web experience first, then enhance for desktop.

4. **Feature Flags** – Use feature flags to enable/disable features without deployments.

5. **Automated Testing** – Target 80% code coverage for critical paths.

### 18.2 Product Recommendations

1. **User Testing Early** – Conduct usability testing with real servants and parents before building full MVP.

2. **Iterative Rollout** – Deploy to a pilot group of users before school-wide rollout.

3. **Feedback Mechanism** – Include in-app feedback for continuous improvement.

4. **Content Strategy** – Develop content guidelines and templates before curriculum development.

5. **Training Materials** – Create video tutorials and help documentation during development.

---

## 19. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| SR-01 | Scope creep from stakeholder requests | High | High | Strict MVP scope, change request process |
| SR-02 | Technical debt from rapid development | Medium | High | Code reviews, refactoring sprints |
| SR-03 | User adoption resistance | Medium | High | Early testing, training, champion users |
| SR-04 | Coptic text rendering bugs | Medium | High | Early prototype, font testing |
| SR-05 | Performance issues at scale | Medium | Medium | Load testing, optimization sprints |
| SR-06 | Security vulnerabilities | Low | Critical | Security audits, penetration testing |
| SR-07 | Third-party service dependency | Medium | Medium | Fallback options, abstraction layers |
| SR-08 | Data migration challenges | Medium | Medium | Migration tools, parallel run |
| SR-09 | Integration with existing systems | Medium | Low | Standard APIs, import/export |
| SR-10 | Platform sustainability | Medium | High | SaaS model, community engagement |

---

## 20. Approval Gate

### Deliverables Summary

| Deliverable | Count | Status |
|-------------|-------|--------|
| Epics | 12 | ✅ Complete |
| User Stories | 92 | ✅ Complete |
| Acceptance Criteria | 350+ | ✅ Complete |
| Story Points | 514 | ✅ Complete |
| Release Plan | 3 releases | ✅ Complete |
| MVP Definition | 45 stories | ✅ Complete |
| Product Backlog | Prioritized | ✅ Complete |

### Questions for Approval

1. Is the epic breakdown logical and complete?
2. Are the user stories well-defined with clear acceptance criteria?
3. Is the MVP scope appropriate (45 stories, ~278 points)?
4. Are the release timelines realistic?
5. Are there any missing user stories or epics?
6. Should any features be moved between priority levels?

### Next Phase Preview

**Phase 3 – Information Architecture and Navigation**
- Site map and page hierarchy
- Navigation structure
- Content organization
- User flow diagrams
- Information architecture decisions

---

**Awaiting approval to proceed to Phase 3.**
