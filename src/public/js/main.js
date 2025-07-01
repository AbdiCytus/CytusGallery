// src/public/js/main.js (SUDAH DIPERBARUI)
document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("suggestions-box");
  let activeSuggestionIndex = -1;

  const setActiveSuggestion = () => {
    const suggestions = suggestionsBox.querySelectorAll("a");
    suggestions.forEach((item, index) => {
      if (index === activeSuggestionIndex) {
        item.classList.add("bg-gray-700");
      } else {
        item.classList.remove("bg-gray-700");
      }
    });
  };

  searchInput.addEventListener("input", async () => {
    const term = searchInput.value;
    activeSuggestionIndex = -1; // Reset saat input berubah

    if (term.length < 2) {
      suggestionsBox.classList.add("hidden");
      return;
    }

    try {
      const response = await fetch(`/api/tagsuggest?term=${term}`);
      const tags = await response.json();
      suggestionsBox.innerHTML = "";

      if (tags.length > 0) {
        tags.forEach((tag) => {
          const suggestionItem = document.createElement("a");
          suggestionItem.href = `/search?tags=${tag.name}`;
          suggestionItem.className =
            "block px-4 py-2 hover:bg-gray-700 text-white rounded-md";
          const postCount = tag.post_count.toLocaleString("en-US");
          suggestionItem.innerHTML = `
                        <span>${tag.name}</span>
                        <span class="text-sm text-gray-400 float-right">${postCount}</span>
                    `;
          suggestionsBox.appendChild(suggestionItem);
        });
        suggestionsBox.classList.remove("hidden");
      } else {
        suggestionsBox.classList.add("hidden");
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    }
  });

  searchInput.addEventListener("keydown", (e) => {
    const suggestions = suggestionsBox.querySelectorAll("a");
    if (suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % suggestions.length;
      setActiveSuggestion();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex =
        (activeSuggestionIndex - 1 + suggestions.length) % suggestions.length;
      setActiveSuggestion();
    } else if (e.key === "Enter") {
      if (activeSuggestionIndex > -1) {
        e.preventDefault();
        suggestions[activeSuggestionIndex].click();
      }
    }
  });

  document.addEventListener("click", (e) => {
    if (!searchForm.contains(e.target)) {
      suggestionsBox.classList.add("hidden");
    }
  });

  // === Logika BARU untuk Interaksi Grid di Mobile ===
  // === Logika FINAL yang JAUH LEBIH SEDERHANA untuk Interaksi Grid ===
  const isMobile = () => window.innerWidth < 768;

  const galleryItems = document.querySelectorAll(".gallery-item");

  // Fungsi untuk menutup semua overlay yang aktif di mobile
  const closeAllOverlays = () => {
    galleryItems.forEach((item) => {
      item.classList.remove("mobile-active");
    });
  };

  galleryItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      // Jika BUKAN mobile, hentikan semua eksekusi JavaScript.
      // Biarkan browser menangani link HTML secara normal.
      if (!isMobile()) {
        return;
      }

      // Jika yang diklik adalah tombol detail, biarkan link <a>-nya bekerja
      if (e.target.closest(".detail-button")) {
        return;
      }

      // Untuk area lain di mobile, cegah navigasi default dan jalankan logika overlay
      e.preventDefault();

      // Jika item ini sudah aktif, tutup.
      if (item.classList.contains("mobile-active")) {
        closeAllOverlays();
      } else {
        // Jika item lain yang aktif, tutup dulu, baru buka yang ini.
        closeAllOverlays();
        item.classList.add("mobile-active");
      }
    });
  });

  // Event listener untuk menutup overlay jika mengklik di luar item manapun
  document.addEventListener("click", (e) => {
    // Jika bukan mobile atau yang diklik adalah bagian dari gallery item, jangan lakukan apa-apa
    if (!isMobile() || e.target.closest(".gallery-item")) {
      return;
    }
    // Jika klik di luar, tutup semua overlay
    closeAllOverlays();
  });
});
