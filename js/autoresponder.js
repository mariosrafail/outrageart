// EmailJS autoresponder (client-side; no env vars)
// Fill these from your EmailJS dashboard:
const EMAILJS_PUBLIC_KEY = "RNQR5CQEG46qKbSbm";
const EMAILJS_SERVICE_ID = "service_xurvbju";
const EMAILJS_TEMPLATE_ID = "template_c3um3cj";

(function initEmailJS(){
  if (window.emailjs && EMAILJS_PUBLIC_KEY) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  } else {
    console.warn("EmailJS SDK not found or key missing.");
  }
})();

// Call this to send the welcome email
window.sendWelcomeEmail = function(email){
  if (!window.emailjs) return Promise.resolve(); // no-op if SDK missing
  // Match the variables your template expects:
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
    to_email: email,
    // subject: "Welcome to daily doodle challenges!",  // optional if set in template
    // message: "Thanks for subscribing! You'll get daily prompts.", // optional
  });
};
