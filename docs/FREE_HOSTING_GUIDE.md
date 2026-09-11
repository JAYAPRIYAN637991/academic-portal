# How to Host This Project 100% Free (No Credit Card Required)

Yes! You can host this entire project **completely for free** without paying anything or entering a credit card.

We use two top-tier, trusted free cloud platforms:
1. **Neon.tech**: Free cloud **PostgreSQL Database** (Free forever, 0.5 GB storage, instant setup).
2. **Render.com**: Free **Cloud Web Service** (Hosts both React frontend and Node.js backend together with free SSL `https://`).

---

## Complete Step-by-Step Free Hosting Guide

### STEP 1: Upload Your Code to GitHub (Free)
1. Go to [github.com](https://github.com) and log in (or create a free account).
2. Click **New Repository**, name it `academic-portal`, choose **Public** or **Private**, and click **Create repository**.
3. In your local terminal, initialize git and push your project:
   ```bash
   cd "C:\Users\VSB CSE LAB\.gemini\antigravity-ide\scratch\academic-portal"
   git init
   git add .
   git commit -m "Initial commit of complete academic portal"
   git branch -M main
   git remote add origin https://github.com/<your-github-username>/academic-portal.git
   git push -u origin main
   ```

---

### STEP 2: Create a Free Cloud Database on Neon.tech (Takes 1 Minute)
1. Go to [https://neon.tech](https://neon.tech) and click **Sign Up** (You can sign in with your GitHub account with 1 click).
2. Click **Create Project**:
   - Project Name: `academic-portal`
   - Postgres Version: `16` (Default)
   - Region: Select the closest region to you (e.g. `Singapore` or `Frankfurt`).
3. Neon will instantly display your **Connection Details**:
   - Select the **Prisma** or **Direct connection** tab.
   - Copy the connection string:
     ```text
     postgresql://neondb_owner:npg_xyz...@ep-cool-cloud.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
     ```
   *(Keep this string handy; this is your `DATABASE_URL`)*.

---

### STEP 3: Deploy the App for Free on Render.com
1. Go to [https://render.com](https://render.com) and sign up with your **GitHub account**.
2. On your Render dashboard, click **New +** and select **Web Service**.
3. Choose **Build and deploy from a Git repository**, and select your `academic-portal` repository.
4. Fill in the settings:
   - **Name**: `vsb-academic-portal` (or any name you like).
   - **Region**: Same or close to your database (e.g., `Singapore` or `Frankfurt`).
   - **Branch**: `main`
   - **Root Directory**: *(Leave blank)*
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm run build
     ```
   - **Start Command**:
     ```bash
     npm run start
     ```
   - **Instance Type**: Select **Free** ($0 / month).

5. Scroll down to **Environment Variables** and click **Add Environment Variable**:
   | Key | Value |
   | :--- | :--- |
   | `DATABASE_URL` | *<Paste the Neon connection string from Step 2>* |
   | `JWT_SECRET` | `vsb-college-super-secret-jwt-key-2026-production` |
   | `NODE_ENV` | `production` |
   | `MOCK_NOTIFICATIONS` | `true` |

6. Click **Create Web Service** at the bottom!

---

### STEP 4: Run Initial Database Migration & Seeds (Automatic or via Shell)
Render will automatically start building the React frontend and Node.js backend.
Once the build completes, populate the initial college data (departments, subjects, admin account):

1. On your Render dashboard for `vsb-academic-portal`, click the **Shell** tab on the left menu.
2. In the terminal window, run:
   ```bash
   cd server
   npx prisma migrate deploy
   npm run prisma:seed
   ```
This sets up all initial database tables, default admin account, departments, and subjects in your free cloud database.

---

### 🎉 YOUR PORTAL IS NOW LIVE FOR FREE!

Render will provide you with a permanent, secure live URL:
👉 **`https://vsb-academic-portal.onrender.com`**

* It works on all devices: laptops, tablets, and mobile phones.
* It comes with a **free SSL certificate** (`https://`).
* Both **Admin Login** and **Staff Login** work smoothly from this single link!

---

### Summary of Free Services Used:
* **GitHub**: Free code hosting & version control.
* **Neon.tech**: Free permanent cloud PostgreSQL database (0.5 GB free forever).
* **Render.com**: Free web hosting with 750 free hours every month and free SSL.
* **Total Cost**: **$0.00 (100% Free)**.
