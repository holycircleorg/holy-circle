// ===============================
// Bible Overlay Core
// ===============================

document.addEventListener("DOMContentLoaded", () => {
  const bibleOverlay = document.getElementById("bibleOverlay");
  const openBtn = document.getElementById("openBible");
  const closeBtn = document.getElementById("closeBible");

  if (!bibleOverlay || !openBtn || !closeBtn) {
    console.warn("Bible overlay elements missing");
    return;
  }

  openBtn.addEventListener("click", () => {
    bibleOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  });

  closeBtn.addEventListener("click", () => {
    bibleOverlay.classList.remove("open");
    document.body.style.overflow = "";
  });
});

// ===============================
// Demo Bible Data (safe)
// ===============================

const BIBLE = {
  John: {
    3: {
      16: "For God so loved the world that he gave his one and only Son..."
    }
  }
};

const bookSelect = document.getElementById("bibleBook");
const chapterSelect = document.getElementById("bibleChapter");
const content = document.getElementById("bibleContent");

// Populate books
if (bookSelect) {
  Object.keys(BIBLE).forEach(book => {
    const opt = document.createElement("option");
    opt.value = book;
    opt.textContent = book;
    bookSelect.appendChild(opt);
  });
}

// Populate chapters
bookSelect?.addEventListener("change", () => {
  chapterSelect.innerHTML = "";
  Object.keys(BIBLE[bookSelect.value]).forEach(ch => {
    const opt = document.createElement("option");
    opt.value = ch;
    opt.textContent = `Chapter ${ch}`;
    chapterSelect.appendChild(opt);
  });
});

// Render verses
chapterSelect?.addEventListener("change", () => {
  const book = bookSelect.value;
  const chapter = chapterSelect.value;
  const verses = BIBLE[book][chapter];

  content.innerHTML = "";

  Object.entries(verses).forEach(([num, text]) => {
    const verseText = `${book} ${chapter}:${num} — ${text}`;

    const div = document.createElement("div");
    div.className = "bible-verse";
    div.innerHTML = `<strong>${num}</strong> ${text}`;

    div.addEventListener("click", () => {
      navigator.clipboard.writeText(verseText);
      div.classList.add("copied");
      setTimeout(() => div.classList.remove("copied"), 800);
    });

    // Insert button (members only)
    if (window.hcUser?.loggedIn) {
      const btn = document.createElement("button");
      btn.className = "insert-verse-btn";
      btn.textContent = "Insert";
      btn.onclick = (e) => {
        e.stopPropagation();
        insertVerseMarkdown(verseText);
      };
      div.appendChild(btn);
    }

    content.appendChild(div);
  });
});

// ===============================
// Helpers
// ===============================

function insertVerseMarkdown(text) {
  const field =
    document.querySelector("textarea:focus") ||
    document.getElementById("threadBody") ||
    document.getElementById("replyBody");

  if (!field) return;

  field.value += `\n\n> ${text}`;
  field.focus();
}
