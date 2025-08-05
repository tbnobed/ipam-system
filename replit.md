# IPAM System - Network IP Address Management

## Project Overview
A comprehensive IP Address Management (IPAM) solution for broadcast facility network infrastructure, providing advanced network scanning, intelligent device management, and precise subnet tracking with robust data handling and visualization capabilities.

## Current Architecture
- **Backend**: Node.js with Express, PostgreSQL database with Drizzle ORM
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui components
- **Database**: PostgreSQL with comprehensive schema for devices, subnets, VLANs, users, and settings
- **Real-time**: WebSocket connections for live network monitoring and scan updates
- **Containerization**: Docker-based deployment with automated database initialization

## Key Features Implemented
- Real-time network scanning with subnet validation
- Device tracking across multiple network ranges (10.63.20.0/24, 10.63.21.0/24)
- Advanced filtering and sorting with numerical IP address ordering
- Excel export functionality organized by VLAN
- Comprehensive settings management system
- Network scan control with stop/start functionality
- Activity logging and audit trails

## Recent Changes
- **2025-08-05**: **EMAIL RECIPIENTS FIX**: Fixed email recipients configuration persistence issue - recipients can now be customized and saved properly
- **2025-08-05**: **SETTINGS SAVE**: Added alert_emails field to settings save process ensuring email recipients persist across sessions
- **2025-08-05**: **SENDGRID INTEGRATION**: Successfully integrated SendGrid for email notifications with proper API key configuration
- **2025-08-05**: **EMAIL NOTIFICATIONS**: Implemented formatted HTML email alerts using SendGrid mail service
- **2025-08-05**: **NOTIFICATION SYSTEM**: Created comprehensive notification service with support for email, webhook, Slack, and SMS alerts
- **2025-08-05**: **NOTIFICATION ARCHITECTURE**: Implemented NotificationService class with configurable channels and alert processing
- **2025-08-05**: **ALERT TRIGGERS**: Added device status change detection and subnet utilization monitoring
- **2025-08-05**: **NOTIFICATION SETTINGS**: Connected UI settings to backend notification delivery system
- **2025-08-05**: **TESTING**: Added /api/test-notification endpoint for admin testing of notification channels
- **2025-01-17**: **UI CLEANUP**: Removed duplicate settings pages - consolidated into single functional settings.tsx
- **2025-01-17**: **SETTINGS COMPLETE**: Implemented full settings functionality with React Hook Form backend connectivity
- **2025-01-17**: Added working save functionality for all setting categories (scanning, notifications, data management)
- **2025-01-17**: Connected export data feature with Excel download and clear historical data with backend API
- **2025-01-17**: **CRITICAL FIX**: Fixed database constraint violation preventing group permissions from saving
- **2025-01-17**: Updated database constraints to use "view" instead of "read" for permission levels
- **2025-01-17**: Fixed permission enum mismatch between frontend and backend schemas
- **2025-01-17**: Group permissions now save correctly with all permission levels (view, write, admin)
- **2025-01-17**: **UI IMPROVEMENT**: Enhanced edit user form with optional password change functionality
- **2025-01-17**: Added separate "Change Password" button to edit user dialog instead of requiring password for all edits
- **2025-01-17**: Created separate EditUserFormData schema with optional password field for editing
- **2025-01-17**: **CRITICAL FIX**: Resolved apiRequest JSON parsing issue causing group permissions display failures
- **2025-01-17**: Fixed frontend to properly call .json() on Response objects from apiRequest function
- **2025-01-17**: **MAJOR FIX**: Group permissions now load and display correctly in frontend dialog
- **2025-01-17**: **CRITICAL FIX**: Resolved group permissions saving issues by implementing bulk save API endpoint
- **2025-01-17**: Fixed migration file 007_add_user_groups_and_permissions.sql to use proper PostgreSQL syntax
- **2025-01-17**: Added deleteGroupPermissions method to storage interface for bulk permission updates
- **2025-01-17**: Enhanced group permissions API to handle both individual and bulk permission operations
- **2025-01-17**: Confirmed group permissions inheritance works - all users in a group automatically inherit permissions
- **2025-01-17**: **MAJOR**: Implemented complete group permissions system with inheritance functionality
- **2025-01-17**: Added user_groups and group_permissions database tables with proper foreign key relationships
- **2025-01-17**: Created comprehensive group management UI with dual-tab interface for users and groups
- **2025-01-17**: Implemented group permissions dialog with hierarchical VLAN→Subnet permission structure
- **2025-01-17**: Added automatic permission inheritance - all users in a group inherit group permissions
- **2025-01-17**: Enhanced backend to merge group permissions with individual user permissions
- **2025-01-17**: Created Docker migration support for group permissions tables
- **2025-01-17**: Updated docker-entrypoint.sh to handle group permissions database schema
- **2025-01-17**: Added "Engineering" default group with network access permissions
- **2025-01-17**: Implemented group assignment functionality in user creation and editing forms
- **2025-01-16**: **MAJOR**: Implemented complete backend authentication and authorization system
- **2025-01-16**: Added session-based authentication with requireAuth middleware to all API endpoints
- **2025-01-16**: Implemented resource-based access control filtering data by user permissions
- **2025-01-16**: Added comprehensive permission checks for devices, subnets, and VLANs
- **2025-01-16**: Created device permission filtering ensuring users only see/modify allowed resources
- **2025-01-16**: Enhanced network scanning with subnet-based permission filtering
- **2025-01-16**: Added write permission requirements for device create/update/delete operations
- **2025-01-16**: Implemented admin-only restrictions for sensitive operations (fix subnets, etc.)
- **2025-01-16**: Fixed TypeScript schema errors and permission type definitions
- **2025-01-16**: Redesigned permissions dialog with super granular VLAN→Subnet hierarchy
- **2025-01-16**: Added visual permission legend with color-coded levels (None/View/Edit/Admin)
- **2025-01-16**: Implemented hierarchical permissions showing subnets under their parent VLANs
- **2025-01-16**: Enhanced permission dialog with detailed resource information and visual indicators
- **2025-01-16**: **CRITICAL FIX**: Resolved Docker deployment syntax errors and module loading issues
- **2025-01-16**: Fixed unterminated string literal error in production setup script
- **2025-01-16**: Implemented standalone JavaScript setup script using pg library for database initialization
- **2025-01-16**: Fixed module path resolution by running setup from app directory instead of /tmp
- **2025-01-16**: **AUTHENTICATION FIX**: Corrected login system to use bcrypt.compare() for password validation
- **2025-01-16**: Resolved Docker deployment authentication issue - admin/admin login now works correctly

