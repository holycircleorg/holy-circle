

async function initCommunityPage() {

  const params = new URLSearchParams(location.search);
  const communityId = Number(params.get("id"));
  if (!communityId) return;

  window.__ACTIVE_COMMUNITY_ID = communityId;
  window.joinCommunityRoomSafe?.(communityId);
  
// 🔍 Enable forum search inside community page
if (typeof window.initForumSearch === "function") {
  window.initForumSearch({
    communityId
  });
}


  window.addEventListener("beforeunload", () => {
  window.leaveCommunityRoom?.(communityId);

});

  const contentFail = (msg = "Community not found.") => {
    const main =
      document.querySelector(".forum-content") ||
      document.querySelector("main") ||
      document.body;

    const content = document.querySelector(".forum-content");
      if (content) {
      content.innerHTML = `<p style="padding:2rem">${msg}</p>`;
}

  };

  try {
    // ✅ Use global API helper
const data = await window.hcForumApiGet(`/communities/${communityId}`);

const community = data.community;

window.__COMMUNITY = community;
window.IS_COMMUNITY_MODERATOR =
  !!community.viewer_is_mod || !!community.viewer_is_owner;


    if (!data || !data.community) {
      contentFail();
      return;
    }

   


// ==============================
// Load community rules
// ==============================
async function loadCommunityRules() {
  const card = document.getElementById("communityRulesCard");
  const list = document.getElementById("communityRules");
  if (!card || !list) return;

  try {
    const data = await window.hcForumApiGet(
      `/communities/${window.__ACTIVE_COMMUNITY_ID}/rules`
    );

    window.__COMMUNITY_RULES = data.rules || [];

    // Reset UI
    card.innerHTML = `<h3>Rules</h3>`;
    list.innerHTML = "";

    // ✅ ADD BUTTON (ONLY HERE, ONLY ONCE)
    if (window.IS_COMMUNITY_MODERATOR === true) {
      const btn = document.createElement("button");
      btn.className = "btn btn-gold add-rule-btn";
      btn.textContent = "+ Add Rule";
      btn.onclick = openRuleModal;
      card.appendChild(btn);
    }

    if (!window.__COMMUNITY_RULES.length) {
      list.innerHTML = `<div class="muted">No rules yet.</div>`;
      return;
    }

    list.innerHTML = `
      <ol class="community-rules">
        ${window.__COMMUNITY_RULES.map(r => `
          <li>
            <strong>${r.title}</strong>
            ${r.body ? `<div class="muted">${r.body}</div>` : ""}
          </li>
        `).join("")}
      </ol>
    `;
  } catch (err) {
    console.error("Failed to load rules:", err);
    list.innerHTML = `<div class="muted">Failed to load rules.</div>`;
  }
}






    await loadCommunityRules();

// ==============================
// Community right sidebar card
// ==============================
document.getElementById("communityCardTitle").textContent = community.name;
document.getElementById("communityCardDesc").textContent =
  community.description || "";

document.querySelectorAll(".member-count").forEach(el => {
  el.textContent = Number(community.member_count || 0).toLocaleString();
});

document.querySelectorAll(".thread-count").forEach(el => {
  el.textContent = Number(community.thread_count || 0).toLocaleString();
});



    if (window.loadTrendingThreads) {
      window.loadTrendingThreads();
    }


    // ==============================
    // Join / Leave button
    // ==============================
const joinBtn = document.getElementById("joinCommunityBtn");

if (joinBtn) {
  window.attachJoinCommunityHandler({
    button: joinBtn,
    communityId: community.id,
    initiallyJoined: community.viewer_joined,
onChange: async () => {
  await window.refreshActiveCommunityStats?.();
}

  });
}

 // ==============================
 // Rule modal logic
 // ==============================
let editingRuleId = null;

function openRuleModal(rule = null) {
  editingRuleId = rule?.id || null;

  document.getElementById("ruleModalTitle").textContent =
    editingRuleId ? "Edit Rule" : "New Rule";

  document.getElementById("ruleTitleInput").value = rule?.title || "";
  document.getElementById("ruleBodyInput").value = rule?.body || "";

  document.getElementById("ruleModal").classList.remove("hidden");
}

document.getElementById("cancelRuleBtn").onclick = () => {
  document.getElementById("ruleModal").classList.add("hidden");
};

document.getElementById("saveRuleBtn").onclick = async () => {
  const title = document.getElementById("ruleTitleInput").value.trim();
  const body = document.getElementById("ruleBodyInput").value.trim();

  if (!title) return alert("Title required");

  if (editingRuleId) {
    await window.hcForumApiPut(
      `/communities/${window.__ACTIVE_COMMUNITY_ID}/rules/${editingRuleId}`,
      { title, body }
    );
  } else {
    await window.hcForumApiPost(
      `/communities/${window.__ACTIVE_COMMUNITY_ID}/rules`,
      { title, body }
    );
  }

  location.reload();
};

  // ==============================
    // Rule edit / delete buttons
    // ==============================

document.addEventListener("click", (e) => {
  const editId = e.target.dataset.editRule;
  const deleteId = e.target.dataset.deleteRule;

  if (editId) {
    const rule = window.__COMMUNITY_RULES.find(r => r.id == editId);
    if (rule) openRuleModal(rule);
  }

  if (deleteId) {
    if (!confirm("Delete this rule?")) return;

    window.hcForumApiDelete(
      `/communities/${window.__ACTIVE_COMMUNITY_ID}/rules/${deleteId}`
    ).then(() => location.reload());
  }
});



    // ==============================
    // Create thread button
    // ==============================
   const newBtn = document.getElementById("createThreadBtn");
if (newBtn) {
  newBtn.href = `/new-thread.html?community_id=${communityId}`;
}

document.getElementById("communityTitle").textContent = community.name;
document.title = `${community.name} • Holy Circle Forum`;
document.getElementById("communityDesc").textContent = community.description;


    // ==============================
    // Load threads (community-scoped)
    // ==============================
    if (window.loadThreads) {
      await window.loadThreads({ communityId });
    }

  } catch (err) {
    console.error("Community page failed:", err);
    contentFail();
  }
 };

if (window.bootPage) {
  window.bootPage(initCommunityPage);
} else {
  initCommunityPage();
}

