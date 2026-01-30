Act as a Senior Full Stack Developer. I need to implement a "Platform Status Monitor" widget on the Dashboard (Overview/Přehled) page.

**Goal:**
Show the live operational status of critical 3rd party platforms. If a platform goes down, we must alert our users via email.

**Target Platforms & URLs:**

1.  **WordPress:** `https://automatticstatus.com/`
2.  **Shoptet:** `https://www.shoptetstatus.com/`
3.  **Shopify:** `https://shopstatus.shopifyapps.com/`
4.  **Linode:** `https://status.linode.com/`

**Technical Implementation Plan:**

**1. Backend (API Route & Logic):**
Create a new API route (e.g., `POST /api/status/check`) that does the following:

- **Fetch Data:** Query the status pages.
  - _Tip:_ Most status pages (Atlassian Statuspage) expose a JSON endpoint at `/api/v2/status.json` or `/api/v2/summary.json`. Try to use these instead of scraping HTML.
- **Compare State:**
  - We need to store the _last known status_ in the database (create a new Prisma model `PlatformStatus` if needed, or use a simple key-value store).
  - Compare the fetched status with the DB status.
- **Trigger Alerts:**
  - IF the status changes from "Operational" to "Major Outage" (or similar negative change), trigger an email notification function.
  - The email function should fetch all users from the database and send a "Service Alert" warning.
- **Update DB:** Save the new status.

**2. Frontend (Dashboard Widget):**
Create a generic component `StatusWidget` that:

- Displays the 4 platforms in a list or grid.
- Shows a visual indicator (Green dot for "Operational", Red/Orange for issues).
- Shows the text status (e.g., "All Systems Operational").
- Has a **"Aktualizovat status" (Refresh)** button that manually triggers the API check and reloads the data.

**Requirements:**

- Use standard Tailwind CSS for styling (make it look clean and integrated).
- Handle API timeouts gracefully.
- For the email part, write a placeholder function `sendOutageEmail(platformName, newStatus)` that I can connect to my email provider (Resend/SendGrid/Nodemailer) later.

**Output:**
Please generate the code for:

1.  The Prisma schema update (to store last status).
2.  The API Route handler (`route.ts`).
3.  The Frontend Component (`PlatformStatus.tsx`).
