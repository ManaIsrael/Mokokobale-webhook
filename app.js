import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const port = process.env.PORT || 3000;
const verifyToken = process.env.VERIFY_TOKEN;
const whatsappToken = process.env.WHATSAPP_TOKEN;
const phoneNumberId = process.env.PHONE_NUMBER_ID;

// In-memory session storage
const sessions = {};

// Webhook Verification
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const challenge = req.query["hub.challenge"];
  const token = req.query["hub.verify_token"];

  if (mode === "subscribe" && token === verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Send WhatsApp Message
async function sendMessage(to, message) {
  await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: message },
      }),
    }
  );
}

// Webhook Listener
app.post("/webhook", async (req, res) => {
  try {
    const message =
      req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const from = message.from;
    const text = message.text?.body?.toLowerCase();

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

    // Step 2: Service Selection
    else if (userSession.step === "service") {
      if (text === "1") {
        userSession.service = "Massage";
        userSession.step = "time";
      } else if (text === "2") {
        userSession.service = "Therapy";
        userSession.step = "time";
      } else {
        return sendMessage(from, "Please reply with 1 or 2.");
      }

      await sendMessage(
        from,
        "Choose a time:\n1️⃣ Tomorrow 10AM\n2️⃣ Tomorrow 2PM"
      );
    }

    // Step 3: Time Selection
    else if (userSession.step === "time") {
      if (text === "1") {
        userSession.time = "Tomorrow 10AM";
      } else if (text === "2") {
        userSession.time = "Tomorrow 2PM";
      } else {
        return sendMessage(from, "Please reply with 1 or 2.");
      }

      userSession.step = "confirm";

      await sendMessage(
        from,
        `Confirm booking:\nService: ${userSession.service}\nTime: ${userSession.time}\nReply YES to confirm`
      );
    }

    // Step 4: Confirmation
    else if (userSession.step === "confirm") {
      if (text === "yes") {
        await sendMessage(
          from,
          "✅ Booking confirmed! We look forward to seeing you."
        );
        delete sessions[from];
      } else {
        await sendMessage(from, "Booking cancelled.");
        delete sessions[from];
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
