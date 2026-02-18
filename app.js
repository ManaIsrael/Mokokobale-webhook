async function handleIncomingMessage(body) {
  try {
    const message =
      body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message) return;

    const from = message.from;
    const text = message.text?.body?.toLowerCase();

    if (!sessions[from]) {
      sessions[from] = { step: "start" };
    }

    const userSession = sessions[from];

    if (userSession.step === "start") {
      userSession.step = "service";
      await sendMessage(
        from,
        "Welcome! Please choose a service:\n1️⃣ Massage\n2️⃣ Therapy"
      );
    }

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
