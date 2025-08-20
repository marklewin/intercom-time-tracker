// Client-side timer management for Intercom Time Tracker
// This script handles browser events and communicates with the server

class IntercomTimeTracker {
  constructor(serverUrl) {
    this.serverUrl = serverUrl;
    this.currentTimer = null;
    this.isVisible = true;
    this.heartbeatInterval = null;

    this.initializeEventListeners();
    this.startHeartbeat();
  }

  initializeEventListeners() {
    // Handle visibility changes (tab switching, minimizing)
    document.addEventListener('visibilitychange', () => {
      this.isVisible = !document.hidden;
      // Note: We don't pause on visibility change per requirement #3
      console.log('Visibility changed:', this.isVisible ? 'visible' : 'hidden');
    });

    // Handle page unload (closing tab/window)
    window.addEventListener('beforeunload', () => {
      this.pauseAllTimers();
    });

    // Handle page unload for mobile/app scenarios
    window.addEventListener('pagehide', () => {
      this.pauseAllTimers();
    });

    // Handle conversation switches (if we can detect them)
    this.observeConversationChanges();
  }

  // Start a heartbeat to keep server in sync and detect state changes
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.currentTimer) {
        this.sendHeartbeat();
      }
    }, 30000); // Every 30 seconds
  }

  async sendHeartbeat() {
    if (!this.currentTimer) return;

    try {
      await fetch(`${this.serverUrl}/api/timer/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: this.currentTimer.admin_id,
          conversation_id: this.currentTimer.conversation_id,
          timestamp: Date.now(),
          visible: this.isVisible
        })
      });
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  }

  async startTimer(adminId, conversationId) {
    // Pause current timer if switching conversations
    if (this.currentTimer && 
        (this.currentTimer.admin_id !== adminId || 
         this.currentTimer.conversation_id !== conversationId)) {
      await this.pauseTimer(this.currentTimer.admin_id, this.currentTimer.conversation_id);
    }

    this.currentTimer = {
      admin_id: adminId,
      conversation_id: conversationId,
      start_time: Date.now()
    };

    try {
      const response = await fetch(`${this.serverUrl}/api/timer/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: adminId,
          conversation_id: conversationId
        })
      });

      const result = await response.json();
      console.log('Timer started:', result);
      return result;
    } catch (error) {
      console.error('Failed to start timer:', error);
      return null;
    }
  }

  async pauseTimer(adminId, conversationId) {
    try {
      const response = await fetch(`${this.serverUrl}/api/timer/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: adminId,
          conversation_id: conversationId
        })
      });

      const result = await response.json();
      console.log('Timer paused:', result);
      return result;
    } catch (error) {
      console.error('Failed to pause timer:', error);
      return null;
    }
  }

  async resumeTimer(adminId, conversationId) {
    try {
      const response = await fetch(`${this.serverUrl}/api/timer/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_id: adminId,
          conversation_id: conversationId
        })
      });

      const result = await response.json();
      console.log('Timer resumed:', result);
      return result;
    } catch (error) {
      console.error('Failed to resume timer:', error);
      return null;
    }
  }

  async pauseAllTimers() {
    if (this.currentTimer) {
      await this.pauseTimer(this.currentTimer.admin_id, this.currentTimer.conversation_id);
      this.currentTimer = null;
    }
  }

  // Observe conversation changes in Intercom interface
  observeConversationChanges() {
    // This is a simplified approach - in practice, you'd need to hook into
    // Intercom's navigation events or observe URL changes

    let lastUrl = window.location.href;

    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('URL changed from', lastUrl, 'to', currentUrl);
        this.handleNavigationChange(currentUrl);
        lastUrl = currentUrl;
      }
    }, 1000);
  }

  handleNavigationChange(newUrl) {
    // Extract conversation ID from URL if possible
    const conversationMatch = newUrl.match(/conversations\/(\d+)/);

    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      console.log('Switched to conversation:', conversationId);

      // This would need admin ID - in practice, you'd get this from Intercom's context
      // For now, we'll use a placeholder
      const adminId = 'current_admin_id'; // Replace with actual admin ID

      this.startTimer(adminId, conversationId);
    } else {
      // Not viewing a specific conversation
      this.pauseAllTimers();
    }
  }

  // Clean up resources
  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.pauseAllTimers();
  }
}

// Initialize the tracker when the script loads
let timeTracker = null;

// Function to initialize the tracker (call this from your Canvas Kit app)
function initializeTimeTracker(serverUrl = '/') {
  if (timeTracker) {
    timeTracker.destroy();
  }

  timeTracker = new IntercomTimeTracker(serverUrl);

  // Expose to global scope for Canvas Kit integration
  window.intercomTimeTracker = timeTracker;

  return timeTracker;
}

// Auto-initialize if we're in the right context
if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeTimeTracker();
    });
  } else {
    initializeTimeTracker();
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IntercomTimeTracker, initializeTimeTracker };
}