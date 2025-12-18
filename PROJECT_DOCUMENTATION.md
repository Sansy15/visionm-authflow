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

---

## Project Structure

```
visionm-authflow/
├── public/                 # Static assets
│   ├── favicon.ico
│   ├── landing-bg.jpg
│   └── placeholder.svg
│
├── src/
│   ├── components/         # React components
│   │   ├── app-shell/      # Layout components
│   │   │   ├── AppHeader.tsx
│   │   │   ├── AppShell.tsx
│   │   │   ├── AppSidebar.tsx
│   │   │   ├── Breadcrumbs.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── pages/          # Page-specific components
│   │   │   ├── EmptyState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   └── PageHeader.tsx
│   │   ├── ui/             # shadcn/ui components
│   │   └── ...             # Feature components
│   │
│   ├── contexts/           # React contexts
│   │   ├── ProfileContext.tsx
│   │   └── profile-context.ts
│   │
│   ├── hooks/              # Custom React hooks
│   │   ├── useProfile.ts
│   │   ├── useFormValidation.ts
│   │   ├── useRoutePersistence.ts
│   │   └── use-toast.ts
│   │
│   ├── integrations/       # Third-party integrations
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   │
│   ├── layouts/            # Layout components
│   │   └── MainLayout.tsx
│   │
│   ├── lib/                # Utility libraries
│   │   ├── utils.ts
│   │   ├── utils/
│   │   │   └── adminUtils.ts
│   │   └── validations/
│   │       └── authSchemas.ts
│   │
│   ├── pages/              # Page components
│   │   ├── Auth.tsx
│   │   ├── Dashboard.tsx
│   │   ├── DatasetManager.tsx
│   │   ├── PredictionPage.tsx
│   │   ├── ProjectsPage.tsx
│   │   └── ...
│   │
│   ├── utils/              # Utility functions
│   │   └── trainingPersistence.ts
│   │
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles
│
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── accept-invite/
│   │   ├── approve-workspace-request/
│   │   ├── create-company/
│   │   ├── invite-project-user/
│   │   ├── send-workspace-request/
│   │   └── ...
│   │
│   ├── migrations/         # Database migrations
│   │   └── *.sql
│   │
│   └── config.toml         # Supabase configuration
│
├── .env                    # Environment variables
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite configuration
├── tailwind.config.ts      # Tailwind CSS config
└── README.md               # Quick start guide
```

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
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

4. **Supabase Setup**
   - Create Supabase project
   - Run migrations from `supabase/migrations/`
   - Configure storage bucket: `datasets`
   - Set up Edge Functions
   - Configure email templates

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
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `VITE_API_BASE_URL` | Backend API base URL | Yes |

### Vite Configuration

- **Port**: 8080 (configurable in `vite.config.ts`)
- **Host**: `::` (all interfaces)
- **HMR**: Enabled with overlay disabled
- **Path Alias**: `@` → `./src`

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

Required environment variables for functions:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (for email functions)
- `APP_URL` (application URL for email links)

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
| `/signup-invite/:token` | `SignUpWithInvite.tsx` | Sign up via invitation |

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

#### `send-workspace-request`
Sends join request to workspace admin.

#### `approve-workspace-request`
Approves workspace join request.

#### `reject-workspace-request`
Rejects workspace join request.

### Project Management

#### `invite-project-user`
Invites user to project with access control.

#### `accept-invite`
Handles project invitation acceptance.

#### `validate-invite`
Validates project invitation token.

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
   - Set `VITE_SUPABASE_ANON_KEY` to production key
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

#### Vercel/Netlify
- Connect GitHub repository
- Set environment variables
- Deploy from `main` branch
- Automatic deployments on push

#### Self-Hosted
- Serve `dist/` directory with web server (nginx, Apache)
- Configure reverse proxy if needed
- Set up SSL certificates

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

**Last Updated**: 18th December 2025  
**Version**: 1.0.0  
**Maintainer**: VisionM Development Team
