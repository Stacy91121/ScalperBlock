# ScalperBlock: Deployment Guide

## Deployment Architecture Overview

ScalperBlock can be deployed in multiple configurations depending on scale and infrastructure:

```
┌──────────────────────────────────────────────────────────────┐
│                      Deployment Options                      │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Local (Development)  → Docker (Testing)  → Cloud (Production)
│  ┌─────────────────┐  ┌──────────────┐   ┌────────────────┐
│  │ Node.js + DB   │  │ Docker       │   │ AWS / Heroku   │
│  │ file-based or  │  │ Compose      │   │ Kubernetes     │
│  │ PostgreSQL     │  │              │   │ Serverless     │
│  └─────────────────┘  └──────────────┘   └────────────────┘
│
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Local Development Deployment

### Prerequisites
- Node.js 16+ ([download](https://nodejs.org/))
- PostgreSQL 12+ ([download](https://www.postgresql.org/download/)) **OR** Docker

### Option 1a: With Local PostgreSQL

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Create PostgreSQL Database**
   ```bash
   createdb -U postgres scalperblock_db
   ```

3. **Initialize Schema**
   ```bash
   psql -U postgres -d scalperblock_db -f database/scalperblock_schema.sql
   ```

4. **Configure Environment**
   ```bash
   cp .env.development .env
   ```
   
   Edit `.env`:
   ```bash
   PORT=3000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=scalperblock_db
   API_SECRET=dev-secret-key
   SB_ADMIN_EMAIL=admin@example.com
   ```

5. **Start Server**
   ```bash
   npm start
   # or with auto-reload
   npm run dev
   ```

6. **Verify**
   - Frontend: http://localhost:3000
   - API: http://localhost:3000/api/health

---

### Option 1b: With Docker (Local PostgreSQL)

1. **Install Dependencies & Start Container**
   ```bash
   npm install
   docker-compose up -d postgres
   ```

2. **Initialize Database**
   ```bash
   # Wait 10 seconds for PostgreSQL to start
   sleep 10
   psql -h localhost -U scalperblock -d scalperblock_db \
     -f database/scalperblock_schema.sql
   ```

3. **Configure Environment**
   ```bash
   cat > .env << EOF
   PORT=3000
   NODE_ENV=development
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=scalperblock
   DB_PASSWORD=secure_password_dev
   DB_NAME=scalperblock_db
   API_SECRET=dev-secret-key
   SB_ADMIN_EMAIL=admin@scalperblock.io
   EOF
   ```

4. **Start Application**
   ```bash
   npm start
   ```

5. **Cleanup**
   ```bash
   docker-compose down  # Stop containers
   docker-compose down -v  # Stop and remove volumes
   ```

---

## 2. Docker Containerized Deployment (Testing/Staging)

### Full Stack with Docker Compose

**Best for**: Testing complete system, CI/CD pipelines, staging environments

1. **Build & Start All Services**
   ```bash
   docker-compose up --build
   ```

   This starts:
   - **PostgreSQL** (port 5432)
   - **Node.js API** (port 3000)

2. **Verify Services**
   ```bash
   # Check running containers
   docker-compose ps

   # View logs
   docker-compose logs -f web

   # Test API
   curl http://localhost:3000/api/health
   ```

3. **Database Management**
   ```bash
   # Access database
   docker-compose exec postgres psql -U scalperblock -d scalperblock_db

   # View transactions
   SELECT COUNT(*) FROM transactions;

   # Exit
   \q
   ```

4. **Scaling**
   ```bash
   # Run multiple API instances (behind load balancer)
   docker-compose up --scale web=3
   ```

5. **Cleanup**
   ```bash
   # Stop all services
   docker-compose stop

   # Remove containers and volumes
   docker-compose down -v
   ```

---

## 3. Cloud Deployment (Production)

### Option 3a: AWS Deployment

#### Using EC2 + RDS + Application Load Balancer

**Architecture**
```
Internet → ALB → Auto Scaling Group (EC2 instances) → RDS PostgreSQL
```

**Steps**

1. **Create RDS PostgreSQL Database**
   - Engine: PostgreSQL 15
   - Instance: db.t3.micro (development) or larger
   - Storage: 20GB (auto-scale)
   - Enable automated backups (7-35 days)
   - Multi-AZ for high availability

2. **Initialize RDS Database**
   ```bash
   # From local machine or EC2 instance with psql installed
   psql -h scalperblock-db.xxx.rds.amazonaws.com \
        -U scalperblock \
        -d scalperblock_db \
        -f database/scalperblock_schema.sql
   ```

3. **Create EC2 Instance(s)**
   - AMI: Ubuntu 22.04 LTS
   - Instance Type: t3.medium (development) or t3.large (production)
   - Security Group: Allow 3000 (API), 22 (SSH)
   - IAM Role: S3, CloudWatch, RDS access

4. **Deploy Application to EC2**
   ```bash
   # SSH into instance
   ssh -i key.pem ubuntu@instance-ip

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Clone repository
   git clone <repo-url>
   cd 06-cw-game-water-quest-final

   # Install dependencies
   npm ci --only=production

   # Configure environment
   cat > .env << EOF
   PORT=3000
   NODE_ENV=production
   DB_HOST=scalperblock-db.xxx.rds.amazonaws.com
   DB_PORT=5432
   DB_USER=scalperblock
   DB_PASSWORD=<strong-password>
   DB_NAME=scalperblock_db
   API_SECRET=<strong-secret>
   SB_ADMIN_EMAIL=admin@company.com
   EOF

   # Start application with PM2
   sudo npm install -g pm2
   pm2 start server.js --name "scalperblock-api"
   pm2 startup
   pm2 save
   ```

5. **Configure Application Load Balancer**
   - Target Group: EC2 instances (port 3000)
   - Health Check: `/api/health` (30s interval)
   - Listener: 80/443 → Target Group 3000

6. **Enable HTTPS**
   - Certificate: AWS Certificate Manager (free)
   - Listener: 443 (HTTPS) → Target Group 3000

7. **Monitor & Scale**
   - CloudWatch: Monitor CPU, memory, API latency
   - Auto Scaling Group: Scale based on CPU > 70%
   - CloudWatch Alarms: Alert on error rate > 5%

---

### Option 3b: Heroku Deployment

**Best for**: Quick MVP, low maintenance, free tier available

1. **Install Heroku CLI**
   ```bash
   curl https://cli-assets.heroku.com/install.sh | sh
   heroku login
   ```

2. **Create Heroku App**
   ```bash
   heroku create scalperblock-api
   ```

3. **Add PostgreSQL Add-on**
   ```bash
   heroku addons:create heroku-postgresql:standard-0
   ```

4. **Configure Environment Variables**
   ```bash
   heroku config:set \
     NODE_ENV=production \
     API_SECRET=<strong-secret> \
     SB_ADMIN_EMAIL=admin@company.com
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

