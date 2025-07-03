document.addEventListener("DOMContentLoaded", () => {
  // === KUMPULKAN SEMUA ELEMEN PENTING DI ATAS ===
  const searchForm = document.getElementById("search-form");
  const searchInput = document.getElementById("search-input");
  const suggestionsBox = document.getElementById("suggestions-box");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebar-overlay");
  const openSidebarButton = document.getElementById("open-sidebar-button");
  const closeSidebarButton = document.getElementById("close-sidebar-button");
  const filterForm = document.getElementById("filter-form");
  const galleryItems = document.querySelectorAll(".gallery-item");
  let activeSuggestionIndex = -1;

  // === FUNGSI BANTU ===
  const isMobile = () => window.innerWidth < 768;

  // --- LOGIKA UNTUK TOGGLE VISIBILITY PANEL FILTER SECARA REAL-TIME ---
  const ratingToggle = document.getElementById("rating-toggle");
  const ratingOptions = document.getElementById("rating-options");
  const typeToggle = document.getElementById("type-toggle");
  const typeOptions = document.getElementById("type-options");

  if (ratingToggle && ratingOptions) {
    ratingToggle.addEventListener("change", () => {
      // Langsung toggle class 'hidden' saat checkbox berubah
      ratingOptions.classList.toggle("hidden", !ratingToggle.checked);
    });
  }

  if (typeToggle && typeOptions) {
    typeToggle.addEventListener("change", () => {
      // Langsung toggle class 'hidden' saat checkbox berubah
      typeOptions.classList.toggle("hidden", !typeToggle.checked);
    });
  }

  // === FUNGSI UTAMA UNTUK NAVIGASI PENCARIAN ===
  const navigateWithFilters = (userTypedTags = "", page = 1) => {
    const params = new URLSearchParams();
    let tagsToSearch = userTypedTags.trim().replace(/\s+/g, "_");
    const filters = JSON.parse(localStorage.getItem("cytusGalleryFilters"));
    let limit = 25;
    let lazyload = false;

    if (filters) {
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
      limit = filters.limit || 25;
      lazyload = filters.lazyloadToggle;
    }

    if (tagsToSearch) params.append("tags", tagsToSearch);
    params.append("limit", limit);
    if (page > 1) params.append("page", page);
    if (lazyload) params.append("lazyload", "true");
    
    const queryString = params.toString();
    window.location.href = queryString ? `/search?${queryString}` : "/";
  };

  // === FUNGSI UNTUK STATE MANAGEMENT FILTER (LOCALSTORAGE) ===
  const saveFilters = () => {
    if (!filterForm) return;
    const formData = new FormData(filterForm);
    const filters = {
      ratingToggle: document.getElementById("rating-toggle").checked,
      rating: formData.get("rating"),
      typeToggle: document.getElementById("type-toggle").checked,
      type: formData.get("type"),
      limit: document.getElementById("limit-input").value,
      autoplayToggle: document.getElementById("autoplay-toggle").checked,
      lazyloadToggle: document.getElementById("lazyload-toggle").checked,
    };
    localStorage.setItem("cytusGalleryFilters", JSON.stringify(filters));
  };

  const loadFilters = () => {
    if (!filterForm) return;
    const savedFilters = JSON.parse(
      localStorage.getItem("cytusGalleryFilters")
    );
    if (!savedFilters) return;

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
      if (savedFilters.type) {
        const typeInput = document.querySelector(
          `input[name="type"][value="${savedFilters.type}"]`
        );
        if (typeInput) typeInput.checked = true;
      }
    }

    document.getElementById("limit-input").value = savedFilters.limit || 25;

    document.body.className = document.body.className.replace(
      /\btheme-\S+/g,
      ""
    );
    if (savedFilters.ratingToggle && savedFilters.rating) {
      if (savedFilters.rating === "g")
        document.body.classList.add("theme-safe");
      if (savedFilters.rating === "not_e")
        document.body.classList.add("theme-moderate");
      if (savedFilters.rating === "not_g")
        document.body.classList.add("theme-explicit");
    }
    const autoplayToggle = document.getElementById("autoplay-toggle");
    if (autoplayToggle) {
      autoplayToggle.checked = savedFilters.autoplayToggle;
    }
    const lazyloadToggle = document.getElementById("lazyload-toggle");
    if (lazyloadToggle) {
      lazyloadToggle.checked = savedFilters.lazyloadToggle;
    }
  };

  // === FUNGSI UNTUK SIDEBAR ===
  const openSidebar = () => {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.remove("translate-x-full");
      sidebarOverlay.classList.remove("opacity-0", "pointer-events-none");
      document.body.classList.add("body-no-scroll");
    }
  };

  const closeSidebar = () => {
    if (sidebar && sidebarOverlay) {
      sidebar.classList.add("translate-x-full");
      sidebarOverlay.classList.add("opacity-0", "pointer-events-none");
      document.body.classList.remove("body-no-scroll");
    }
  };

  // === LOGIKA BARU UNTUK SWIPER SLIDER ===
  const swiper = new Swiper(".swiper", {
    // Opsi
    loop: true,
    slidesPerView: 2,
    spaceBetween: 10,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
      pauseOnMouseEnter: true,
    },
    // Breakpoints untuk layar lebih besar
    breakpoints: {
      640: {
        slidesPerView: 3,
        spaceBetween: 20,
      },
      1024: {
        slidesPerView: 5,
        spaceBetween: 20,
      },
    },
    // Tombol Navigasi
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
  });

  // === FUNGSI UNTUK AUTO-SUGGEST ===
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

  // === FUNGSI UNTUK INTERAKSI GALERI MOBILE ===
  const closeAllOverlays = () => {
    galleryItems.forEach((item) => {
      item.classList.remove("mobile-active");
    });
  };

  // === MEMASANG SEMUA EVENT LISTENER ===

  // 1. Listener untuk form filter dan searchbar
  if (filterForm) {
    filterForm.addEventListener("change", saveFilters);
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      navigateWithFilters(searchInput.value, 1);
    });
  }
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      navigateWithFilters(searchInput.value, 1);
    });
  }

  // 2. Listener untuk auto-suggest
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

  // 3. Listener untuk sidebar
  if (openSidebarButton)
    openSidebarButton.addEventListener("click", openSidebar);
  if (closeSidebarButton)
    closeSidebarButton.addEventListener("click", closeSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener("click", closeSidebar);

  // 4. Listener untuk interaksi galeri (GAMBAR & VIDEO)
  galleryItems.forEach((item) => {
    const mediaContainer = item.querySelector(".media-container");
    if (!mediaContainer) return;

    let videoElement = null;
    let loopTimeout = null;

    const playVideo = () => {
      // Hanya jalankan jika item adalah video
      if (item.dataset.isVideo !== "true") return;

      // Sembunyikan preview image
      const imgPreview = mediaContainer.querySelector("img");
      if (imgPreview) imgPreview.style.display = "none";

      // Buat atau tampilkan elemen video
      if (!videoElement) {
        videoElement = document.createElement("video");
        videoElement.src = item.dataset.videoUrl;
        videoElement.className = "w-full h-auto";
        videoElement.muted = true;
        videoElement.playsInline = true;
        mediaContainer.appendChild(videoElement);
      }
      videoElement.style.display = "block";

      videoElement.currentTime = 0;
      videoElement.play().catch((e) => console.error("Video play failed", e));

      // Fungsi untuk me-loop video di 5 detik awal
      const loopLogic = () => {
        if (videoElement.currentTime >= 5) {
          videoElement.currentTime = 0;
          videoElement.play().catch((e) => {});
        }
      };

      // Hapus listener lama sebelum menambahkan yang baru
      videoElement.removeEventListener("timeupdate", loopLogic);
      videoElement.addEventListener("timeupdate", loopLogic);

      // Hentikan loop interval lama jika ada
      clearInterval(loopTimeout);
    };

    const stopVideo = () => {
      if (!videoElement) return;

      videoElement.pause();
      clearInterval(loopTimeout);

      // Tampilkan kembali preview image dan sembunyikan video
      videoElement.style.display = "none";
      const imgPreview = mediaContainer.querySelector("img");
      if (imgPreview) imgPreview.style.display = "block";
    };

    // --- Event Listener untuk Desktop (HOVER) ---
    if (!isMobile()) {
      item.addEventListener("mouseenter", () => {
        const settings = JSON.parse(
          localStorage.getItem("cytusGalleryFilters")
        );
        if (settings && settings.autoplayToggle) {
          playVideo();
        }
      });
      item.addEventListener("mouseleave", stopVideo);
    }

    // --- Event Listener untuk Mobile (TAP) ---
    item.addEventListener("click", (e) => {
      if (!isMobile()) return;
      if (e.target.closest(".detail-button")) return;

      e.preventDefault();

      const isCurrentlyActive = item.classList.contains("mobile-active");

      // Selalu hentikan semua video dan tutup overlay lain
      galleryItems.forEach((otherItem) => {
        if (otherItem !== item) {
          otherItem.classList.remove("mobile-active");
          // Panggil fungsi stop untuk item lain
          const otherVideo = otherItem.querySelector("video");
          if (otherVideo) {
            otherVideo.pause();
            otherVideo.style.display = "none";
            const otherImg = otherItem.querySelector(".media-container img");
            if (otherImg) otherImg.style.display = "block";
          }
        }
      });

      // Toggle item yang diklik
      item.classList.toggle("mobile-active");

      // Mainkan atau hentikan video berdasarkan state baru
      if (item.classList.contains("mobile-active")) {
        playVideo();
      } else {
        stopVideo();
      }
    });
  });

  // 5. Listener global untuk mencegat klik dan menutup elemen
  document.addEventListener("click", (e) => {
    // Menutup suggestion box
    if (searchForm && !searchForm.contains(e.target)) {
      suggestionsBox.classList.add("hidden");
    }

    // Menutup overlay mobile
    if (isMobile() && !e.target.closest(".gallery-item")) {
      closeAllOverlays();
    }

    // Mencegat klik link untuk menerapkan filter
    const link = e.target.closest("a");
    if (!link) return;

    // Tambahkan ID 'pagination-nav' ke <nav> di pagination.ejs
    const isPaginationLink = link.closest("#pagination-nav");
    const isSuggestionLink = link.closest("#suggestions-box");
    // Tambahkan class 'tag-link' ke <a> tag di detail.ejs
    const isTagLinkOnDetailPage = link.classList.contains("tag-link");

    if (link.href.includes("/search") || link.href.includes("/?page=")) {
      if (isPaginationLink || isSuggestionLink || isTagLinkOnDetailPage) {
        e.preventDefault();
        const url = new URL(link.href);
        const tags = url.searchParams.get("tags") || "";
        const page = url.searchParams.get("page") || 1;
        const userTags = tags
          .split(" ")
          .filter(
            (tag) =>
              !tag.startsWith("rating:") &&
              !tag.startsWith("-rating:") &&
              !tag.startsWith("filetype:")
          )
          .join(" ");
        navigateWithFilters(userTags, page);
      }
    }
  });

  // === MEMANGGIL FUNGSI AWAL ===
  // Muat filter dari localStorage saat halaman pertama kali dibuka
  if (filterForm) {
    loadFilters();
  }
});
