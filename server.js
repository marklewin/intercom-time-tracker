const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static('public'));

// Configuration
const INTERCOM_SECRET = process.env.INTERCOM_SECRET || 'your_intercom_secret_here';
const APP_ID = process.env.INTERCOM_APP_ID || 'your_app_id_here';

// In-memory storage (replace with database in production)
const timers = new Map(); // Key: `${admin_id}_${conversation_id}`, Value: timer data
const sessions = new Map(); // Key: session_id, Value: session data
const conversationHistory = new Map(); // Key: `${admin_id}_${conversation_id}`, Value: array of sessions

// Utility functions
function generateSessionId() {
  return crypto.randomUUID();
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function verifyIntercomSignature(payload, signature) {
  if (!signature) return false;
  
  const expectedSignature = 'sha1=' + crypto
    .createHmac('sha1', INTERCOM_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Test endpoint to simulate what Intercom should send
app.get('/test-initialize', (req, res) => {
  const mockRequest = {
    context: {
      location: "conversation",
      conversation_id: "test_conv_123"
    },
    current_admin: {
      id: "test_admin_456",
      name: "Test Admin"
    }
  };
  
  // Simulate the initialize request
  req.body = mockRequest;
  
  // Call the same logic as initialize
  const { context, current_admin } = req.body;
  
  
  if (!context || context.location !== 'conversation') {
    console.log('Context check failed:', { context });
    return res.json({
      canvas: {
        content: {
          components: [
            {
              type: "text",
              text: "Please open a conversation to track time.",
              style: "muted"
            },
            {
              type: "text",
              text: `Debug: location=${context?.location || 'null'}, context=${JSON.stringify(context)}`,
              style: "muted"
            }
          ]
        }
      }
    });
  }

  const conversationId = context.conversation_id;
  const adminId = current_admin?.id;
  
  console.log('Extracted data:', { conversationId, adminId });
  
  if (!conversationId || !adminId) {
    console.log('ID extraction failed:', { conversationId, adminId, current_admin });
    return res.json({
      canvas: {
        content: {
          components: [
            {
              type: "text",
              text: "Unable to identify conversation or admin.",
              style: "error"
            },
            {
              type: "text",
              text: `Debug: convId=${conversationId}, adminId=${adminId}`,
              style: "muted"
            }
          ]
        }
      }
    });
  }

  // Continue with the rest of the initialize logic...
  // Start or resume timer
  const timerKey = `${adminId}_${conversationId}`;
  let timer = timers.get(timerKey);
  
  if (!timer) {
    // Create new timer
    const sessionId = generateSessionId();
    timer = {
      admin_id: adminId,
      conversation_id: conversationId,
      session_id: sessionId,
      start_time: Date.now(),
      total_elapsed: 0,
      status: 'running',
      last_update: Date.now()
    };
    
    timers.set(timerKey, timer);
    sessions.set(sessionId, timer);
    console.log('Created new timer:', timer);
  } else if (timer.status === 'paused') {
    // Resume timer
    timer.status = 'running';
    timer.last_update = Date.now();
    console.log('Resumed timer:', timer);
  }

  // Get conversation history
  const historyKey = `${adminId}_${conversationId}`;
  const history = conversationHistory.get(historyKey) || [];
  const recentSessions = history.slice(-5);

  // Calculate current elapsed time
  const currentElapsed = timer.total_elapsed + (timer.status === 'running' ? Date.now() - timer.last_update : 0);

  // Build Canvas response
  const canvas = {
    content: {
      components: [
        {
          type: "text",
          text: "⏱️ Time Tracker",
          style: "header"
        },
        {
          type: "divider"
        },
        {
          type: "text",
          text: `Status: ${timer.status.toUpperCase()}`,
          style: timer.status === 'running' ? 'success' : timer.status === 'paused' ? 'warning' : 'muted'
        },
        {
          type: "text",
          text: `Current Session: ${formatDuration(currentElapsed)}`,
          style: "paragraph"
        },
        {
          type: "text",
          text: `Admin: ${adminId} | Conv: ${conversationId}`,
          style: "muted"
        },
        {
          type: "spacer",
          size: "m"
        }
      ]
    }
  };

  // Add history if available
  if (recentSessions.length > 0) {
    canvas.content.components.push(
      {
        type: "text",
        text: "Recent Sessions:",
        style: "header"
      }
    );

    recentSessions.forEach((session, index) => {
      canvas.content.components.push({
        type: "text",
        text: `${index + 1}. ${formatDuration(session.final_duration || 0)} - ${new Date(session.start_time).toLocaleDateString()}`,
        style: "muted"
      });
    });
  }

  console.log('Sending canvas response:', JSON.stringify(canvas, null, 2));
  res.json({ canvas });
});

// Canvas Kit Initialize Endpoint
app.post('/initialize', (req, res) => {
  // Add detailed logging to debug the issue
  console.log('=== Initialize Request Debug ===');
  console.log('Full request body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('================================');
  
  const { context, current_admin } = req.body;
});

// Webhook endpoint for conversation updates
app.post('/webhooks/conversations', (req, res) => {
  const signature = req.headers['x-hub-signature'];
  const payload = JSON.stringify(req.body);

  // Verify signature
  if (!verifyIntercomSignature(payload, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { type, data } = req.body;

  if (type === 'conversation.admin.closed') {
    const conversationId = data.item.id;
    
    // Find and stop all timers for this conversation
    for (const [timerKey, timer] of timers.entries()) {
      if (timer.conversation_id === conversationId) {
        stopTimer(timer);
      }
    }
  }

  res.status(200).json({ received: true });
});

// API endpoints for timer management
app.post('/api/timer/pause', (req, res) => {
  const { admin_id, conversation_id } = req.body;
  const timerKey = `${admin_id}_${conversation_id}`;
  const timer = timers.get(timerKey);

  if (timer && timer.status === 'running') {
    timer.total_elapsed += Date.now() - timer.last_update;
    timer.status = 'paused';
    timer.last_update = Date.now();
  }

  res.json({ success: true });
});

app.post('/api/timer/resume', (req, res) => {
  const { admin_id, conversation_id } = req.body;
  const timerKey = `${admin_id}_${conversation_id}`;
  const timer = timers.get(timerKey);

  if (timer && timer.status === 'paused') {
    timer.status = 'running';
    timer.last_update = Date.now();
  }

  res.json({ success: true });
});

// Analytics endpoint
app.get('/api/analytics/:admin_id', (req, res) => {
  const adminId = req.params.admin_id;
  const adminSessions = [];

  // Collect all sessions for this admin
  for (const [key, sessionsList] of conversationHistory.entries()) {
    if (key.startsWith(`${adminId}_`)) {
      adminSessions.push(...sessionsList);
    }
  }

  if (adminSessions.length === 0) {
    return res.json({
      total_sessions: 0,
      total_time: 0,
      average_time: 0,
      median_time: 0
    });
  }

  const durations = adminSessions
    .filter(s => s.final_duration)
    .map(s => s.final_duration)
    .sort((a, b) => a - b);

  const totalTime = durations.reduce((sum, d) => sum + d, 0);
  const averageTime = totalTime / durations.length;
  const medianTime = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;

  res.json({
    total_sessions: durations.length,
    total_time: totalTime,
    average_time: averageTime,
    median_time: medianTime,
    formatted: {
      total_time: formatDuration(totalTime),
      average_time: formatDuration(averageTime),
      median_time: formatDuration(medianTime)
    }
  });
});

// Helper function to stop timer
function stopTimer(timer) {
  if (timer.status === 'running') {
    timer.total_elapsed += Date.now() - timer.last_update;
  }
  
  timer.status = 'stopped';
  timer.final_duration = timer.total_elapsed;
  timer.end_time = Date.now();

  // Store in history
  const historyKey = `${timer.admin_id}_${timer.conversation_id}`;
  const history = conversationHistory.get(historyKey) || [];
  history.push({ ...timer });
  conversationHistory.set(historyKey, history);

  // Remove from active timers
  const timerKey = `${timer.admin_id}_${timer.conversation_id}`;
  timers.delete(timerKey);
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    active_timers: timers.size,
    total_sessions: sessions.size
  });
});

// Dashboard route (simple HTML interface)
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Time Tracker Dashboard</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .timer { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
            .running { border-color: #4CAF50; background-color: #f0f8f0; }
            .paused { border-color: #ff9800; background-color: #fff8e1; }
            .stopped { border-color: #9e9e9e; background-color: #f5f5f5; }
        </style>
    </head>
    <body>
        <h1>Time Tracker Dashboard</h1>
        <p>Active Timers: ${timers.size}</p>
        <p>Total Sessions: ${sessions.size}</p>
        
        <h2>Active Timers</h2>
        ${Array.from(timers.entries()).map(([key, timer]) => {
          const currentElapsed = timer.total_elapsed + (timer.status === 'running' ? Date.now() - timer.last_update : 0);
          return `
            <div class="timer ${timer.status}">
              <strong>Admin ID:</strong> ${timer.admin_id}<br>
              <strong>Conversation ID:</strong> ${timer.conversation_id}<br>
              <strong>Status:</strong> ${timer.status}<br>
              <strong>Elapsed:</strong> ${formatDuration(currentElapsed)}<br>
              <strong>Started:</strong> ${new Date(timer.start_time).toLocaleString()}
            </div>
          `;
        }).join('')}
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Time Tracker server running on port ${PORT}`);
  console.log(`Dashboard available at: http://localhost:${PORT}/dashboard`);
  console.log(`Canvas Kit endpoint: http://localhost:${PORT}/initialize`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhooks/conversations`);
});

module.exports = app;