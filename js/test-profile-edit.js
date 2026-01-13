const liveAvatarPreview = document.getElementById("liveAvatarPreview");
const livePreviewName = document.getElementById("livePreviewName");


async function loadMyProfile() {
  const res = await fetch("/api/members/me/profile", {
    credentials: "include",
  });

  const data = await res.json();
  if (!res.ok) return;

  document.getElementById("firstName").value = data.first_name || "";
  document.getElementById("lastName").value = data.last_name || "";
  document.getElementById("testimony").value = data.testimony || "";
  document.getElementById("favoriteVerse").value = data.favorite_verse || "";
  document.getElementById("favoriteVerseRef").value = data.favorite_verse_ref || "";
  document.getElementById("profileVisibility").value =
    data.profile_visibility || "public";
}

const avatarInput = document.getElementById("avatarInput");
const avatarPreview = document.getElementById("avatarPreview");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");

// Open file picker
if (changeAvatarBtn) {
  changeAvatarBtn.addEventListener("click", () => {
    avatarInput.click();
  });
}


function updateNamePreview() {
  const first = document.getElementById("firstName")?.value || "";
  const last = document.getElementById("lastName")?.value || "";
  livePreviewName.textContent =
    `${first} ${last}`.trim() || "Your Name";
}

["firstName", "lastName"].forEach((id) => {
  const input = document.getElementById(id);
  if (input) input.addEventListener("input", updateNamePreview);
});

let cropper;

avatarInput.addEventListener("change", () => {
  const file = avatarInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    avatarPreview.src = reader.result;

    if (cropper) cropper.destroy();

    cropper = new Cropper(avatarPreview, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1,
      responsive: true,

      crop() {
        const canvas = cropper.getCroppedCanvas({
          width: 200,
          height: 200,
        });

        // 🔥 LIVE PREVIEW UPDATE
        liveAvatarPreview.src = canvas.toDataURL("image/jpeg", 0.9);
      },
    });
  };

  reader.readAsDataURL(file);
});

async function uploadCroppedAvatar() {
  if (!cropper) return;

  const canvas = cropper.getCroppedCanvas({
    width: 400,
    height: 400,
  });

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9)
  );

  const formData = new FormData();
  formData.append("avatar", blob,"avatar.jpg");

  const res = await fetch("/api/members/me/avatar", {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) return alert("Upload failed");

  // Tell the whole app the profile changed
window.dispatchEvent(
  new CustomEvent("hc:profile-update", {
    detail: {
      avatar_url: data.avatar_url,
    },
  })
);
  // UPDATE LIVE PREVIEW
  avatarPreview.src = data.avatar_url;
  window.applyAvatarEverywhere?.(data.avatar_url);

  // RETURN THE URL so the caller can use it
  return data.avatar_url;

}


async function loadAvatarPreview() {
  const res = await fetch("/api/members/me/profile", {
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) return;

  if (data.avatar_url) {
    liveAvatarPreview.src = data.avatar_url;
  }

  updateNamePreview();
}

document.addEventListener("DOMContentLoaded", loadAvatarPreview);






document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("editProfileForm");
  if (!form) return;



  form.addEventListener("submit", async (e) => {
    e.preventDefault();
   
  // ✅ SAVE CROPPED AVATAR FIRST (if exists)
  let uploadedAvatarUrl = null;

  if (cropper) {
    uploadedAvatarUrl = await uploadCroppedAvatar();
  }


    const payload = {
      first_name: document.getElementById("firstName").value.trim(),
      last_name: document.getElementById("lastName").value.trim(),
      testimony: document.getElementById("testimony").value.trim(),
      favorite_verse: document.getElementById("favoriteVerse").value.trim(),
      favorite_verse_ref: document.getElementById("favoriteVerseRef").value.trim(),
      profile_visibility: document.getElementById("profileVisibility").value,
    };

    const statusEl = document.getElementById("formStatus");
    statusEl.textContent = "Saving...";

    const res = await fetch("/api/members/me/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
    statusEl.textContent = "Save failed";
    return;
  }





   statusEl.textContent = "Saved! Redirecting…";

// Update profile avatar immediately if profile page is open


   
setTimeout(() => {
  window.location.href = "/test-profile.html";
}, 700);


 });
});


document.addEventListener("DOMContentLoaded", loadMyProfile);
