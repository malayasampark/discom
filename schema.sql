-- =============================================================================
-- UTILITY CUSTOMER INFORMATION SYSTEM (CIS) - ENHANCED SCHEMA
-- =============================================================================

-- Create schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS cis;

-- =============================================================================
-- OTP MANAGEMENT TABLE
-- =============================================================================

-- OTP verification table (standalone, no user linkage)
CREATE TABLE IF NOT EXISTS otp_verifications (
    id SERIAL PRIMARY KEY,
    consumer_number VARCHAR(50) NOT NULL, -- Link to CIS consumer
    user_identifier VARCHAR(255) NOT NULL, -- email or mobile
    otp_code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- CIS CORE TABLES
-- =============================================================================

-- Consumer master table
CREATE TABLE IF NOT EXISTS cis.consumers (
    consumer_number VARCHAR(50) PRIMARY KEY,  -- Consumer Number (CIS/CRM ID)
    consumer_name VARCHAR(150) NOT NULL,      -- Consumer Name
    consumer_type VARCHAR(50) NOT NULL,       -- Consumer Type (Residential/Commercial/Industrial)
    
    -- Contact Information
    mobile_no VARCHAR(15) NOT NULL,           -- Primary Mobile No (Required)
    alternative_mobile VARCHAR(15),           -- Alternative Mobile
    email_address VARCHAR(255),               -- Email Address (Optional)
    
    -- Address Information
    address_line1 VARCHAR(250),               -- Address Line 1
    address_line2 VARCHAR(250),               -- Address Line 2 (Optional)
    city VARCHAR(50),                         -- City
    state VARCHAR(50),                        -- State
    pincode VARCHAR(10),                      -- Pincode (Extended for international)
    landmark VARCHAR(250),                    -- Landmark
    
    -- Administrative Information
    circle VARCHAR(50) NOT NULL,              -- Circle (Required)
    division VARCHAR(50) NOT NULL,            -- Division (Required)
    sub_division VARCHAR(50) NOT NULL,        -- Sub Division (Required)
    section VARCHAR(50),                      -- Section (Optional)
    
    -- Status and Audit
    status VARCHAR(25) NOT NULL DEFAULT 'active', -- active, disconnected, suspended
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by VARCHAR(50),
    modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_consumer_status CHECK (status IN ('active', 'disconnected', 'suspended')),
    CONSTRAINT chk_consumer_type CHECK (consumer_type IN ('residential', 'commercial', 'industrial', 'agricultural'))
);

-- Smart meters table
CREATE TABLE IF NOT EXISTS cis.smart_meters (
    meter_number VARCHAR(50) PRIMARY KEY,
    meter_type VARCHAR(50) NOT NULL,          -- Single/Three phase, Prepaid/Postpaid
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    installation_date DATE,
    last_reading_date TIMESTAMP,
    communication_protocol VARCHAR(50),       -- GSM/RF/PLC/etc
    firmware_version VARCHAR(50),
    meter_status VARCHAR(25) DEFAULT 'active', -- active, faulty, replaced
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by VARCHAR(50),
    modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_meter_status CHECK (meter_status IN ('active', 'faulty', 'replaced', 'maintenance')),
    CONSTRAINT chk_meter_type CHECK (meter_type IN ('single_phase', 'three_phase', 'prepaid', 'postpaid'))
);

-- Consumer accounts table (linking consumers to meters)
CREATE TABLE IF NOT EXISTS cis.consumer_accounts (
    account_id VARCHAR(50) PRIMARY KEY,
    consumer_number VARCHAR(50) NOT NULL,
    account_status VARCHAR(25) NOT NULL DEFAULT 'active',
    connection_type VARCHAR(25) NOT NULL,      -- permanent, temporary
    connection_status VARCHAR(25) NOT NULL,    -- connected, disconnected
    meter_number VARCHAR(50) NOT NULL,
    installation_number VARCHAR(20),
    sanctioned_load DECIMAL(10,2),            -- Sanctioned load in KW
    tariff_category VARCHAR(50),              -- Tariff category
    billing_cycle VARCHAR(20),               -- monthly, bi-monthly
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_by VARCHAR(50),
    modified_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (consumer_number) REFERENCES cis.consumers(consumer_number) ON DELETE CASCADE,
    FOREIGN KEY (meter_number) REFERENCES cis.smart_meters(meter_number) ON DELETE RESTRICT,
    
    -- Constraints
    CONSTRAINT chk_account_status CHECK (account_status IN ('active', 'inactive', 'suspended')),
    CONSTRAINT chk_connection_type CHECK (connection_type IN ('permanent', 'temporary')),
    CONSTRAINT chk_connection_status CHECK (connection_status IN ('connected', 'disconnected'))
);

-- =============================================================================
-- ADDITIONAL CIS TABLES
-- =============================================================================

-- Meter readings table
CREATE TABLE IF NOT EXISTS cis.meter_readings (
    reading_id SERIAL PRIMARY KEY,
    meter_number VARCHAR(50) NOT NULL,
    reading_date TIMESTAMP NOT NULL,
    reading_type VARCHAR(20) NOT NULL, -- manual, automatic, estimated
    kwh_reading DECIMAL(12,2),
    kvah_reading DECIMAL(12,2),
    voltage_r DECIMAL(8,2),
    voltage_y DECIMAL(8,2),
    voltage_b DECIMAL(8,2),
    current_r DECIMAL(8,2),
    current_y DECIMAL(8,2),
    current_b DECIMAL(8,2),
    power_factor DECIMAL(4,2),
    frequency DECIMAL(4,2),
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (meter_number) REFERENCES cis.smart_meters(meter_number),
    CONSTRAINT chk_reading_type CHECK (reading_type IN ('manual', 'automatic', 'estimated'))
);

-- Bills table
CREATE TABLE IF NOT EXISTS cis.bills (
    bill_id SERIAL PRIMARY KEY,
    account_id VARCHAR(50) NOT NULL,
    bill_number VARCHAR(50) UNIQUE NOT NULL,
    bill_date DATE NOT NULL,
    due_date DATE NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    units_consumed DECIMAL(10,2),
    bill_amount DECIMAL(12,2),
    bill_status VARCHAR(20) DEFAULT 'pending',
    payment_date DATE,
    created_by VARCHAR(50),
    created_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (account_id) REFERENCES cis.consumer_accounts(account_id),
    CONSTRAINT chk_bill_status CHECK (bill_status IN ('pending', 'paid', 'overdue', 'cancelled'))
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- OTP verification indexes
CREATE INDEX IF NOT EXISTS idx_otp_consumer ON otp_verifications(consumer_number);
CREATE INDEX IF NOT EXISTS idx_otp_user_identifier ON otp_verifications(user_identifier);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);

-- CIS indexes
CREATE INDEX IF NOT EXISTS idx_consumers_mobile ON cis.consumers(mobile_no);
CREATE INDEX IF NOT EXISTS idx_consumers_email ON cis.consumers(email_address);
CREATE INDEX IF NOT EXISTS idx_consumers_status ON cis.consumers(status);
CREATE INDEX IF NOT EXISTS idx_consumers_division ON cis.consumers(division);
CREATE INDEX IF NOT EXISTS idx_meters_status ON cis.smart_meters(meter_status);
CREATE INDEX IF NOT EXISTS idx_accounts_consumer ON cis.consumer_accounts(consumer_number);
CREATE INDEX IF NOT EXISTS idx_accounts_meter ON cis.consumer_accounts(meter_number);
CREATE INDEX IF NOT EXISTS idx_readings_meter ON cis.meter_readings(meter_number);
CREATE INDEX IF NOT EXISTS idx_readings_date ON cis.meter_readings(reading_date);
CREATE INDEX IF NOT EXISTS idx_bills_account ON cis.bills(account_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON cis.bills(bill_status);

-- =============================================================================
-- FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update modified_on timestamp
CREATE OR REPLACE FUNCTION update_modified_on_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modified_on = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for CIS tables
CREATE TRIGGER update_consumers_modified_on 
    BEFORE UPDATE ON cis.consumers 
    FOR EACH ROW EXECUTE FUNCTION update_modified_on_column();

CREATE TRIGGER update_meters_modified_on 
    BEFORE UPDATE ON cis.smart_meters 
    FOR EACH ROW EXECUTE FUNCTION update_modified_on_column();

CREATE TRIGGER update_accounts_modified_on 
    BEFORE UPDATE ON cis.consumer_accounts 
    FOR EACH ROW EXECUTE FUNCTION update_modified_on_column();

-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Link OTP verifications to consumers
ALTER TABLE otp_verifications 
ADD CONSTRAINT fk_otp_consumer 
FOREIGN KEY (consumer_number) REFERENCES cis.consumers(consumer_number) ON DELETE CASCADE;

-- =============================================================================
-- SAMPLE DATA INSERT (Optional - for testing)
-- =============================================================================

-- Insert sample consumer types
INSERT INTO cis.consumers (consumer_number, consumer_name, consumer_type, mobile_no, email_address, 
                          address_line1, city, state, pincode, circle, division, sub_division, 
                          status, created_by) 
VALUES 
('CONS001', 'John Doe', 'residential', '9876543210', 'john@example.com', 
 '123 Main Street', 'Mumbai', 'Maharashtra', '400001', 'Western', 'Mumbai Central', 'Bandra', 
 'active', 'admin'),
('CONS002', 'ABC Industries', 'commercial', '9876543211', 'contact@abc.com', 
 '456 Business Park', 'Delhi', 'Delhi', '110001', 'Northern', 'Delhi North', 'Connaught Place', 
 'active', 'admin')
ON CONFLICT (consumer_number) DO NOTHING;

-- Insert sample meters
INSERT INTO cis.smart_meters (meter_number, meter_type, manufacturer, model, 
                             installation_date, communication_protocol, firmware_version, created_by)
VALUES 
('MTR001', 'single_phase', 'Schneider Electric', 'EM6400', '2024-01-15', 'GSM', '1.2.3', 'admin'),
('MTR002', 'three_phase', 'Landis+Gyr', 'E650', '2024-01-20', 'RF', '2.1.0', 'admin')
ON CONFLICT (meter_number) DO NOTHING;

-- Insert sample accounts
INSERT INTO cis.consumer_accounts (account_id, consumer_number, account_status, connection_type, 
                                  connection_status, meter_number, sanctioned_load, tariff_category, 
                                  billing_cycle, created_by)
VALUES 
('ACC001', 'CONS001', 'active', 'permanent', 'connected', 'MTR001', 5.00, 'Residential', 'monthly', 'admin'),
('ACC002', 'CONS002', 'active', 'permanent', 'connected', 'MTR002', 100.00, 'Commercial', 'monthly', 'admin')
ON CONFLICT (account_id) DO NOTHING;
