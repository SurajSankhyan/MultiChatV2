# Supabase Token Swap Bridge Backend

This is a stateless, secure backend bridge designed to run on Render. It facilitates Single Sign-On (SSO) or cross-database authenticated queries between two distinct Supabase projects.

## How it works (Token Swap Method)

1. **User logs in** to your web application using **Supabase Project 1 (Auth Project)**.
2. The frontend client retrieves the active session's access token (JWT 1).
3. The frontend makes a POST request to this **Token Swap Bridge** sending JWT 1 in the `Authorization` header.
4. The Token Swap Bridge:
   - Verifies the signature of JWT 1 using `PROJECT_1_JWT_SECRET`.
   - Copies the user details, UUID (`sub`), email, and roles.
   - Signs a new token (JWT 2) using `PROJECT_2_JWT_SECRET` (the JWT secret of your database project).
5. The frontend client receives JWT 2 and uses it to authenticate queries directly to **Supabase Project 2 (Data Project)**.
6. Supabase Project 2's Row-Level Security (RLS) policies (e.g., `auth.uid() = user_id`) will automatically and securely verify the UUID inside JWT 2.

## Local Setup

### 1. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the secrets:
```bash
cp .env.example .env
```
- **PROJECT_1_JWT_SECRET**: Find this in the Supabase Dashboard for Project 1 under **Settings > API > JWT Settings > JWT Secret**.
- **PROJECT_2_JWT_SECRET**: Find this in the Supabase Dashboard for Project 2 under **Settings > API > JWT Settings > JWT Secret**.

### 3. Run the Server
For development (with automatic reload on file changes):
```bash
npm run dev
```

For production:
```bash
npm start
```
The server will start on port `4000` (or the port defined by the `PORT` environment variable).

---

## Deploying to Render

To deploy this subfolder to Render as a Web Service:

1. Push your repository to GitHub.
2. Log in to the [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
3. Connect your GitHub repository.
4. Configure the Web Service settings:
   - **Name**: `supabase-token-swap-bridge`
   - **Root Directory**: `BACKEND Bridge` *(Important: This ensures Render builds from this subdirectory)*
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Instance Type**: `Free`
5. Click **Advanced** and add the following Environment Variables:
   - `PROJECT_1_JWT_SECRET`: (Your Supabase Project 1 JWT Secret)
   - `PROJECT_2_JWT_SECRET`: (Your Supabase Project 2 JWT Secret)
6. Click **Create Web Service**.

---

## Frontend Integration Example (Next.js / Vanilla JS)

Here is how you swap the tokens on the frontend and initialize the Supabase client for Project 2:

```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize Project 1 (Auth Database) using standard URL and Anon Key
const supabaseAuth = createClient(
  'https://project-1-url.supabase.co',
  'PROJECT_1_ANON_KEY'
);

// Initialize Project 2 (Data Database) using standard URL and Anon Key
const supabaseData = createClient(
  'https://project-2-url.supabase.co',
  'PROJECT_2_ANON_KEY'
);

async function loginAndSwap() {
  // 1. Perform login in Project 1
  const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
    email: 'user@example.com',
    password: 'securepassword'
  });

  if (authError) throw authError;

  const session = authData.session;
  const project1Token = session.access_token;

  // 2. Call the Render Token Swap Bridge
  const bridgeUrl = 'https://supabase-token-swap-bridge.onrender.com';
  const response = await fetch(`${bridgeUrl}/api/swap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${project1Token}`
    }
  });

  if (!response.ok) {
    throw new Error('Token swap failed');
  }

  const { access_token: project2Token } = await response.json();

  // 3. Set the swapped token in Project 2's client session
  // This configures the client to send JWT 2 in all headers automatically
  const { error: sessionError } = await supabaseData.auth.setSession({
    access_token: project2Token,
    refresh_token: '' // Stateless JWTs don't use refresh tokens here
  });

  if (sessionError) throw sessionError;

  // 4. Query Project 2 directly! RLS policies will verify the token.
  const { data, error } = await supabaseData
    .from('user_projects')
    .select('*');

  console.log('User projects from Project 2:', data);
}
```

### Automatic Token Refresh (Optional but Recommended)
JWTs typically expire in 1 hour. You can set up a background interval or hook into your routing system:
```javascript
// Run every 45 minutes to get a fresh Project 2 token
setInterval(async () => {
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (session) {
    const response = await fetch(`${bridgeUrl}/api/swap`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      }
    });
    if (response.ok) {
      const { access_token } = await response.json();
      await supabaseData.auth.setSession({
        access_token,
        refresh_token: ''
      });
    }
  }
}, 45 * 60 * 1000);
```
