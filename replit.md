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

## User Preferences
- Clean database initialization without hardcoded subnet IDs or network configurations
- Focus on production-ready code with proper error handling
- Emphasis on data integrity and authentic data sources
- Prefer comprehensive solutions over partial implementations

## Current Status
**COMPLETED**: Full-stack authentication and authorization system successfully implemented:

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

### User Role System (✅ Complete)
1. **Admin**: Full control over entire application and all resources
2. **User**: Can modify VLANs and subnets they have permissions for  
3. **Viewer**: Read-only access to assigned resources only

### Authentication Features (✅ Complete)
- Login/logout functionality with session management
- Demo credentials: admin/admin for testing
- Protected routes with 401 responses for unauthenticated access
- User data filtering ensuring permission-based visibility

## Technical Notes
- Production environment has 122 devices across 2 subnets
- Backend properly extracts subnet, sortBy, and sortOrder parameters
- Settings system includes scanning intervals, notifications, and data retention
- Network scanner uses WebSocket for real-time status updates