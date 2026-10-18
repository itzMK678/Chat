import { useState } from "react";
import { UserRound, Camera, LockKeyhole, Save } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Setting = ({ user, setUser }) => {
  const [username, setUsername] = useState(user.username || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Image must be smaller than 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!username.trim()) {
      alert("Username is required.");
      return;
    }

    if (newPassword && !currentPassword) {
      alert("Enter your current password to change it.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/profile/${user._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            username: username.trim(),
            avatar,
            currentPassword,
            newPassword,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Could not update profile.");
        return;
      }

      setUser((previousUser) => ({
        ...previousUser,
        ...data.user,
      }));

      setCurrentPassword("");
      setNewPassword("");
      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Profile update failed:", error);
      alert("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 flex justify-center items-center">
      <form
        onSubmit={handleSave}
        className="bg-white w-full max-w-lg p-6 sm:p-8 rounded-2xl shadow-lg"
      >
        <h2 className="text-2xl font-bold mb-2">Profile Settings</h2>
        <p className="text-gray-500 text-sm mb-6">
          Update your personal information.
        </p>

        {/* Existing profile picture and new preview */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {avatar ? (
              <img
                src={avatar}
                alt="Profile preview"
                className="w-28 h-28 rounded-full object-cover border-4 border-purple-200"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center">
                <UserRound size={48} className="text-gray-500" />
              </div>
            )}

            <label
              htmlFor="profile-image"
              className="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full cursor-pointer"
              title="Change profile picture"
            >
              <Camera size={18} />
            </label>

            <input
              id="profile-image"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          <p className="mt-3 text-sm text-gray-500">
            Current picture / new preview
          </p>
        </div>

        {/* Username */}
        <label className="block font-medium mb-2">Username</label>
        <div className="flex items-center gap-2 border rounded-lg px-3 mb-5">
          <UserRound size={20} className="text-gray-400" />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 outline-none"
            placeholder="Enter username"
            required
          />
        </div>

        {/* Password settings */}
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <LockKeyhole size={19} />
          Change Password
        </h3>

        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="border rounded-lg p-3 w-full mb-3"
          placeholder="Current password"
          autoComplete="current-password"
        />

        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="border rounded-lg p-3 w-full mb-6"
          placeholder="New password (leave blank to keep current)"
          autoComplete="new-password"
          minLength={8}
        />

        <button
          type="submit"
          disabled={loading}
          className="flex justify-center items-center gap-2 w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-semibold p-3 rounded-lg"
        >
          <Save size={19} />
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
};

export default Setting;