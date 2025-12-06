-- ============================================================================
-- ScalperBlock: PostgreSQL Database Schema
-- Supports all four components: API Interface, Risk Scoring Engine, 
-- Management & Monitoring, and User/Merchant Management
-- ============================================================================

-- Drop existing schema if needed (development only)
-- DROP SCHEMA IF EXISTS scalperblock CASCADE;
-- CREATE SCHEMA scalperblock;

-- ============================================================================
-- COMPONENT 1: USER & MERCHANT MANAGEMENT
-- ============================================================================

/**
 * Users table: Stores merchant/customer accounts
 * Supports FR-5 (Secure Access with authentication)
 */
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_verified BOOLEAN DEFAULT FALSE,
    api_key VARCHAR(255) UNIQUE,  -- FR-5: Secure API access
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster email lookup
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);

/**
 * Merchants table: Extended merchant profile information
 * Tracks merchant metadata for dashboard and reporting
 */
CREATE TABLE merchants (
    merchant_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    company_name VARCHAR(255),
    industry VARCHAR(100),
    mcc_code VARCHAR(10),  -- Merchant Category Code
    api_quota_monthly INTEGER DEFAULT 100000,
    api_calls_used_month INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- ============================================================================
-- COMPONENT 2: CORE API & TRANSACTION DATA
-- ============================================================================

/**
 * Transactions table: Stores all incoming transaction requests (FR-1, FR-2)
 * Every API call is logged here for auditing and analysis
 */
CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    merchant_id INTEGER NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    session_id VARCHAR(255),
    product_id VARCHAR(255),
    timestamp BIGINT NOT NULL,
    checkout_speed_ms BIGINT,
    risk_score INTEGER,  -- Calculated by the engine
    recommended_action VARCHAR(20),  -- ALLOW, CHALLENGE, BLOCK
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

-- Indexes for fast lookups and aggregation
CREATE INDEX idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX idx_transactions_ip_address ON transactions(ip_address);
CREATE INDEX idx_transactions_session_id ON transactions(session_id);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX idx_transactions_risk_score ON transactions(risk_score);

-- ============================================================================
-- COMPONENT 3: RISK SCORING ENGINE DATA
-- ============================================================================

/**
 * Risk Breakdown table: Detailed scoring component breakdown (FR-4)
 * Stores individual scores for transparency and debugging
 */
CREATE TABLE risk_breakdowns (
    breakdown_id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL UNIQUE,
    ip_score INTEGER DEFAULT 0,            -- FR-7: IP reputation
    velocity_score INTEGER DEFAULT 0,      -- FR-8: Request rate
    fingerprint_score INTEGER DEFAULT 0,   -- FR-9: Browser fingerprinting
    behavior_score INTEGER DEFAULT 0,      -- FR-10: Checkout speed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE
);

/**
 * IP Reputation Cache table: Caches IP reputation lookups
 * Reduces external API calls for frequently seen IPs
 */
CREATE TABLE ip_reputation_cache (
    ip_id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    is_botnet BOOLEAN DEFAULT FALSE,
    is_datacenter BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    is_vpn BOOLEAN DEFAULT FALSE,
    risk_level VARCHAR(50),  -- LOW, MEDIUM, HIGH, CRITICAL
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (is_botnet OR is_datacenter OR is_proxy OR is_vpn OR risk_level IS NOT NULL)
);

CREATE INDEX idx_ip_reputation_cache_ip ON ip_reputation_cache(ip_address);

/**
 * Velocity Tracking table: Tracks request rates (FR-8)
 * Rolling window tracking for abuse detection
 */
CREATE TABLE velocity_tracking (
    velocity_id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL,  -- session_id or ip_address
    request_count INTEGER DEFAULT 0,
    time_window_seconds INTEGER DEFAULT 60,
    first_request_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_request_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(key, time_window_seconds)
);

CREATE INDEX idx_velocity_tracking_key ON velocity_tracking(key);

/**
 * Device Fingerprints table: Stores known device profiles (FR-9)
 * Detects headless browsers and bot signatures
 */
CREATE TABLE device_fingerprints (
    fingerprint_id SERIAL PRIMARY KEY,
    user_agent_hash VARCHAR(255) UNIQUE,
    is_headless BOOLEAN DEFAULT FALSE,
    is_automation_tool BOOLEAN DEFAULT FALSE,  -- Selenium, Puppeteer, etc.
    browser_type VARCHAR(100),
    device_type VARCHAR(100),  -- Desktop, Mobile, Bot
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    occurrence_count INTEGER DEFAULT 1
);

CREATE INDEX idx_device_fingerprints_hash ON device_fingerprints(user_agent_hash);

-- ============================================================================
-- COMPONENT 4: MANAGEMENT & MONITORING
-- ============================================================================

/**
 * Rule Configurations table: Stores weight and threshold settings (FR-14)
 * Allows dynamic rule updates without code redeployment
 */
CREATE TABLE rule_configurations (
    rule_config_id SERIAL PRIMARY KEY,
    merchant_id INTEGER,  -- NULL = global config
    config_name VARCHAR(255) NOT NULL,
    ip_score_weight FLOAT DEFAULT 0.8,
    velocity_score_weight FLOAT DEFAULT 0.5,
    fingerprint_score_weight FLOAT DEFAULT 0.2,
    behavior_score_weight FLOAT DEFAULT 0.9,
    allow_threshold INTEGER DEFAULT 50,   -- Score < 50 = ALLOW
    challenge_threshold INTEGER DEFAULT 80,  -- 50-79 = CHALLENGE, 80+ = BLOCK
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX idx_rule_configurations_merchant_id ON rule_configurations(merchant_id);
CREATE INDEX idx_rule_configurations_active ON rule_configurations(is_active);

/**
 * Feedback Records table: Merchant feedback on false positives/negatives (FR-15)
 * Used to improve the ML model over time
 */
CREATE TABLE feedback_records (
    feedback_id SERIAL PRIMARY KEY,
    transaction_id INTEGER NOT NULL,
    merchant_id INTEGER NOT NULL,
    is_false_positive BOOLEAN DEFAULT FALSE,  -- System blocked legitimate user
    is_false_negative BOOLEAN DEFAULT FALSE,  -- System allowed fraudulent user
    feedback_description TEXT,
    actual_outcome VARCHAR(50),  -- What actually happened (FRAUD, LEGITIMATE, UNKNOWN)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_records_transaction_id ON feedback_records(transaction_id);
CREATE INDEX idx_feedback_records_merchant_id ON feedback_records(merchant_id);
CREATE INDEX idx_feedback_records_is_false_positive ON feedback_records(is_false_positive);
CREATE INDEX idx_feedback_records_is_false_negative ON feedback_records(is_false_negative);

/**
 * API Access Logs table: Audit trail for all API calls (FR-13)
 * Critical for compliance, monitoring, and debugging
 */
CREATE TABLE api_access_logs (
    log_id SERIAL PRIMARY KEY,
    merchant_id INTEGER NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    http_method VARCHAR(10),
    request_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER,
    http_status_code INTEGER,
    ip_address VARCHAR(45),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX idx_api_access_logs_merchant_id ON api_access_logs(merchant_id);
CREATE INDEX idx_api_access_logs_request_timestamp ON api_access_logs(request_timestamp);
CREATE INDEX idx_api_access_logs_http_status_code ON api_access_logs(http_status_code);

/**
 * Service Health Metrics table: Monitor API performance (FR-16)
 * Tracks latency, error rates, and volume for alerting
 */
CREATE TABLE service_health_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,  -- api_latency_avg, error_rate, request_volume, etc.
    metric_value FLOAT NOT NULL,
    measurement_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50)  -- OK, WARNING, CRITICAL
);

CREATE INDEX idx_service_health_metrics_metric_name ON service_health_metrics(metric_name);
CREATE INDEX idx_service_health_metrics_measurement_time ON service_health_metrics(measurement_time);

/**
 * Alerts table: Service alerts for operational monitoring (FR-16)
 * Tracks degradation events and incidents
 */
CREATE TABLE alerts (
    alert_id SERIAL PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL,  -- HIGH_LATENCY, HIGH_ERROR_RATE, QUOTA_EXCEEDED, etc.
    merchant_id INTEGER,
    severity VARCHAR(50),  -- INFO, WARNING, CRITICAL
    message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_merchant_id ON alerts(merchant_id);
CREATE INDEX idx_alerts_alert_type ON alerts(alert_type);
CREATE INDEX idx_alerts_severity ON alerts(severity);

-- ============================================================================
-- VIEWS FOR REPORTING & ANALYSIS
-- ============================================================================

/**
 * Risk Score Distribution View
 * Shows aggregate risk score statistics by merchant
 */
CREATE VIEW risk_score_distribution AS
SELECT
    m.merchant_id,
    m.company_name,
    COUNT(t.transaction_id) as total_transactions,
    AVG(t.risk_score) as avg_risk_score,
    MIN(t.risk_score) as min_risk_score,
    MAX(t.risk_score) as max_risk_score,
    COUNT(CASE WHEN t.risk_score >= 80 THEN 1 END) as blocked_count,
    COUNT(CASE WHEN t.risk_score >= 50 AND t.risk_score < 80 THEN 1 END) as challenged_count,
    COUNT(CASE WHEN t.risk_score < 50 THEN 1 END) as allowed_count
FROM merchants m
LEFT JOIN transactions t ON m.merchant_id = t.merchant_id
GROUP BY m.merchant_id, m.company_name;

/**
 * False Positive/Negative Tracking View
 * Helps identify model improvement opportunities
 */
CREATE VIEW feedback_analysis AS
SELECT
    m.merchant_id,
    m.company_name,
    COUNT(f.feedback_id) as total_feedback,
    COUNT(CASE WHEN f.is_false_positive THEN 1 END) as false_positive_count,
    COUNT(CASE WHEN f.is_false_negative THEN 1 END) as false_negative_count,
    ROUND(100.0 * COUNT(CASE WHEN f.is_false_positive THEN 1 END) / NULLIF(COUNT(f.feedback_id), 0), 2) as false_positive_rate
FROM merchants m
LEFT JOIN feedback_records f ON m.merchant_id = f.merchant_id
GROUP BY m.merchant_id, m.company_name;

/**
 * API Performance View
 * Tracks API response times and error rates per merchant
 */
CREATE VIEW api_performance AS
SELECT
    m.merchant_id,
    m.company_name,
    COUNT(l.log_id) as total_requests,
    AVG(l.response_time_ms) as avg_response_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY l.response_time_ms) as p95_response_time_ms,
    COUNT(CASE WHEN l.http_status_code >= 400 THEN 1 END) as error_count,
    ROUND(100.0 * COUNT(CASE WHEN l.http_status_code >= 400 THEN 1 END) / NULLIF(COUNT(l.log_id), 0), 2) as error_rate_percent
FROM merchants m
LEFT JOIN api_access_logs l ON m.merchant_id = l.merchant_id
GROUP BY m.merchant_id, m.company_name;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

/**
 * Function: update_updated_at_timestamp
 * Automatically updates the updated_at field on record modification
 */
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to users
CREATE TRIGGER trigger_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_timestamp();

-- Apply timestamp trigger to rule_configurations
CREATE TRIGGER trigger_update_rule_configurations_timestamp
BEFORE UPDATE ON rule_configurations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

INSERT INTO users (email, password_hash, full_name, api_key) VALUES
('admin@scalperblock.io', 'hashed_password_123', 'Admin User', 'sk-admin-demo-key-12345'),
('merchant1@example.com', 'hashed_password_456', 'John Merchant', 'sk-merchant-1-demo-key'),
('merchant2@example.com', 'hashed_password_789', 'Jane Retailer', 'sk-merchant-2-demo-key');

INSERT INTO merchants (user_id, company_name, industry, mcc_code) VALUES
(2, 'TechStore Inc.', 'Electronics', '5045'),
(3, 'Ticketing Masters', 'Entertainment', '7922');

INSERT INTO rule_configurations (merchant_id, config_name, is_active) VALUES
(NULL, 'Global Default Config', TRUE),
(1, 'TechStore Custom Config', TRUE),
(2, 'TicketMasters Custom Config', TRUE);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
