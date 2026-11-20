import { Hono } from "hono";
import { supabase } from "../lib/supabase.js";

const authRoutes = new Hono();

// POST /api/auth/signup — Create user via Supabase Admin API & sign in
authRoutes.post("/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, fullName } = body;

    if (!email || !password || !fullName) {
      return c.json({ success: false, error: "Full Name, Email, and Password are required." }, 400);
    }

    if (password.length < 8) {
      return c.json({ success: false, error: "Password must contain at least 8 characters." }, 400);
    }

    // 1. Create user via admin API to avoid email rate limits
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    });

    if (createError) {
      console.error("[Auth API] Admin createUser error:", createError.message);
      if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
        return c.json({ success: false, error: "An account with this email already exists." }, 409);
      }
      return c.json({ success: false, error: createError.message }, 400);
    }

    const user = createData.user;
    if (!user) {
      return c.json({ success: false, error: "Failed to create user account." }, 500);
    }

    // 2. Create profile row
    const initialsAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=004AC6&color=fff`;
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName,
      email: email,
      avatar_url: initialsAvatar,
      updated_at: new Date().toISOString()
    });

    // 3. Authenticate user session
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError || !signInData.session) {
      return c.json({
        success: true,
        user,
        message: "Account created successfully. Please log in with your credentials."
      }, 201);
    }

    return c.json({
      success: true,
      user,
      session: signInData.session
    }, 201);

  } catch (err: any) {
    console.error("[Auth API] Unexpected signup error:", err);
    return c.json({ success: false, error: err.message || "Unable to process signup request." }, 500);
  }
});

// POST /api/auth/login — Sign in with email & password
authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = body;

    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required." }, 400);
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return c.json({ success: false, error: "Email or password is incorrect." }, 401);
    }

    return c.json({
      success: true,
      user: data.user,
      session: data.session
    }, 200);

  } catch (err: any) {
    console.error("[Auth API] Unexpected login error:", err);
    return c.json({ success: false, error: "Unable to process login request." }, 500);
  }
});

// POST /api/auth/profile — Fetch user profile securely via backend
authRoutes.post("/profile", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, email } = body;

    if (!userId) {
      return c.json({ success: false, error: "User ID is required." }, 400);
    }

    // 1. Fetch profile from DB
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profile && !profileError) {
      return c.json({ success: true, profile }, 200);
    }

    // 2. Fallback to auth admin getUserById
    const { data: userData } = await supabase.auth.admin.getUserById(userId);
    const user = userData?.user;
    const name = user?.user_metadata?.full_name || email?.split('@')[0] || "User";
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=004AC6&color=fff`;

    const fallbackProfile = {
      id: userId,
      full_name: name,
      email: email || user?.email || "",
      avatar_url: avatarUrl,
      created_at: user?.created_at || new Date().toISOString()
    };

    // Upsert into profiles table to persist
    await supabase.from("profiles").upsert(fallbackProfile);

    return c.json({ success: true, profile: fallbackProfile }, 200);

  } catch (err: any) {
    console.error("[Auth API] Get profile error:", err);
    return c.json({ success: false, error: err.message || "Failed to fetch profile." }, 500);
  }
});

// POST /api/auth/update-profile — Update user profile details
authRoutes.post("/update-profile", async (c) => {
  try {
    const body = await c.req.json();
    const { userId, email, full_name, avatar_url } = body;

    if (!userId) {
      return c.json({ success: false, error: "User ID is required." }, 400);
    }

    const updates: any = {
      id: userId,
      updated_at: new Date().toISOString()
    };
    if (email) updates.email = email;
    if (full_name !== undefined) updates.full_name = full_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;

    // 1. Update profiles table
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(updates);

    if (upsertError) {
      console.error("[Auth API] Update profile DB error:", upsertError.message);
    }

    // 2. Update auth user metadata if name changed
    if (full_name) {
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { full_name }
      });
    }

    return c.json({ success: true, profile: updates }, 200);

  } catch (err: any) {
    console.error("[Auth API] Update profile error:", err);
    return c.json({ success: false, error: err.message || "Failed to update profile." }, 500);
  }
});

// POST /api/auth/change-password — Send password reset or update password
authRoutes.post("/change-password", async (c) => {
  try {
    const body = await c.req.json();
    const { email, userId, newPassword } = body;

    if (userId && newPassword) {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });
      if (error) {
        return c.json({ success: false, error: error.message }, 400);
      }
      return c.json({ success: true, message: "Password updated successfully." }, 200);
    }

    if (email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `http://localhost:5173/login.html`
      });
      if (error) {
        return c.json({ success: false, error: error.message }, 400);
      }
      return c.json({ success: true, message: "Password reset link sent to your email." }, 200);
    }

    return c.json({ success: false, error: "Email or User ID is required." }, 400);

  } catch (err: any) {
    console.error("[Auth API] Change password error:", err);
    return c.json({ success: false, error: err.message || "Failed to process password change." }, 500);
  }
});

export default authRoutes;
