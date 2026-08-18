// SOYBREACH administrator list.
// Add usernames here to control their displayed admin name/color.
// Actual permissions are enforced by Supabase RLS/security functions.
window.SOYBREACH_ADMINS = {
  "Groot3": { color: "#7b2cff", role: "admin" }
};

window.soybreachAdmin = function(username){
  if (!username) return null;
  return window.SOYBREACH_ADMINS[username] || null;
};
