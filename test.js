// Test script to verify the Time Tracker API endpoints
const axios = require("axios");

const BASE_URL = "https://intercom-time-tracker.onrender.com"; // Change to your Replit URL when deployed

async function runTests() {
  console.log("🧪 Testing Intercom Time Tracker API");
  console.log("=====================================\n");

  try {
    // Test 1: Health Check
    console.log("1. Testing health endpoint...");
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Health check passed:", healthResponse.data);
    console.log();

    // Test 2: Canvas Kit Initialize (mock request)
    console.log("2. Testing Canvas Kit initialize endpoint...");
    const initializePayload = {
      context: {
        location: "conversation",
        conversation_id: "test_conv_123",
      },
      current_admin: {
        id: "test_admin_456",
        name: "Test Admin",
      },
    };

    const initResponse = await axios.post(
      `${BASE_URL}/initialize`,
      initializePayload,
    );
    console.log("✅ Initialize endpoint passed");
    console.log(
      "Canvas response:",
      JSON.stringify(
        initResponse.data.canvas.content.components.slice(0, 2),
        null,
        2,
      ),
    );
    console.log();

    // Test 3: Timer Management
    console.log("3. Testing timer pause endpoint...");
    const pauseResponse = await axios.post(`${BASE_URL}/api/timer/pause`, {
      admin_id: "test_admin_456",
      conversation_id: "test_conv_123",
    });
    console.log("✅ Timer pause passed:", pauseResponse.data);
    console.log();

    // Test 4: Timer Resume
    console.log("4. Testing timer resume endpoint...");
    const resumeResponse = await axios.post(`${BASE_URL}/api/timer/resume`, {
      admin_id: "test_admin_456",
      conversation_id: "test_conv_123",
    });
    console.log("✅ Timer resume passed:", resumeResponse.data);
    console.log();

    // Test 5: Analytics
    console.log("5. Testing analytics endpoint...");
    const analyticsResponse = await axios.get(
      `${BASE_URL}/api/analytics/test_admin_456`,
    );
    console.log("✅ Analytics endpoint passed:", analyticsResponse.data);
    console.log();

    // Test 6: Webhook (without signature - will fail security check)
    console.log(
      "6. Testing webhook endpoint (expect 401 due to missing signature)...",
    );
    try {
      const webhookResponse = await axios.post(
        `${BASE_URL}/webhooks/conversations`,
        {
          type: "conversation.admin.closed",
          data: {
            item: {
              id: "test_conv_123",
            },
          },
        },
      );
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log(
          "✅ Webhook security working (401 Unauthorized as expected)",
        );
      } else {
        console.log("❌ Unexpected webhook error:", error.message);
      }
    }
    console.log();

    console.log("🎉 All tests completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Deploy to Replit");
    console.log("2. Configure Intercom app with your Replit URL");
    console.log("3. Set up webhooks in Intercom");
    console.log("4. Test with real Intercom conversations");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }
}

// Helper function to test webhook with proper signature
function createWebhookSignature(payload, secret) {
  const crypto = require("crypto");
  return (
    "sha1=" +
    crypto
      .createHmac("sha1", secret)
      .update(JSON.stringify(payload), "utf8")
      .digest("hex")
  );
}

async function testWebhookWithSignature() {
  console.log("\n7. Testing webhook with valid signature...");

  const payload = {
    type: "conversation.admin.closed",
    data: {
      item: {
        id: "test_conv_123",
      },
    },
  };

  const secret = "bd9b04ed-ece2-4e31-9cdd-0ea7f60d6720"; // Use your actual secret
  const signature = createWebhookSignature(payload, secret);

  try {
    const webhookResponse = await axios.post(
      `${BASE_URL}/webhooks/conversations`,
      payload,
      {
        headers: {
          "X-Hub-Signature": signature,
          "Content-Type": "application/json",
        },
      },
    );
    console.log("✅ Webhook with signature passed:", webhookResponse.data);
  } catch (error) {
    console.log("❌ Webhook test failed:", error.message);
  }
}

// Run the tests
if (require.main === module) {
  runTests().then(() => {
    // Uncomment to test webhook with signature
    // testWebhookWithSignature();
  });
}

module.exports = { runTests, createWebhookSignature };
