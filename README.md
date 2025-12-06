# ScalperBlock: Transaction Verification API for Bot Detection

## Overview

**ScalperBlock** is a comprehensive, multi-layered Transaction Verification API designed to combat bot-driven fraud in high-demand e-commerce and digital ticketing. 

## Quick Start (Local Development)

Prerequisites: Node.js 16+, PostgreSQL 12+ (or Docker)

```bash
npm install
npm start
```

Server runs on `http://localhost:3000`

## Architecture: Four Core Components

1. **Core API Interface** — Real-time scoring endpoint (FR-1 through FR-5)
2. **Risk Scoring Engine** — Multi-factor analysis (FR-7 through FR-11)
   - FR-7: IP Reputation Check
   - FR-8: Velocity Abuse Detection
   - FR-9: Browser Fingerprinting
   - FR-10: Behavioral Anomaly Detection
   - FR-11: Weighted Score Aggregation
3. **Management & Monitoring** — Admin controls & audit (FR-13 through FR-16)
4. **Database Design** — PostgreSQL schema with all tables, views, and indexes

## Key Files

- **Java**: `java/ScalperBlockSystem.java` — Complete system implementation with all 4 components
- **Database**: `database/scalperblock_schema.sql` — PostgreSQL schema (all tables + views)
- **Backend**: `server.js` — Node.js Express API server
- **Frontend**: `public/` — Web UI with merchant dashboard

## Environment Variables

```bash
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_USER=scalperblock
DB_PASSWORD=secure_password
DB_NAME=scalperblock_db
SB_ADMIN_EMAIL=admin@scalperblock.io
```

## Deployment

**Local**: `npm start`  
**Docker**: `docker-compose up --build`  
**Cloud**: AWS / Heroku / Google Cloud (see documentation)

## Functional Requirements Status

All 14 functional requirements (FR-1 through FR-16) are implemented across the four components:
- FR-1 to FR-5: Core API Interface
- FR-7 to FR-11: Risk Scoring Engine
- FR-13 to FR-16: Management & Monitoring

Database design includes all scoring algorithms, rule configurations, feedback tracking, and audit logs.

**Project**: INSY 4325 - ScalperBlock Transaction Verification API  
**Version**: 1.0.0  
**Updated**: December 6, 2025
