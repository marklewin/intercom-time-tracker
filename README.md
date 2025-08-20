# Intercom Time Tracker App

A proof of concept time tracking app for Intercom that monitors how long admins spend viewing conversations assigned to them, similar to Zendesk's Time Tracker.

## Features

- **Active Time Tracking**: Tracks time spent viewing assigned conversations
- **Smart Pause/Resume**: Pauses when switching conversations, resumes when returning
- **Browser Event Handling**: Pauses on tab close, continues when backgrounded
- **Canvas Kit Integration**: Shows live timer status in Intercom sidebar
- **Webhook Integration**: Automatically stops timers when conversations are closed
- **Analytics Dashboard**: View session statistics and active timers
- **Secure Webhooks**: HMAC SHA-1 signature verification

## Architecture

- **Backend**: Node.js + Express server hosted on Replit
- **Frontend**: Canvas Kit JSON responses for Intercom sidebar
- **Storage**: In-memory storage (easily upgradeable to database)
- **Security**: HMAC signature verification for webhooks

## Setup Instructions

### 1. Replit Setup

1. Go to [Replit](https://replit.com) and create a new account if needed
2. Click "Create Repl" and choose "Node.js"
3. Name your repl "intercom-time-tracker"
4. Delete the default files and create these files:

**File Structure:**
```
/
├── server.js          (main server file)
├── package.json       (dependencies)
├── .replit           (replit config)
└── public/
    ├── index.html    (dashboard)
    └── timer.js      (client script)
```

5. Copy the code from each artifact into the corresponding files
6. Click "Run" to start the server

### 2. Environment Variables

In Replit, go to the "Secrets" tab and add:

```
INTERCOM_SECRET=your_webhook_secret_here
INTERCOM_APP_ID=your_app_id_here
```

### 3. Intercom App Setup

1. Go to [Intercom Developer Hub](https://developers.intercom.com)
2. Click "New app" and fill in basic details
3. Choose "Canvas Kit" as the integration type

**App Configuration:**
- **App Type**: Canvas Kit
- **Canvas Location**: Inbox (conversation sidebar)
- **Initialize URL**: `https://your-repl-name.replit.app/initialize`
- **Webhook URL**: `https://your-repl-name.replit.app/webhooks/conversations`

### 4. Webhook Setup

In your Intercom app settings:

1. Go to "Webhooks" section
2. Add webhook endpoint: `https://your-repl-name.replit.app/webhooks/conversations`
3. Subscribe to these events:
   - `conversation.admin.closed`
   - `conversation.admin.assigned`
   - `conversation.admin.unassigned`
4. Set the webhook secret (use the same value as `INTERCOM_SECRET`)

### 5. Canvas Kit Configuration

In the Intercom app settings, configure Canvas Kit:

```json
{
  "initialize_url": "https://your-repl-name.replit.app/initialize",
  "location": "conversation",
  "canvas": {
    "content": {
      "components": []
    }
  }
}
```

### 6. Testing

1. Install the app in your Intercom workspace
2. Open a conversation assigned to you
3. Check the sidebar for the time tracker widget
4. Visit `https://your-repl-name.replit.app/dashboard` to see the admin dashboard

## API Endpoints

### Canvas Kit
- `POST /initialize` - Canvas Kit initialization endpoint

### Timer Management
- `POST /api/timer/pause` - Pause a timer
- `POST /api/timer/resume` - Resume a timer
- `GET /api/analytics/:admin_id` - Get analytics for an admin

### Webhooks
- `POST /webhooks/conversations` - Intercom webhook endpoint

### Monitoring
- `GET /health` - Health check and basic stats
- `GET /dashboard` - Visual dashboard

## Code Explanation

### Server.js (Backend)

The main server handles:

1. **Canvas Kit Integration**: The `/initialize` endpoint receives context from Intercom and returns JSON describing the UI to display
2. **Timer Management**: Tracks active timers using in-memory Map structures
3. **Webhook Processing**: Verifies HMAC signatures and processes conversation events
4. **Analytics**: Calculates session statistics (mean, median, total time)

**Key Components:**
- `timers` Map: Stores active timer states
- `sessions` Map: Stores completed sessions
- `verifyIntercomSignature()`: Validates webhook authenticity
- `formatDuration()`: Converts milliseconds to HH:MM:SS format

### Timer.js (Client-side)

Handles browser events and server communication:

1. **Event Listeners**: Monitors tab visibility, page unload, navigation changes
2. **Heartbeat System**: Keeps server synchronized with client state
3. **Automatic Timer Management**: Starts/stops timers based on conversation navigation

### Canvas Kit JSON Response

The app returns structured JSON that Intercom renders as UI components:

```json
{
  "canvas": {
    "content": {
      "components": [
        {
          "type": "text",
          "text": "⏱️ Time Tracker",
          "style": "header"
        },
        {
          "type": "text", 
          "text": "Status: RUNNING",
          "style": "success"
        }
      ]
    }
  }
}
```

## Timer Logic

### State Machine
- **RUNNING**: Timer actively counting
- **PAUSED**: Timer stopped, can be resumed
- **STOPPED**: Timer permanently stopped (conversation closed)

### Behavior Rules
1. **Conversation Switch**: Pause previous, start new (if assigned)
2. **Tab Backgrounded**: Continue running (per requirements)
3. **Tab Closed**: Pause all timers
4. **Conversation Closed**: Stop timer permanently
5. **Server Restart**: Timers lost (use database for persistence)

## Security

- **HMAC Verification**: All webhooks verified with SHA-1 signature
- **Input Validation**: Request parameters validated
- **CORS**: Configured for Intercom domains
- **No OAuth**: Uses workspace-only installation (can add OAuth later)

## Deployment Notes

### Replit Advantages
- Zero setup hosting
- Automatic SSL certificates
- Built-in environment variable management
- Always-on hosting (with paid plan)

### Production Considerations
- Replace in-memory storage with database (PostgreSQL, MongoDB)
- Add Redis for session management
- Implement proper logging (Winston, etc.)
- Add rate limiting
- Add admin authentication
- Use environment-specific configurations

## Troubleshooting

### Common Issues

1. **Webhook signature fails**
   - Check `INTERCOM_SECRET` matches webhook secret
   - Verify webhook URL is accessible

2. **Timer not showing in Intercom**
   - Check Canvas Kit initialize URL
   - Verify app is installed in workspace
   - Check browser console for errors

3. **Timers not persisting**
   - This is expected with in-memory storage
   - Server restarts clear all data
   - Upgrade to database for persistence

### Debug Endpoints
- `GET /health` - Check server status
- `GET /dashboard` - Visual debugging interface
- Browser console - Client-side errors

## Next Steps

For production deployment:

1. **Database Integration**: Replace Maps with PostgreSQL/MongoDB
2. **User Authentication**: Add proper admin authentication
3. **OAuth Flow**: Implement full OAuth for multi-workspace support  
4. **Advanced Analytics**: Add more detailed reporting
5. **Real-time Updates**: WebSocket integration for live updates
6. **Mobile Support**: Optimize for Intercom mobile app
7. **Error Handling**: Comprehensive error handling and logging
8. **Testing**: Unit and integration tests
9. **Monitoring**: Application performance monitoring
10. **Documentation**: API documentation with OpenAPI/Swagger

## Support

For questions or issues:
1. Check the Replit console logs
2. Test endpoints directly with curl/Postman
3. Verify Intercom app configuration
4. Check webhook delivery logs in Intercom Developer Hub