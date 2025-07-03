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

  document.addEventListener("click", (e) => {
    if (!searchForm.contains(e.target)) {
      suggestionsBox.classList.add("hidden");
    }
  });

  if (searchInput) {
    searchInput.addEventListener("input", async () => {
      const term = searchInput.value;
      activeSuggestionIndex = -1;
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
            suggestionItem.innerHTML = `<span>${tag.name}</span><span class="text-sm text-gray-400 float-right">${postCount}</span>`;
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
        activeSuggestionIndex =
          (activeSuggestionIndex + 1) % suggestions.length;
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
  }

  const isMobile = () => window.innerWidth < 768;
  const galleryItems = document.querySelectorAll(".gallery-item");

  const closeAllOverlays = () => {
    galleryItems.forEach((item) => {
      item.classList.remove("mobile-active");
    });
  };

  galleryItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      if (!isMobile()) return;
      const isCurrentlyActive = item.classList.contains("mobile-active");
      if (e.target.closest(".detail-button") && isCurrentlyActive) return;

      closeAllOverlays();
      e.preventDefault();

      if (!isCurrentlyActive) {
        console.log("activate");
        item.classList.add("mobile-active");
      } else {
        console.log("close");
        closeAllOverlays();
      }
    });
  });

  document.addEventListener("click", (e) => {
    if (!isMobile() || e.target.closest(".gallery-item")) {
      return;
    }
    closeAllOverlays();
  });

  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const openSidebarButton = document.getElementById("open-sidebar-button");
  const closeSidebarButton = document.getElementById("close-sidebar-button");
  const filterForm = document.getElementById("filter-form");

  const openSidebar = () => {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.remove("translate-x-full");
      sidebarOverlay.classList.remove("opacity-0", "pointer-events-none");
      document.body.classList.add("body-no-scroll"); // <-- TAMBAHKAN INI
    }
  };

  const closeSidebar = () => {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.add("translate-x-full");
      sidebarOverlay.classList.add("opacity-0", "pointer-events-none");
      document.body.classList.remove("body-no-scroll"); // <-- TAMBAHKAN INI
    }
  };

  if (openSidebarButton) {
    openSidebarButton.addEventListener("click", openSidebar);
  }
  // Referensi ke tombol desktop sudah tidak diperlukan lagi
  if (closeSidebarButton) {
    closeSidebarButton.addEventListener("click", closeSidebar);
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", closeSidebar);
  }

  const ratingToggle = document.getElementById("rating-toggle");
  const ratingOptions = document.getElementById("rating-options");
  const typeToggle = document.getElementById("type-toggle");
  const typeOptions = document.getElementById("type-options");

  // Menampilkan/menyembunyikan panel filter rating
  if (ratingToggle && ratingOptions) {
    ratingToggle.addEventListener("change", () => {
      ratingOptions.classList.toggle("hidden", !ratingToggle.checked);
    });
  }

  // Menampilkan/menyembunyikan panel filter tipe
  if (typeToggle && typeOptions) {
    typeToggle.addEventListener("change", () => {
      typeOptions.classList.toggle("hidden", !typeToggle.checked);
    });
  }

  // --- Fungsi untuk State Management Filter ---
  const saveFilters = () => {
    const formData = new FormData(filterForm);
    const filters = {
      ratingToggle: document.getElementById("rating-toggle").checked,
      rating: formData.get("rating"),
      typeToggle: document.getElementById("type-toggle").checked,
      type: formData.get("type"), // getAll untuk checkbox
      limit: document.getElementById("limit-input").value,
    };
    localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
  };

  const loadFilters = () => {
    const savedFilters = JSON.parse(
      localStorage.getItem("cytusGalleryFilters")
    );
    if (!savedFilters) return;

    // Terapkan state ke UI
    const ratingToggle = document.getElementById("rating-toggle");
    if (ratingToggle) {
      ratingToggle.checked = savedFilters.ratingToggle;
      document
        .getElementById("rating-options")
        .classList.toggle("hidden", !savedFilters.ratingToggle);
      if (savedFilters.rating) {
        const ratingInput = document.querySelector(
          `input[name="rating"][value="${savedFilters.rating}"]`
        );
        if (ratingInput) ratingInput.checked = true;
      }
    }

    const typeToggle = document.getElementById("type-toggle");
    if (typeToggle) {
      typeToggle.checked = savedFilters.typeToggle;
      document
        .getElementById("type-options")
        .classList.toggle("hidden", !savedFilters.typeToggle);
      // Logika disederhanakan untuk radio button
      if (savedFilters.type) {
        const typeInput = document.querySelector(
          `input[name="type"][value="${savedFilters.type}"]`
        );
        if (typeInput) typeInput.checked = true;
      }
    }

    document.getElementById("limit-input").value = savedFilters.limit || 25;

    // Terapkan warna background sesuai filter rating yang tersimpan
    document.body.className = document.body.className.replace(
      /\btheme-\S+/g,
      ""
    );
    if (savedFilters.ratingToggle) {
      if (savedFilters.rating === "g")
        document.body.classList.add("theme-safe");
      if (savedFilters.rating === "not_e")
        document.body.classList.add("theme-moderate");
      if (savedFilters.rating === "not_g")
        document.body.classList.add("theme-explicit");
    }
  };

  // --- Event Listener untuk Form ---
  if (filterForm) {
    // Simpan setiap kali ada perubahan di form
    filterForm.addEventListener("change", saveFilters);

    // Logika saat form di-submit
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      saveFilters(); // Pastikan state terakhir tersimpan

      const params = new URLSearchParams();
      const mainSearchInput = document.getElementById("search-input");
      let tagsToSearch = mainSearchInput.value.trim().replace(/\s+/g, "_");

      const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
      if (filters) {
        // Bangun tag filter dari state yang tersimpan
        if (
          filters.ratingToggle &&
          filters.rating &&
          filters.rating !== "all"
        ) {
          // Gunakan sintaks -rating:g dan -rating:e
          let ratingTag =
            filters.rating === "not_g"
              ? "-rating:g"
              : filters.rating === "not_e"
              ? "-rating:e"
              : `rating:${filters.rating}`;
          tagsToSearch = tagsToSearch
            ? `${tagsToSearch} ${ratingTag}`
            : ratingTag;
        }

        if (filters.typeToggle && filters.type) {
          const typeTag = `filetype:${filters.type.join(",")}`;
          tagsToSearch = tagsToSearch ? `${tagsToSearch} ${typeTag}` : typeTag;
        }

        params.append("limit", filters.limit);
      }

      if (tagsToSearch) {
        params.append("tags", tagsToSearch);
      }

      window.location.href = `/search?${params.toString()}`;
    });
  }

  const handleFormSubmit = (event) => {
    event.preventDefault();
    saveFilters(); // Selalu simpan state terakhir sebelum submit

    const params = new URLSearchParams();
    const mainSearchInput = document.getElementById("search-input");
    let tagsToSearch = mainSearchInput.value.trim().replace(/\s+/g, "_");

    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));

    if (filters) {
      // Proses Filter Rating
      if (filters.ratingToggle && filters.rating && filters.rating !== "all") {
        let ratingTag =
          filters.rating === "not_g"
            ? "-rating:g"
            : filters.rating === "not_e"
            ? "-rating:e"
            : `rating:${filters.rating}`;
        tagsToSearch = tagsToSearch
          ? `${tagsToSearch} ${ratingTag}`
          : ratingTag;
      }

      // Proses Filter Tipe (DIPERBAIKI)
      if (filters.typeToggle && filters.type) {
        let typeTag = "";
        if (filters.type === "image") {
          typeTag = "filetype:jpg,jpeg,png,webp,gif,avif";
        } else if (filters.type === "video") {
          typeTag = "filetype:mp4,webm";
        }
        if (typeTag) {
          tagsToSearch = tagsToSearch ? `${tagsToSearch} ${typeTag}` : typeTag;
        }
      }

      params.append("limit", filters.limit || 25);
    } else {
      params.append("limit", "25");
    }

    if (tagsToSearch) {
      params.append("tags", tagsToSearch);
    }

    window.location.href = `/search?${params.toString()}`;
  };

  // Terapkan listener ke kedua form
  if (filterForm) {
    filterForm.addEventListener("change", saveFilters);
    filterForm.addEventListener("submit", handleFormSubmit);
  }
  if (searchForm) {
    searchForm.addEventListener("submit", handleFormSubmit);
  }

  // Muat filter saat halaman pertama kali dibuka
  loadFilters();
});
