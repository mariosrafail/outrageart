// EmailJS autoresponder (client-side; no env vars)
// Fill these from your EmailJS dashboard:
const EMAILJS_PUBLIC_KEY = "RNQR5CQEG46qKbSbm";
const EMAILJS_SERVICE_ID = "service_xurvbju";
const EMAILJS_TEMPLATE_ID = "template_c3um3cj";

(function initEmailJS(){
  if (window.emailjs && EMAILJS_PUBLIC_KEY) {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }
})();

// Call this after the Netlify form succeeds
window.sendWelcomeEmail = function(email){
  if (!window.emailjs) return Promise.resolve();
  // MUST match the template variable name in "To email": {{to_email}}
  const params = {
    to_email: email,
    site_name: "Outrage Art",
    // add more if your template uses them, e.g. to_name, message, reply_to, etc.
  };
  return emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params)
    .catch(err => { console.warn("EmailJS send failed:", err); });
};