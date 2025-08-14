# IPAM System - Network IP Address Management

## Overview
This project delivers a comprehensive IP Address Management (IPAM) solution designed for broadcast facility network infrastructure. Its primary purpose is to provide advanced network scanning, intelligent device management, and precise subnet tracking. Key capabilities include robust data handling, real-time visualization, and secure user management. The system aims to streamline network administration, enhance operational efficiency, and provide a single source of truth for network resources, supporting scalable and reliable network operations.

## User Preferences
- Clean database initialization without hardcoded subnet IDs or network configurations
- Focus on production-ready code with proper error handling
- Emphasis on data integrity and authentic data sources
- Prefer comprehensive solutions over partial implementations
- NEVER suggest commands that delete production data (e.g., docker-compose down --volumes)
- Always provide data-safe deployment options and backup procedures

## System Architecture
The IPAM system is built with a modern full-stack architecture. The **backend** is powered by Node.js with Express.js, utilizing a PostgreSQL database managed by Drizzle ORM. The **frontend** is developed using React with TypeScript, styled with Tailwind CSS, and leverages shadcn/ui components for a clean and functional user interface.

**Core Architectural Decisions:**
- **Containerization**: The entire application is deployed using Docker, with automated database initialization and schema migrations, ensuring consistent and reproducible environments.
- **Real-time Communication**: WebSocket connections are used for live network monitoring, scan updates, and real-time feedback.
- **Data Management**: A comprehensive PostgreSQL schema underpins the system, storing detailed information on devices, subnets, VLANs, users, and system settings.
- **Authentication and Authorization**: A robust session-based authentication system is implemented, coupled with granular resource-based access control. This includes a complete group permissions system with inheritance functionality, allowing for hierarchical VLAN and subnet-based permissions.
- **UI/UX Design**: The frontend features a professional and modern design, including a redesigned sidebar with enhanced styling and brand integration. Key UI elements like device tables and settings are optimized for usability, incorporating features like advanced filtering, sorting, and pagination.
- **Configuration Management**: A comprehensive settings management system allows users to configure scanning intervals, notification preferences, and data retention policies, with all settings persistently stored in the database.
- **Security**: All user passwords are hashed using bcrypt. The system includes user profile management with secure credential updates and admin-only restrictions for sensitive operations.
- **Backup and Restore**: Comprehensive backup and restore functionality is provided for system configuration and full database snapshots.

**Feature Specifications:**
- Real-time network scanning with subnet validation.
- Device tracking across multiple network ranges.
- Advanced filtering and sorting with numerical IP address ordering.
- Excel export functionality organized by VLAN.
- Activity logging and audit trails.
- Notification system with support for email alerts.
- User role system including Admin, User, and Viewer roles with distinct permissions.
- Device tracking functionality to monitor who created each device.

## Recent Changes
- **2025-08-07**: **DEVICE TRACKING FEATURE**: Added "Created By" column to track who added each device - devices from system scans show "system scan", manually added devices show the username. Includes complete Docker deployment support with database migration and schema updates
- **2025-08-07**: **DOCKER DEPLOYMENT FIX**: Fixed critical production deployment issue where settings table was missing created_at column causing database initialization failures - updated docker-entrypoint.sh to include proper schema definition, Docker build now succeeds completely
- **2025-08-07**: **MODERN SIDEBAR REDESIGN**: Implemented modern sidebar design with enhanced spacing, professional styling, blue accent colors, gradient user avatar, and 50% larger TBN logo for better brand visibility
- **2025-08-07**: **TBN LOGO INTEGRATION**: Properly moved TBN logo to client/src/assets directory structure and updated imports for proper Vite asset handling, removed unnecessary static file serving

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Drizzle ORM**: Used for database interaction and schema management.
- **SendGrid**: Integrated for sending email notifications and alerts.