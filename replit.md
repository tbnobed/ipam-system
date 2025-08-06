# IPAM System - Network IP Address Management

## Overview
This project delivers a comprehensive IP Address Management (IPAM) solution designed for broadcast facility network infrastructure. Its primary purpose is to provide advanced network scanning, intelligent device management, and precise subnet tracking with robust data handling and visualization capabilities. The system aims to streamline network administration, enhance visibility, and improve the efficiency of managing IP addresses and network devices within complex broadcast environments. Key capabilities include real-time network monitoring, device tracking, detailed data exports, and comprehensive system configuration management.

## User Preferences
- Clean database initialization without hardcoded subnet IDs or network configurations
- Focus on production-ready code with proper error handling
- Emphasis on data integrity and authentic data sources
- Prefer comprehensive solutions over partial implementations
- NEVER suggest commands that delete production data
- Always provide data-safe deployment options and backup procedures

## System Architecture
The IPAM system is built as a full-stack application. The backend is developed using Node.js with Express, leveraging a PostgreSQL database with Drizzle ORM for data persistence. The frontend is a React application built with TypeScript, styled using Tailwind CSS, and incorporating shadcn/ui components for a modern user interface. Real-time functionalities, such as live network monitoring and scan updates, are handled via WebSocket connections. The entire application is designed for Docker-based deployment, including automated database initialization.

Key architectural decisions and technical implementations include:
- **UI/UX:** Modern professional appearance with consistent branding (TBN logo integration), improved spacing, typography, blue accent colors, smooth transitions, and enhanced user profile sections. User management interfaces feature dual-tabbed layouts for users and groups, and hierarchical permission dialogs.
- **Authentication & Authorization:** A complete session-based authentication and authorization system with `requireAuth` middleware applied to all API endpoints. It features resource-based access control, comprehensive permission checks for devices, subnets, and VLANs, and granular write permissions.
- **Group Permissions:** A robust group permissions system with inheritance, allowing users to inherit permissions from assigned groups. Individual user permissions can override group permissions. The UI supports group management with a hierarchical VLAN-to-Subnet permission structure.
- **User Roles:** Defined user roles (Admin, User, Viewer) with distinct access levels and UI restrictions.
- **Network Scanning:** Real-time network scanning with subnet validation, configurable intervals, and dynamic settings read from the database (e.g., ping timeouts, port scanning timeouts).
- **Data Management:** Features for exporting configuration (VLANs, subnets, settings) and full system backups. Configuration imports include robust validation, error handling, and proper import order.
- **Notification System:** A comprehensive notification service supporting various channels (email via SendGrid) triggered by device status changes and subnet utilization.
- **Settings Management:** A comprehensive system for managing application settings, including scanning parameters, notification preferences, and data retention policies, with persistence across application rebuilds.
- **Data Integrity:** Elimination of hardcoded VLAN/subnet IDs, ensuring all configurations and permissions are dynamically sourced from the database. Critical security fixes include bcrypt hashing for all user passwords.

## External Dependencies
- **PostgreSQL:** Primary database for storing all system data, including devices, subnets, VLANs, users, and settings.
- **Drizzle ORM:** Used for interacting with the PostgreSQL database from the Node.js backend.
- **SendGrid:** Integrated for sending email notifications and alerts.
- **Docker:** Used for containerization and deployment of the entire application stack.

## Recent Changes
- **2025-08-06**: **DOCKER BUILD ISSUES RESOLVED**: Fixed critical database schema issues causing Docker deployment failures - resolved missing created_at column in settings table, missing assignment_type column in subnets table, and foreign key constraint violations in activity_logs. All 8 database migrations now apply successfully enabling clean Docker deployments
- **2025-08-06**: **DOCKER COMPOSE CLEANUP**: Removed obsolete init.sql reference from docker-compose.yml configuration ensuring PostgreSQL container starts without initialization errors
- **2025-08-06**: **CODEBASE CLEANUP**: Removed all unnecessary Docker test scripts and database maintenance files - cleaned up 18 obsolete files including test scripts, debug tools, production fixes, and temporary assets while preserving only essential deployment files for fresh installations  
- **2025-08-06**: **HARDCODED IDS ELIMINATION**: Completely eliminated all hardcoded VLAN and subnet IDs from codebase - updated test scripts and production fixes to use dynamic database lookups ensuring complete data integrity with authentic sources only
- **2025-08-06**: **SIDEBAR MODERNIZATION**: Redesigned sidebar with modern professional appearance - increased TBN logo size by 50%, improved spacing and typography, added blue accent colors and smooth transitions, enhanced user profile section with gradient avatar
- **2025-08-06**: **TBN BRANDING INTEGRATION**: Moved TBN logo to proper Vite asset directory structure and integrated throughout application with proper organizational branding