## User Preferences
- Clean database initialization without hardcoded subnet IDs or network configurations
- Focus on production-ready code with proper error handling
- Emphasis on data integrity and authentic data sources
- Prefer comprehensive solutions over partial implementations
- **NEVER suggest commands that delete production data** (e.g., docker-compose down --volumes)
- Always provide data-safe deployment options and backup procedures

## Current Status
**COMPLETED**: Full-stack authentication and authorization system with group permissions successfully implemented and deployed:

### Backend Security (✅ Complete)
- Session-based authentication with requireAuth middleware on all API endpoints
- Resource-based access control filtering data by user permissions
- Comprehensive permission checks for devices, subnets, VLANs, and network operations
- Write permission requirements for device create/update/delete operations
- Admin-only restrictions for sensitive operations (fix subnets, user management)
- Subnet-based permission filtering for network scanning

### Group Permissions System (✅ Complete)
- User groups database tables with proper foreign key relationships
- Group permissions inheritance - all users in a group automatically inherit group permissions
- Group management UI with dual-tab interface for users and groups
- Hierarchical permission structure showing VLANs and their subnets
- Backend automatically merges group permissions with individual user permissions
- Individual user permissions can override group permissions
- Docker migration support for group permissions tables

### Frontend Access Control (✅ Complete)  
- User management interface with create, edit, delete capabilities
- Role-based UI restrictions and navigation filtering
- Permission dialog with hierarchical VLAN→Subnet structure
- Visual permission indicators and color-coded levels
- Device table actions (Add/Edit/Delete) properly hidden based on user permissions
- Group permissions dialog with Settings button for each group

### User Role System (✅ Complete)
1. **Admin**: Full control over entire application and all resources
2. **User**: Can modify VLANs and subnets they have permissions for  
3. **Viewer**: Read-only access to assigned resources only

### Authentication Features (✅ Complete)
- Login/logout functionality with session management
- Demo credentials: admin/admin for testing
- Protected routes with 401 responses for unauthenticated access
- User data filtering ensuring permission-based visibility
- Group assignment functionality in user creation and editing

### Docker Production Deployment (✅ Complete)
- Complete Docker containerization with PostgreSQL database
- Automated database schema migrations via docker-entrypoint.sh
- Session table creation and user account setup during container startup
- Production-ready environment configuration with .env.docker
- Health checks and proper container orchestration
- Default users created: admin/admin, user/user, viewer/viewer
- Default "Engineering" group created with network access
- bcrypt password hashing with proper authentication validation
- Bulletproof user account creation with fallback mechanisms
- Group permissions tables migration support in Docker deployment

## Technical Notes
- Production environment has 122 devices across 2 subnets
- Backend properly extracts subnet, sortBy, and sortOrder parameters
- Settings system includes scanning intervals, notifications, and data retention
- Network scanner uses WebSocket for real-time status updates