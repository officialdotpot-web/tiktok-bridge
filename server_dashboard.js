import express from "express";
import { TikTokLiveConnection, WebcastEvent } from "tiktok-live-connector";

const app = express();
app.use(express.json());

// Use PORT from Render environment, default to 3000
const PORT = process.env.PORT || 3000; 
// Use TIKTOK_USERNAME from Render environment
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "your_username_here"; 

let eventCounter = 0;
const eventLog = [];
let tiktokConnection = null;
let isConnected = false;

function logEvent(type, user, detail = "", amount = 1) {
    eventCounter++;
    eventLog.push({
        id: eventCounter,
        type: type,
        user: user,
        comment: detail,
        giftName: detail,
        message: detail,
        amount: amount,
        diamondCount: amount,
        likeCount: amount
    });
    if (eventLog.length > 500) eventLog.shift();
}

app.post("/api/connect", (req, res) => {
    const username = req.body?.username;
    console.log(`[Roblox] Connect request received for @${username}`);
    res.json({ success: true, message: "Connected" });
});

app.get("/api/events", (req, res) => {
    const since = Number(req.query.since || 0);
    const newEvents = eventLog.filter(ev => ev.id > since);
    const lastId = newEvents.length > 0 ? newEvents[newEvents.length - 1].id : since;
    
    res.json({
        success: true,
        events: newEvents,
        cursor: lastId
    });
});

async function startTikTok(username) {
    if (isConnected) return;
    console.log(`[TikTok] Connecting to @${username}...`);
    
    tiktokConnection = new TikTokLiveConnection(username, {
        processInitialData: false,
        fetchRoomInfoOnConnect: true
    });

    tiktokConnection.on(WebcastEvent.CHAT, data => {
        const user = data?.user?.uniqueId || data?.user?.displayId || "Unknown";
        const comment = data?.comment || data?.text || "";
        console.log(`[TikTok] Comment: @${user}: ${comment}`);
        logEvent("comment", user, comment, 1);
    });

    tiktokConnection.on(WebcastEvent.GIFT, data => {
        const user = data?.user?.uniqueId || data?.user?.displayId || "Unknown";
        const giftName = data?.gift?.name || data?.giftName || "Unknown Gift";
        const diamonds = (data?.gift?.diamondCount || data?.diamondCount || 0) * (data?.repeatCount || 1);
        console.log(`[TikTok] Gift: @${user} sent ${giftName} (${diamonds} diamonds)`);
        logEvent("gift", user, giftName, diamonds);
    });

    tiktokConnection.on(WebcastEvent.LIKE, data => {
        const user = data?.user?.uniqueId || data?.user?.displayId || "Unknown";
        logEvent("like", user, "liked the stream", data?.likeCount || 1);
    });

    tiktokConnection.on(WebcastEvent.JOIN, data => {
        const user = data?.user?.uniqueId || data?.user?.displayId || "Unknown";
        logEvent("join", user, "joined the stream", 1);
    });

    try {
        await tiktokConnection.connect();
        isConnected = true;
        console.log(`[TikTok] Successfully connected to @${username}!`);
    } catch (error) {
        console.error(`[TikTok] Connection failed:`, error.message);
    }
}

// START SERVER - MUST BE 0.0.0.0 FOR RENDER
app.listen(PORT, "0.0.0.0", () => {
    console.log("========================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`Connecting to @${TIKTOK_USERNAME}...`);
    console.log("========================================");
    // Auto-connect on startup using the environment variable
    startTikTok(TIKTOK_USERNAME);
});