6. **Initialize Database**
   ```bash
   heroku pg:psql < database/scalperblock_schema.sql
   ```

7. **Monitor**
   ```bash
   heroku logs --tail
   heroku metrics
   ```

---

### Option 3c: Google Cloud Run (Serverless)

**Best for**: Auto-scaling, pay-per-use, minimal ops

1. **Build Container Image**
   ```bash
   gcloud builds submit --tag gcr.io/PROJECT_ID/scalperblock
   ```

2. **Create Cloud SQL PostgreSQL Instance**
   ```bash
   gcloud sql instances create scalperblock-db \
     --database-version=POSTGRES_15 \
     --tier=db-f1-micro
   ```

3. **Initialize Database**
   ```bash
   gcloud sql connect scalperblock-db
   # Then run schema SQL
   ```

4. **Deploy to Cloud Run**
   ```bash
   gcloud run deploy scalperblock-api \
     --image gcr.io/PROJECT_ID/scalperblock \
     --platform managed \
     --region us-central1 \
     --set-env-vars=DB_HOST=<CLOUD_SQL_IP>,DB_USER=scalperblock,...
   ```

5. **Configure Cloud SQL Proxy**
   - For secure connection to Cloud SQL

---

### Option 3d: Kubernetes (EKS, GKE, AKS)

**Best for**: Enterprise, high availability, complex requirements

1. **Create Kubernetes Cluster**
   ```bash
   # AWS EKS
   eksctl create cluster --name scalperblock

   # GKE
   gcloud container clusters create scalperblock
   ```

2. **Create Docker Image**
   ```bash
   docker build -t scalperblock-api .
   docker tag scalperblock-api gcr.io/PROJECT_ID/scalperblock-api
   docker push gcr.io/PROJECT_ID/scalperblock-api
   ```

3. **Deploy PostgreSQL (Optional: Use managed service instead)**
   ```bash
   kubectl apply -f kubernetes/postgres-deployment.yaml
   ```

4. **Deploy Application**
   ```bash
   kubectl apply -f kubernetes/api-deployment.yaml
   kubectl apply -f kubernetes/api-service.yaml
   ```

