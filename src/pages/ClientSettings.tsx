import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ClientLayout from "../components/ClientLayout";

type ProfileData = {
  full_name: string;
  client_id: string;
  avatar_url: string | null;
};

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);

  if (parts.length === 0) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function ClientSettings() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);

  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(
    null
  );
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadSettings();

    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, []);

  async function loadSettings() {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      navigate("/", { replace: true });
      return;
    }

    setCurrentUserId(user.id);

    const { count: unreadCount, error: unreadError } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_user_id", user.id)
      .eq("receiver_user_id", user.id)
      .is("read_at", null);

    if (unreadError) {
      console.error(unreadError);
    } else {
      setUnreadMessages(unreadCount || 0);
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, client_id, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(profileError);
      setErrorMessage("Could not load your settings.");
      setLoading(false);
      return;
    }

    setProfile((profileData || null) as ProfileData | null);
    setLoading(false);
  }

  function handleAvatarFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    setSuccessMessage("");
    setErrorMessage("");

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Please choose an image smaller than 5MB.");
      return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setSelectedAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  }

  async function handleUploadAvatar() {
    if (!selectedAvatarFile) {
      setErrorMessage("Choose a photo first.");
      return;
    }

    if (!currentUserId) {
      setErrorMessage("You must be logged in to update your profile photo.");
      return;
    }

    setUploadingAvatar(true);
    setSuccessMessage("");
    setErrorMessage("");

    const fileExtension =
      selectedAvatarFile.name.split(".").pop()?.toLowerCase() || "jpg";

    const filePath = `${currentUserId}/avatar-${Date.now()}.${fileExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, selectedAvatarFile, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error(uploadError);
      setErrorMessage(
        "Could not upload profile photo. Make sure the avatars bucket exists and is public."
      );
      setUploadingAvatar(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
      })
      .eq("id", currentUserId);

    if (updateError) {
      console.error(updateError);
      setErrorMessage("Photo uploaded, but your profile could not be updated.");
      setUploadingAvatar(false);
      return;
    }

    setProfile((currentProfile) =>
      currentProfile
        ? {
            ...currentProfile,
            avatar_url: publicUrl,
          }
        : currentProfile
    );

    setSelectedAvatarFile(null);

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl("");
    }

    setSuccessMessage("Profile photo updated successfully.");
    setUploadingAvatar(false);
  }

  async function handleRemoveAvatar() {
    if (!currentUserId) return;

    const confirmed = window.confirm("Remove your profile photo?");

    if (!confirmed) return;

    setUploadingAvatar(true);
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: null,
      })
      .eq("id", currentUserId);

    if (error) {
      console.error(error);
      setErrorMessage("Could not remove profile photo.");
      setUploadingAvatar(false);
      return;
    }

    setProfile((currentProfile) =>
      currentProfile
        ? {
            ...currentProfile,
            avatar_url: null,
          }
        : currentProfile
    );

    setSelectedAvatarFile(null);

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl("");
    }

    setSuccessMessage("Profile photo removed.");
    setUploadingAvatar(false);
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();

    setSuccessMessage("");
    setErrorMessage("");

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Please fill in both password fields.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("Password updated successfully.");
    setNewPassword("");
    setConfirmPassword("");

    setTimeout(() => {
      navigate("/client");
    }, 1500);
  }

  if (loading) {
    return (
      <ClientLayout unreadMessages={unreadMessages}>
        <section className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:rounded-[2rem] sm:p-8">
          <p className="text-sm font-semibold text-slate-600">
            Loading settings...
          </p>
        </section>
      </ClientLayout>
    );
  }

  const displayAvatarUrl = avatarPreviewUrl || profile?.avatar_url || "";
  const displayName = profile?.full_name || "Client";

  return (
    <ClientLayout unreadMessages={unreadMessages}>
      <section className="overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-sm sm:rounded-[2rem]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-4 py-5 text-white sm:px-6 sm:py-8 md:px-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-100 sm:text-sm sm:tracking-[0.3em]">
            Client Settings
          </p>

          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:mt-3 sm:text-4xl">
            Account Settings
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50 sm:mt-3 sm:text-base">
            Manage your profile photo, password, and account access.
          </p>
        </div>

        <div className="space-y-5 p-4 sm:p-6 md:p-8">
          {successMessage && (
            <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 sm:rounded-3xl sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[2rem] border border-white bg-blue-600 text-2xl font-black text-white shadow-sm ring-4 ring-white">
                  {displayAvatarUrl ? (
                    <img
                      src={displayAvatarUrl}
                      alt={`${displayName} profile`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(displayName)
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                    Profile Photo
                  </p>

                  <h2 className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    {displayName}
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    This photo will appear on your dashboard.
                  </p>
                </div>
              </div>

              {profile?.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm font-black text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Remove Photo
                </button>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-sky-100 bg-white p-4">
              <label className="block text-sm font-black text-slate-700">
                Choose New Photo
              </label>

              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                disabled={uploadingAvatar}
                className="mt-2 w-full rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-slate-700 file:mr-4 file:rounded-xl file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-black file:text-white disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                Use a clear square photo if possible. Maximum size: 5MB.
              </p>

              <button
                type="button"
                onClick={handleUploadAvatar}
                disabled={uploadingAvatar || !selectedAvatarFile}
                className="mt-4 w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 sm:w-auto"
              >
                {uploadingAvatar ? "Uploading Photo..." : "Save Profile Photo"}
              </button>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-sky-100 bg-sky-50 p-4 sm:rounded-3xl sm:p-6">
            <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
              Change Password
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Use this page to replace your temporary password with a new
              password you can remember.
            </p>

            <form onSubmit={handleChangePassword} className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-black text-slate-700">
                  New Password
                </label>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-2 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-700">
                  Confirm New Password
                </label>

                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-2 w-full rounded-2xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? "Updating Password..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </ClientLayout>
  );
}