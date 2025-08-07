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

## External Dependencies
- **PostgreSQL**: Primary database for all application data.
- **Drizzle ORM**: Used for database interaction and schema management.
- **SendGrid**: Integrated for sending email notifications and alerts.