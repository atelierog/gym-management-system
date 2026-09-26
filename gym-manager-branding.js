/* Shared bootstrap hook. Load portal QA/health modules before the main React bundle. */
import("./src/owner-portal-audit.js").catch(()=>{});
import("./src/super-admin-health-bridge.js").catch(()=>{});
