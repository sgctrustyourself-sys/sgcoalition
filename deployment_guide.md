# Deployment Guide: Fix User Registration

> [!IMPORTANT]
> **USER ACTION REQUIRED**: This fix requires running a SQL script in your Supabase project.

## 1. Access Supabase Dashboard
Go to your [Supabase Dashboard](https://supabase.com/dashboard/project/_/sql) and open the **SQL Editor**.

## 2. Load the Migration Script
Open the file `fix_user_registration.sql` located in the root of your project.
Copy the **entire content** of the file.

## 3. Run the Script
1. Paste the content into the SQL Editor.
2. Click the **Run** button.

## 4. Verify Results
The script includes a verification step at the end. Check the **Results/Messages** tab in the SQL Editor.
You should see:
- `SUCCESS: User registration fix applied successfully!`
- `Missing profiles: 0` (indicating backfill worked)

## 5. Test Frontend
1. Go to your application's Signup page.
2. Sign up with a new email address.
3. Confirm you are redirected correctly and no "Database error" appears.
