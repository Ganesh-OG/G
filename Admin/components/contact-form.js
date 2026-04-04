import { SUPABASE_CONFIG } from "./config.js";

const API = `${SUPABASE_CONFIG.url}/rest/v1/response`;

document.getElementById("contactForm").addEventListener("submit", async function(event) {

    event.preventDefault();

    const fullname = event.target.fullname.value;
    const email = event.target.email.value;
    const number = event.target.number.value;
    const subject = event.target.subject.value;
    const message = event.target.message.value;

    const payload = {
        name: fullname,
        email: email,
        phone: number,
        subject: subject,
        message: message
    };

    try {

        const res = await fetch(API, {
            method: "POST",
            headers: {
                apikey: SUPABASE_CONFIG.key,
                Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
                "Content-Type": "application/json",
                Prefer: "return=minimal"
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error("Insert failed");
        }

        alert("Message sent successfully!");
        event.target.reset();

    } catch (err) {

        console.error("Insert error:", err);
        alert("Failed to send message");

    }

});