-- Database Schema for Hosted PostgreSQL (e.g. Neon.tech, Supabase, Render PostgreSQL Free Tier)
-- Run this script in your hosted database query console if configuring DATABASE_URL

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(32) UNIQUE NOT NULL,
    display_name VARCHAR(64) NOT NULL,
    password_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_call_records (
    id VARCHAR(64) PRIMARY KEY,
    caller VARCHAR(32) NOT NULL,
    callee VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_caller ON app_call_records(caller);
CREATE INDEX IF NOT EXISTS idx_call_callee ON app_call_records(callee);

CREATE TABLE IF NOT EXISTS telephony_calls (
    id VARCHAR(64) PRIMARY KEY,
    call_id VARCHAR(64) NOT NULL,
    target_number VARCHAR(32) NOT NULL,
    country_code VARCHAR(8) NOT NULL,
    provider_name VARCHAR(64) NOT NULL,
    is_simulated BOOLEAN DEFAULT TRUE,
    state VARCHAR(24) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0,
    end_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telephony_favorites (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    phone_number VARCHAR(32) NOT NULL,
    country_code VARCHAR(8) NOT NULL,
    dial_code VARCHAR(8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
