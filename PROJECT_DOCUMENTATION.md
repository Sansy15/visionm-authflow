# VisionM Project Documentation

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Features](#features)
5. [Project Structure](#project-structure)
6. [Database Schema](#database-schema)
7. [API Integration](#api-integration)
8. [Authentication & Authorization](#authentication--authorization)
9. [Setup & Installation](#setup--installation)
10. [Configuration](#configuration)
11. [Development Workflow](#development-workflow)
12. [Key Components](#key-components)
13. [Pages & Routes](#pages--routes)
14. [Supabase Functions](#supabase-functions)
15. [Deployment](#deployment)
16. [Testing](#testing)
17. [Contributing](#contributing)
18. [Additional Notes](#additional-notes)
19. [Troubleshooting](#troubleshooting)
20. [Support & Resources](#support--resources)
21. [Quick Reference Checklist for New Project Setup](#quick-reference-checklist-for-new-project-setup)
22. [Additional Resources](#additional-resources)

---

## Project Overview

**VisionM** is a comprehensive web application for managing computer vision datasets, machine learning model training, and inference operations. The platform enables teams to collaborate on dataset projects with secure workspace controls, project management, and seamless file uploads.

### Core Purpose

VisionM helps teams:
- Organize and manage computer vision datasets
- Train machine learning models (YOLO) with their datasets
- Run inference/prediction jobs on trained models
- Collaborate within workspaces with role-based access control
- Track training and inference history

### Key Highlights

- **Workspace-based Collaboration**: Multi-user workspaces with company-level organization
- **Dataset Management**: Version-controlled dataset uploads with folder structure preservation
- **Model Training**: YOLO model training with progress tracking and log monitoring
- **Inference/Prediction**: Run predictions on trained models with result visualization
- **Role-based Access**: Admin and member roles with appropriate permissions

---

## Technology Stack

### Frontend

- **React 18.3.1** - UI library
- **TypeScript 5.8.3** - Type safety
- **Vite 7.2.4** - Build tool and dev server
- **React Router DOM 6.30.1** - Client-side routing
- **Tailwind CSS 3.4.17** - Styling
- **shadcn/ui** - UI component library (built on Radix UI)
- **React Hook Form 7.61.1** - Form management
- **Zod 3.25.76** - Schema validation
- **Lucide React 0.462.0** - Icon library
- **TanStack Query 5.83.0** - Data fetching and caching

### Backend & Database

- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Authentication (Supabase Auth)
  - Row Level Security (RLS)
  - Storage buckets
  - Edge Functions (Deno runtime)

### External Services

- **Backend API** - Separate backend service for ML operations
  - Dataset upload and processing
  - Model training endpoints
  - Inference/prediction endpoints
  - File management

### Development Tools

- **ESLint** - Code linting
- **TypeScript ESLint** - TypeScript linting rules
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

---

## Architecture

### Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client (React App)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages      │  │  Components  │  │   Hooks      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
┌───────▼────────┐                    ┌────────▼────────┐
│   Supabase     │                    │  Backend API    │
│                │                    │                 │
│  - Auth        │                    │  - Dataset Mgmt │
│  - Database    │                    │  - Training     │
│  - Storage     │                    │  - Inference    │
│  - Edge Funcs  │                    │  - File Storage │
└────────────────┘                    └─────────────────┘
```

### Data Flow

1. **Authentication**: Supabase Auth handles user authentication
2. **Database Operations**: Supabase PostgreSQL with RLS policies
3. **File Storage**: Dataset files stored via backend API
4. **ML Operations**: Training and inference handled by backend API
5. **Real-time Updates**: Polling for job status updates

---

## Features

### 1. Authentication & User Management

- **User Registration**: Email/password signup with email verification
- **Login/Logout**: Secure authentication via Supabase Auth
- **Password Reset**: Email-based password reset flow
- **Profile Management**: User profile with name, phone, email
- **Email Verification**: Required before full access

### 2. Workspace Management

- **Company/Workspace Creation**: Create new workspaces
- **Join Workspace**: Request to join existing workspaces
- **Workspace Members**: View and manage team members
- **Admin Controls**: Workspace admins can approve/reject join requests
- **Role-based Access**: Admin and member roles

### 3. Project Management

- **Create Projects**: Organize datasets under projects
- **Project List**: View all projects in workspace
- **Project Details**: View project information and datasets
- **Delete Projects**: Remove projects (with confirmation)
- **Project Navigation**: Navigate to dataset manager per project

### 4. Dataset Management

- **Upload Datasets**: Upload labelled or unlabelled data folders
- **Version Control**: Multiple versions per project
- **File Browser**: View files in grid or list view
- **Folder Structure**: Preserve folder hierarchy
- **File Preview**: Image viewer with zoom and pan
- **Label Viewing**: View associated label files (.txt)
- **Search & Filter**: Search files by name, filter by type/folder
- **Download**: Download individual files or entire dataset
- **Delete Versions**: Delete dataset versions (soft delete with dependency check)

### 5. Model Training (Simulation)

- **Project Selection**: Choose project and dataset version
- **Model Configuration**: Select YOLO model type (n, s, m, l, x)
- **Training Parameters**: Configure training settings
- **Start Training**: Initiate training jobs
- **Progress Tracking**: Real-time training progress
- **Log Monitoring**: View training logs
- **Job History**: View past training jobs
- **Model Management**: Delete trained models

### 6. Inference/Prediction

- **Model Selection**: Choose trained model
- **Inference Modes**:
  - **Use Dataset**: Run inference against a dataset’s test folder
  - **Upload Custom Images**: Run inference on ad-hoc uploaded images
- **Dataset Selection** (dataset mode): Select a ready dataset that has test images
- **Custom Test Inputs** (custom mode): Drag-and-drop or select images to upload
- **Confidence Threshold**: Configure detection confidence
- **Run Inference**: Execute prediction jobs
- **Result Visualization**: View annotated images
- **History**: Track past inference jobs
- **Delete Results**: Remove inference job results

### 7. Team Collaboration

- **Member Management**: View all workspace members
- **Invite Users**: Invite users to workspace
- **Join Requests**: Approve/reject join requests
- **Team Settings**: Configure workspace settings

### 8. Settings & Account

- **Profile Settings**: Update personal information
- **Security Settings**: Change password
- **Preferences**: Configure application preferences
- **Workspace Settings**: Manage workspace details
- **Billing** (Placeholder): Billing information page
- **Usage** (Placeholder): Usage statistics page

### 9. Route Persistence

- **Automatic Route Saving**: Last visited protected route is automatically saved to localStorage
- **Route Restoration**: On refresh or return, users are automatically redirected to their last visited route
- **Smart Navigation**: Only restores routes when landing on generic `/dashboard` route
- **Session-Aware**: Route persistence only works when user is authenticated

---

## Project Structure

```
visionm-authflow/
├── public/                          # Static assets
│   ├── favicon.ico                  # Site favicon
│   ├── landing-bg.jpg               # Landing page background image
│   ├── placeholder.svg             # Placeholder image
│   └── robots.txt                   # SEO robots file
│
├── src/                             # Source code
│   ├── components/                  # React components
│   │   ├── app-shell/               # Application shell/layout components
│   │   │   ├── AppHeader.tsx        # Top navigation header
│   │   │   ├── AppShell.tsx         # Main app shell wrapper
│   │   │   ├── AppSidebar.tsx       # Side navigation sidebar
│   │   │   ├── Breadcrumbs.tsx      # Breadcrumb navigation component
│   │   │   ├── breadcrumb-context.tsx # Breadcrumb context provider
│   │   │   └── UserMenu.tsx         # User dropdown menu
│   │   │
│   │   ├── pages/                   # Page-specific reusable components
│   │   │   ├── EmptyState.tsx       # Empty state placeholder component
│   │   │   ├── ErrorState.tsx       # Error state display component
│   │   │   ├── LoadingState.tsx     # Loading spinner/state component
│   │   │   └── PageHeader.tsx       # Standardized page header component
│   │   │
│   │   ├── ui/                      # shadcn/ui component library
│   │   │   ├── accordion.tsx        # Accordion component
│   │   │   ├── alert-dialog.tsx     # Alert dialog component
│   │   │   ├── alert.tsx            # Alert/notification component
│   │   │   ├── aspect-ratio.tsx    # Aspect ratio wrapper
│   │   │   ├── avatar.tsx           # Avatar component
│   │   │   ├── badge.tsx            # Badge component
│   │   │   ├── breadcrumb.tsx       # Breadcrumb UI component
│   │   │   ├── button.tsx           # Button component
│   │   │   ├── calendar.tsx         # Calendar/date picker component
│   │   │   ├── card.tsx             # Card container component
│   │   │   ├── carousel.tsx         # Carousel/slider component
│   │   │   ├── chart.tsx            # Chart component wrapper
│   │   │   ├── checkbox.tsx         # Checkbox input component
│   │   │   ├── collapsible.tsx      # Collapsible section component
│   │   │   ├── command.tsx          # Command palette component
│   │   │   ├── context-menu.tsx     # Context menu component
│   │   │   ├── dialog.tsx           # Modal dialog component
│   │   │   ├── drawer.tsx           # Drawer/side panel component
│   │   │   ├── dropdown-menu.tsx    # Dropdown menu component
│   │   │   ├── form.tsx             # Form wrapper component
│   │   │   ├── hover-card.tsx       # Hover card component
│   │   │   ├── input-otp.tsx        # OTP input component
│   │   │   ├── input.tsx            # Text input component
│   │   │   ├── label.tsx            # Form label component
│   │   │   ├── menubar.tsx          # Menu bar component
│   │   │   ├── navigation-menu.tsx  # Navigation menu component
│   │   │   ├── pagination.tsx       # Pagination component
│   │   │   ├── popover.tsx          # Popover component
│   │   │   ├── progress.tsx         # Progress bar component
│   │   │   ├── radio-group.tsx      # Radio button group component
│   │   │   ├── resizable.tsx        # Resizable panel component
│   │   │   ├── scroll-area.tsx     # Custom scroll area component
│   │   │   ├── select.tsx           # Select dropdown component
│   │   │   ├── separator.tsx        # Separator/divider component
│   │   │   ├── sheet.tsx            # Sheet/side panel component
│   │   │   ├── sidebar.tsx          # Sidebar component
│   │   │   ├── skeleton.tsx         # Loading skeleton component
│   │   │   ├── slider.tsx           # Slider/range input component
│   │   │   ├── sonner.tsx           # Toast notification component
│   │   │   ├── switch.tsx           # Toggle switch component
│   │   │   ├── table.tsx            # Table component
│   │   │   ├── tabs.tsx             # Tabs component
│   │   │   ├── textarea.tsx         # Textarea component
│   │   │   ├── toast.tsx            # Toast component
│   │   │   ├── toaster.tsx          # Toast container component
│   │   │   ├── toggle-group.tsx     # Toggle button group component
│   │   │   ├── toggle.tsx           # Toggle button component
│   │   │   ├── tooltip.tsx          # Tooltip component
│   │   │   └── use-toast.ts         # Toast hook
│   │   │
│   │   ├── CompanyMembers.tsx       # Company/workspace members list component
│   │   ├── FormFieldWrapper.tsx     # Reusable form field wrapper
│   │   ├── InviteUserDialog.tsx     # User invitation dialog
│   │   ├── JoinCompanyDialog.tsx    # Join workspace dialog
│   │   ├── JoinRequestsSidePanel.tsx # Join requests management panel
│   │   ├── NavLink.tsx              # Navigation link component
│   │   ├── PasswordChecklist.tsx    # Password validation checklist
│   │   ├── PasswordInput.tsx         # Secure password input component
│   │   ├── ProfileCompletionDialog.tsx # Profile completion prompt
│   │   ├── RequestItem.tsx           # Join request item component
│   │   ├── SimulationView.tsx        # Model training simulation view
│   │   └── UserProfileDialog.tsx    # User profile edit dialog
│   │
│   ├── contexts/                    # React context providers
│   │   ├── ProfileContext.tsx       # Profile context provider (user/company data)
│   │   └── profile-context.ts       # Profile context type definitions
│   │
│   ├── hooks/                       # Custom React hooks
│   │   ├── use-mobile.tsx           # Mobile device detection hook
│   │   ├── use-toast.ts             # Toast notification hook
│   │   ├── useFormValidation.ts     # Form validation hook
│   │   ├── useProfile.ts            # Profile data access hook
│   │   └── useRoutePersistence.ts   # Route persistence hook (used in AppShell)
│   │
│   ├── integrations/                # Third-party service integrations
│   │   └── supabase/                 # Supabase integration
│   │       ├── client.ts             # Supabase client initialization
│   │       └── types.ts              # Supabase database type definitions
│   │
│   ├── layouts/                     # Layout wrapper components
│   │   └── MainLayout.tsx           # Main application layout (uses AppShell)
│   │
│   ├── lib/                         # Utility libraries and helpers
│   │   ├── utils.ts                 # General utility functions
│   │   ├── utils/                    # Utility sub-modules
│   │   │   └── adminUtils.ts        # Admin role checking utilities
│   │   └── validations/              # Validation schemas
│   │       └── authSchemas.ts        # Authentication validation schemas (Zod)
│   │
│   ├── pages/                       # Page/route components
│   │   ├── AccountPage.tsx          # Account settings overview page
│   │   ├── AccountPreferencesPage.tsx # User preferences page
│   │   ├── AccountProfilePage.tsx   # Profile settings page
│   │   ├── AccountSecurityPage.tsx  # Security settings page (password change)
│   │   ├── Auth.tsx                 # Authentication page (login/signup)
│   │   ├── Dashboard.tsx             # Main dashboard page
│   │   ├── DatasetManager.tsx       # Dataset management page
│   │   ├── DatasetPage.tsx          # Dataset detail page
│   │   ├── Index.tsx                # Index/redirect page
│   │   ├── Landing.tsx              # Landing/home page
│   │   ├── NotFound.tsx             # 404 error page
│   │   ├── PredictionHistoryDetailsPage.tsx # Inference result details page
│   │   ├── PredictionPage.tsx       # Inference/prediction page
│   │   ├── ProjectsPage.tsx         # Projects listing page
│   │   ├── ResetPassword.tsx        # Password reset page
│   │   ├── SettingsBillingPage.tsx  # Billing settings page (placeholder)
│   │   ├── SettingsPage.tsx         # Settings overview page
│   │   ├── SettingsUsagePage.tsx    # Usage statistics page (placeholder)
│   │   ├── SettingsWorkspacePage.tsx # Workspace settings page
│   │   ├── SignUpWithInvite.tsx     # Sign up via invitation page
│   │   ├── TeamInvitationsPage.tsx  # Team invitations management page
│   │   ├── TeamMembersPage.tsx      # Team members listing page
│   │   └── VerifyEmail.tsx          # Email verification page
│   │
│   ├── utils/                       # Utility functions
│   │   ├── routePersistence.ts      # Route persistence utilities (used in App.tsx)
│   │   └── trainingPersistence.ts   # Training state persistence utilities
│   │
│   ├── App.tsx                      # Main application component (routing)
│   ├── App.css                      # App-specific styles
│   ├── index.css                    # Global styles and Tailwind imports
│   ├── main.tsx                     # Application entry point
│   └── vite-env.d.ts                # Vite environment type definitions
│
├── supabase/                        # Supabase configuration and functions
│   ├── .temp/                       # Temporary Supabase CLI files
│   │   ├── cli-latest               # CLI version info
│   │   ├── gotrue-version          # GoTrue version
│   │   ├── pooler-url              # Connection pooler URL
│   │   ├── postgres-version        # PostgreSQL version
│   │   ├── project-ref             # Project reference
│   │   ├── rest-version            # REST API version
│   │   ├── storage-migration      # Storage migration info
│   │   └── storage-version        # Storage version
│   │
│   ├── functions/                   # Supabase Edge Functions (Deno)
│   │   ├── accept-invite/           # Accept project invitation
│   │   │   └── index.ts
│   │   ├── approve-workspace-request/ # Approve workspace join request
│   │   │   └── index.ts
│   │   ├── check-email-exists/      # Check if email exists in system
│   │   │   └── index.ts
│   │   ├── create-company/         # Create new workspace/company
│   │   │   └── index.ts
│   │   ├── create-invite/          # Create project invitation
│   │   │   └── index.ts
│   │   ├── dataset-status/         # Get dataset processing status
│   │   │   └── index.ts
│   │   ├── invite-project-user/     # Invite user to project
│   │   │   └── index.ts
│   │   ├── reject-workspace-request/ # Reject workspace join request
│   │   │   └── index.ts
│   │   ├── send-verification-email/ # Send email verification
│   │   │   └── index.ts
│   │   ├── send-workspace-request/  # Send workspace join request
│   │   │   └── index.ts
│   │   ├── upload-dataset/         # Initiate dataset upload
│   │   │   └── index.ts
│   │   └── validate-invite/        # Validate project invitation token
│   │       └── index.ts
│   │
│   ├── migrations/                 # Database migration files (SQL)
│   │   ├── 20251126111624_cd8277f3-67f3-4bc8-86a4-06d7b8541ec9.sql
│   │   ├── 20251127073139_651fc8ee-6e10-43df-8e37-10fa4d7e5835.sql
│   │   ├── 20251204131926_add_rls_policies_join_requests.sql
│   │   ├── 20251205000000_allow_company_members_to_edit_projects.sql
│   │   ├── 20251205000001_prevent_admin_email_update.sql
│   │   ├── 20251205000002_ensure_created_by_column.sql
│   │   ├── 20251205000003_fix_companies_rls.sql
│   │   ├── 20251206000000_fix_profile_phone_null.sql
│   │   ├── 20251206000001_fix_companies_rls_insert.sql
│   │   ├── 20251206000002_simplify_companies_rls.sql
│   │   ├── 20251207000000_fix_companies_select_policy.sql
│   │   ├── 20251208000000_allow_company_existence_check.sql
│   │   ├── 20251208000001_fix_join_requests_rls.sql
│   │   ├── 20251209000000_add_role_to_profiles.sql
│   │   ├── 20251209000001_get_join_request_user_info.sql
│   │   ├── 20251209000002_fix_profiles_rls_admin_view_members.sql
│   │   ├── 20251209133418_add_ignored_status_to_join_requests.sql
│   │   └── APPLY_MIGRATIONS.sql    # Migration application script
│   │
│   └── config.toml                 # Supabase project configuration
│
├── scripts/                         # Build and utility scripts
│   ├── README.md                    # Scripts documentation
│   ├── setup-git-hooks.js           # Git hooks setup script
│   └── update-docs.js               # Documentation auto-update script
│
├── .env                             # Environment variables (not in git)
├── .gitignore                       # Git ignore rules
├── additional_api_endpoints.csv     # Additional API endpoints reference
├── bun.lockb                        # Bun lock file (if using Bun)
├── components.json                  # shadcn/ui components configuration
├── eslint.config.js                 # ESLint configuration
├── index.html                       # HTML entry point
├── package-lock.json                # npm lock file
├── package.json                     # Project dependencies and scripts
├── postcss.config.js                # PostCSS configuration
├── PROJECT_DOCUMENTATION.md         # This documentation file
├── README.md                        # Quick start guide
├── tailwind.config.ts               # Tailwind CSS configuration
├── tsconfig.app.json                # TypeScript config for app
├── tsconfig.json                    # TypeScript root configuration
├── tsconfig.node.json               # TypeScript config for Node.js
└── vite.config.ts                   # Vite build tool configuration
```

### Directory Descriptions

#### `/public`
Static assets served directly by the web server. Files here are copied to the build output as-is.

#### `/src/components`
- **`app-shell/`**: Core layout components that wrap the entire application
- **`pages/`**: Reusable components used across multiple pages
- **`ui/`**: shadcn/ui component library (50+ components)
- **Root components**: Feature-specific components for dialogs, forms, and business logic

#### `/src/contexts`
React Context providers for global state management (profile, user data).

#### `/src/hooks`
Custom React hooks for reusable logic (profile access, form validation, route persistence).

#### `/src/integrations`
Third-party service integrations (currently Supabase for auth and database).

#### `/src/layouts`
Layout wrapper components that define page structure.

#### `/src/lib`
Utility libraries, helper functions, and validation schemas.

#### `/src/pages`
Route components - one file per route/page in the application.

#### `/src/utils`
Utility functions for specific features (route persistence, training state).

#### `/supabase/functions`
Supabase Edge Functions (serverless functions running on Deno runtime).

#### `/supabase/migrations`
Database migration files applied in chronological order to set up the database schema.

---

## Database Schema

### Tables

#### `profiles`
User profile information linked to Supabase Auth users.

```sql
- id (UUID, PK, FK -> auth.users)
- name (TEXT, NOT NULL)
- phone (TEXT, NOT NULL)
- email (TEXT, NOT NULL)
- is_verified (BOOLEAN, DEFAULT FALSE)
- company_id (UUID, FK -> companies)
- role (TEXT) - 'admin' or 'member'
- created_at (TIMESTAMPTZ)
```

#### `companies`
Workspace/company information.

```sql
- id (UUID, PK)
- name (TEXT, NOT NULL)
- admin_email (TEXT, NOT NULL)
- created_by (UUID, FK -> profiles)
- created_at (TIMESTAMPTZ)
```

#### `workspace_join_requests`
Join requests for workspaces.

```sql
- id (UUID, PK)
- user_id (UUID, FK -> profiles)
- company_name (TEXT, NOT NULL)
- admin_email (TEXT, NOT NULL)
- status (TEXT) - 'pending', 'approved', 'rejected', 'ignored'
- token (TEXT, UNIQUE, NOT NULL)
- created_at (TIMESTAMPTZ)
```

#### `projects`
Project/workspace organization units.

```sql
- id (UUID, PK)
- name (TEXT, NOT NULL)
- description (TEXT)
- company_id (UUID, FK -> companies)
- created_by (UUID, FK -> profiles)
- created_at (TIMESTAMPTZ)
```

#### `project_users`
Project-level user access control.

```sql
- id (UUID, PK)
- project_id (UUID, FK -> projects)
- user_email (TEXT, NOT NULL)
- hashed_password (TEXT, NOT NULL)
- invited_by (UUID, FK -> profiles)
- created_at (TIMESTAMPTZ)
- UNIQUE(project_id, user_email)
```

#### `datasets`
Dataset version information (stored in Supabase, main data in backend).

```sql
- id (UUID, PK)
- company_id (UUID, FK -> companies)
- project_id (UUID, FK -> projects)
- version (TEXT)
- status (TEXT) - 'processing', 'ready', 'failed'
- total_images (INTEGER)
- size_bytes (BIGINT)
- created_by (UUID, FK -> profiles)
- created_at (TIMESTAMPTZ)
```

#### `dataset_files`
Metadata for dataset files (files stored in backend storage).

```sql
- id (UUID, PK)
- dataset_id (UUID, FK -> datasets)
- filename (TEXT, NOT NULL)
- file_type (TEXT, NOT NULL)
- file_size (BIGINT, NOT NULL)
- storage_path (TEXT, NOT NULL)
- created_at (TIMESTAMPTZ)
```

#### `email_verification_tokens`
Email verification token storage.

```sql
- id (UUID, PK)
- user_id (UUID, FK -> profiles)
- token (TEXT, UNIQUE, NOT NULL)
- expires_at (TIMESTAMPTZ, NOT NULL)
- created_at (TIMESTAMPTZ)
```

### Row Level Security (RLS)

All tables have RLS enabled with policies:
- **profiles**: Users can view/update their own profile
- **companies**: Users can view companies they belong to
- **projects**: Users can view/create/update projects in their company
- **datasets**: Users can view/create/update datasets in their company
- **workspace_join_requests**: Users can view their own requests
- **Storage**: Users can upload/view files in their company's datasets bucket

---

## API Integration

### Backend API Base URL

Configured via environment variable: `VITE_API_BASE_URL`

Example: `http://localhost:3000/api` or `https://api.visionm.com/api`

### Dataset Management Endpoints

#### Upload Dataset
- **Endpoint**: `POST /api/dataset/upload`
- **Method**: POST
- **Content-Type**: multipart/form-data
- **Body**:
  - `company` (string)
  - `project` (string)
  - `version` (string)
  - `files` (File[])
  - `fileMeta` (JSON string with folder structure)
- **Response**: `{ datasetId, status, totalImages }`

#### Get Dataset Metadata
- **Endpoint**: `GET /api/dataset/:datasetId`
- **Method**: GET
- **Response**: Dataset metadata with file counts, status, etc.

#### Get Dataset Status
- **Endpoint**: `GET /api/dataset/:datasetId/status`
- **Method**: GET
- **Response**: `{ status, processed, total, percent, trainCount, valCount, testCount }`

#### List Datasets
- **Endpoint**: `GET /api/datasets?company={name}&project={name}`
- **Method**: GET
- **Response**: Array of dataset versions

#### Get Dataset Dependencies
- **Endpoint**: `GET /api/dataset/:datasetId/dependencies`
- **Method**: GET
- **Response**: `{ hasDependencies, dependencies: { trainingJobs, models, inferenceJobs }, counts }`

#### Delete Dataset (Soft Delete)
- **Endpoint**: `DELETE /api/dataset/:datasetId`
- **Method**: DELETE
- **Response**: `{ datasetId, message, deletedAt, dependencies, note }`
- **Error Codes**:
  - `400`: Dataset is processing
  - `410`: Already deleted
  - `404`: Not found

#### Get Dataset Files
- **Endpoint**: `GET /api/dataset/:datasetId/files?page={n}&limit={n}&folder={name}&type={image|label}`
- **Method**: GET
- **Response**: `{ files: [], totalFiles, totalPages, page, limit }`

#### Download Dataset
- **Endpoint**: `GET /api/dataset/:datasetId/download`
- **Method**: GET
- **Response**: ZIP file download

#### Get File
- **Endpoint**: `GET /api/dataset/:datasetId/file/:fileId`
- **Method**: GET
- **Response**: File content

#### Download File
- **Endpoint**: `GET /api/dataset/:datasetId/file/:fileId/download`
- **Method**: GET
- **Response**: File download

#### Get Thumbnail
- **Endpoint**: `GET /api/dataset/:datasetId/file/:fileId/thumbnail`
- **Method**: GET
- **Response**: Image thumbnail

#### Get Folder Summary
- **Endpoint**: `GET /api/dataset/:datasetId/folders`
- **Method**: GET
- **Response**: Folder breakdown with file counts

### Training Endpoints

#### Start Training
- **Endpoint**: `POST /api/train`
- **Method**: POST
- **Body**: `{ projectId, datasetId, modelType, modelVersion, ... }`
- **Response**: `{ jobId, status }`

#### Get Training Status
- **Endpoint**: `GET /api/train/:jobId/status`
- **Method**: GET
- **Response**: Training job status and progress

#### Get Training Logs
- **Endpoint**: `GET /api/train/:jobId/logs`
- **Method**: GET
- **Response**: Training logs

#### List Trained Models
- **Endpoint**: `GET /api/models?projectId={id}`
- **Method**: GET
- **Response**: Array of trained models

#### Delete Model
- **Endpoint**: `DELETE /api/models/:modelId`
- **Method**: DELETE
- **Response**: Success confirmation

### Inference/Prediction Endpoints

#### Start Inference
- **Endpoint**: `POST /api/inference/start`
- **Method**: POST
- **Modes**:
  - **Dataset-based inference (JSON)**:
    - **Body**: `{ modelId, datasetId, confidenceThreshold }`
    - **Notes**: Used when the user selects “Use dataset” and picks a dataset with test images.
  - **Custom upload inference (multipart/form-data)**:
    - **Form fields**:
      - `modelId` (text, required)
      - `confidenceThreshold` (text, optional)
      - `images` (file, required) — one entry per uploaded image
    - **Notes**: Used when the user selects “Upload custom images”; images are uploaded temporarily and cleaned up by the backend after inference.
- **Response**: `{ inferenceId, status, ... }` (includes at least the queued status and an ID to poll)

#### Get Inference Status
- **Endpoint**: `GET /api/inference/:inferenceId/status`
- **Method**: GET
- **Response**: Inference job status

#### Get Inference Results
- **Endpoint**: `GET /api/inference/:inferenceId/results`
- **Method**: GET
- **Response**: Annotated images and results

#### List Inference Jobs
- **Endpoint**: `GET /api/inference/history?projectId={id}`
- **Method**: GET
- **Response**: Array of past inference jobs

#### Cancel Inference
- **Endpoint**: `POST /api/inference/:inferenceId/cancel`
- **Method**: POST
- **Response**: Cancellation confirmation

#### Delete Inference
- **Endpoint**: `DELETE /api/inference/:inferenceId`
- **Method**: DELETE
- **Response**: Success confirmation

### Project Management Endpoints

#### Delete Project
- **Endpoint**: `DELETE /api/project/:projectId`
- **Method**: DELETE
- **Response**: Success confirmation

### Authentication

All API requests require Bearer token authentication:
```
Authorization: Bearer <supabase_session_token>
```

---

## Authentication & Authorization

### Authentication Flow

1. **User Registration**
   - User signs up with email, password, name, phone
   - Supabase creates auth user
   - Trigger creates profile record
   - Verification email sent

2. **Email Verification**
   - User clicks verification link
   - `is_verified` set to true
   - User can access application

3. **Login**
   - User signs in with email/password
   - Supabase returns session token
   - Token stored in localStorage
   - Profile data loaded via context

4. **Session Management**
   - Session persisted in localStorage
   - Automatic token refresh
   - Protected routes check session

### Authorization Model

#### Role-Based Access Control

1. **Workspace Roles**
   - **Admin**: Created workspace, can approve/reject join requests
   - **Member**: Joined workspace, can create projects/datasets

2. **Database Level (RLS)**
   - Users can only access data from their company
   - Project creators can update their projects
   - Admins have additional permissions

3. **Application Level**
   - UI elements hidden based on role
   - API calls validated on backend
   - Workspace operations restricted by role

### Protected Routes

All routes under `/dashboard`, `/account`, `/dataset`, `/project` require authentication.

Public routes:
- `/` - Landing page
- `/auth` - Authentication page
- `/reset-password` - Password reset
- `/verify-email` - Email verification

---

## Setup & Installation

### Prerequisites

- **Node.js** 18+ (recommended: use nvm)
- **npm** or **bun** package manager
- **Supabase Account** and project
- **Backend API** running (separate service)
- **Git** (for cloning repository)
- **Code Editor** (VS Code recommended)

### Creating a New Project from Scratch

If you want to create a completely new project based on this documentation:

1. **Initialize New Project**
   ```bash
   npm create vite@latest visionm-authflow -- --template react-ts
   cd visionm-authflow
   npm install
   ```

2. **Install All Dependencies**
   ```bash
   npm install @hookform/resolvers @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip @supabase/supabase-js @tanstack/react-query class-variance-authority clsx cmdk date-fns embla-carousel-react input-otp lucide-react next-themes react react-day-picker react-dom react-hook-form react-resizable-panels react-router-dom recharts sonner tailwind-merge tailwindcss-animate vaul zod
   
   npm install -D @eslint/js @tailwindcss/typography @types/node @types/react @types/react-dom @vitejs/plugin-react-swc autoprefixer eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals lovable-tagger postcss tailwindcss typescript typescript-eslint
   ```

3. **Set Up Project Structure**
   - Create all folders as documented in "Project Structure" section
   - Copy configuration files: `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `postcss.config.js`
   - Set up path aliases in `tsconfig.json`: `"@/*": ["./src/*"]`

4. **Configure Tailwind CSS and shadcn/ui**
   - Install Tailwind CSS: `npm install -D tailwindcss postcss autoprefixer`
   - Initialize Tailwind: `npx tailwindcss init -p`
   - Configure `tailwind.config.ts` with content paths: `["./index.html", "./src/**/*.{js,ts,jsx,tsx}"]`
   - Set up `components.json` for shadcn/ui:
     ```json
     {
       "style": "default",
       "rsc": false,
       "tsx": true,
       "tailwind": {
         "config": "tailwind.config.ts",
         "css": "src/index.css",
         "baseColor": "slate",
         "cssVariables": true
       },
       "aliases": {
         "components": "@/components",
         "utils": "@/lib/utils",
         "ui": "@/components/ui"
       }
     }
     ```
   - Install shadcn/ui components as needed: `npx shadcn-ui@latest add [component-name]`

5. **Set Up Supabase**
   - Follow "Supabase Setup" section below
   - Initialize Supabase in project: `supabase init`
   - Create all migrations
   - Deploy all Edge Functions
   - **Configure Email Service**:
     - Option A: Get Resend API key (recommended for full functionality)
     - Option B: Configure Supabase SMTP/email templates
     - Option C: Modify functions to use only Supabase email (requires code changes)

6. **Create All Components and Pages**
   - Follow the structure in "Project Structure" section
   - Implement all components as documented in "Key Components"
   - Create all pages as documented in "Pages & Routes"

7. **Configure Environment Variables**
   - Create `.env` file with all required variables
   - See "Configuration" section for details

### Installation Steps

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd visionm-authflow
   ```

2. **Install Dependencies**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Environment Configuration**
   Create `.env` file in root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
   VITE_API_BASE_URL=http://localhost:3000/api
   ```
   
   **Note**: The environment variable is `VITE_SUPABASE_PUBLISHABLE_KEY` (not `VITE_SUPABASE_ANON_KEY`). This is the Supabase anonymous/public key from your Supabase project settings.

4. **Supabase Setup**
   
   **a. Create Supabase Project**
   - Go to [supabase.com](https://supabase.com) and create a new project
   - Note your project URL and API keys from Settings → API
   
   **b. Database Setup**
   - Run all migrations in order from `supabase/migrations/` directory:
     ```bash
     # Using Supabase CLI (recommended)
     supabase db push
     
     # Or manually apply each migration file in Supabase SQL Editor
     ```
   - Verify all tables are created: `profiles`, `companies`, `projects`, `datasets`, `workspace_join_requests`, `project_users`, `dataset_files`, `email_verification_tokens`
   
   **c. Storage Bucket Configuration**
   - Go to Storage in Supabase dashboard
   - Create a new bucket named `datasets`
   - Set bucket to **Private**
   - Enable RLS (Row Level Security)
   - Configure policies to allow users to upload/view files in their company's datasets
   
   **d. Edge Functions Setup**
   - Deploy all Edge Functions from `supabase/functions/`:
     ```bash
     supabase functions deploy accept-invite
     supabase functions deploy approve-workspace-request
     supabase functions deploy check-email-exists
     supabase functions deploy create-company
     supabase functions deploy create-invite
     supabase functions deploy dataset-status
     supabase functions deploy invite-project-user
     supabase functions deploy reject-workspace-request
     supabase functions deploy send-verification-email
     supabase functions deploy send-workspace-request
     supabase functions deploy upload-dataset
     supabase functions deploy validate-invite
     ```
   
   **e. Edge Function Environment Variables**
   - For each Edge Function, set these environment variables in Supabase dashboard:
     - `SUPABASE_URL`: Your Supabase project URL (required for all functions)
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (required for all functions, from Settings → API)
     - `APP_URL` or `FRONTEND_URL`: Your application URL (required for functions that send emails, e.g., `http://localhost:8080` for dev)
     - `RESEND_API_KEY`: Your Resend API key (required for some email functions, see Email Configuration below)
   
   **f. Email Configuration**
   
   **Email Service Overview:**
   - This project uses a **mixed email approach**:
     - **Supabase Built-in Email**: Used by `create-invite` function (via `signInWithOtp`)
     - **Resend API**: Used by other email functions for custom email templates
   
   **Functions Using Supabase Email (No Resend Required):**
   - `create-invite`: Uses Supabase's `signInWithOtp()` to send magic link emails
   
   **Functions Requiring Resend API Key:**
   - `send-verification-email`: Requires `RESEND_API_KEY` (will fail without it)
   - `invite-project-user`: Requires `RESEND_API_KEY` (will fail without it)
   - `reject-workspace-request`: Requires `RESEND_API_KEY` (will fail without it)
   
   **Functions with Optional Resend (Work Without It):**
   - `approve-workspace-request`: Works without Resend, skips email if not configured
   - `send-workspace-request`: Works without Resend, skips email if not configured
   
   **Setup Options:**
   
   **Option 1: Use Resend (Recommended for Full Functionality)**
   - Sign up at [resend.com](https://resend.com) and get API key
   - Set `RESEND_API_KEY` for functions that require it
   - All email functionality will work
   
   **Option 2: Use Only Supabase Email**
   - Configure Supabase email in Dashboard → Settings → Auth → Email Templates
   - Set up SMTP in Dashboard → Settings → Auth → SMTP Settings (if needed)
   - Modify functions that require Resend to use Supabase email instead
   - Note: Some functions will not send emails without Resend or modification
   
   **Option 3: Hybrid Approach**
   - Use Supabase email for `create-invite` (already configured)
   - Use Resend for other functions that require it
   - Leave optional functions without Resend (they'll work but won't send emails)

5. **Start Development Server**
   ```bash
   npm run dev
   ```
   Server runs on `http://localhost:8080`

### Database Migrations

Apply all migrations in order:
```bash
# Using Supabase CLI
supabase db push

# Or manually apply each migration file in supabase/migrations/
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anonymous key | Yes |
| `VITE_API_BASE_URL` | Backend API base URL | Yes |

### Vite Configuration

- **Port**: 8080 (configurable in `vite.config.ts`)
- **Host**: `::` (all interfaces)
- **HMR**: Enabled with overlay disabled (prevents refresh issues)
- **Path Alias**: `@` → `./src` (configured in `vite.config.ts` and `tsconfig.json`)
- **Plugins**: React SWC plugin for fast refresh, component tagger in development mode

### shadcn/ui Configuration

The `components.json` file configures shadcn/ui:
- **Style**: Default (slate base color)
- **TypeScript**: Enabled
- **CSS Variables**: Enabled for theming
- **Aliases**: Components use `@/components`, utils use `@/lib/utils`

### Scripts

The `scripts/` directory contains utility scripts:
- **`update-docs.js`**: Automatically updates PROJECT_DOCUMENTATION.md by extracting:
  - Routes from `src/App.tsx`
  - Pages from `src/pages/`
  - Components from `src/components/`
  - Edge Functions from `supabase/functions/`
  - Migrations from `supabase/migrations/`
- **`setup-git-hooks.js`**: Sets up git hooks to auto-update documentation on commit
- Run manually: `npm run docs:update`
- Setup git hooks: `npm run docs:setup-hooks`

### Supabase Configuration

#### Storage Buckets

- **datasets**: Private bucket for dataset files
  - RLS enabled
  - Users can upload/view their company's datasets

#### Edge Functions

All functions in `supabase/functions/` need to be deployed:

```bash
supabase functions deploy <function-name>
```

**Complete list of Edge Functions:**
- `accept-invite` - Handles project invitation acceptance
- `approve-workspace-request` - Approves workspace join requests (email optional)
- `check-email-exists` - Checks if email exists in system
- `create-company` - Creates new workspace/company
- `create-invite` - Creates project invitations (uses Supabase email)
- `dataset-status` - Provides dataset processing status
- `invite-project-user` - Invites user to project (requires Resend)
- `reject-workspace-request` - Rejects workspace join requests (requires Resend)
- `send-verification-email` - Sends email verification (requires Resend)
- `send-workspace-request` - Sends join request to workspace admin (email optional)
- `upload-dataset` - Handles dataset upload initiation
- `validate-invite` - Validates project invitation token

**Required environment variables:**

**For ALL functions:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (from Settings → API)

**For functions that send emails:**
- `APP_URL` or `FRONTEND_URL` - Application URL for email links (e.g., `http://localhost:8080` for dev)

**For functions that require Resend (see Email Configuration section):**
- `RESEND_API_KEY` - Your Resend API key
  - **Required for**: `send-verification-email`, `invite-project-user`, `reject-workspace-request`
  - **Optional for**: `approve-workspace-request`, `send-workspace-request` (functions work without it, but won't send emails)
  - **Not needed for**: `create-invite` (uses Supabase email)

**Note**: Set these in Supabase Dashboard → Edge Functions → Settings → Secrets for each function.

---

## Development Workflow

### Running Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

Output directory: `dist/`

### Preview Production Build

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

### Type Checking

TypeScript checks are performed during build. Use your IDE for real-time checking.

### Code Structure Guidelines

1. **Components**: Place in `src/components/`
   - Feature components in root
   - Reusable UI components in `ui/`
   - Page-specific components in `pages/`

2. **Pages**: Place in `src/pages/`
   - One file per route
   - Use hooks for logic
   - Keep components small and focused

3. **Hooks**: Place in `src/hooks/`
   - Custom hooks for reusable logic
   - Data fetching hooks
   - Form validation hooks

4. **Utils**: Place in `src/lib/` or `src/utils/`
   - Utility functions
   - Validation schemas
   - Helper functions

### Git Workflow

1. Create feature branch from `main`
2. Make changes
3. Commit with descriptive messages
4. Push and create PR
5. Code review
6. Merge to `main`

---

## Key Components

### App Shell

#### `AppShell.tsx`
Main application layout wrapper with header and sidebar.

#### `AppHeader.tsx`
Top navigation bar with user menu and notifications.

#### `AppSidebar.tsx`
Side navigation with:
- Dashboard sections
- Projects list
- Navigation links
- Collapsible sections

#### `Breadcrumbs.tsx`
Navigation breadcrumb component for deep linking.

### Pages

#### `Dashboard.tsx`
Main dashboard with:
- Company/workspace creation dialogs
- Project creation
- Overview sections
- Simulation view integration

#### `DatasetManager.tsx`
Comprehensive dataset management:
- Dataset upload (labelled/unlabelled)
- Version management
- File browser (grid/list views)
- Image viewer with zoom/pan
- Search and filtering
- Delete operations with dependency checks

#### `PredictionPage.tsx`
Inference/prediction interface:
- Project and model selection
- **Inference mode toggle**:
  - **Use dataset** → shows a “Select Dataset” card listing ready datasets with test images
  - **Upload custom images** → shows a “Test Inputs” card with drag-and-drop and image selection
- Confidence threshold controls (number input + slider)
- Job execution and status polling
- Result visualization and history tracking

#### `SimulationView.tsx`
Model training interface:
- Project/dataset selection
- Model configuration
- Training job management
- Progress tracking
- Log viewing

### Form Components

#### `PasswordInput.tsx`
Secure password input with visibility toggle.

#### `PasswordChecklist.tsx`
Password strength validation checklist.

#### `FormFieldWrapper.tsx`
Consistent form field wrapper with error display.

### Dialog Components

#### `InviteUserDialog.tsx`
User invitation dialog for workspaces.

#### `JoinCompanyDialog.tsx`
Workspace join request dialog.

#### `ProfileCompletionDialog.tsx`
Profile completion prompt for new users.

### Data Display

#### `CompanyMembers.tsx`
Workspace member list with roles.

#### `JoinRequestsSidePanel.tsx`
Join request management panel for admins.

---

## Pages & Routes

### Public Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `Landing.tsx` | Landing page with feature overview |
| `/auth` | `Auth.tsx` | Authentication (sign in/sign up) |
| `/reset-password` | `ResetPassword.tsx` | Password reset flow |
| `/verify-email` | `VerifyEmail.tsx` | Email verification |
| `/signup-invite/:token` | `SignUpWithInvite.tsx` | Sign up via invitation (component exists but route not currently implemented in App.tsx) |

### Protected Routes (require authentication)

#### Dashboard
| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | `Dashboard.tsx` | Main dashboard |
| `/dashboard/projects` | `ProjectsPage.tsx` | Projects listing |

#### Projects & Datasets
| Route | Component | Description |
|-------|-----------|-------------|
| `/dataset/:id` | `DatasetManager.tsx` | Dataset management for project |
| `/datasets` | `DatasetManager.tsx` | Dataset manager (legacy route) |

#### Training & Inference
| Route | Component | Description |
|-------|-----------|-------------|
| `/project/prediction` | `PredictionPage.tsx` | Inference/prediction interface |
| `/project/prediction/history/:inferenceId` | `PredictionHistoryDetailsPage.tsx` | Inference result details |

#### Team Management
| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard/team` | `TeamMembersPage.tsx` | Team members list |
| `/dashboard/team/members` | `TeamMembersPage.tsx` | Team members (alias) |
| `/dashboard/team/invitations` | `TeamInvitationsPage.tsx` | Team invitations |

#### Settings
| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard/settings` | `SettingsPage.tsx` | Settings overview |
| `/dashboard/settings/workspace` | `SettingsWorkspacePage.tsx` | Workspace settings |
| `/dashboard/settings/billing` | `SettingsBillingPage.tsx` | Billing (placeholder) |
| `/dashboard/settings/usage` | `SettingsUsagePage.tsx` | Usage stats (placeholder) |

#### Account
| Route | Component | Description |
|-------|-----------|-------------|
| `/account` | `AccountPage.tsx` | Account overview |
| `/account/profile` | `AccountProfilePage.tsx` | Profile settings |
| `/account/security` | `AccountSecurityPage.tsx` | Security settings |
| `/account/preferences` | `AccountPreferencesPage.tsx` | User preferences |

---

## Supabase Functions

### Authentication & User Management

#### `send-verification-email`
Sends email verification to users.

#### `check-email-exists`
Checks if email exists in system.

### Workspace Management

#### `create-company`
Creates new workspace/company.
- **Email Service**: None (no emails sent)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

#### `send-workspace-request`
Sends join request to workspace admin.
- **Email Service**: Resend (optional - function works without it, but won't send email)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `RESEND_API_KEY` (optional)
- **Functionality**: Creates join request and sends email to admin if Resend is configured

#### `approve-workspace-request`
Approves workspace join request.
- **Email Service**: Resend (optional - function works without it, but won't send email)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `FRONTEND_URL`, `RESEND_API_KEY` (optional)
- **Functionality**: Approves request, adds user to company, sends approval email if Resend is configured

#### `reject-workspace-request`
Rejects workspace join request.
- **Email Service**: Requires Resend API key
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
- **Functionality**: Rejects request and sends rejection email via Resend

### Project Management

#### `invite-project-user`
Invites user to project with access control.
- **Email Service**: Requires Resend API key
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `RESEND_API_KEY`
- **Functionality**: Creates project invite and sends invitation email via Resend

#### `create-invite`
Creates company/workspace invitations.
- **Email Service**: Uses Supabase built-in email (via `signInWithOtp`)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`
- **Functionality**: Creates invite and sends magic link email via Supabase Auth (no Resend needed)
- **Note**: This is the only function that uses Supabase's native email service

#### `accept-invite`
Handles project invitation acceptance.
- **Email Service**: None (no emails sent)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

#### `validate-invite`
Validates project invitation token.
- **Email Service**: None (no emails sent)
- **Environment Variables**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Dataset Management

#### `upload-dataset`
Handles dataset upload initiation (coordinates with backend).

#### `dataset-status`
Provides dataset processing status.

---

## Deployment

### Environment Setup

1. **Supabase Production**
   - Create production project
   - Apply all migrations
   - Deploy Edge Functions
   - Configure production URLs

2. **Backend API**
   - Deploy backend service
   - Configure CORS for frontend domain
   - Set up production storage

3. **Environment Variables**
   - Set `VITE_SUPABASE_URL` to production URL
   - Set `VITE_SUPABASE_PUBLISHABLE_KEY` to production publishable key
   - Set `VITE_API_BASE_URL` to production API URL

### Build Process

```bash
npm run build
```

Builds optimized production bundle in `dist/` directory.

### Deployment Options

#### Lovable Platform
- Uses built-in deployment
- Click "Share → Publish" in Lovable dashboard
- Automatically deploys and provides URL

#### Azure Static Web Apps (Recommended)
- **Best for**: React/Vite static applications
- **Setup**:
  1. Create Azure Static Web App resource in Azure Portal
  2. Connect GitHub repository
  3. Configure build settings:
     - App location: `/`
     - Output location: `dist`
     - Build command: `npm run build`
  4. Set environment variables in Azure Portal → Configuration
  5. Deploy automatically on push to main branch
- **Benefits**: Free tier available, global CDN, automatic HTTPS, custom domains
- **Note**: For SPA routing, ensure `routes.json` in `public/` redirects all routes to `index.html`

#### Vercel/Netlify
- Connect GitHub repository
- Set environment variables
- Deploy from `main` branch
- Automatic deployments on push

#### Self-Hosted
- Serve `dist/` directory with web server (nginx, Apache)
- Configure reverse proxy if needed
- Set up SSL certificates
- **SPA Routing**: Configure URL rewrite rules to serve `index.html` for all routes

### Post-Deployment

1. Verify environment variables
2. Test authentication flow
3. Verify API connectivity
4. Test file uploads
5. Verify email functionality

---

## Testing

### Manual Testing Checklist

#### Authentication
- [ ] User registration
- [ ] Email verification
- [ ] Login/logout
- [ ] Password reset
- [ ] Session persistence

#### Workspace Management
- [ ] Create workspace
- [ ] Join workspace request
- [ ] Approve/reject requests
- [ ] View members
- [ ] Invite users

#### Project Management
- [ ] Create project
- [ ] View projects
- [ ] Delete project
- [ ] Navigate to dataset manager

#### Dataset Management
- [ ] Upload labelled data
- [ ] Upload unlabelled data
- [ ] View versions
- [ ] Browse files (grid/list)
- [ ] Preview images
- [ ] View labels
- [ ] Search files
- [ ] Filter by type/folder
- [ ] Download files
- [ ] Delete version (with dependencies)

#### Training
- [ ] Select project/dataset
- [ ] Configure model
- [ ] Start training
- [ ] View progress
- [ ] View logs
- [ ] View trained models
- [ ] Delete model

#### Inference
- [ ] Select model/dataset
- [ ] Configure confidence
- [ ] Run inference
- [ ] View results
- [ ] View history
- [ ] Delete results

---

## Contributing

### Code Style

- Use TypeScript for all new code
- Follow React best practices
- Use functional components and hooks
- Maintain component prop types
- Use ESLint configuration
- Follow existing code patterns

### Commit Messages

Use clear, descriptive commit messages:
```
feat: Add dataset version deletion
fix: Resolve file browser pagination issue
docs: Update API documentation
refactor: Simplify authentication flow
```

### Pull Request Process

1. Fork repository
2. Create feature branch
3. Make changes with tests
4. Update documentation
5. Submit PR with description
6. Address review feedback
7. Merge after approval

---

## Additional Notes

### Performance Considerations

- **Lazy Loading**: Images loaded on-demand with IntersectionObserver
- **Pagination**: File lists paginated to handle large datasets
- **Caching**: Training state cached in localStorage
- **Polling**: Status polling with appropriate intervals
- **Optimistic Updates**: UI updates before API confirmation

### Security Considerations

- **RLS**: All database operations protected by Row Level Security
- **Authentication**: All API calls authenticated
- **Input Validation**: Zod schemas validate all inputs
- **File Upload**: File size and type validation
- **XSS Protection**: React escapes content automatically
- **CSRF**: Token-based authentication reduces CSRF risk

### Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES6+ JavaScript support required
- LocalStorage support required
- File API support for uploads

### Known Limitations

- File upload size limited by backend (typically 200MB per file)
- Maximum 5000 files per dataset upload
- Training jobs require backend availability
- Large datasets may have performance implications

---

## Troubleshooting

### Common Issues

#### Authentication Issues
- **Problem**: Session not persisting
- **Solution**: Check localStorage is enabled, verify Supabase URL/key

#### API Connection Issues
- **Problem**: API calls failing
- **Solution**: Verify `VITE_API_BASE_URL` is correct, check CORS settings

#### File Upload Issues
- **Problem**: Uploads failing
- **Solution**: Check file size limits, verify backend storage configuration

#### Database Errors
- **Problem**: RLS policy errors
- **Solution**: Verify user has correct company_id, check RLS policies

#### Email Issues
- **Problem**: Email functions failing with "Missing RESEND_API_KEY"
- **Solution**: 
  - For `send-verification-email`, `invite-project-user`, `reject-workspace-request`: Set `RESEND_API_KEY` environment variable
  - For `approve-workspace-request`, `send-workspace-request`: Resend is optional - functions work without it but won't send emails
  - For `create-invite`: Uses Supabase email - ensure Supabase email is configured in Dashboard → Settings → Auth
- **Problem**: Emails not being sent
- **Solution**: 
  - Check Resend API key is valid and has verified domain
  - Verify `APP_URL` or `FRONTEND_URL` is set correctly
  - Check Supabase email configuration if using `create-invite`
  - Review Edge Function logs in Supabase Dashboard

---

## Support & Resources

### Documentation
- This documentation file
- README.md for quick start
- Code comments in source files

### External Resources
- [React Documentation](https://react.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)

---

---

## Quick Reference Checklist for New Project Setup

### Initial Setup
- [ ] Install Node.js 18+
- [ ] Clone or initialize project
- [ ] Install all dependencies from `package.json`
- [ ] Create `.env` file with required variables
- [ ] Configure `vite.config.ts` (port 8080, path aliases)
- [ ] Set up Tailwind CSS and shadcn/ui
- [ ] Configure TypeScript paths (`@/*` → `./src/*`)

### Supabase Setup
- [ ] Create Supabase project
- [ ] Apply all database migrations in order
- [ ] Create `datasets` storage bucket (private, RLS enabled)
- [ ] Deploy all 12 Edge Functions
- [ ] Set environment variables for each Edge Function:
  - [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for all functions
  - [ ] `APP_URL` or `FRONTEND_URL` for email functions
  - [ ] `RESEND_API_KEY` for functions that require it (optional for some)
- [ ] Configure email service:
  - [ ] Option A: Get Resend API key and set for required functions
  - [ ] Option B: Configure Supabase SMTP/email templates
  - [ ] Option C: Modify functions to use only Supabase email

### Backend API Setup
- [ ] Ensure backend API is running
- [ ] Verify `VITE_API_BASE_URL` points to correct endpoint
- [ ] Test API connectivity
- [ ] Configure CORS for frontend domain

### Development
- [ ] Run `npm run dev` (should start on port 8080)
- [ ] Verify all routes work
- [ ] Test authentication flow
- [ ] Test file uploads
- [ ] Verify email functionality

### Production Deployment
- [ ] Build production bundle: `npm run build`
- [ ] Set production environment variables
- [ ] Deploy frontend (Vercel/Netlify/Azure Static Web Apps)
- [ ] Deploy backend API
- [ ] Update Supabase Edge Function `APP_URL` to production URL
- [ ] Test all features in production

---

---

## Additional Resources

### Configuration Files Reference

- **`components.json`**: shadcn/ui configuration (component paths, aliases, styling)
- **`vite.config.ts`**: Vite build configuration (port, plugins, path aliases)
- **`tailwind.config.ts`**: Tailwind CSS configuration (theme, content paths)
- **`tsconfig.json`**: TypeScript root configuration
- **`tsconfig.app.json`**: TypeScript configuration for application code
- **`tsconfig.node.json`**: TypeScript configuration for Node.js scripts
- **`postcss.config.js`**: PostCSS configuration (Tailwind, Autoprefixer)
- **`eslint.config.js`**: ESLint linting rules
- **`index.html`**: HTML entry point for the application

### Important Notes

1. **Environment Variables**: Always use `VITE_SUPABASE_PUBLISHABLE_KEY` (not `VITE_SUPABASE_ANON_KEY`)
2. **Route Persistence**: Implemented via `routePersistence.ts` (utils) and `useRoutePersistence.ts` (hook)
3. **Profile Loading**: Timeout errors are soft-handled to preserve user experience
4. **SPA Routing**: For production deployment, ensure all routes redirect to `index.html` for client-side routing
5. **Database Migrations**: Must be applied in chronological order (by filename timestamp)
6. **Email Configuration**: 
   - **Mixed Email Approach**: Project uses both Supabase email (`create-invite`) and Resend API (other functions)
   - **Resend Required**: `send-verification-email`, `invite-project-user`, `reject-workspace-request` require `RESEND_API_KEY`
   - **Resend Optional**: `approve-workspace-request`, `send-workspace-request` work without Resend but won't send emails
   - **Supabase Email**: `create-invite` uses Supabase's built-in email service (no Resend needed)
   - **Alternative**: To use only Supabase email, modify the 3 functions that require Resend to use Supabase email instead

---

**Last Updated**: 18th December 2025  
**Version**: 1.0.0  
**Maintainer**: VisionM Development Team
