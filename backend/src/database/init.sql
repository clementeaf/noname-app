CREATE TABLE users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rut VARCHAR(12) UNIQUE NOT NULL,
  phone VARCHAR(20),
  pin_hash VARCHAR(255),
  consent_granted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_providers (
  provider_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_accounts (
  account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES service_providers(provider_id) ON DELETE CASCADE,
  contract_number VARCHAR(100),
  meter_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bills (
  bill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES user_accounts(account_id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL,
  amount_clp DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL,
  amount_clp DECIMAL(12,2) NOT NULL,
  amount_crypto DECIMAL(18,8),
  exchange_rate DECIMAL(18,8),
  fee DECIMAL(12,2),
  total DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  tx_id VARCHAR(255),
  receipt_url TEXT,
  expires_at TIMESTAMP,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  params JSONB,
  result JSONB,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_rut ON users(rut);
CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_bills_account_id ON bills(account_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_audit_log_request_id ON audit_log(request_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

INSERT INTO users (rut, phone, pin_hash, consent_granted) VALUES
('12345678-9', '+56912345678', '$2a$10$placeholder', true),
('98765432-1', '+56998765432', '$2a$10$placeholder', true);

INSERT INTO service_providers (name, service_type) VALUES
('Enel', 'Electricidad'),
('Aguas Andinas', 'Agua'),
('Metrogas', 'Gas');

INSERT INTO user_accounts (user_id, provider_id, contract_number, meter_id, status)
SELECT
  u.user_id,
  sp.provider_id,
  'CONT-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 8),
  'MET-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 10),
  'active'
FROM users u
CROSS JOIN service_providers sp
WHERE u.rut = '12345678-9';

INSERT INTO user_accounts (user_id, provider_id, contract_number, meter_id, status)
SELECT
  u.user_id,
  sp.provider_id,
  'CONT-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 8),
  'MET-' || SUBSTR(MD5(RANDOM()::TEXT), 1, 10),
  'active'
FROM users u
CROSS JOIN service_providers sp
WHERE u.rut = '98765432-1' AND sp.service_type IN ('Electricidad', 'Agua');

INSERT INTO bills (account_id, period, amount_clp, due_date, status)
SELECT
  account_id,
  TO_CHAR(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM'),
  (RANDOM() * 50000 + 20000)::DECIMAL(12,2),
  CURRENT_DATE + INTERVAL '15 days',
  'pending'
FROM user_accounts;

INSERT INTO bills (account_id, period, amount_clp, due_date, status)
SELECT
  account_id,
  TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM'),
  (RANDOM() * 50000 + 20000)::DECIMAL(12,2),
  CURRENT_DATE - INTERVAL '15 days',
  'pending'
FROM user_accounts
WHERE RANDOM() < 0.5;
