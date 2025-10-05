CREATE TABLE conversation_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
  phone VARCHAR(20),
  state VARCHAR(50) DEFAULT 'active',
  conversation_state VARCHAR(50) DEFAULT 'initial',
  context JSONB DEFAULT '{}',
  messages JSONB DEFAULT '[]',
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversation_sessions_user_id ON conversation_sessions(user_id);
CREATE INDEX idx_conversation_sessions_phone ON conversation_sessions(phone);
CREATE INDEX idx_conversation_sessions_state ON conversation_sessions(state);
CREATE INDEX idx_conversation_sessions_last_activity ON conversation_sessions(last_activity);
