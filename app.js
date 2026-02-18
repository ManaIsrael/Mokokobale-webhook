import express from "express";

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const waToken = process.env.WA_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

// Debug check (remove later if you want)
console.log("VERIFY_TOKEN:", verifyToken ? "Loaded" : "Missing");
console.log("WA_TOKEN:", waToken ? "Loaded" : "Missing");
console.log("PHONE_NUMBER_ID:", phoneNumberId ? "Loaded" : "Missing");

// In-memory session storage
const sessions = {};

// =============================
// Webhook Verification (GET)
// =============================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =============================
// Send WhatsApp Message
// =============================
async function sendMessage(to, message) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${waToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: message },
        }),
      }
    );

    const data = await response.json();
    console.log("WhatsApp response:", data);
  } catch (error) {
    console.error("Send message error:", error);
  }
}

// =============================
// Handle Incoming Messages
// =============================
async function handleIncomingMessage(body) {
  try {
    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return;

    const from = message.from;
    const text = message.text?.body?.toLowerCase() || "";

    if (!sessions[from]) {
      sessions[from] = { step: "start" };
    }

    const userSession = sessions[from];

    // Step 1: Welcome
    if (userSession.step === "start") {
      userSession.step = "service";

      await sendMessage(
        from,
        "Welcome! Please choose a service:\n1️⃣ Massage\n2️⃣ Therapy"
      );
    }

    // Step 2: Service
    else if (userSession.step === "service") {
      if (text === "1") {
        userSession.service = "Massage";
        userSession.step = "time";
      } else if (text === "2") {
        userSession.service = "Therapy";
        userSession.step = "time";
      } else {
        return await sendMessage(from, "Please reply with 1 or 2.");
      }

      await sendMessage(
        from,
        "Choose a time:\n1️⃣ Tomorrow 10AM\n2️⃣ Tomorrow 2PM"
      );
    }

    // Step 3: Time
    else if (userSession.step === "time") {
      if (text === "1") {
        userSession.time = "Tomorrow 10AM";
      } else if (text === "2") {
        userSession.time = "Tomorrow 2PM";
      } else {
        return await sendMessage(from, "Please reply with 1 or 2.");
      }

      userSession.step = "confirm";

      await sendMessage(
        from,
        `Confirm booking:\nService: ${userSession.service}\nTime: ${userSession.time}\nReply YES to confirm`
      );
    }

    // Step 4: Confirm
    else if (userSession.step === "confirm") {
      if (text === "yes") {
        await sendMessage(
          from,
          "✅ Booking confirmed! We look forward to seeing you."
        );
      } else {
        await sendMessage(from, "Booking cancelled.");
      }

      delete sessions[from];
    }
  } catch (error) {
    console.error("Processing error:", error);
  }
}

// =============================
// Webhook Listener (POST)
// =============================
app.post("/webhook", (req, res) => {
  // Respond immediately to avoid timeout
  res.sendStatus(200);

  // Process message asynchronously
  handleIncomingMessage(req.body);
});

// =============================
// Start Server
// =============================
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
