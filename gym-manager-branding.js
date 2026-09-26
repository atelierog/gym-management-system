/* Shared bootstrap hook. Load Owner Portal QA/health modules before the main React bundle. */
import("./src/owner-portal-audit.js").catch(()=>{});
import("./src/super-admin-health-bridge.js").catch(()=>{});
import("./src/owner-account-creation-hardening.js").catch(()=>{});
import("./src/owner-portal-finalizer.js").catch(()=>{});
