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
- **2025-01-16**: **MAJOR**: Implemented comprehensive user groups system with group-based permissions
- **2025-01-16**: Added database schema for user groups, group permissions, and group memberships
- **2025-01-16**: Created complete API endpoints for user groups management (CRUD operations)
- **2025-01-16**: Implemented group permissions allowing inheritance from groups to users
- **2025-01-16**: Added group memberships system linking users to groups with cascading permissions
- **2025-01-16**: Fixed Settings page visibility - now properly hidden from non-admin users
- **2025-01-16**: Enhanced sidebar navigation with improved role-based filtering using .filter() method
- **2025-01-16**: **GROUPS UI COMPLETE**: Integrated Groups functionality into Users page with tabbed interface
- **2025-01-16**: Added comprehensive group permissions dialog with VLAN→Subnet hierarchy management
- **2025-01-16**: Implemented group CRUD operations with create, edit, delete, and permissions management
- **2025-01-16**: Fixed group permissions button functionality - now opens full permissions management dialog
- **2025-01-16**: **DOCKER DEPLOYMENT UPDATED**: Updated Docker build files to include groups feature
- **2025-01-16**: Enhanced docker-entrypoint.sh to create user groups tables and default groups
- **2025-01-16**: Added groups table verification to Docker container initialization
- **2025-01-16**: Integrated groups creation into both automated and manual database setup procedures

## User Preferences
- Clean database initialization without hardcoded subnet IDs or network configurations
- Focus on production-ready code with proper error handling
- Emphasis on data integrity and authentic data sources
- Prefer comprehensive solutions over partial implementations
- **NEVER suggest commands that delete production data** (e.g., docker-compose down --volumes)
- Always provide data-safe deployment options and backup procedures

## Current Status
**COMPLETED**: Full-stack authentication and authorization system successfully implemented and deployed:

### Backend Security (✅ Complete)
- Session-based authentication with requireAuth middleware on all API endpoints
- Resource-based access control filtering data by user permissions
- Comprehensive permission checks for devices, subnets, VLANs, and network operations
- Write permission requirements for device create/update/delete operations
- Admin-only restrictions for sensitive operations (fix subnets, user management)
- Subnet-based permission filtering for network scanning

### Frontend Access Control (✅ Complete)  
- User management interface with create, edit, delete capabilities
- Role-based UI restrictions and navigation filtering
- Permission dialog with hierarchical VLAN→Subnet structure
- Visual permission indicators and color-coded levels
- Device table actions (Add/Edit/Delete) properly hidden based on user permissions

### User Role System (✅ Complete)
1. **Admin**: Full control over entire application and all resources
2. **User**: Can modify VLANs and subnets they have permissions for  
3. **Viewer**: Read-only access to assigned resources only

### Authentication Features (✅ Complete)
- Login/logout functionality with session management
- Demo credentials: admin/admin for testing
- Protected routes with 401 responses for unauthenticated access
- User data filtering ensuring permission-based visibility

### Docker Production Deployment (✅ Complete)
- Complete Docker containerization with PostgreSQL database
- Automated database schema migrations via docker-entrypoint.sh
- Session table creation and user account setup during container startup
- Production-ready environment configuration with .env.docker
- Health checks and proper container orchestration
- Default users created: admin/admin, user/user, viewer/viewer
- bcrypt password hashing with proper authentication validation
- Bulletproof user account creation with fallback mechanisms

## Technical Notes
- Production environment has 122 devices across 2 subnets
- Backend properly extracts subnet, sortBy, and sortOrder parameters
- Settings system includes scanning intervals, notifications, and data retention
- Network scanner uses WebSocket for real-time status updates