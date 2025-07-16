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
- **2025-01-16**: Fixed user edit form dialog switching to create mode instead of closing
- **2025-01-16**: Implemented role-based access control - viewers restricted from Discovery, Analytics, Settings
- **2025-01-16**: Added route protection in frontend and sidebar navigation filtering
- **2025-01-16**: Implemented comprehensive settings management system with database persistence
- **2025-01-16**: Fixed numerical IP address sorting using PostgreSQL inet casting
- **2025-01-16**: Added functional stop scan capability with proper state management
- **2025-01-16**: Enhanced Excel export with VLAN-organized tabs using xlsx library
- **2025-01-16**: Created settings API endpoints and functional frontend form

## User Preferences
- Clean database initialization without hardcoded subnet IDs or network configurations
- Focus on production-ready code with proper error handling
- Emphasis on data integrity and authentic data sources
- Prefer comprehensive solutions over partial implementations

## Current Status
**COMPLETED**: User access control system successfully implemented with three permission levels:
1. **Admin**: Full control over entire application
2. **User**: Can modify VLANs and subnets they have permissions for  
3. **Viewer**: Read-only access to assigned resources

✅ User management interface functional with create, edit, delete capabilities
✅ Database integration with user storage and permissions
✅ API endpoints for complete user management operations
✅ Role-based access control system implemented

## Technical Notes
- Production environment has 122 devices across 2 subnets
- Backend properly extracts subnet, sortBy, and sortOrder parameters
- Settings system includes scanning intervals, notifications, and data retention
- Network scanner uses WebSocket for real-time status updates