5. **Enable Auto-Scaling**
   ```bash
   kubectl autoscale deployment scalperblock-api --min=2 --max=10
   ```

---

## 4. Database Backup & Recovery

### Automated Backups

**AWS RDS**
```bash
# Enable automated backups (7-35 days retention)
aws rds modify-db-instance \
  --db-instance-identifier scalperblock-db \
  --backup-retention-period 30 \
  --apply-immediately
```

**Heroku PostgreSQL**
```bash
# Automatic backups enabled (included)
heroku pg:backups
heroku pg:backups:capture
heroku pg:backups:restore <backup-id>
```

### Manual Backups

**PostgreSQL Dump**
```bash
# Create backup
pg_dump -h localhost -U scalperblock -d scalperblock_db > backup.sql

# Restore backup
psql -h localhost -U scalperblock -d scalperblock_db < backup.sql
```

---

## 5. Monitoring & Alerts

### Key Metrics to Monitor

1. **API Performance**
   - Response time (target: < 100ms)
   - Error rate (target: < 1%)
   - Throughput (requests/second)

2. **Database**
   - Connection pool usage
   - Query execution time
   - Storage usage

3. **Infrastructure**
   - CPU usage
   - Memory usage
   - Disk I/O

### Monitoring Tools

**AWS CloudWatch**
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name high-api-latency \
  --alarm-description "Alert if API latency > 500ms" \
  --metric-name ResponseTime \
  --namespace ScalperBlock \
  --statistic Average \
  --period 300 \
  --threshold 500 \
  --comparison-operator GreaterThanThreshold
```

**Heroku Metrics**
```bash
heroku metrics
heroku ps
```

**Google Cloud Monitoring**
```bash
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

---

## 6. Scaling Strategy

### Vertical Scaling (Larger Instance)
- Increase machine resources (CPU, RAM)
- Good for single-instance deployments
- Limited by hardware ceiling

### Horizontal Scaling (Multiple Instances)
- Deploy multiple API instances behind load balancer
- Use auto-scaling groups
- Add caching layer (Redis) for velocity tracking

### Database Scaling
- Read replicas for read-heavy workloads
- Sharding for multi-tenant separation
- Connection pooling (pgBouncer)

**Example: Auto-scaling on AWS**
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name scalperblock-asg \
  --launch-template LaunchTemplateName=scalperblock \
  --min-size 2 --max-size 10 --desired-capacity 2 \
  --load-balancer-names scalperblock-alb
```

---

## 7. Security Checklist

- [ ] Use HTTPS/TLS for all communication
- [ ] Enable database encryption at rest
- [ ] Set strong API keys and secrets
- [ ] Enable VPC isolation (private subnets for DB)
- [ ] Configure security groups (whitelist IPs)
- [ ] Enable API rate limiting
- [ ] Implement WAF (Web Application Firewall)
- [ ] Set up DDoS protection
- [ ] Enable audit logging
- [ ] Regular security patching
- [ ] Implement secrets rotation (every 90 days)

---

## 8. Troubleshooting Deployment

### "Cannot connect to database"
```bash
# Check connection string
echo $DB_HOST $DB_PORT $DB_USER

# Test connectivity
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"
```

### "API responding slowly"
```bash
# Check database slow queries
SELECT * FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

# Add indexes if needed (see schema)
```

### "Out of memory"
```bash
# Check Node.js memory usage
node --max-old-space-size=4096 server.js

# Or increase container memory (docker-compose.yml)
```

---

## 9. Deployment Checklist

Before deploying to production:

- [ ] All environment variables configured
- [ ] Database schema initialized
- [ ] Automated backups enabled
- [ ] HTTPS/TLS certificate installed
- [ ] Monitoring and alerting configured
- [ ] Security groups configured correctly
- [ ] API keys and secrets in secure vault
- [ ] Load balancer health checks passing
- [ ] Auto-scaling configured
- [ ] Disaster recovery plan documented
- [ ] Team trained on runbooks

---

## Quick Reference Commands

```bash
# Local development
npm install && npm start

# Docker development
docker-compose up --build

# Heroku
heroku create && heroku addons:create heroku-postgresql
git push heroku main

# AWS
aws ecs run-task --cluster scalperblock --task-definition scalperblock-api

# Kubernetes
kubectl apply -f kubernetes/

# Database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
SELECT * FROM transactions LIMIT 10;
```

---

**Last Updated**: December 6, 2025  
**Version**: 1.0.0
