(async function enforceAdminAccess() {
  try {
    const res = await fetch("/api/admin/me", {
      credentials: "include",
    });

    if (!res.ok) throw new Error("Not authorized");

    const data = await res.json();
    if (!data.success) throw new Error("Not admin");

    // Optional: expose admin identity globally
    window.hcAdmin = data.admin;
  } catch (err) {
    console.warn("Admin access denied:", err);
    window.location.href = "/login.html";
  }
})();


const API_BASE = "http://localhost:4000/api";

const usersTableBody = document.getElementById("usersTableBody");
const usersEmptyState = document.getElementById("usersEmptyState");

const userModal = document.getElementById("userModal");
const userForm = document.getElementById("userForm");

const openCreateBtn = document.getElementById("openCreateUser");
const closeUserModalBtn = document.getElementById("closeUserModal");

const modalTitle = document.getElementById("userModalTitle");
const editUserId = document.getElementById("editUserId");
const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const userRole = document.getElementById("userRole");
const userPassword = document.getElementById("userPassword");
const userPasswordLabel = document.getElementById("userPasswordLabel");

/* LOAD USERS */
async function loadUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, {
    credentials: "include"
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Error loading users:", data.error);
    return;
  }

  const users = data.users;

  usersTableBody.innerHTML = "";

  if (users.length === 0) {
    usersEmptyState.classList.remove("hidden");
    return;
  }

  usersEmptyState.classList.add("hidden");

  users.forEach((u) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.name}</td>
      <td>${u.email}</td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td>
        ${
          u.twofa_enabled
            ? '<span class="twofa-enabled">Enabled</span>'
            : '<span class="twofa-disabled">Disabled</span>'
        }
      </td>
      <td>${new Date(u.created_at).toLocaleDateString()}</td>

      <td>
        <button onclick="editUser(${u.id})" class="secondary-btn small-btn">
          Edit
        </button>
        <button onclick="deleteUser(${u.id})" class="secondary-btn small-btn danger">
          Delete
        </button>
      </td>
    `;

    usersTableBody.appendChild(tr);
  });
}

/* OPEN CREATE USER MODAL */
openCreateBtn.onclick = () => {
  editUserId.value = "";
  modalTitle.textContent = "Create New User";

  userName.value = "";
  userEmail.value = "";
  userRole.value = "admin";
  userPassword.value = "";
  userPasswordLabel.style.display = "block";

  userModal.classList.add("active");
};

/* CLOSE MODAL */
closeUserModalBtn.onclick = () => userModal.classList.remove("active");

/* EDIT USER */
async function editUser(id) {
  const res = await fetch(`${API_BASE}/admin/users/${id}`, {
    credentials: "include",
  });

  const data = await res.json();

  editUserId.value = id;
  modalTitle.textContent = "Edit User";

  userName.value = data.user.name;
  userEmail.value = data.user.email;
  userRole.value = data.user.role;

  // hide password field unless editing password
  userPasswordLabel.style.display = "none";
  userPassword.value = "";

  userModal.classList.add("active");
}

/* DELETE USER */
async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;

  const res = await fetch(`${API_BASE}/admin/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });

  await loadUsers();
}

/* CREATE / UPDATE USER */
userForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    name: userName.value,
    email: userEmail.value,
    role: userRole.value,
    password: userPassword.value || null,
  };

  let res;

  if (editUserId.value) {
    // Update user
    res = await fetch(`${API_BASE}/admin/users/${editUserId.value}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } else {
    // Create user
    res = await fetch(`${API_BASE}/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  }

  userModal.classList.remove("active");
  await loadUsers();
});

/* INIT */
loadUsers();
